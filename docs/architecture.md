# Architecture and correctness notes

## Runtime
- Next.js App Router + React + TypeScript.
- MongoDB Atlas or a local MongoDB replica set. Multi-document transactions require replica-set support.
- bcrypt password hashes; signed JWT sessions in HttpOnly, SameSite=Lax cookies. Session versions are checked against the user record and incremented after password recovery so old sessions are rejected. Legacy accounts without an email verification flag are migrated to unverified and must complete email verification; seeded demo accounts are explicitly marked verified.
- Zod validation on API inputs.

## Collections and indexes
- users: normalized unique email, name, bcrypt password hash.
- teams: hackathon, team metadata, leader, status and authoritative memberCount.
- memberships: one participant per hackathon, enforced by unique (hackathonId,userId); ordered by teamId/joinedAt.
- idempotency: unique (userId,key), with the target hackathon and team stored so a replay cannot be silently reused for a different action.
- invites: SHA-256 token hashes, expiry, used/revoked timestamps and TTL cleanup.
- audit: action timeline.
- rateLimits: persistent fixed-window counters with TTL cleanup.
- authTokens: SHA-256-only email verification and password-reset tokens with expiry and TTL cleanup.
- securityEvents: hashed-identity abuse telemetry with a 30-day TTL.

## Race-safe membership
Joining inserts the membership and conditionally increments memberCount inside one MongoDB transaction. The conditional update only succeeds while memberCount < maxSize. The unique membership index prevents a participant joining two teams in one hackathon. Transaction write conflicts are retried by the MongoDB driver. A duplicate retry with the same idempotency key and same team returns a replay success; reuse of that key for another team returns 409.

Leaving deletes the member record and recomputes memberCount in a transaction. If the leader leaves, leadership passes to the earliest remaining member. If the last member leaves, the team is marked deleted and its invites are revoked.

Invite acceptance checks an opaque random token by its SHA-256 hash, expiry, revocation and single-use state. Membership, capacity reservation, invite consumption and audit insertion happen in one transaction. When a team leader leaves, all outstanding invites are revoked in that same transaction before leadership transfers.

## API surface
- GET /api/auth; POST /api/auth with register, login or logout action.
- GET /api/teams?hackathonId=...; POST /api/teams.
- POST /api/teams/:teamId/join; POST /api/teams/:teamId/leave.
- PATCH /api/teams/:teamId for leader-only settings.
- POST /api/teams/:teamId/invites; GET/DELETE /api/teams/:teamId/invites; POST /api/invites/:token.
- POST /api/auth/verify, /api/auth/verification, /api/auth/recovery and /api/auth/reset.
- GET /api/events for bounded SSE board updates; GET /api/admin/security for allowlisted telemetry; GET /api/health for service readiness.
- POST /api/matches for skill-complementarity recommendations.
- GET /api/board for the board.

## Security controls
Mutating API routes require a matching Origin (or Referer origin) and use persistent MongoDB fixed-window rate limits. Vercel deployments compare against the request origin so preview URLs work; self-hosted deployments compare against NEXT_PUBLIC_APP_URL. Authentication uses a 15,000-request per-IP ceiling per 15 minutes plus 10 attempts per email/IP pair per 15 minutes. This avoids a global per-email lockout that a third party could trigger against a victim account. Authenticated write routes use a high shared-IP ceiling and route-specific per-account limits (for example, 3 team creations per account per minute and 10 joins per account per minute), avoiding low per-IP limits that would lock out a large event behind one venue NAT. Configure NEXT_PUBLIC_APP_URL to the exact deployed origin. On Vercel, the IP key uses x-real-ip, which Vercel documents as the client IP header it overwrites. On self-hosted production, set TRUSTED_CLIENT_IP_HEADER to a header that your trusted reverse proxy overwrites and prevent direct access to the app server. Local development uses one local-development bucket. If a production IP header is unavailable, mutation requests fail closed with 503 rather than sharing an unknown-IP bucket. A proxy in front of Vercel can collapse clients to the proxy IP; deploy directly behind Vercel or configure a supported trusted-proxy path. See https://vercel.com/docs/headers/request-headers. For self-hosted deployments, configure TRUSTED_CLIENT_IP_HEADER (for example, x-real-ip) only when the reverse proxy overwrites it and the app server is not directly reachable.

Rate-limit exceedances (including public SSE connection limits) and failed authentication attempts are stored as security events with hashed identity keys and 30-day TTL. The restricted security dashboard is allowlisted by ADMIN_EMAILS. This is basic abuse telemetry, not a SIEM: configure external alerts and monitor authentication failures, invitation abuse, email-provider bounces and database anomalies. Email verification and recovery use single-use hashed tokens sent through Resend; configure RESEND_API_KEY and EMAIL_FROM, and publish SPF/DKIM/DMARC records. The board uses a bounded MongoDB change stream and EventSource reconnection; it requires a replica set or sharded cluster and must be tested against the target serverless duration and connection limits. Cloudflare WAF configuration is provided as Terraform but is not active until a production zone is added and proxied. Do not expose the MongoDB URI or JWT secret to NEXT_PUBLIC_* variables.

## Demo data
Run npm run seed against a disposable database to create 10,000 demo users, 2,000 teams and 8,000 memberships. Set a unique SEED_DEMO_PASSWORD (16–72 UTF-8 bytes) before seeding; all seeded accounts use that value. The script refuses to run when NODE_ENV=production. Use --reset only on a disposable demo database; it deletes records for the configured hackathon ID before reseeding.

## Verification
- npm run typecheck
- npm test (the MongoDB race test runs when MONGODB_TEST_URI points to a replica set)
- npm run build
- npm run seed (disposable database only)
- BASE_URL=https://your-deployment.example npm run loadtest (requires k6)

The integration race test sends 50 concurrent contenders for one remaining seat and asserts exactly one membership wins. CI also executes scripts/smoke.mjs against the production Next.js server to verify the health route, public board JSON and initial SSE connection before running k6. CI seeds and verifies the 10k/2k/8k dataset, runs the race test, and executes the 100-VU, 30-second k6 board test. The latest verified follow-up CI result is documented in docs/performance.md (p95 28.93 ms, 0% HTTP failures, and 27/27 black-box API scenarios passed on the GitHub-hosted runner). See docs/performance.md. This is not a deployed-region measurement; repeat against the production URL.
