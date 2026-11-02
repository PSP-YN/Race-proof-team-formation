# CrewForge — Race-proof team formation

A Next.js + MongoDB application for discovering and forming hackathon teams. The initial implementation focuses on the correctness-critical path: unique participation, transactional joins, capacity enforcement, idempotent requests, leader succession and audit events.

## Stack
- Next.js App Router, React, TypeScript
- MongoDB Atlas (replica set required for multi-document transactions)
- bcrypt password hashing and signed HttpOnly session cookies
- Zod request validation
- Vitest unit tests; k6 board load-test script
- GitHub Actions CI

## Local setup
1. Install Node.js 20+.
2. Copy .env.example to .env.local.
3. Create a MongoDB Atlas cluster (or local replica set) and set MONGODB_URI.
4. Set JWT_SECRET to a random value of at least 32 characters.
5. Run npm install, then npm run dev.
6. Open http://localhost:3000.

## Correctness guarantees
- A unique compound index on memberships(hackathonId,userId) prevents one participant from joining multiple teams in the same hackathon.
- Joining inserts the membership and conditionally increments the team's authoritative memberCount in one transaction. The conditional update only succeeds while memberCount < maxSize; otherwise the transaction aborts.
- Idempotency keys are unique per user, so retries with the same key do not add another membership.
- Leaving transfers leadership to the earliest remaining member. The team is marked deleted when its last member leaves.
- Audit events are written in the same transaction as the action.

## API
- GET /api/auth — current session
- POST /api/auth — register, login or logout (action)
- GET /api/teams?hackathonId=... — team board
- POST /api/teams — create a team (authenticated)
- POST /api/teams/:teamId/join — transactional join; requires hackathonId and idempotencyKey
- POST /api/teams/:teamId/leave — leave and transfer leadership if needed
- GET /api/board — board endpoint

## Validation
npm run typecheck, npm test, npm run build.
For the load script: BASE_URL=https://your-deployment.example npm run loadtest (requires k6 installed).

## Important remaining work before a judged production submission
The repository is a working foundation, not yet a fully verified final submission. Complete and verify: leader-only team editing and invite lifecycle, skill/time-zone match scoring with explanations, server-push updates (currently five-second polling), a true 50-way last-seat integration race test against a replica-set MongoDB, 10k participant/2k team seed data, 100-VU p95 evidence, rate limiting/CSRF-origin controls, and deployment verification. Do not claim the load target or race test passed until measured.

See docs/architecture.md.
