# CrewForge — race-proof hackathon team formation

CrewForge is a team-formation platform built around a hard correctness requirement: a participant must not occupy two teams in the same hackathon, and concurrent joins must never exceed a team's capacity.

It combines transactional membership operations, invitation lifecycle controls, skill-complementarity recommendations, real-time board updates, account security and repeatable load testing.

## Why this is technically interesting

Typical team directories are CRUD applications. CrewForge treats team membership as a concurrency problem. The database—not the browser—enforces one-team-per-participant and capacity invariants. Joining a final seat is a transaction that must remain correct even when dozens of people click at the same time.

## Architecture

- **Application:** Next.js 16 App Router, React 19, TypeScript.
- **Validation:** Zod 4 request schemas.
- **Persistence:** MongoDB replica set / Atlas; transactions, unique indexes, TTL indexes and change streams.
- **Identity:** bcrypt password hashing, signed JWT sessions in HttpOnly cookies, email verification and single-use password-reset tokens.
- **Realtime:** Server-Sent Events backed by MongoDB change streams, with a client refresh fallback.
- **Abuse controls:** same-origin mutation checks, persistent rate limiting, hashed security telemetry and an allowlisted operator dashboard.
- **Edge security:** Cloudflare WAF Terraform template (requires a proxied production zone).
- **Quality:** Vitest, MongoDB race integration test, npm audit, TypeScript, Next.js production build and k6.

## Core guarantees

1. One participant per hackathon: unique index on `(hackathonId, userId)`.
2. No over-capacity team: conditional capacity reservation inside the same transaction as membership insertion.
3. Safe retries: request-bound idempotency keys distinguish valid retries from conflicting reuse.
4. Race-safe invites: random opaque tokens, SHA-256-only storage, expiry, single use and leader revocation.
5. Consistent leadership: leader departure transfers leadership to the earliest remaining member; empty teams close and outstanding invites are revoked.
6. Traceability: team and invite actions are written to an audit timeline.

## Local development

Requirements: Node.js 20+, npm and a MongoDB replica set (local Docker or Atlas).

1. Copy `.env.example` to `.env.local`.
2. Set `MONGODB_URI` to a replica-set connection string.
3. Set `JWT_SECRET` to at least 32 random characters.
4. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
5. Configure `RESEND_API_KEY` and `EMAIL_FROM` with a verified Resend sender to test verification and recovery emails.
6. Run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Email registration intentionally does not activate a session until the user verifies their address. Without a working email provider, the app cannot complete that flow; configure the provider before demoing registration.

## Main user flows

- Register, verify email, sign in and sign out.
- Create a team, edit leader-controlled settings and browse open teams.
- Join and leave teams with transactional capacity and membership guarantees.
- Generate, list and manually revoke invitation links; accept valid invitations once.
- Get explainable team suggestions from skill complementarity and available seats.
- Receive real-time board changes over SSE.
- Recover an account using an expiring password-reset email.
- Inspect rate-limit telemetry at `/admin/security` for accounts listed in `ADMIN_EMAILS`.

## API overview

| Route | Purpose |
|---|---|
| `GET/POST /api/auth` | Session, registration, login and logout |
| `POST /api/auth/verify` | Verify an email token |
| `POST /api/auth/verification` | Resend verification |
| `POST /api/auth/recovery` | Request a password-reset email |
| `POST /api/auth/reset` | Consume a reset token |
| `GET/POST /api/teams` | Browse/create teams |
| `POST /api/teams/:id/join` | Transactional join |
| `POST /api/teams/:id/leave` | Leave / leadership succession |
| `PATCH /api/teams/:id` | Leader-only settings |
| `POST /api/teams/:id/invites` | Create invite |
| `GET/DELETE /api/teams/:id/invites` | List and revoke invites |
| `POST /api/invites/:token` | Accept invite |
| `POST /api/matches` | Skill matching |
| `GET /api/events` | Bounded SSE board stream |
| `GET /api/admin/security` | Allowlisted security telemetry |

## Tests and scale validation

```bash
npm run typecheck
npm test
npm run build
```

The MongoDB integration race test requires `MONGODB_TEST_URI` to point to a replica set. It sends 50 concurrent contenders for one final seat and asserts exactly one winner.

The CI workflow provisions a disposable MongoDB replica set, audits dependencies, seeds and verifies 10,000 users / 2,000 teams / 8,000 memberships, runs the typecheck and test suite, builds production assets, and executes a 100-VU / 30-second k6 board test.

The latest recorded benchmark is documented in [docs/performance.md](docs/performance.md). It is a GitHub-runner benchmark against a local MongoDB container, not a production-region result. Run the same test against the deployed URL before claiming production performance.

## Production gates — do not skip

- Configure MongoDB Atlas replica-set URI, JWT secret, canonical HTTPS origin and trusted client IP handling.
- Configure Resend sender/domain, SPF, DKIM and DMARC; test verification, resend, recovery, expiry and replay.
- Configure `ADMIN_EMAILS`; verify non-admin access is denied.
- Deploy behind Cloudflare after the production domain is added and proxied; review managed WAF false positives.
- Verify SSE behavior and function-duration limits on the selected hosting plan.
- Run deployed smoke tests and k6; record p50/p95/p99, throughput, error rate, database tier and region.
- Test backup restore and deployment rollback.

See [docs/architecture.md](docs/architecture.md), [docs/performance.md](docs/performance.md) and [docs/production-readiness.md](docs/production-readiness.md).

## Challenge demo narrative

Start with the invariant: "A participant gets at most one team per hackathon, and a team can never exceed capacity—even under concurrent requests." Show the 50-contender integration test, then create a team, invite a participant, revoke an invite and show the revoked link fails. Finish with the 10k/2k/8k seeded board and k6 measurements. Be explicit that the load numbers are CI results, not deployed production results.
