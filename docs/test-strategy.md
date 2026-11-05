# Test strategy and verification matrix

This document separates automated white-box verification, automated black-box smoke checks, and manual staging release checks. A passing test suite is evidence for the tested cases, not proof that every production configuration is correct.

## White-box tests currently automated

| Area | Automated location | Current assertion |
|---|---|---|
| Team size invariants | tests/unit/invariants.test.ts | Valid min/max sizes are accepted; invalid ranges are rejected |
| Route-handler API contracts | tests/api/route-contracts.test.ts | 49 request/response tests across auth, team, join requests, member management and health endpoints |
| Skill matching | tests/unit/invariants.test.ts | Scores reward uncovered skills (65%), time-zone proximity (20%) and open-seat capacity (15%); unrelated or already-covered skills are not rewarded. Missing time-zone data is neutral |
| Membership transaction integration | tests/integration/race.test.ts | 11 real-MongoDB tests: 50-way final-seat approval race, cross-team uniqueness, idempotency, moderated requests, leader authorization, accept/decline, full-seat rejection and leader member removal |
| Transaction fault injection | tests/chaos/kill-mid-join.mjs | Kills a worker after transaction writes are staged but before commit; asserts that membership, capacity, request status and audit writes all roll back |
| Type and build integrity | CI | TypeScript typecheck and Next.js production build pass |
| Dependency risk | CI | npm audit reports no vulnerabilities at the configured moderate threshold |

The route-handler API contract suite in `tests/api/route-contracts.test.ts` adds 49 automated tests using real `NextRequest` inputs and route handlers with database/auth/security dependencies isolated behind mocks. It covers authentication session responses, malformed and invalid auth payloads, login outcomes, logout cookie clearing, missing email-provider configuration, team board caching, team creation authorization and validation, join authorization/idempotency validation, and health readiness/failure responses. These are route-level API tests, not full deployed end-to-end tests; provider delivery, database-backed invitation lifecycle, role authorization across every mutation, and staging abuse behavior remain in the manual matrix below. The MongoDB replica-set integration suite exercises the 50-request concurrent approval race, cross-team duplicate membership, idempotent replay, request creation/approval/decline, capacity exhaustion and member removal against a real database. The 50-way race test calls the same `requestJoinTransaction` and `decideJoinRequestTransaction` helpers used by the join-request HTTP routes, rather than maintaining a second copy of the transaction algorithm.

## Automated black-box smoke checks

The CI workflow starts the production Next.js server against a disposable MongoDB replica set and runs scripts/smoke.mjs. It verifies:

- Health endpoint and database ping
- Security headers and API no-store cache policy
- Cross-origin authentication mutation is rejected
- Public board JSON response shape
- SSE response headers and initial connected event

## Manual staging black-box checks

Run these against a disposable staging deployment using separate test accounts. Do not use real participant data.

| Scenario | Action | Expected result |
|---|---|---|
| Registration | Register with a valid email | Verification email is sent; account is not active before verification |
| Verification | Open a valid verification link | Token is consumed once and the account becomes verified |
| Verification replay | Open the same link again | Request is rejected without changing account state |
| Login | Login with verified and unverified accounts | Verified login succeeds; unverified login is blocked |
| Team creation | Create a team with a capacity and skill needs | Team appears on the board with correct capacity |
| Capacity race | Send concurrent joins for the last seat | One join succeeds; no over-capacity state is observable |
| Duplicate membership | Attempt to join a second team in the same hackathon | Request is rejected and original membership remains |
| Idempotent retry | Repeat the same mutation with the same key | One logical mutation is recorded |
| Idempotency conflict | Reuse a key for a different target | Conflict response; no second mutation |
| Invite lifecycle | Create, list, revoke, and accept invitations | Leader controls are enforced; revoked/expired/used tokens fail |
| Leadership | Leader leaves a non-empty team | Earliest remaining member becomes leader |
| Last member leaves | Last member leaves | Team closes and outstanding invites are revoked |
| Recovery | Request and consume a reset link | Reset succeeds once and old sessions are invalidated |
| Authorization | Access admin endpoints as a non-allowlisted user | Access is denied server-side |
| Origin protection | Submit a mutation from a foreign origin | Request is rejected |
| Rate limiting | Exceed a configured endpoint limit | Request is throttled and telemetry is recorded without raw secrets |
| Realtime | Open the board in two sessions and mutate a team | Other session receives an SSE update or documented polling fallback |
| Health | Call /api/health | Database health is reported; dependency failure returns 503 |
| Failure mode | Stop or disconnect MongoDB in staging | API fails safely; no success response is returned for failed writes |

## CI verification

The GitHub Actions workflow provisions a disposable MongoDB replica set, seeds and verifies 10,000 users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants and 4,000 open seats, runs typecheck and automated tests, audits locked dependencies, builds the application, starts the production server, runs smoke checks, and executes the 100-VU/30-second k6 board test.

Latest successful submission-branch CI run: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/42057405278. Matching CodeQL run: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/42057405246. Both passed on commit `274feac`, including the corrected seed, 71-test suite, transaction-kill rollback and 100-VU load test.

## Local verification on submission-readiness branch

The submission-readiness branch was verified locally with the following commands/results:

- `npm run typecheck` — passed.
- `MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?directConnection=true&replicaSet=rs0' npm test` — **71/71 tests passed across 3 files**, including 11 real MongoDB replica-set integration tests and the 50-contender final-seat approval race.
- `MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?directConnection=true&replicaSet=rs0' npm run chaos` — passed; a worker was killed after transaction writes were staged and before commit, and the database retained the original membership count, pending request and zero acceptance audit events.
- `npm run build` — production build passed.
- `npm audit --audit-level=moderate` — 0 vulnerabilities.
- `BASE_URL=http://localhost:3002 npm run smoke` — all five checks passed against the Docker Compose app through its loopback-only trusted proxy: health/database, security headers, cross-origin rejection, board JSON and SSE connected event.

The local fixture contains 10,000 synthetic users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants, 4,000 open seats and 2 judge-only accounts. The API route tests isolate database/auth/security dependencies with mocks; the integration and chaos tests use separate disposable MongoDB databases. These local checks do not replace CI on the final release commit or deployed black-box validation.

## Manual release sign-off

Before a public production launch, record:

- Deployment URL, commit SHA, hosting region and runtime configuration
- MongoDB Atlas tier/region and backup/restore evidence
- Email sender verification and delivery tests
- Test account roles and black-box results
- Smoke test output
- k6 p50/p95/p99, throughput, errors and test duration
- Cookie, CORS/origin, rate-limit and authorization checks
- Rollback target and owner

Production sign-off remains incomplete until the deployed environment has been tested. CI-only results must not be described as production results.
