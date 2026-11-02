# Test strategy and verification matrix

This document separates automated white-box verification from black-box behavior checks. A passing test suite is evidence for the tested cases, not proof that every production configuration is correct.

## White-box tests

| Area | Verification | Required assertion |
|---|---|---|
| Domain invariants | `tests/unit/invariants.test.ts` | Capacity, membership and state transitions reject invalid states |
| Matching | Unit tests | Scores reward uncovered team needs and available capacity |
| Persistence | Replica-set integration tests | Transactional writes and unique indexes preserve invariants |
| Contended join | `tests/integration/race.test.ts` | Exactly one of 50 contenders obtains the final seat |
| Authentication | Unit/integration coverage | Invalid credentials, unverified users and invalid sessions are rejected |
| Idempotency | Integration coverage | Same key/same target is replay-safe; same key/different target conflicts |
| Invitations | Integration coverage | Expiry, revocation, single use and duplicate acceptance are enforced |
| Security | API tests and review | Origin checks, rate limits, role checks and token redaction are enforced |
| Build integrity | CI | TypeScript, test suite, dependency audit and production build pass |

## Black-box checks

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
| Health | Call `/api/health` | Database health is reported; dependency failure returns 503 |
| Failure mode | Stop or disconnect MongoDB in staging | API fails safely; no success response is returned for failed writes |

## CI verification

The GitHub Actions workflow provisions a disposable MongoDB replica set, seeds and verifies 10,000 users, 2,000 teams and 8,000 memberships, runs typecheck and tests, builds the application, starts the production server, runs smoke checks, and executes the 100-VU/30-second k6 board test.

Latest successful run: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41517226227

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
