# Contributing

Run `make setup`, then `make check` before opening a pull request. `make check`
runs ESLint, TypeScript, Prettier and the unit/integration tests.

Branch from `main` using `feat/`, `fix/`, `docs/`, `test/`, `ci/` or `chore/`
prefixes, and write Conventional Commits such as
`feat(queue): release expired task leases`. Keep `main` releasable and do not
force-push shared branches.

Open an issue for each substantial change with acceptance criteria, and link it
from the pull request. Update `CHANGELOG.md` and `PROGRESS.md` as part of the
change, not afterwards.

Guidelines:

- Schema changes ship with a Prisma migration. Never edit an applied migration.
- Rubric versions are immutable once published. Create a new version instead.
- Metric code lives in `src/lib/metrics` as pure functions with unit tests.
- Randomness (sampling, synthetic data, simulation) takes an explicit seed.
- Tests must not call Hugging Face or any paid API. Use the committed fixtures.
- Never commit `.env` files, credentials, dataset dumps or invented metrics.
