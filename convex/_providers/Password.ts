/**
 * Adapted from @convex-dev/auth 0.0.95, src/providers/Password.ts (Apache-2.0).
 * Modifications: normalized/validated email, persistent pre-verification lockout,
 * unknown-account failure tracking and timing work, generic credential errors,
 * reset anti-enumeration, and the application's password policy.
 */
import {
  ConvexCredentials,
  type ConvexCredentialsUserConfig,
} from "@convex-dev/auth/providers/ConvexCredentials";
import {
  type AuthProviderConfig,
  type EmailConfig,
  type GenericActionCtxWithAuthConfig,
  type GenericDoc,
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import type {
  DocumentByName,
  GenericDataModel,
  WithoutSystemFields,
} from "convex/server";
import type { Value } from "convex/values";
import { Scrypt } from "lucia";

export const PASSWORD_PROVIDER = "password";
export const GENERIC_AUTH_ERROR = "Email or password is incorrect";
export const PASSWORD_POLICY_ERROR =
  "Password must be 8-72 characters";

type PasswordProfile<DataModel extends GenericDataModel> = (
  params: Record<string, Value | undefined>,
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
) => WithoutSystemFields<DocumentByName<DataModel, "users">> & { email: string };

export interface PasswordConfig<DataModel extends GenericDataModel> {
  id?: string;
  profile?: PasswordProfile<DataModel>;
  validatePasswordRequirements?: (password: string) => void;
  crypto?: ConvexCredentialsUserConfig["crypto"];
  // Narrowed from upstream's `EmailConfig | ((...args: any) => EmailConfig)`:
  // this application always passes materialized configs.
  reset?: EmailConfig;
  verify?: EmailConfig;
}

function normalizeAndValidateEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error(GENERIC_AUTH_ERROR);
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error(GENERIC_AUTH_ERROR);
  }
  return email;
}

export function validatePasswordRequirements(password: string): void {
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    throw new Error(PASSWORD_POLICY_ERROR);
  }
}

const dummyHash = new Scrypt().hash("timing-only-invalid-account-password");

async function runLockoutMutation<T>(
  ctx: GenericActionCtxWithAuthConfig<GenericDataModel>,
  name: "check" | "recordFailure" | "clear" | "consumeCodeRequest",
  args: Record<string, Value>,
): Promise<T> {
  return await ctx.runMutation(`authLockout:${name}` as never, args as never) as T;
}

/**
 * Throttles outbound one-time codes. A denial is reported as "not allowed"
 * rather than thrown, because callers must respond as if the mail was sent.
 */
async function mayRequestCode(
  ctx: GenericActionCtxWithAuthConfig<GenericDataModel>,
  purpose: "reset" | "verify",
  email: string,
): Promise<boolean> {
  const result = await runLockoutMutation<{ allowed: boolean }>(
    ctx,
    "consumeCodeRequest",
    { key: `${purpose}:${email}`, now: Date.now() },
  );
  return result.allowed;
}

async function genericCredentialFailure(
  ctx: GenericActionCtxWithAuthConfig<GenericDataModel>,
  email: string,
  error?: unknown,
): Promise<never> {
  if (error instanceof Error && error.message.includes("InvalidAccountId")) {
    await new Scrypt().verify(await dummyHash, "timing-only-invalid-account-password");
  }
  await runLockoutMutation(ctx, "recordFailure", { email, now: Date.now() });
  throw new Error(GENERIC_AUTH_ERROR);
}

