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
- **joinRequests** — pending/accepted/declined/cancelled requests; unique `(userId,idempotencyKey)`, plus a partial unique `(hackathonId,userId)` index while status is pending.
- **invites** — SHA-256 token hash, expiry, consumed/revoked timestamps.
- **audit** — append-oriented record of actor, action, target and timestamp.
- **rateLimits / securityEvents / authTokens** — persistent abuse counters, privacy-preserving security telemetry and hashed single-use authentication tokens.

Indexes are part of the correctness model, not optional performance tuning. The application requires a MongoDB replica set or sharded cluster for transactions and change streams.

## How the last-seat race is prevented

1. The API authenticates the participant, validates the request and stores a pending request with a request-bound idempotency key. A partial unique index prevents multiple active requests per participant and hackathon.
2. The current leader accepts a pending request. Inside one MongoDB transaction, the service verifies leader authority and request state, inserts the membership, and conditionally increments memberCount only while the team is open and below maxSize.
3. The same transaction marks the request accepted and appends the audit event. If capacity or uniqueness fails, the transaction aborts; membership, capacity and request status cannot diverge.
4. The unique (hackathonId, userId) membership index prevents a participant from joining a second team in the hackathon, including through invite acceptance or team creation.
5. The MongoDB driver retries transient transaction conflicts. Replaying the same idempotency key and target returns the original request; reusing the key for another target is rejected.

The integration suite calls the production requestJoinTransaction and decideJoinRequestTransaction helpers. It creates one remaining seat, inserts 50 pending requests and launches 50 leader approvals concurrently; exactly one request is accepted and 49 approvals are rejected. Assertions require two total memberships including the leader, memberCount=2 and exactly one JOIN_REQUEST_ACCEPTED audit event. Separate database tests cover unique membership, request replay safety, conflicting idempotency-key reuse, decline, full-seat rejection and member removal.

## Moderated joins and leader member management

A participant's board action creates a pending joinRequests record; it does not reserve a seat or create membership. A participant may hold only one pending request per hackathon, enforced by the partial unique index. Only the current leader can view the pending queue and accept or decline. The legacy /join endpoint creates the same moderated request and cannot bypass approval.

The leader-only member removal endpoint prevents self-removal through that route, deletes the selected membership, decrements memberCount and writes an audit event in one transaction. Pending requests by a removed participant in that hackathon are cancelled. Leaders transfer leadership through the normal Leave team flow; the earliest remaining member becomes leader.

## Other lifecycle and product decisions

- Invite tokens are high-entropy, opaque and stored only as hashes. Expiry, revocation, single-use consumption, membership insertion and audit writes are transactionally enforced.
- When a leader leaves, the earliest remaining member becomes leader and outstanding invites are revoked. When the final member leaves, the team is closed.
- Skill matching scores candidates for filling skills the team still needs and for available capacity; the explanation accompanies the score.
- The board uses MongoDB change streams over bounded Server-Sent Events. SSE fits one-way board invalidation; reconnect and refresh fallback avoid making a long-lived socket a correctness dependency.
- Same-origin checks, persistent rate limits, server-side authorization, HttpOnly sessions and hashed security telemetry protect mutation and account flows.

## Trade-offs

MongoDB transactions and unique indexes were chosen over client-side checks, in-memory locks or Redis locks. They keep invariants next to the source of truth and work across multiple application instances. The cost is replica-set infrastructure, transaction overhead and careful connection-pool management. SSE is simpler than WebSockets for one-way updates, but change streams consume database connections and serverless stream duration must be measured on the target host.

## Evidence and limits

The repository documents a CI benchmark with 10,000 users, 2,000 teams and 10,000 memberships; 100 virtual users for 30 seconds; 3,000 requests; 97.43 requests/second; 20.92 ms p95; and 0% HTTP failures. The environment was a GitHub-hosted runner with a disposable local MongoDB replica set. It is a regression benchmark, **not** a production-region or deployed-service measurement.

The automated suite currently includes 45 route-handler API contract tests, 9 unit tests and 11 MongoDB replica-set integration tests, including the 50-contender race and the moderated request/accept/decline/removal workflows. These tests passed against the local disposable MongoDB 7 replica set during this update. API tests use real `NextRequest` objects and the actual route handlers while isolating database/auth/security dependencies with mocks; they are not full deployed end-to-end tests. Provider delivery, full database-backed invite lifecycle and broader staging authorization/abuse checks remain manual release checks.

## What I would do with one more week

1. Configure a managed MongoDB replica-set database and verified Resend sender in Vercel, then deploy the full-stack service.
2. Run the full staging authorization, invite lifecycle, origin/rate-limit, SSE multi-session and failure-mode matrix against the deployed URL.
3. Add optimistic UI rollback for 409 conflicts, Docker Compose, tracing/metrics and a server-kill-during-join chaos test.
4. Run a 15–30 minute soak and controlled burst test against the deployed environment; capture p50/p95/p99, throughput, errors and database pool behavior, then rehearse backup restore and rollback.

**Deployment gate:** the workflows are implemented and locally integration-tested. The full-stack app still cannot be deployed as a working service until Vercel has a MongoDB Atlas replica-set URI and Resend sender credentials. The public URL remains a static browser-only demo.
