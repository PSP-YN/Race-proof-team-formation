# CrewForge

**Race-safe team formation for high-concurrency hackathons.**

CrewForge helps participants discover teams, create crews, and join without duplicate membership or over-capacity teams. Its defining requirement is a data-integrity guarantee: concurrent requests must not allow a participant to join multiple teams in one hackathon or claim more seats than a team has.

[![CI](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/ci.yml)
[![CodeQL](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/PSP-YN/Race-proof-team-formation/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Product capabilities

- Participant registration, email verification, sign-in, sign-out, and password recovery.
- Team creation, capacity management, leader-controlled settings, and team discovery.
- Moderated join requests: participants request a seat; only the current leader can accept or decline.
- Leader-only member removal, transactional leave, leadership succession, and duplicate-membership protection.
- Invitation creation, listing, revocation, expiry, and single-use acceptance.
- Skill-complementarity recommendations with an explainable score.
- MongoDB change-stream Server-Sent Events (SSE), bounded stream lifetime, and client refresh fallback.
- Rate limiting, origin validation, audit events, privacy-preserving security telemetry, and an allowlisted security dashboard.
- Health endpoint, disposable large-dataset seeding, smoke tests, concurrency tests, and k6 load testing.

## Engineering highlights

CrewForge treats membership as a concurrency and consistency problem, not a client-side form-validation problem.

1. A unique database index enforces one membership per participant per hackathon; a partial unique index allows only one pending join request per participant per hackathon.
2. Only the current leader can accept or decline. Acceptance, seat reservation, membership insertion, request status and audit event commit in one MongoDB transaction.
3. Request-bound idempotency keys make retries safe and reject conflicting reuse.
4. Leader-only member removal, leadership succession, last-member team closure and invite invalidation preserve lifecycle invariants.
5. Invitation tokens are random, hashed at rest, expiring, revocable, and consumed transactionally.

The replica-set integration test creates 50 pending requests and executes 50 leader approvals concurrently for one remaining seat. Exactly one approval commits; 49 are rejected and the stored member count remains correct.

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

- Node.js 22 or newer and npm
- MongoDB 7 replica set (local Docker Compose or MongoDB Atlas)
- Docker Engine with the Compose plugin for the full-stack local environment
- Resend API key and verified sender only if you need email verification or recovery

### Configure direct Next.js development

```bash
cp .env.example .env.local
```

Set `JWT_SECRET` to at least 32 cryptographically random characters. The checked-in `.env.example` uses the Compose service hostname `mongo`; if you run `npm run dev` directly on the host, override `MONGODB_URI` with `mongodb://127.0.0.1:27017/crewforge?directConnection=true&replicaSet=rs0` and use `NEXT_PUBLIC_APP_URL=http://localhost:3000` for the dev-server origin. Leave `TRUSTED_CLIENT_IP_HEADER` unset in local development. Set `RESEND_API_KEY` and `EMAIL_FROM` only when a real verified Resend sender is available; keep `ADMIN_EMAILS` empty unless you have a real operator account.

```bash
npm ci
MONGODB_URI='mongodb://127.0.0.1:27017/crewforge?directConnection=true&replicaSet=rs0' NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run dev
```

Open http://localhost:3000. Never prefix secrets with `NEXT_PUBLIC_`; never commit `.env.local`.

### Full-stack local staging with Docker Compose

```bash
cp .env.example .env
# Set a unique JWT_SECRET and separate 16+ character SEED_DEMO_PASSWORD / JUDGE_DEMO_PASSWORD values.
docker compose up --build -d
docker compose --profile seed run --rm seed
BASE_URL=http://localhost:3002 npm run smoke
```

Open **http://localhost:3002**. Use port 3002 for browser interactions: the loopback-only local proxy overwrites `X-Forwarded-For` before requests reach the production-mode app. Port 3001 is the direct app container and is for diagnostics. Seed only a fresh disposable volume; the seed refuses to overwrite an existing dataset unless you explicitly reset an isolated database. The seed creates 10,000 synthetic users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants and 4,000 open seats, plus two verified judge-only accounts. These are test fixtures, not real participants.

If Resend is not configured, registration and recovery email delivery remain disabled. The local seed's pre-verified judge accounts can be used for isolated reviewer walkthroughs with the local `JUDGE_DEMO_PASSWORD`; do not publish that password.

See [the Docker Compose runbook](docs/docker-compose.md) for the full local start, verification and cleanup procedure. `docker compose down` preserves the local database volume; `docker compose down -v` deletes it.

## Validation

```bash
npm run typecheck
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?directConnection=true&replicaSet=rs0' npm test
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?directConnection=true&replicaSet=rs0' npm run chaos
npm run build
npm audit --audit-level=moderate
BASE_URL=http://localhost:3002 npm run smoke
```

The direct-connection option is needed for host-run tests against the Compose replica set because MongoDB advertises its Docker-network hostname (`mongo:27017`). CI creates a disposable MongoDB replica set, verifies 10,000 seeded users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants and 4,000 open seats, runs the 50-contender final-seat race and transaction-kill rollback checks, builds the production app, executes smoke checks and runs a 100-VU / 30-second k6 board test.

Latest submission-branch CI run: [run 41873925487](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925487); CodeQL: [run 41873925485](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925485). Both passed on commit `a809e7d`. CI verified 10,000 seeded users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants and 4,000 open seats; all 65 tests passed, including the 50-way final-seat race. The 100-VU/30-second k6 test processed 3,000 requests at 97.43 requests/second, with 16.00 ms average response, 20.92 ms p95, 0% HTTP failures and 6,000/6,000 board checks passed. These are GitHub-runner measurements against a disposable local MongoDB replica set, not production-region measurements. See [performance report](docs/performance.md).

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

### No-backend judging demo

**Public demo:** [crewforge-demo-pspyn.vercel.app](https://crewforge-demo-pspyn.vercel.app/) · [Alternate Vercel alias](https://crewforge-demo-sandy.vercel.app/)

The standalone static demo source is [`demo/index.html`](demo/index.html). It does not call APIs, use a database, require login, load remote assets, or need secrets. Team creation, join/leave, skill matching and reset are simulated in browser JavaScript and saved only in local browser storage. It is intentionally not the live full-stack service; the race-safety guarantee is separately verified by MongoDB replica-set integration tests.

The [2:04 full-stack staging walkthrough](demo/files/CrewForge-FullStack-Staging-Walkthrough.mp4) is recorded from the local MongoDB 7 replica-set build, with English captions in the adjacent VTT file. The video uses temporary, clearly labelled test fixtures and explicitly distinguishes local staging from the public browser-only preview. The demo runbook includes setup, judge-account preparation, technical explanation, recovery steps and claims to avoid. The reviewer-first [submission pack](SUBMISSION.md) links the one-page design brief, measured performance evidence, test matrix and [walkthrough script](docs/walkthrough-video-script.md). The challenge-specific explanation and interview preparation are in [docs/challenge-submission.md](docs/challenge-submission.md).

## Project documentation

- [Architecture and correctness](docs/architecture.md)
- [Engineering decisions and industry patterns](docs/engineering-decisions.md)
- [Threat model](docs/threat-model.md)
- [Test strategy and black-box matrix](docs/test-strategy.md)
- [Performance report](docs/performance.md)
- [Production readiness and operations](docs/production-readiness.md)
- [Demo runbook](docs/demo-runbook.md)
- [Docker Compose local staging](docs/docker-compose.md)
- [Challenge submission and interview guide](docs/challenge-submission.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [MIT License](LICENSE)

## Open source

CrewForge is released under the [MIT License](LICENSE). Contributions are governed by the [contribution guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md). Please report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md).

## Scope and honest limitations

The current automated evidence covers the CI environment and stated synthetic workloads. It does not establish production availability, production-region latency, a formal security certification, an active Cloudflare WAF, or a production SLA. Hosting, email delivery, database operations, and deployment-specific behavior must be validated in the actual target environment before public launch.
