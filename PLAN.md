# RubricOps implementation plan

Source: Portfolio_Projects_AI_Evaluation.md, RubricOps brief.

- Build a Next.js evaluation platform with PostgreSQL/Prisma, NextAuth roles,
  optional Upstash queue acceleration, and Recharts reporting.
- Ingest normalized tasks and HH-RLHF/Arena exports; provide seeded offline data.
- Publish immutable rubric versions; bind tasks and scores to their version.
- Lease work to distinct evaluators, collect two scores, sample reviewer audits,
  route disagreements to admin adjudication, and retain an audit trail.
- Measure per-criterion Cohen's kappa, reviewer overturn rate and task duration
  from stored records, with explicit undefined/empty cases.
- Deliver a usable responsive application, role enforcement, input validation,
  concurrency tests, browser checks, Docker, Makefile, CI and documentation.
- Verify local behavior and record measured results. Hosted Supabase, Upstash,
  OAuth and Vercel deployment require external configuration; do not invent
  deployment URLs or claim remote checks have run.

The starter already uses Next.js 16; retain its installed version instead of
reverting to the brief's older Next.js 14. Use Prisma 6's supported schema API.
