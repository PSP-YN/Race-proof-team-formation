# Architecture and correctness notes

## Runtime
- Next.js App Router + React + TypeScript.
- MongoDB Atlas or a local MongoDB replica set. Multi-document transactions require replica-set support.
- bcrypt password hashes; signed JWT sessions in HttpOnly, SameSite=Lax cookies.
- Zod validation on API inputs.

## Collections and indexes
- users: normalized unique email, name, bcrypt password hash.
- teams: hackathon, team metadata, leader, status and authoritative memberCount.
- memberships: one participant per hackathon, enforced by unique (hackathonId,userId); ordered by teamId/joinedAt.
- idempotency: unique (userId,key), with the target hackathon and team stored so a replay cannot be silently reused for a different action.
- invites: SHA-256 token hashes, expiry, used/revoked timestamps and TTL cleanup.
- audit: action timeline.
- rateLimits: persistent fixed-window counters with TTL cleanup.

## Race-safe membership
Joining inserts the membership and conditionally increments memberCount inside one MongoDB transaction. The conditional update only succeeds while memberCount < maxSize. The unique membership index prevents a participant joining two teams in one hackathon. Transaction write conflicts are retried by the MongoDB driver. A duplicate retry with the same idempotency key and same team returns a replay success; reuse of that key for another team returns 409.

Leaving deletes the member record and recomputes memberCount in a transaction. If the leader leaves, leadership passes to the earliest remaining member. If the last member leaves, the team is marked deleted and its invites are revoked.

Invite acceptance checks an opaque random token by its SHA-256 hash, expiry, revocation and single-use state. Membership, capacity reservation, invite consumption and audit insertion happen in one transaction.

## API surface
- GET /api/auth; POST /api/auth with register, login or logout action.
- GET /api/teams?hackathonId=...; POST /api/teams.
- POST /api/teams/:teamId/join; POST /api/teams/:teamId/leave.
- PATCH /api/teams/:teamId for leader-only settings.
- POST /api/teams/:teamId/invites; POST /api/invites/:token.
- POST /api/matches for skill-complementarity recommendations.
- GET /api/board for the board.

## Security controls
Mutating API routes require a matching Origin (or Referer origin) against NEXT_PUBLIC_APP_URL and use persistent MongoDB fixed-window rate limits. Authentication is limited to 20 attempts per 15 minutes per source IP; other write routes have route-specific limits. Configure NEXT_PUBLIC_APP_URL to the exact deployed origin. The IP key uses the last x-forwarded-for value, which should be appended by the trusted hosting proxy. Verify the actual header behavior for the selected host; do not expose this endpoint directly behind an untrusted proxy.

This is a baseline, not a substitute for a managed WAF, monitoring, account lockout/abuse detection, email verification, or a security review. Do not expose the MongoDB URI or JWT secret to NEXT_PUBLIC_* variables.

## Demo data
Run npm run seed against a disposable database to create 10,000 demo users, 2,000 teams and 8,000 memberships. Set a unique SEED_DEMO_PASSWORD (16–72 UTF-8 bytes) before seeding; all seeded accounts use that value. The script refuses to run when NODE_ENV=production. Use --reset only on a disposable demo database; it deletes records for the configured hackathon ID before reseeding.

## Verification
- npm run typecheck
- npm test (the MongoDB race test runs when MONGODB_TEST_URI points to a replica set)
- npm run build
- npm run seed (disposable database only)
- BASE_URL=https://your-deployment.example npm run loadtest (requires k6)

The integration race test sends 50 concurrent contenders for one remaining seat and asserts exactly one membership wins. The k6 script uses 100 virtual users for 30 seconds and checks board response latency/error thresholds. CI starts a disposable MongoDB replica set and runs the race test. Passing CI is not evidence that the deployed system meets a particular load target; retain measured k6 output from the target environment.
