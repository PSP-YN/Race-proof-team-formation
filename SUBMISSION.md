# CrewForge — Hack4Hack PS1 submission pack

**Challenge:** Hack4Hack Crew Hiring Challenge 2026  
**Problem statement:** PS1 — Race-proof team formation at scale  
**Submission deadline:** 15 November 2026, 11:59 PM IST  
**Repository:** https://github.com/PSP-YN/Race-proof-team-formation
**Public demo:** https://crewforge-demo-pspyn.vercel.app/ (static browser-only demo; no backend/API)

## Reviewer entry points

1. **Start here:** [README](README.md) — product scope, setup, architecture summary and validation commands.
2. **One-page design brief:** [docs/one-page-design.md](docs/one-page-design.md) — data model, race prevention, trade-offs and next-week plan.
3. **Architecture:** [docs/architecture.md](docs/architecture.md) — transaction boundaries, indexes, API surface and security controls.
4. **Measured performance:** [docs/performance.md](docs/performance.md) — dataset, workload, p95 and benchmark limitations.
5. **Test evidence and gaps:** [docs/test-strategy.md](docs/test-strategy.md) — automated checks separated from manual release checks.
6. **Security:** [docs/threat-model.md](docs/threat-model.md) — assets, trust boundaries, controls and residual risks.
7. **Recorded 2:04 full-stack staging walkthrough:** [watch MP4](demo/files/CrewForge-FullStack-Staging-Walkthrough.mp4) · [English captions](demo/files/CrewForge-FullStack-Staging-Walkthrough.vtt) · [capture script and review boundary](docs/walkthrough-video-script.md).
8. **Challenge/interview guide:** [docs/challenge-submission.md](docs/challenge-submission.md).

## Evidence currently recorded

