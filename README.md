# CrewForge

**Race-safe team formation for high-concurrency hackathons.**

CrewForge helps participants discover teams, create crews, and join without duplicate membership or over-capacity teams. Its defining requirement is a data-integrity guarantee: concurrent requests must not allow a participant to join multiple teams in one hackathon or claim more seats than a team has.

[![CI](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/ci.yml)
[![CodeQL](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Product capabilities

- Participant registration, email verification, sign-in, sign-out, and password recovery.
- Team creation, capacity management, leader-controlled settings, team discovery, and leader-reviewed join requests.
- Transactional join/leave operations, leadership succession, and duplicate-membership protection.
- Invitation creation, listing, revocation, expiry, and single-use acceptance.
- Skill-complementarity and time-zone recommendations with an explainable score.
- MongoDB change-stream Server-Sent Events (SSE), bounded stream lifetime, and client refresh fallback.
- Rate limiting, origin validation, audit events, privacy-preserving security telemetry, and an allowlisted security dashboard.
- Health endpoint, disposable large-dataset seeding, smoke tests, concurrency tests, and k6 load testing.

## Engineering highlights

CrewForge treats membership as a concurrency and consistency problem, not a client-side form-validation problem.

1. A unique database index enforces one membership per participant per hackathon.
2. A conditional capacity reservation and membership insertion happen in one MongoDB transaction.
3. Request-bound idempotency keys make retries safe and reject conflicting reuse.
4. Invitation tokens are random, hashed at rest, expiring, revocable, and consumed transactionally.
5. Leader departure, succession, invite invalidation, and membership changes preserve the intended lifecycle invariants.

See [architecture and correctness notes](docs/architecture.md) for the transaction model, [engineering decisions](docs/engineering-decisions.md) for the technology trade-offs, [threat model](docs/threat-model.md) for the security boundaries, and [test strategy](docs/test-strategy.md) for the verification matrix.

## Technology

| Layer | Technology |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript |
| Validation | Zod 4 |
| Persistence | MongoDB 7 replica set / MongoDB Atlas |
| Authentication | bcrypt password hashes, signed JWT sessions, HttpOnly cookies |
| Email | Resend |
| Realtime | MongoDB change streams and browser EventSource |
| Infrastructure | Vercel deployment guidance, Cloudflare Terraform WAF template |
| Quality | Vitest, TypeScript, npm audit, GitHub Actions, CodeQL, k6 |

## Quick start

### Requirements

- Node.js 22 (Node.js 20.9+ is the Next.js minimum)
- npm
- MongoDB replica set (local Docker or MongoDB Atlas)
- Resend API key and verified sender for email verification and recovery flows

### One-command Docker setup

The included Compose setup runs the app with a MongoDB replica set (transactions and change streams enabled):

```bash
cp .env.example .env
# Set JWT_SECRET to a strong random value in .env
openssl rand -base64 48
# Paste the generated value into .env, then:
docker compose up --build
```

Open http://localhost:3000. Resend credentials are optional for the app to start but required for email verification and password recovery. Do not expose this local Compose stack directly to the public internet.

### Manual configure

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

- `MONGODB_URI`: replica-set connection string
- `JWT_SECRET`: at least 32 cryptographically random characters
- `NEXT_PUBLIC_APP_URL`: exact app origin, for example `http://localhost:3000`
- `RESEND_API_KEY` and `EMAIL_FROM`: verified Resend sender configuration
- `ADMIN_EMAILS`: comma-separated operator allowlist

Never prefix secrets with `NEXT_PUBLIC_`. Never commit `.env.local`.

### Run

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

Email verification is required before an account becomes active. Configure Resend before demonstrating registration or account recovery. Use a disposable database for all tests and demo seeding.

## Validation

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

The MongoDB integration test requires a replica set through `MONGODB_TEST_URI`. CI provisions a disposable replica set, validates 10,000 users / 2,000 teams / 8,000 memberships, runs the 50-contender final-seat race test, builds the production app, runs smoke checks and a black-box API suite with 20+ cases, and executes a 100-VU / 30-second k6 board test.

Latest completed pre-merge CI benchmark: [run 41523345249](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41523345249). It recorded 3,000 requests, 97.75 requests/second, 14.03 ms average response, 10.77 ms p95, 0% HTTP failures, and 6,000/6,000 board checks passed. These are GitHub-runner measurements against a disposable local MongoDB replica set, not production-region measurements. See [performance report](docs/performance.md).

## Deployment status and production gates

The repository contains deployment configuration and operational guidance, but it must not be described as production-deployed until the following are complete:

- Vercel project and production domain are configured.
- MongoDB Atlas replica-set URI, network access, least-privilege database user, and backup policy are configured.
- `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, and `ADMIN_EMAILS` are set in the hosting provider's encrypted environment settings.
- Resend sender domain has SPF, DKIM, and DMARC configured and email delivery tested.
- Cloudflare zone is configured and proxied before applying the Terraform WAF template.
- Staging black-box security and user-flow checks pass.
- Deployed smoke and load tests are run and their environment/metrics are recorded.
- Backup restore and rollback are rehearsed.

Follow [production readiness](docs/production-readiness.md) for the runbook and required environment variables. Do not paste credentials into issues, pull requests, or chat.

## Demo

Use the five-minute walkthrough in [docs/demo-runbook.md](docs/demo-runbook.md). The demo guide includes setup, test-account preparation, technical explanation, recovery steps, and claims to avoid. The challenge-specific explanation and interview preparation are in [docs/challenge-submission.md](docs/challenge-submission.md).

## Project documentation

- [Architecture and correctness](docs/architecture.md)
- [Engineering decisions and industry patterns](docs/engineering-decisions.md)
- [Threat model](docs/threat-model.md)
- [Test strategy and black-box matrix](docs/test-strategy.md)
- [Performance report](docs/performance.md)
- [Production readiness and operations](docs/production-readiness.md)
- [Demo runbook](docs/demo-runbook.md)
- [Challenge submission and interview guide](docs/challenge-submission.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [MIT License](LICENSE)

## Open source

CrewForge is released under the [MIT License](LICENSE). Contributions are governed by the [contribution guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md). Please report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md).

## Scope and honest limitations

The current automated evidence covers the CI environment and stated synthetic workloads. It does not establish production availability, production-region latency, a formal security certification, an active Cloudflare WAF, or a production SLA. Hosting, email delivery, database operations, and deployment-specific behavior must be validated in the actual target environment before public launch.
