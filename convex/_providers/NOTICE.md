# Vendored Convex Auth provider notice

`Password.ts` is adapted from `@convex-dev/auth` version `0.0.95`,
source path `src/providers/Password.ts`, licensed under Apache-2.0.

The local version retains the upstream `ConvexCredentials`, Lucia `Scrypt`,
account create/retrieve/modify, provider sign-in, and session invalidation
primitives. It adds normalized email handling, the Realidi password policy,
persistent pre-verification lockout checks (including unknown accounts),
generic credential failures, reset anti-enumeration, and timing equalization
for unknown-account password attempts.

Copyright and license terms remain those of the upstream project:
https://github.com/get-convex/convex-auth
