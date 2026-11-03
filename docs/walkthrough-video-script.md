# CrewForge — five-minute walkthrough video script

**Target length:** 4:30–5:00  
**Purpose:** Let a reviewer understand the user problem, see the product, and verify the race-safety evidence quickly.  
**Recording mode:** Use a local instance and disposable MongoDB replica set. Do not imply that the local instance is a public deployment.

## Recording preparation

- Start MongoDB as a replica set and configure a disposable `.env.local`.
- Run `npm ci`, `npm run dev`, and open the app in a clean browser profile.
- Prepare two verified demo accounts with different browser profiles.
- Use a separate disposable database for the 10,000-user seed. Do not seed the interactive demo database.
- Keep the GitHub repository, CI run and performance report ready in other tabs.
- Hide terminal secrets, environment files, email inboxes containing private information and raw invite tokens.
- If email delivery is not configured locally, use pre-verified disposable accounts and say so. Do not bypass production verification.

## Timed walkthrough

### 0:00–0:25 — The problem

**Show:** CrewForge landing page and team board.

**Say:** “CrewForge solves team formation when many participants compete for limited seats. The key requirement is not just showing available capacity; it is ensuring the database never records an over-capacity team or lets one participant join two teams in the same hackathon.”

### 0:25–1:05 — Create and discover a team

**Show:** Create a team, set its size limits and skill needs, then return to the board.

**Say:** “The team board exposes the available teams and the skills they need. These values are validated by the server. The browser is not the authority for membership or capacity.”

### 1:05–1:45 — Invite lifecycle

**Show:** As leader, create an invite, list it, and revoke it. Avoid showing the raw token.

**Say:** “Invitations are random, expiring and single-use. Only the leader can manage them. The database stores a hash rather than the bearer token, and acceptance is committed with the membership change.”

### 1:45–2:20 — Join and matching

**Show:** In the second browser profile, view the board, inspect a match suggestion and join a team. Return to the first profile.

**Say:** “Matching explains which uncovered skills a candidate contributes. A successful join updates membership and capacity together. The board receives updates through server-sent events, with reconnect and refresh fallback.”

### 2:20–3:25 — Explain the race-proof transaction

**Show:** Open `docs/architecture.md` and the integration test `tests/integration/race.test.ts`.

**Say:** “The join operation uses a MongoDB transaction. A conditional capacity update reserves a seat, while a unique compound index on hackathon and user prevents duplicate membership across teams. Both changes commit or abort together. Request-bound idempotency keys make network retries safe.”

**Point to:** the test that launches 50 contenders for one remaining seat and asserts exactly one winner and a consistent stored count.

### 3:25–4:10 — Scale and measured performance

**Show:** CI workflow, seed verification and `docs/performance.md`.

**Say:** “CI provisions a disposable MongoDB replica set, verifies 10,000 users, 2,000 teams and 8,000 memberships, runs the race test, builds the app, performs smoke checks and runs a 100-user k6 board test. The recorded run processed 3,000 requests at 97.75 requests per second, with 10.77 milliseconds p95 and zero HTTP failures.”

**Say immediately after:** “Those figures are from a GitHub-hosted runner and local disposable MongoDB. They are not production-region measurements.”

### 4:10–4:45 — Security and limits

**Show:** `docs/threat-model.md`, security dashboard if available, and test strategy.

**Say:** “The project also includes same-origin mutation checks, server-side authorization, persistent rate limits, HttpOnly sessions, hashed single-use tokens and privacy-preserving security telemetry. The documented manual matrix covers flows that still need staging verification.”

### 4:45–5:00 — Close

**Show:** Repository README and submission brief.

**Say:** “The strongest part of CrewForge is its database-enforced consistency model and reproducible concurrency evidence. The repository records what is verified and what remains incomplete. This recording uses a local environment; the challenge's live-URL requirement is not claimed as complete.”

## Recording checklist

- [ ] Record at 1080p with readable browser and editor text.
- [ ] Keep the walkthrough under five minutes.
- [ ] Show the 50-contender test source and its passing CI evidence.
- [ ] Show the performance report and explicitly state its environment.
- [ ] Do not expose credentials, tokens, private user data or seeded passwords.
- [ ] Do not claim a deployed URL, production WAF or production benchmark.
- [ ] Upload the final MP4 to the submission portal or a shareable location and verify reviewer access.
