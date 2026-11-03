# Test strategy and verification matrix

This document separates automated white-box verification, automated black-box smoke checks, and manual staging release checks. A passing test suite is evidence for the tested cases, not proof that every production configuration is correct.

## White-box tests currently automated

| Area | Automated location | Current assertion |
|---|---|---|
| Team size invariants | tests/unit/invariants.test.ts | Valid min/max sizes are accepted; invalid ranges are rejected |
| Route-handler API contracts | tests/api/route-contracts.test.ts | 32 request/response tests across auth, team, join and health endpoints |
| Skill matching | tests/unit/invariants.test.ts | Scores reward uncovered skills and available capacity; unrelated or already-covered skills are not rewarded |
| Contended membership | tests/integration/race.test.ts | Exactly one of 50 contenders obtains the final seat; stored membership count and team memberCount remain consistent |
| Type and build integrity | CI | TypeScript typecheck and Next.js production build pass |
| Dependency risk | CI | npm audit reports no vulnerabilities at the configured moderate threshold |

The route-handler API contract suite in `tests/api/route-contracts.test.ts` adds 32 automated tests using real `NextRequest` inputs and route handlers with database/auth/security dependencies isolated behind mocks. It covers authentication session responses, malformed and invalid auth payloads, login outcomes, logout cookie clearing, missing email-provider configuration, team board caching, team creation authorization and validation, join authorization/idempotency validation, and health readiness/failure responses. These are route-level API tests, not full deployed end-to-end tests; provider delivery, database-backed invitation lifecycle, role authorization across every mutation, and staging abuse behavior remain in the manual matrix below. The separate MongoDB replica-set integration test exercises the 50-contender final-seat race against a real database.

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

The GitHub Actions workflow provisions a disposable MongoDB replica set, seeds and verifies 10,000 users, 2,000 teams and 8,000 memberships, runs typecheck and automated tests, audits locked dependencies, builds the application, starts the production server, runs smoke checks, and executes the 100-VU/30-second k6 board test.

Latest successful full CI run for the current branch head: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41522634418

## Local verification on submission-readiness branch

The submission-readiness branch was verified locally with the following commands/results:

- `npm run typecheck` — passed.
- `MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0' npm test` — 42 tests passed across 3 files, including the real MongoDB replica-set race test (50 contenders, exactly one winner).
- `MONGODB_URI=... JWT_SECRET=... NEXT_PUBLIC_APP_URL=... npm run build` — production build passed.
- `npm audit --audit-level=moderate` — 0 vulnerabilities.

The API route tests isolate database/auth/security dependencies with mocks. The race test uses a disposable local MongoDB replica set. These local checks do not replace the GitHub Actions run on the final merged commit or deployed black-box validation.

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
