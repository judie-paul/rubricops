# Changelog

## 0.1.1 — agreement correctness

- Group Cohen's kappa by stable evaluator pair, rubric version, and criterion.
- Show evaluator names alongside each metric; submission order no longer mixes
  label marginals, and different pairs are no longer pooled.

## 0.1.0 — local implementation

- PostgreSQL-backed task ingestion, immutable rubrics, two-evaluator leases,
  sampled audits, adjudication and append-only workflow events.
- NextAuth evaluator/reviewer/admin access, local demo and allowlisted GitHub OAuth.
- Responsive evaluation workspace, Recharts agreement, review forms, imports,
  rubric publishing, activity and metrics export.
- Seeded offline examples, normalized/HH-RLHF/Arena export adapters, measured results.
- Docker, Makefile, CI configuration, unit/integration/browser checks and deployment notes.

No hosted deployment or remote release is claimed.