export function Password<DataModel extends GenericDataModel>(
  config: PasswordConfig<DataModel> = {},
) {
  const provider = config.id ?? PASSWORD_PROVIDER;
  return ConvexCredentials<DataModel>({
    id: provider,
    authorize: async (params, rawCtx) => {
      const ctx = rawCtx as GenericActionCtxWithAuthConfig<GenericDataModel>;
      const flow = params.flow;
      const email = normalizeAndValidateEmail(params.email);
      params.email = email;

      const passwordToValidate =
        flow === "signUp"
          ? params.password
          : flow === "reset-verification"
            ? params.newPassword
            : undefined;
      if (passwordToValidate !== undefined) {
        (config.validatePasswordRequirements ?? validatePasswordRequirements)(
          passwordToValidate as string,
        );
      }

      const profile = config.profile?.(params, rawCtx) ?? {
        email,
        ...(typeof params.name === "string" ? { name: params.name.trim() } : {}),
      };
      profile.email = email;

      let account: GenericDoc<DataModel, "authAccounts">;
      let user: GenericDoc<DataModel, "users">;

      if (flow === "signUp") {
        if (typeof params.password !== "string") {
          throw new Error(PASSWORD_POLICY_ERROR);
        }
        try {
          ({ account, user } = await createAccount(rawCtx, {
            provider,
            account: { id: email, secret: params.password },
            profile: profile as never,
            shouldLinkViaEmail: config.verify !== undefined,
            shouldLinkViaPhone: false,
          }));
        } catch {
          throw new Error(GENERIC_AUTH_ERROR);
        }
        if (typeof params.username === "string") {
          await ctx.runMutation("profiles:claimSignupUsername" as never, {
            authUserId: user._id,
            username: params.username,
            displayName: typeof params.name === "string" ? params.name : undefined,
          } as never);
        }
      } else if (flow === "signIn") {
        if (typeof params.password !== "string") {
          throw new Error(GENERIC_AUTH_ERROR);
        }
        const lockout = await runLockoutMutation<{ locked: boolean }>(
          ctx,
          "check",
          { email, now: Date.now() },
        );
        if (lockout.locked) throw new Error(GENERIC_AUTH_ERROR);
        try {
          ({ account, user } = await retrieveAccount(rawCtx, {
            provider,
            account: { id: email, secret: params.password },
          }));
          if (account === undefined || user === undefined) {
            return await genericCredentialFailure(ctx, email);
          }
        } catch (error) {
          return await genericCredentialFailure(ctx, email, error);
        }
        await runLockoutMutation(ctx, "clear", { email });
      } else if (flow === "reset") {
        if (!config.reset) throw new Error("Password reset is not enabled");
        if (!(await mayRequestCode(ctx, "reset", email))) return null;
        try {
          const retrieved = await retrieveAccount(rawCtx, {
            provider,
            account: { id: email },
          });
          if (retrieved === null) return null;
          return await signInViaProvider(rawCtx, config.reset as AuthProviderConfig, {
            accountId: retrieved.account._id,
            params,
          });
        } catch {
          // The observable reset-request result is identical for unknown accounts.
          return null;
        }
      } else if (flow === "reset-verification") {
        if (!config.reset) throw new Error("Password reset is not enabled");
        if (typeof params.newPassword !== "string") {
          throw new Error(PASSWORD_POLICY_ERROR);
        }
        try {
          const { account: resetAccount } = await retrieveAccount(rawCtx, {
            provider,
            account: { id: email },
          });
          const result = await signInViaProvider(
            rawCtx,
            config.reset as AuthProviderConfig,
            { params },
          );
          if (result === null || resetAccount.userId !== result.userId) {
            throw new Error(GENERIC_AUTH_ERROR);
          }
          await modifyAccountCredentials(rawCtx, {
            provider,
            account: { id: email, secret: params.newPassword },
          });
          await invalidateSessions(rawCtx, {
            userId: result.userId,
            except: [result.sessionId],
          });
          return result;
        } catch {
          throw new Error(GENERIC_AUTH_ERROR);
        }
      } else if (flow === "email-verification") {
        if (!config.verify) throw new Error("Email verification is not enabled");
        // Requesting a code must look identical for unknown addresses;
        // redeeming one may report failure, since a wrong code and an unknown
        // address produce the same generic error.
        const isRedeeming = params.code !== undefined;
        if (!isRedeeming && !(await mayRequestCode(ctx, "verify", email))) {
          return null;
        }
        try {
          const { account: verifyAccount } = await retrieveAccount(rawCtx, {
            provider,
            account: { id: email },
          });
          return await signInViaProvider(rawCtx, config.verify as AuthProviderConfig, {
            accountId: verifyAccount._id,
            params,
          });
        } catch {
          if (isRedeeming) throw new Error(GENERIC_AUTH_ERROR);
          return null;
        }
      } else {
        throw new Error("Invalid authentication flow");
      }

      if (config.verify && !account.emailVerified) {
        return await signInViaProvider(rawCtx, config.verify as AuthProviderConfig, {
          accountId: account._id,
          params,
        });
      }
      return { userId: user._id };
    },
    crypto: config.crypto ?? {
      hashSecret: (password) => new Scrypt().hash(password),
      verifySecret: (password, hash) => new Scrypt().verify(hash, password),
    },
    extraProviders: [config.reset, config.verify],
  });
}
