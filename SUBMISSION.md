# CrewForge — Hack4Hack PS1 submission pack

**Challenge:** Hack4Hack Crew Hiring Challenge 2026  
**Problem statement:** PS1 — Race-proof team formation at scale  
**Submission deadline:** 15 November 2026, 11:59 PM IST  
**Repository:** https://github.com/PSP-YN/Race-proof-team-formation

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
| 10,000 participants / 2,000 teams seed | CI seed verification in `.github/workflows/ci.yml` | Implemented in CI |
| 50 contenders for one final seat | `tests/integration/race.test.ts` | Automated integration test |
| One membership per participant per hackathon | Unique compound index + transaction | Implemented |
| Idempotent retries | Request-bound idempotency records | Implemented |
| Real-time board updates | MongoDB change streams + bounded SSE | Implemented; local/CI smoke evidence |
| Authentication and secure invite lifecycle | Auth routes, hashed expiring tokens, leader checks | Implemented; staging verification outstanding |
| Audit log | Audit collection and transactional writes | Implemented |
| Explainable skill recommendations | Matching helper and UI | Implemented |
| CI and security scanning | GitHub Actions CI and CodeQL workflows | Configured; verify latest main-branch run before submission |
| 100 concurrent users / board p95 under 200 ms | [Performance report](docs/performance.md) | CI benchmark recorded: 100 VUs, 10.77 ms p95, 0% HTTP failures |
| At least 20 API tests | [Test strategy](docs/test-strategy.md), `tests/api/route-contracts.test.ts` | **32 route-handler API contract tests**; database/provider end-to-end checks remain separate |
| Responsive, keyboard-accessible UI | UI implementation | Needs a final manual accessibility and mobile pass |
| Live URL | Challenge requirement | **Not supplied** — no deployment was performed, per project owner instruction |
| One-page design doc | [One-page design brief](docs/one-page-design.md) | Prepared |
| Walkthrough video (up to 5 minutes) | [Recording script](docs/walkthrough-video-script.md) | Script prepared; video recording/upload still required |

## Local verification on the submission-readiness branch

- TypeScript typecheck: passed.
- Vitest: **42/42 passed** across 3 files, including 32 route-handler API contract tests and the 50-contender MongoDB replica-set race integration test.
- Next.js production build: passed.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.

These checks were run locally on the submission-readiness branch. Verify GitHub Actions again after the PR is merged; local success is not a substitute for the final main-branch CI record.

## Recorded benchmark

The current report records a GitHub-hosted runner test using a disposable MongoDB 7 replica set and a seeded dataset of 10,000 users, 2,000 teams and 8,000 memberships. The 100-VU, 30-second run recorded 3,000 requests, 97.75 requests/second, 10.77 ms p95 and 0% HTTP failures. These are CI measurements, not a production deployment result or a production capacity guarantee.

See [docs/performance.md](docs/performance.md) for the exact run, tested commit and caveats.

## Local reviewer setup

Requirements: Node.js 20+, npm and MongoDB 7 configured as a replica set. Copy `.env.example` to `.env.local`, provide a disposable database URI and a fresh random JWT secret, then run:

```bash
npm ci
npm run dev
```

Email verification and recovery flows require a configured Resend sender. Use pre-verified disposable test accounts only when demonstrating locally without an email provider. Never use the demo seed against a production database.

## Before submitting

- [ ] Merge the submission-readiness branch after CI passes, then verify the latest `main` CI and CodeQL runs are green; link the exact run in the submission form.
- [ ] Complete a keyboard-only pass and mobile viewport pass; record any remaining accessibility limitations.
- [ ] Record the five-minute walkthrough from a disposable local environment and upload it.
- [ ] Re-check all repository links, setup steps and public visibility from a signed-out browser.
- [ ] Complete the organizer's submission form before the deadline.
- [ ] If no deployment is authorized, disclose that the live-URL criterion is unmet. Do not use the Vercel project hostname as a live URL until a successful deployment actually exists.

## Submission integrity

AI coding tools are allowed by the challenge, but candidates must be able to explain every line and make a small live change during the interview. Only present technical details you personally understand. The repository distinguishes implemented code, automated evidence, manual checks and external deployment gates; preserve that distinction in the submission and interview.
