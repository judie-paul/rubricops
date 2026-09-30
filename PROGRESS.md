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
- Clean Docker image build succeeds. The persistent Compose app is running at
  http://localhost:3001. Container browser smoke verifies sign-in, seeded metrics,
  malformed-input rejection, mobile layout and logout without changing task data.
  Clean screenshots are saved under docs/screenshots/.
- Dependency install audit reports zero known vulnerabilities. Prisma's development
  dependency deepmerge-ts is overridden to its patched v8 version; Prisma generation,
  migrations and builds have been exercised with that override.
- Fresh seed measurements: 32 tasks, 48 evaluations, 24 paired tasks; accuracy
  kappa 0.529412; 1 overturn among 4 completed audits. All seeded data is synthetic.

## External status

Repository: https://github.com/judie-paul/rubricops

Incremental delivery (linked issues #1–#4):

- [PR #5](https://github.com/judie-paul/rubricops/pull/5): repository standards.
- [PR #6](https://github.com/judie-paul/rubricops/pull/6): persistent evaluation core.
- [PR #7](https://github.com/judie-paul/rubricops/pull/7): responsive workspace.
- [PR #8](https://github.com/judie-paul/rubricops/pull/8): reproducible delivery and CI.

[Full remote verification](https://github.com/judie-paul/rubricops/actions/runs/36770923318)
passed: lint, typing, formatting, 13 unit/adapter tests, 7 PostgreSQL integration
tests, production build, 4 Chromium scenarios and Docker image build. GitHub is
the authority for each PR's current merge/check status and release status.
The issue/PR drafts in docs/github/ preserve the incremental delivery plan.

GitHub CLI authentication is stored in the system keyring; Git uses the CLI
credential helper. Future repositories normally reuse this account login.

Supabase, live Upstash and GitHub OAuth require real provider configuration.
The local runtime uses PostgreSQL and local demo authentication. Hosted setup is
documented in docs/deployment.md. The dashboard loads the full task collection;
large-scale pagination and multi-workspace tenancy are outside this portfolio scope.
