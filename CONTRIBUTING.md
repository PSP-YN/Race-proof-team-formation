# Contributing to CrewForge

Thank you for considering a contribution. CrewForge is a correctness-sensitive application: changes to membership, invitations, authentication, rate limiting, or persistence must preserve the invariants documented in [docs/architecture.md](docs/architecture.md).

## Before opening a pull request

1. Check existing issues and pull requests for related work.
2. For a substantial change, open an issue first to agree on scope and design.
3. Keep changes focused. Avoid unrelated formatting or dependency churn.
4. Never commit credentials, real participant data, production database dumps, or generated secrets.
5. Add or update tests and documentation with the implementation.

## Development setup

- Node.js 20 or newer
- npm
- MongoDB 7 replica set for transaction and integration tests
- k6 only when running load tests

Follow the local setup in [README.md](README.md). Use a disposable database for seed and integration tests. Never point the seed script at production.

## Required checks

Run the checks relevant to your change before requesting review:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

For persistence or membership changes, run the replica-set integration suite:

```bash
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0' npm test
```

For board performance changes, run the smoke and k6 checks against a local production server or a staging deployment. Record the dataset, environment, VU count, duration, throughput, p50/p95/p99, and error rate. Do not compare results from materially different environments as if they were equivalent.

## Pull request expectations

A pull request should include:

- Problem statement and user impact
- Design and trade-offs
- API, schema, migration, or configuration changes
- Tests added and exact commands/results
- Security and privacy impact
- Performance impact when relevant
- Screenshots or a short recording for visible UI changes
- Documentation updates and rollback notes for operational changes

Use conventional commit prefixes where practical: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `perf:`, `security:`, and `chore:`.

## Correctness rules

- Treat MongoDB indexes as part of the correctness model, not optional optimizations.
- Keep membership writes, capacity reservations, invite consumption, and related audit records within the intended transaction boundary.
- Do not weaken unique constraints to make a test pass.
- Preserve idempotency semantics for retried requests.
- Never log passwords, raw session tokens, invitation tokens, reset tokens, or raw identity data.
- Validate authorization on the server for every protected operation; UI visibility is not authorization.
- Keep demo seed safeguards intact.

## Review process

All changes require CI to pass and maintainer review before merge. A green CI run is not a substitute for reviewing business logic, security boundaries, or operational readiness.
