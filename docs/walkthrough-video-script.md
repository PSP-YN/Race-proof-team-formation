# Full-stack staging walkthrough

**Recorded asset:** `demo/files/CrewForge-FullStack-Staging-Walkthrough.mp4`
**Length:** 2:04 · 1280×720 · narrated · English captions in the adjacent VTT file
**Local capture:** Docker Compose Next.js app, MongoDB 7 single-node replica set, and loopback-only trusted proxy on port 3002.

## What the recording demonstrates

1. **00:00–00:16 — Live staging and health.** The actual Next.js application is open in a dedicated browser profile. Its health endpoint reports the local database connection.
2. **00:16–00:31 — Persisted team board.** The board and its counts are read from MongoDB. The seeded user/team records are synthetic test fixtures and the interface labels them as such.
3. **00:31–00:43 — Search.** The board filters by skills and team focus using backend data.
4. **00:43–01:00 — Real-time update.** A temporary recording-only team and membership are inserted into the isolated staging database. The open page receives a MongoDB change-stream event and refreshes without a manual reload. The fixture is deleted after the capture.
5. **01:00–01:15 — Authentication boundary.** A signed-out join attempt opens the authentication gate. No anonymous membership mutation is performed.
6. **01:15–01:29 — Explainable matching.** The interface shows the skill-coverage, time-zone and open-capacity weights.
7. **01:29–01:44 — Correctness evidence.** The recording states the local 71-test result and the separate 50-contender final-seat race test.
8. **01:44–02:04 — Production boundary.** The temporary fixture is removed. The narration states that public full-stack deployment still requires Atlas and verified email delivery.

## Narration

This is CrewForge running as a full-stack local staging application. The page reads its team board and dataset counts from a live MongoDB seven replica set. The health endpoint confirms that the database connection is working.

The board is populated from persisted team records. Search and filtering operate on the data returned by the backend. The interface clearly identifies seeded records as test fixtures, not registered participants.

Filtering updates the visible teams immediately. Participants can search by team name, skills, or project focus, while the underlying records remain stored in MongoDB.

A temporary recording fixture is inserted into the staging database. The open browser receives the MongoDB change event and refreshes the board without a manual page reload. The fixture is clearly marked and removed after capture.

When a signed-out visitor requests to join, CrewForge requires authentication first. No anonymous membership write is accepted. Once authenticated, join requests enter a leader-moderated approval workflow.

The matching module ranks teams using uncovered skill coverage, time-zone proximity, and available capacity. The scoring weights are visible in the interface and documented in the engineering notes.

The current automated suite passes seventy-one tests, including a fifty-contender race for the final team seat. Exactly one approval commits. These are local verification results, not production capacity guarantees.

The temporary recording fixture is deleted after the live update check. This demonstrates the working local backend, not a public production service. Production deployment remains gated on a dedicated MongoDB Atlas database and verified transactional email delivery.

## Review boundary

- The video is a genuine browser capture of the running local full-stack application, not a slide animation or a still-image montage.
- The fixture dataset is synthetic and must not be presented as real participants.
- The recording shows the signed-out authentication gate and the matching weights; it does not run an authenticated match or claim a successful public email-verification journey.
- The public Vercel demo is a separate browser-only preview. The full-stack staging app is not publicly reachable.
- Do not submit the Hack4Hack form until the public backend and email gates are resolved and the final review is approved.
