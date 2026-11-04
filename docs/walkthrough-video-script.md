# CrewForge — five-minute walkthrough video script

**Target length:** 4:30–5:00  
**Purpose:** Let a reviewer understand the user problem, see the product, and verify the race-safety evidence quickly.  
**Recording mode:** Start with the [public static demo](https://crewforge-demo-pspyn.vercel.app/) and then show GitHub source + CI evidence. The public demo has no backend/API: its create/join/leave and matching interactions are simulations saved in local browser storage. Do not claim it performs real auth, invites, transactions or live multi-user sync.

## Recording preparation

- Open the public static demo in an incognito browser to show it works without login.
- Keep the GitHub repository, CI run, integration test and performance report ready in other tabs.
- Use the `Reset demo` button before recording to restore the six seed teams.
- If you separately record the full-stack local app, use a disposable MongoDB replica set and verified test users. Do not mix its data with the browser-only demo.
- Hide terminal secrets, environment files, email inboxes containing private information and raw invite tokens.
- If email delivery is not configured locally, use pre-verified disposable accounts and say so. Do not bypass production verification.

## Timed walkthrough

### 0:00–0:25 — The problem

**Show:** The public demo landing page and team board. Point out the “Interactive demo · no backend” marker.

**Say:** “CrewForge solves team formation when many participants compete for limited seats. The key requirement is not just showing available capacity; it is ensuring the database never records an over-capacity team or lets one participant join two teams in the same hackathon.”

### 0:25–1:05 — Create and discover a team

**Show:** Create a demo team, add skills, and show it appearing on the board.

**Say:** “This judging demo is intentionally static: the browser simulates team creation and persists only in local storage. In the full application, the server validates team creation and capacity; this page does not make API calls.”

### 1:05–1:35 — Skill matching and membership simulation

**Show:** Enter a skill such as `Design`, run matching, and join/leave a team.

**Say:** “The demo illustrates the product flow and match discovery. These membership changes are local simulation only; they are not shared with other viewers.”

### 1:35–2:10 — The real race-proof guarantee

**Show:** Open `docs/architecture.md`, `tests/integration/race.test.ts`, and the passing CI run.

**Say:** “The actual race-proof guarantee is implemented in the full-stack code and tested separately against a MongoDB replica set. The static page is a judge-friendly UI demo, not the backend concurrency test.”

### 2:10–3:15 — Explain the race-proof transaction

**Show:** Open `docs/architecture.md` and the integration test `tests/integration/race.test.ts`.

**Say:** “The join operation uses a MongoDB transaction. A conditional capacity update reserves a seat, while a unique compound index on hackathon and user prevents duplicate membership across teams. Both changes commit or abort together. Request-bound idempotency keys make network retries safe.”

**Point to:** the test that launches 50 contenders for one remaining seat and asserts exactly one winner and a consistent stored count.

### 3:15–4:00 — Scale and measured performance

**Show:** CI workflow, seed verification and `docs/performance.md`.

**Say:** “CI provisions a disposable MongoDB replica set, verifies 10,000 users, 2,000 teams and 8,000 memberships, runs the race test, builds the app, performs smoke checks and runs a 100-user k6 board test. The latest main-branch run processed 3,000 requests at 97.84 requests per second, with 11.01 milliseconds p95 and zero HTTP failures.”

**Say immediately after:** “Those figures are from a GitHub-hosted runner and local disposable MongoDB. They are not production-region measurements.”

### 4:00–4:40 — Security and limits

**Show:** `docs/threat-model.md`, security dashboard if available, and test strategy.

**Say:** “The project also includes same-origin mutation checks, server-side authorization, persistent rate limits, HttpOnly sessions, hashed single-use tokens and privacy-preserving security telemetry. The documented manual matrix covers flows that still need staging verification.”

### 4:40–5:00 — Close

**Show:** Repository README and submission brief.

**Say:** “The strongest part of CrewForge is its database-enforced consistency model and reproducible concurrency evidence. The public demo is intentionally browser-only; the backend remains a separate code-and-test deliverable. The repository distinguishes measured evidence from what is not deployed.”

## Recording checklist

- [ ] Record at 1080p with readable browser and editor text.
- [ ] Keep the walkthrough under five minutes.
- [ ] Show the 50-contender test source and its passing CI evidence.
- [ ] Show the performance report and explicitly state its environment.
- [ ] Do not expose credentials, tokens, private user data or seeded passwords.
- [ ] State that the public URL is a static simulation and not the full-stack production service.
- [ ] Do not claim a production WAF or production benchmark.
- [ ] Upload the final MP4 to the submission portal or a shareable location and verify reviewer access.