| Requirement | Evidence | Status |
|---|---|---|
| 10,000 seeded participants / 2,000 teams / 6,000 memberships / 4,000 open seats | Updated CI seed verification and isolated local seed validation | Local seed validation passed; updated CI rerun pending |
| 50 concurrent leader approvals for one final seat | `tests/integration/race.test.ts` | Automated integration test |
| One membership per participant per hackathon | Unique compound index + transaction | Implemented |
| Idempotent retries | Request-bound idempotency records | Implemented |
| Real-time board updates | MongoDB change streams + bounded SSE | Implemented; local/CI smoke evidence |
| Authentication and secure invite lifecycle | Auth routes, hashed expiring tokens, leader checks | Implemented; staging verification outstanding |
| Pending join requests with leader accept/decline | joinRequests collection, leader-only decision route, transactional membership insert and audit event | Implemented + replica-set integration tests |
| Leader-driven member removal | Leader-only DELETE member route, atomic membership/count update, request cancellation and audit | Implemented + replica-set integration tests |
| Audit log | Audit collection and transactional writes | Implemented |
| Explainable skill recommendations | Matching helper and UI | Implemented |
| CI and security scanning | [CI run 41886730555](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41886730555) and [CodeQL run 41886730567](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41886730567) | Both passed on commit `ef43950`; current 6k-membership/4k-open-seat and chaos-test changes require a fresh CI run |
| 100 concurrent users / board p95 under 200 ms | [Performance report](docs/performance.md) | Historical CI baseline: 100 VUs, 20.92 ms p95, 0% HTTP failures on the previous 10k-membership fixture; fresh benchmark pending for the corrected 6k-membership/4k-open-seat fixture |
| At least 20 API tests | [Test strategy](docs/test-strategy.md), `tests/api/route-contracts.test.ts` | **49 route-handler API contract tests**; database/provider end-to-end checks remain separate |
| Responsive, keyboard-accessible UI | Full React app at 390px viewport (no horizontal overflow); auth dialog ARIA role/label, initial focus, Tab wrap, Escape close and focus restoration | Mobile viewport and modal keyboard checks passed; broader end-to-end keyboard audit remains outstanding |
| Live URL | Challenge requirement | **Provided:** [CrewForge static demo](https://crewforge-demo-pspyn.vercel.app/). This is a public browser-only simulation; the full-stack service is not deployed. |
| One-page design doc | [One-page design brief](docs/one-page-design.md) | Prepared |
| Walkthrough video (up to 5 minutes) | [Recorded full-stack staging MP4](demo/files/CrewForge-FullStack-Staging-Walkthrough.mp4), [English captions](demo/files/CrewForge-FullStack-Staging-Walkthrough.vtt) | **Recorded (2:04), narrated and captioned**; embedded on the static demo; redeployment pending |
| Bonus: optimistic conflict rollback | No backend on public demo; server-conflict rollback not implemented | **Not implemented** |
| Bonus: Docker Compose, metrics, chaos test | `compose.yaml`, `/api/metrics`, `tests/chaos/kill-mid-join.mjs` | **Implemented and locally verified**; distributed tracing is not implemented |

## Local verification on the submission-readiness branch

- TypeScript typecheck: passed.
- Vitest: **71/71 passed across 3 files**, including 11 MongoDB replica-set integration tests and the 50-contender final-seat approval race.
- Transaction fault injection: passed; a worker was killed after writes were staged and before commit, and all transaction writes rolled back.
- Production build: passed.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Isolated seed validation: 10,000 synthetic users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants, 4,000 open seats and 2 judge-only accounts; the validation database was dropped afterwards.
- Docker Compose smoke test: all five checks passed through the loopback-only trusted proxy — health/database, security headers, cross-origin rejection, board JSON and SSE connected event.

The latest published CI and CodeQL runs are [41886730555](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41886730555) and [41886730567](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41886730567), both passed on commit `ef43950`. They predate the current local changes to the 6k-membership/4k-open-seat fixture, judge accounts and transaction-kill test. The updated branch must receive a fresh CI and CodeQL pass before submission.

## Recorded benchmark

The published CI baseline is a GitHub-hosted 100-VU/30-second board-read test against a disposable MongoDB 7 replica set. It recorded 3,000 requests, 97.43 requests/second, 20.92 ms p95 and 0% HTTP failures on the earlier 10,000-membership seed. The current submission branch corrects the seed to 6,000 memberships and 4,000 open seats; a fresh CI load-test result is required before using a benchmark claim for that dataset. These are CI measurements, never a production capacity guarantee.

See [docs/performance.md](docs/performance.md) for the tested commit and caveats.

## Local reviewer setup

Use the reproducible [Docker Compose runbook](docs/docker-compose.md): copy `.env.example` to `.env`, set a unique `JWT_SECRET` and separate 16+ character `SEED_DEMO_PASSWORD` / `JUDGE_DEMO_PASSWORD` values, then run `docker compose up --build -d`. Seed only a fresh disposable volume with `docker compose --profile seed run --rm seed`. Open **http://localhost:3002** through the loopback-only trusted proxy. Port 3001 is for diagnostics. The full local test, chaos and smoke commands are in the runbook.

Email verification and recovery flows require a configured Resend sender. Without one, those flows remain deliberately unavailable. Never use the demo seed against a production database.

## Before submitting

- [ ] Re-check the latest `main` CI and CodeQL runs immediately before submission; include the exact CI run link.
- [x] Verify 390px mobile viewport has no horizontal overflow and the authentication dialog supports ARIA semantics, initial focus, Tab wrapping, Escape close and focus restoration; broader keyboard-only audit remains outstanding.
- [x] Record the 2:04 full-stack staging walkthrough with narration and English captions; embed it in the static demo after redeployment.
- [ ] Re-check all repository links, setup steps and public visibility from a signed-out browser.
- [ ] Complete the organizer's submission form before the deadline.
- [ ] Configure MongoDB Atlas and Resend production credentials, deploy the full-stack app, then complete the staging verification matrix. Confirm the public static demo URL opens in a signed-out/incognito browser and disclose its simulation boundary.

## Demo deployment boundary

The static demo is manually deployed to Vercel from `demo/` as project `crewforge-demo`. Latest production deployment: `dpl_H2VreKqtgNiV1LFegco86R3rBhCG`, source commit `f847946` plus the latest guide-only redeployment, state **Ready**, public alias [crewforge-demo-pspyn.vercel.app](https://crewforge-demo-pspyn.vercel.app/). It does not use API routes, backend services, secrets, or database access. Automatic Vercel Git deployments remain disabled in `vercel.json`; Preview deployments are disabled for the demo project. The current full-stack Next.js project remains **not deployed** because production MongoDB and Resend credentials are not configured in Vercel; its production gates in [docs/production-readiness.md](docs/production-readiness.md) are not satisfied. Do not describe the static demo as a live authentication, invite, email, database, or concurrency service.

## Submission integrity

AI coding tools are allowed by the challenge, but candidates must be able to explain every line and make a small live change during the interview. Only present technical details you personally understand. The repository distinguishes implemented code, automated evidence, manual checks and external deployment gates; preserve that distinction in the submission and interview.
