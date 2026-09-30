.PHONY: setup db pipeline dev check test-integration browser results docker
setup:
	npm ci
	node scripts/setup.mjs
	npm run db:generate
db:
	docker compose up -d --wait db
pipeline: db
	npm run db:migrate
	npm run db:seed
	npm run results
dev:
	npm run dev
check:
	npm run lint
	npm run typecheck
	npm run format:check
	npm test
test-integration:
	node scripts/integration.mjs
browser:
	npm run test:e2e
results:
	npm run results
docker:
	docker compose up --build -d
