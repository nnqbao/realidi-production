Convex is the application data plane.

- `convex/schema.ts` — domain tables, validators, and indexes
- `convex/seed.ts` — idempotent taxonomy, configuration, and 22-place seed
- Live backend: Convex Cloud (`prod:zany-lyrebird-546`)
- `compose.convex.yml` — retired local Docker stack; do not start

`database/supabase-archive/` is historical SQL only. No script or package
command may run it.

```bash
./scripts/convex-auth-env.sh
npm run convex:deploy
npm run convex:seed
npm run convex:verify
```
