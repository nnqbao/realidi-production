Convex is the application data plane.

- `convex/schema.ts` — domain tables, validators, and indexes
- `convex/seed.ts` — idempotent taxonomy, configuration, and 22-place seed
- `compose.convex.yml` — persistent loopback-only backend

`database/supabase-archive/` is historical SQL only. No script or package
command may run it.

```bash
./scripts/convex-local.sh up
npm run convex:deploy:local
npm run convex:seed
npm run convex:verify
```
