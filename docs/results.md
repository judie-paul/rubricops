# Measured synthetic demo results

Command: `make pipeline` on a fresh database, then `npm run results`.
Generator: `scripts/seed.ts`, seed 42. These measurements describe synthetic scores
and timings, not real evaluator performance or model accuracy.

| Metric                            |       Value |
| --------------------------------- | ----------: |
| Tasks                             |          32 |
| Original evaluations              |          48 |
| Paired tasks                      |          24 |
| Initially completed tasks         |          16 |
| Completed confirm/overturn audits |           4 |
| Reviewer overturn rate            | 25% (1 / 4) |
| Median seeded evaluation time     | 130 seconds |
| Accuracy Cohen's κ                |    0.529412 |
| Helpfulness Cohen's κ             |    1.000000 |
| Clarity Cohen's κ                 |    1.000000 |

The perfect values for helpfulness and clarity are a property of the synthetic
fixture. They are not evidence of real-world reliability. Small synthetic audit
samples cannot support general conclusions about overturn rates. New user actions
change the dashboard and regenerated JSON; this table records the initial seed.

See `results.json` for the captured database result and generation timestamp.
