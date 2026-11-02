# CrewForge — Race-proof team formation

CrewForge helps hackathon participants discover teams, create crews and join without overfilling teams or assigning one participant to multiple teams.

## Stack
- Next.js 16 App Router, React 19 and TypeScript
- Zod 4 input validation and Vitest 4 test runner
- MongoDB replica set (MongoDB Atlas or local replica set)
- bcrypt password hashing, signed HttpOnly sessions and Zod validation
- Vitest unit/integration tests, MongoDB concurrency test and k6 load script
- GitHub Actions CI

## Local setup
1. Use Node.js 20 or newer.
2. Copy .env.example to .env.local.
3. Set MONGODB_URI to a MongoDB replica-set connection string.
4. Set JWT_SECRET to a random secret of at least 32 characters.
5. Set NEXT_PUBLIC_APP_URL to the exact app origin (for local use, http://localhost:3000).
6. Run npm install, npm run dev, then open http://localhost:3000.

## Implemented flows
- Register, sign in and sign out.
- Create a team and discover open teams.
- Transactional team join with unique participant constraint, conditional capacity reservation and request-bound idempotency.
- Leave a team; transfer leadership to the earliest remaining member or close the empty team.
- Leader-only team settings endpoint.
- Leader-generated invite links with random opaque tokens, hashed token storage, expiry and single-use transactional acceptance.
- Explainable team suggestions using skill complementarity and available seats.
- Same-origin checks and persistent fixed-window rate limiting on mutation routes.
- Append-only audit events for core membership/team actions.

## API
- GET /api/auth; POST /api/auth (register/login/logout)
- GET /api/teams?hackathonId=...; POST /api/teams
- POST /api/teams/:teamId/join (hackathonId, idempotencyKey, optional skills)
- POST /api/teams/:teamId/leave
- PATCH /api/teams/:teamId (leader only)
- POST /api/teams/:teamId/invites (leader only)
- POST /api/invites/:token (authenticated acceptance)
- POST /api/matches (hackathonId, skills)
- GET /api/board?hackathonId=...

## Seed and test
Seed a disposable database with 10,000 participants, 2,000 teams and 8,000 memberships:
```bash
npm run seed
```
Set a unique `SEED_DEMO_PASSWORD` (16–72 UTF-8 bytes) before running the script; every seeded account shares that password. Never use seeded credentials in production. To replace only the configured hackathon's demo data, pass `--reset` to the script. The script refuses to run with NODE_ENV=production.

Run validation:
```bash
npm run typecheck
npm test
npm run build
```
CI provisions a disposable MongoDB replica set and runs the 50-contender last-seat race integration test. The test also runs locally when MONGODB_TEST_URI points to a replica set.

Run the 100-VU, 30-second board test (requires k6):
```bash
BASE_URL=https://your-deployment.example npm run loadtest
```
CI runs the same 100-VU, 30-second test against the seeded fixture. The latest passing CI run measured p95 21.78 ms and 0% HTTP failures on a GitHub-hosted runner; this is not a production-region result. See the performance report and repeat against the deployed URL before making production performance claims.

## Known gaps before final production submission
- The UI exposes create/join/leave, leader edit/invite and matching. Invite revocation and richer member/profile management are not yet exposed.
- The board currently refreshes by five-second polling rather than SSE/WebSocket.
- Email verification, account recovery, abuse monitoring and a managed WAF are not implemented.
- The 100-VU target has not been measured against the final deployment.
- Deploying requires your MongoDB replica-set URI, JWT secret and exact NEXT_PUBLIC_APP_URL in the hosting environment.

See [docs/architecture.md](docs/architecture.md) for transaction, security and verification details, and [docs/performance.md](docs/performance.md) for the measured 100-VU CI benchmark and its limitations.
