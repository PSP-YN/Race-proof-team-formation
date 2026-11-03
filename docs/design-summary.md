# CrewForge — PS1 design summary

## Problem

Hackathon team formation must remain correct when many users concurrently request limited seats. A UI-only check is insufficient: two requests can both read the last available seat and overfill a team, or one participant can join two teams.

## Architecture

- **Application:** Next.js App Router, React, TypeScript, Node.js runtime.
- **Persistence:** MongoDB replica set / Atlas; transaction support and change streams.
- **Authentication:** bcrypt password hashes, email verification, expiring JWT sessions in HttpOnly cookies.
- **Live board:** MongoDB change streams → bounded Server-Sent Events → browser EventSource; reconnect and polling fallback.
- **Deployment:** Vercel-compatible application; MongoDB Atlas; Resend email; optional Cloudflare WAF template.
- **Local dev:** Docker Compose with a MongoDB replica set and Next.js standalone container.

## Data model

- `users`: unique email, password hash, verification status, session version.
- `teams`: hackathon ID, name, leader, min/max size, member count, skill needs, timezone, status.
- `memberships`: hackathon ID, team ID, user ID, skills, join timestamp; unique index on `(hackathonId,userId)`.
- `joinRequests`: candidate/team/hackathon, skills, status, timestamps; partial unique index prevents duplicate pending requests.
- `invites`: hashed opaque token, team/hackathon, expiry, used/revoked metadata.
- `idempotency`: user-scoped key mapped to operation and target.
- `audit`: actor, action, target and timestamp.
- `authTokens`: hashed single-use verification/recovery token and expiry.

## Race prevention and idempotency

A join acceptance runs inside a MongoDB transaction: read the pending request, insert the membership, conditionally increment the team's member count only while it is below `maxSize`, mark the request accepted, and write an audit record. A unique membership index prevents one person from joining multiple teams in the same hackathon. The conditional update prevents capacity overflow. The integration test launches 50 contenders for the final seat and asserts one winner.

Mutations use request-bound idempotency keys where retries can otherwise duplicate operations. Reuse of a key for a different target is rejected. Invitations are random, expiring, hashed at rest and consumed transactionally.

## Matching

- 65% uncovered skill fit, 15% approximate timezone offset compatibility, and 20% capacity when both time zones are present.
- 75% skill fit and 25% capacity when timezone data is missing.
- Skills are normalized and deduplicated; already-covered skills are not counted as a contribution.
- Time-zone offsets are compared at request time. This is a heuristic, not a guarantee of shared work hours.

## Security and observability

Zod validation, bcrypt, HttpOnly/SameSite cookies, session-version invalidation, same-origin mutation checks, IP/account rate limits, hashed telemetry, leader authorization, expiring token hashes, audit events, no-store API responses, security headers and a restricted operator dashboard. CI includes npm audit and CodeQL. The WAF template is not active until Cloudflare is configured.

## Performance evidence and limitations

CI seeds 10,000 users, 2,000 teams and 8,000 memberships. The 100-VU/30-second k6 test on the GitHub runner latest completed CI run 41660184028 recorded 3,000 requests, 98.23 req/s, 12.86 ms average, 28.93 ms p95, 0% HTTP errors and 6,000/6,000 board checks. The same run passed 27 black-box API scenarios and the 50-contender HTTP race. These are synthetic runner measurements with disposable local MongoDB, not production-region capacity.

## Trade-offs / next week

Transactions and unique indexes prioritize correctness over single-write simplicity. SSE fits one-way updates better than WebSockets; polling fallback protects usability. Mongo-backed rate limits avoid another service but can become a write bottleneck. Next: deploy to Atlas/Vercel, run staging security/soak/failover tests, measure production p99, tune connection pools, add email delivery webhooks and observability, and perform external accessibility/security review.
