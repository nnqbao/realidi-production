#!/usr/bin/env bash
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/realidi-auth.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

names="$(npx convex env list --names-only)"
has_private=false
has_jwks=false
grep -qx JWT_PRIVATE_KEY <<<"$names" && has_private=true
grep -qx JWKS <<<"$names" && has_jwks=true

if [[ "$has_private" != "$has_jwks" ]]; then
  printf 'Refusing to replace only one member of the Convex Auth key pair.\n' >&2
  exit 1
fi

if [[ "$has_private" == false ]]; then
  node - "$tmp_dir" <<'NODE'
const { generateKeyPairSync } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const directory = process.argv[2];
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const publicObject = require("node:crypto").createPublicKey(publicKey);
const jwk = publicObject.export({ format: "jwk" });
writeFileSync(join(directory, "private"), privateKey.trimEnd().replace(/\n/g, " "), { mode: 0o600 });
writeFileSync(join(directory, "jwks"), JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...jwk }] }), { mode: 0o600 });
NODE
  npx convex env set JWT_PRIVATE_KEY < "$tmp_dir/private" >/dev/null
  npx convex env set JWKS < "$tmp_dir/jwks" >/dev/null
fi

site_url="${SITE_URL:-${APP_URL:-${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3020}}}"
printf '%s' "$site_url" | npx convex env set SITE_URL >/dev/null

smtp_host="${SMTP_HOST:-}"
if [[ -n "$smtp_host" && "$smtp_host" != "mailpit" && "$smtp_host" != "127.0.0.1" && "$smtp_host" != "localhost" ]]; then
  printf '%s' "$smtp_host" | npx convex env set SMTP_HOST >/dev/null
  printf '%s' "${SMTP_PORT:-587}" | npx convex env set SMTP_PORT >/dev/null
  printf '%s' "${SMTP_FROM:-Realidi <no-reply@realidi.local>}" | npx convex env set SMTP_FROM >/dev/null
  printf 'Convex Auth environment is configured with SMTP.\n'
else
  printf 'Convex Auth keys and SITE_URL are configured. SMTP was skipped (Convex Cloud cannot reach local Mailpit).\n'
fi
