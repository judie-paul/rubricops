# RubricOps progress

## Implemented

- PostgreSQL schema and versioned Prisma migration; persistent task/evaluation/review data.
- Immutable rubric publication; normalized, HH-RLHF, and Arena local-export imports.
- Two distinct evaluator slots, 20-minute leases, expiry/release, serializable claims.
- Deterministic 25% review sampling, score-disagreement routing, reviewer audits,
  admin adjudication, retained original scores, and recorded workflow events.
- NextAuth local demo and allowlisted GitHub provider; server-enforced roles.
- Optional Upstash candidate index with a 1.5-second request timeout and SQL fallback.
- Responsive workspace, scoring forms, filters, rubric editor, imports, activity,
  agreement charts and JSON metric export.
- Seeded offline data, Makefile, Docker Compose, CI configuration and deployment notes.

## Local verification

- 13 unit/adapter tests pass: metric edge cases, import validation, rubric scores,
  deterministic sampling, and mocked Redis success/failure behavior.
- 7 PostgreSQL integration tests pass, covering concurrent claims, lease expiry,
  duplicate submissions, atomic imports, roles, rubric preservation and overturns.
- 4 Chromium scenarios pass: admin import/publication/adjudication; evaluator
  scoring and API permissions; mobile review with no page overflow; unauthenticated
  and cross-origin request rejection. Desktop and mobile screenshots inspected.
- ESLint, strict TypeScript, Prettier, and the production Next.js build pass.
- Clean Docker image build succeeds. Compose database migrations and seed succeed.
- Dependency install audit reports zero known vulnerabilities. Prisma's development
  dependency deepmerge-ts is overridden to its patched v8 version; Prisma generation,
  migrations and builds have been exercised with that override.
- Fresh seed measurements: 32 tasks, 48 evaluations, 24 paired tasks; accuracy
  kappa 0.529412; 1 overturn among 4 completed audits. All seeded data is synthetic.

## External status

GitHub publication is requested. The saved GitHub credential returned HTTP 401;
a browser device authorization was started and requires the user's sign-in.
No remote repository, remote CI run, release or hosted deployment is claimed yet.

Supabase, live Upstash and GitHub OAuth require real provider configuration.
The local runtime uses PostgreSQL and local demo authentication. Hosted setup is
documented in docs/deployment.md. The dashboard loads the full task collection;
large-scale pagination and multi-workspace tenancy are outside this portfolio scope.
