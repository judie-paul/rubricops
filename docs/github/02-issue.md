# Implement persistent evaluation and review workflows

Build the backend for versioned rubric scoring with independent evaluators,
sampled audits, adjudication and reliable queue ownership.

Acceptance:

- PostgreSQL migration and Prisma model cover users, rubrics, tasks, claims, scores,
  review decisions and workflow events.
- Server-side roles enforce evaluation, review and administration boundaries.
- At most two evaluation slots exist per task; claims expire and duplicate
  submissions fail safely under concurrent requests.
- Rubric versions remain fixed and imports validate atomically.
- Metrics and optional Redis fallback have meaningful tests.
