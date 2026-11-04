# CrewForge

**Public interactive demo:** https://crewforge-demo-pspyn.vercel.app/ — static browser-only; no backend/API. The production race guarantee is demonstrated by the repository integration tests, not by this simulation. — PS1 one-page design brief

**Challenge:** Hack4Hack Crew Hiring Challenge 2026 · PS1: Race-proof team formation at scale  
**Repository:** https://github.com/PSP-YN/Race-proof-team-formation

## Problem

At hackathon scale, many participants can attempt to join the same team at the same time. A client-side capacity check or a read-then-write API can admit more people than the team allows. A participant can also race two requests to join different teams. The system must preserve both invariants under concurrent requests and retries.

## Data model

MongoDB stores the authoritative state:

- **users** — normalized unique email, password hash, verification state and session version.
- **teams** — hackathon, leader, team metadata, min/max size, status and authoritative member count.
- **memberships** — participant-to-team relationship. A unique compound index on `(hackathonId, userId)` enforces one team per participant per hackathon.
- **idempotency** — unique `(userId, key)`, bound to the requested hackathon and team.
- **invites** — SHA-256 token hash, expiry, consumed/revoked timestamps.
- **audit** — append-oriented record of actor, action, target and timestamp.
- **rateLimits / securityEvents / authTokens** — persistent abuse counters, privacy-preserving security telemetry and hashed single-use authentication tokens.

Indexes are part of the correctness model, not optional performance tuning. The application requires a MongoDB replica set or sharded cluster for transactions and change streams.

## How the last-seat race is prevented

1. The API authenticates the participant, validates the request and checks the request-bound idempotency key.
2. Inside one MongoDB transaction, it conditionally increments the team's member count only if the team is open and `memberCount < maxSize`.
3. It inserts the participant's membership in the same transaction.
4. The unique `(hackathonId, userId)` index prevents the participant from joining a second team in that hackathon, even if two different team requests race.
5. The transaction records the audit event and commits. If capacity or uniqueness fails, the transaction aborts; the counter and membership cannot diverge.
6. The MongoDB driver retries transient transaction conflicts. A replay with the same idempotency key and same target returns the original logical result; reusing the key for a different target is rejected.

The integration suite calls the production `joinTeamTransaction` helper. It creates one remaining seat and launches 50 concurrent contenders; assertions require exactly one successful membership, two total members including the leader, a stored member count of two, one idempotency record and one audit event. Separate real-database tests cover cross-team duplicate membership, replay safety and conflicting idempotency-key reuse.

## Other lifecycle and product decisions

- Invite tokens are high-entropy, opaque and stored only as hashes. Expiry, revocation, single-use consumption, membership insertion and audit writes are transactionally enforced.
- When a leader leaves, the earliest remaining member becomes leader and outstanding invites are revoked. When the final member leaves, the team is closed.
- Skill matching scores candidates for filling skills the team still needs and for available capacity; the explanation accompanies the score.
- The board uses MongoDB change streams over bounded Server-Sent Events. SSE fits one-way board invalidation; reconnect and refresh fallback avoid making a long-lived socket a correctness dependency.
- Same-origin checks, persistent rate limits, server-side authorization, HttpOnly sessions and hashed security telemetry protect mutation and account flows.

## Trade-offs

MongoDB transactions and unique indexes were chosen over client-side checks, in-memory locks or Redis locks. They keep invariants next to the source of truth and work across multiple application instances. The cost is replica-set infrastructure, transaction overhead and careful connection-pool management. SSE is simpler than WebSockets for one-way updates, but change streams consume database connections and serverless stream duration must be measured on the target host.

## Evidence and limits

The repository documents a CI benchmark with 10,000 users, 2,000 teams and 8,000 memberships; 100 virtual users for 30 seconds; 3,000 requests; 97.84 requests/second; 11.01 ms p95; and 0% HTTP failures. The environment was a GitHub-hosted runner with a disposable local MongoDB replica set. It is a regression benchmark, **not** a production-region or deployed-service measurement.

The automated suite includes 32 route-handler API contract tests, 9 unit tests and four MongoDB replica-set integration tests, including the 50-contender race. The current application supports direct joins and invite acceptance; it does not yet implement a leader-moderated pending join-request queue or leader-driven member removal. API tests use real `NextRequest` objects and the actual route handlers while isolating database/auth/security dependencies with mocks; they are not full deployed end-to-end tests. Provider delivery, full database-backed invite lifecycle and broader staging authorization/abuse checks remain manual release checks.

## What I would do with one more week

1. Implement the missing pending join-request workflow (leader accept/decline) and leader-driven member removal, then add route-level and database integration tests for authorization and race behavior.
2. Add optimistic UI rollback for 409 conflicts, Docker Compose for reproducible local setup, and a server-kill-during-join chaos test.
3. Deploy a staging backend with a replica-set database and verified email provider; run the outstanding invite, role authorization, origin/rate-limit, SSE multi-session and failure-mode matrix.
4. Run a 15–30 minute soak and controlled burst test against the deployed environment; capture p50/p95/p99, throughput, errors and database pool behavior. Add tracing/metrics, alerting, backup/restore rehearsal and rollback procedure.

**Submission honesty:** the full-stack application has not been deployed. The public URL is a static browser-only demo and does not satisfy the deployed-backend requirement.
