# Hosted deployment

The local app is complete without hosted services. The following configuration is
needed to run it on Vercel with Supabase and optional Upstash. These integrations
have not been exercised against a live hosted account in this workspace.

1. Create a PostgreSQL database and set `DATABASE_URL`. For Supabase, use a
   server-compatible pooled connection string for runtime, and a direct connection
   for running `prisma migrate deploy` in your release process. Do not run migration
   deployment inside Vercel request handlers. Use TLS as required by the provider.
2. Set a random `AUTH_SECRET`, the public origin in `AUTH_URL`, and
   `AUTH_TRUST_HOST=true` only behind the trusted platform proxy. Disable local
   credentials with `DEMO_MODE=false`; do not deploy the local shared password.
3. Configure a GitHub OAuth application and set `AUTH_GITHUB_ID` and
   `AUTH_GITHUB_SECRET`. The callback path is `/api/auth/callback/github`.
4. Pre-provision allowed user emails with EVALUATOR, REVIEWER or ADMIN roles in
   PostgreSQL. There is no public signup and no client-controlled role assignment.
   GitHub sign-in accepts only emails already in the users table. Use the CLI below.
5. Optionally set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. A missing
   or unavailable index falls back to PostgreSQL. Each deployment should use its
   own Redis database; the current queue key is `rubricops:open:v1`.
6. Deploy the repository with build command `npm run build` and Node 24. Verify
   authenticated imports, claims, submission, reviewer decisions and logout using
   real accounts before sharing the URL.

Provision an allowed account (this performs a database write):

```sh
npx tsx --env-file=.env scripts/user.ts person@example.com "Person Name" EVALUATOR
```

Production considerations: managed database backups, OAuth provider availability,
connection pool limits, request rate limiting at the hosting edge, and application
error monitoring. The app is a single-workspace portfolio implementation; tenant
isolation, public registration, invitation delivery, and enterprise administration
are not part of the brief. Dashboard queries currently load all task records.
