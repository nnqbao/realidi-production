import "server-only";

import { cookies } from "next/headers";
import {
  fetchAction,
  fetchMutation,
  fetchQuery,
} from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { convexUrl } from "./env";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function isLocalApp(): boolean {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  return origin.includes("localhost") || origin.includes("127.0.0.1");
}

function cookieName(kind: "jwt" | "refresh"): string {
  const prefix = isLocalApp() ? "" : "__Host-";
  return kind === "jwt" ? `${prefix}__convexAuthJWT` : `${prefix}__convexAuthRefreshToken`;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !isLocalApp(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export async function applyAuthTokens(
  tokens: { token: string; refreshToken: string } | null | undefined,
): Promise<void> {
  const jar = await cookies();
  if (!tokens?.token || !tokens.refreshToken) {
    jar.delete(cookieName("jwt"));
    jar.delete(cookieName("refresh"));
    return;
  }
  jar.set(cookieName("jwt"), tokens.token, cookieOptions());
  jar.set(cookieName("refresh"), tokens.refreshToken, cookieOptions());
}

export async function convexToken(): Promise<string | undefined> {
  return await convexAuthNextjsToken();
}

type QueryRef = FunctionReference<"query">;
type MutationRef = FunctionReference<"mutation">;
type ActionRef = FunctionReference<"action">;

export async function convexQuery<Fn extends QueryRef>(
  fn: Fn,
  args: Fn["_args"],
  token?: string,
): Promise<FunctionReturnType<Fn>> {
  return await fetchQuery(fn, args, {
    url: convexUrl(),
    ...(token ? { token } : {}),
  });
}

export async function convexQueryAuthed<Fn extends QueryRef>(
  fn: Fn,
  args: Fn["_args"],
): Promise<FunctionReturnType<Fn>> {
  return await convexQuery(fn, args, await convexToken());
}

export async function convexMutation<Fn extends MutationRef>(
  fn: Fn,
  args: Fn["_args"],
  token?: string,
): Promise<FunctionReturnType<Fn>> {
  const auth = token ?? (await convexToken());
  return await fetchMutation(fn, args, {
    url: convexUrl(),
    ...(auth ? { token: auth } : {}),
  });
}

export async function convexAction<Fn extends ActionRef>(
  fn: Fn,
  args: Fn["_args"],
  token?: string,
): Promise<FunctionReturnType<Fn>> {
  const auth = token ?? (await convexToken());
  return await fetchAction(fn, args, {
    url: convexUrl(),
    ...(auth ? { token: auth } : {}),
  });
}
