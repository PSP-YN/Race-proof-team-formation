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
7. **Five-minute video script:** [docs/walkthrough-video-script.md](docs/walkthrough-video-script.md).
8. **Challenge/interview guide:** [docs/challenge-submission.md](docs/challenge-submission.md).

## Evidence currently recorded

| Requirement | Evidence | Status |
|---|---|---|
| 10,000 seeded participants / 2,000 teams / 10,000 memberships | CI seed verification in `.github/workflows/ci.yml` | Implemented in CI |
| 50 concurrent leader approvals for one final seat | `tests/integration/race.test.ts` | Automated integration test |
| One membership per participant per hackathon | Unique compound index + transaction | Implemented |
| Idempotent retries | Request-bound idempotency records | Implemented |
| Real-time board updates | MongoDB change streams + bounded SSE | Implemented; local/CI smoke evidence |
| Authentication and secure invite lifecycle | Auth routes, hashed expiring tokens, leader checks | Implemented; staging verification outstanding |
| Pending join requests with leader accept/decline | joinRequests collection, leader-only decision route, transactional membership insert and audit event | Implemented + replica-set integration tests |
| Leader-driven member removal | Leader-only DELETE member route, atomic membership/count update, request cancellation and audit | Implemented + replica-set integration tests |
| Audit log | Audit collection and transactional writes | Implemented |
| Explainable skill recommendations | Matching helper and UI | Implemented |
| CI and security scanning | [CI run 41873925487](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925487) and [CodeQL run 41873925485](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925485) | Both passed on submission commit |
| 100 concurrent users / board p95 under 200 ms | [Performance report](docs/performance.md) | CI benchmark recorded: 100 VUs, 20.92 ms p95, 0% HTTP failures |
| At least 20 API tests | [Test strategy](docs/test-strategy.md), `tests/api/route-contracts.test.ts` | **45 route-handler API contract tests**; database/provider end-to-end checks remain separate |
| Responsive, keyboard-accessible UI | Static demo browser QA: dialog semantics, Escape handling, create/join, 390px viewport | Browser QA passed; full React app needs separate staging pass |
| Live URL | Challenge requirement | **Provided:** [CrewForge static demo](https://crewforge-demo-pspyn.vercel.app/). This is a public browser-only simulation; the full-stack service is not deployed. |
| One-page design doc | [One-page design brief](docs/one-page-design.md) | Prepared |
| Walkthrough video (up to 5 minutes) | [Recording script](docs/walkthrough-video-script.md) | Script prepared; video recording/upload still required |
| Bonus: optimistic conflict rollback | No backend on public demo; server-conflict rollback not implemented | **Not implemented** |
| Bonus: Docker Compose, tracing/metrics, chaos test | Not in verified delivery | **Not implemented** |

## Local verification on the submission-readiness branch

- TypeScript typecheck: passed.
- Vitest: **65/65 passed (45 API contract, 9 unit, 11 MongoDB integration)** across 3 files, including 45 route-handler API contract tests and 11 MongoDB replica-set integration tests.
- Next.js production build: passed.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.

These checks were run locally before merge. The latest submission-readiness CI run is [41873925487](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925487) (passed). CodeQL is [41873925485](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925485) (passed). Both ran on commit `a809e7d` in PR #12.

## Recorded benchmark

The current report records a GitHub-hosted runner test using a disposable MongoDB 7 replica set and a seeded dataset of 10,000 users, 2,000 teams and 10,000 memberships. The latest submission-branch CI run (100 VUs for 30 seconds) recorded 3,000 requests, 97.43 requests/second, 20.92 ms p95 and 0% HTTP failures. These are CI measurements, not a production deployment result or a production capacity guarantee.

See [docs/performance.md](docs/performance.md) for the exact run, tested commit and caveats.

## Local reviewer setup

Requirements: Node.js 20+, npm and MongoDB 7 configured as a replica set. Copy `.env.example` to `.env.local`, provide a disposable database URI and a fresh random JWT secret, then run:

```bash
npm ci
npm run dev
```

Email verification and recovery flows require a configured Resend sender. Use pre-verified disposable test accounts only when demonstrating locally without an email provider. Never use the demo seed against a production database.

## Before submitting

- [ ] Re-check the latest `main` CI and CodeQL runs immediately before submission; include the exact CI run link.
- [ ] Complete a keyboard-only pass and mobile viewport pass; record any remaining accessibility limitations.
- [ ] Record the five-minute walkthrough from a disposable local environment and upload it.
- [ ] Re-check all repository links, setup steps and public visibility from a signed-out browser.
- [ ] Complete the organizer's submission form before the deadline.
- [ ] Configure MongoDB Atlas and Resend production credentials, deploy the full-stack app, then complete the staging verification matrix. Confirm the public static demo URL opens in a signed-out/incognito browser and disclose its simulation boundary.

## Demo deployment boundary

The static demo is manually deployed to Vercel from `demo/` as project `crewforge-demo`. Latest production deployment: `dpl_H2VreKqtgNiV1LFegco86R3rBhCG`, source commit `f847946` plus the latest guide-only redeployment, state **Ready**, public alias [crewforge-demo-pspyn.vercel.app](https://crewforge-demo-pspyn.vercel.app/). It does not use API routes, backend services, secrets, or database access. Automatic Vercel Git deployments remain disabled in `vercel.json`; Preview deployments are disabled for the demo project. The current full-stack Next.js project remains **not deployed** because production MongoDB and Resend credentials are not configured in Vercel; its production gates in [docs/production-readiness.md](docs/production-readiness.md) are not satisfied. Do not describe the static demo as a live authentication, invite, email, database, or concurrency service.

## Submission integrity

AI coding tools are allowed by the challenge, but candidates must be able to explain every line and make a small live change during the interview. Only present technical details you personally understand. The repository distinguishes implemented code, automated evidence, manual checks and external deployment gates; preserve that distinction in the submission and interview.
