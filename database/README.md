Convex Phases 0–2 provide the local migration foundation:

- `convex/schema.ts` — domain tables, validators, and indexes
- `convex/seed.ts` — idempotent taxonomy, configuration, and 22-place seed
- `compose.convex.yml` — persistent loopback-only backend

The application has not cut over: SQL migrations and `supabase/seed.sql`
remain the current Supabase runtime source as well as parity evidence. The
Convex schema/seed can be deployed and verified independently without creating
a hybrid application data path.

```bash
./scripts/convex-local.sh up
npm run convex:deploy:local
npm run convex:seed
npm run convex:verify
```
