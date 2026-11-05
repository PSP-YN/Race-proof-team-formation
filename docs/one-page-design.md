# CrewForge — race-proof team formation at scale

**Pitch:** A reliable hackathon team-formation platform where skill discovery is fast and membership capacity is enforced by the database—not by a browser button.

**Interactive product preview:** https://crewforge-demo-pspyn.vercel.app/
**Repository:** https://github.com/PSP-YN/Race-proof-team-formation
**Challenge:** Hack4Hack Crew Hiring Challenge 2026 · PS1

## The problem

At hackathon scale, many participants can request the same final team seat at nearly the same time. Client-side capacity checks and read-then-write APIs can overfill teams, duplicate memberships or produce inconsistent state after retries. CrewForge makes team membership a transactional, auditable operation.

## Product workflow

1. **Discover:** browse teams, filter by skill and compare open seats.
2. **Create:** define a team, project focus, required skills and capacity.
3. **Request:** submit an idempotent pending join request; a pending request does not reserve a seat.
4. **Approve:** only the current leader can accept or decline. Approval checks authority and capacity inside a MongoDB transaction.
5. **Manage:** leaders can remove members; leadership transfers when a leader leaves; final-member departure closes the team.
6. **Stay current:** MongoDB change streams publish bounded Server-Sent Events for board refresh.

## Architecture and correctness

Next.js API routes handle authentication, validation, origin checks and rate limits. MongoDB stores users, teams, memberships, join requests, invites and audit events. Unique compound indexes enforce one membership per participant per hackathon and one pending request per participant. Invite tokens are high-entropy and stored only as hashes.

An approval transaction verifies the leader and pending request, inserts the membership, conditionally increments `memberCount` only when capacity remains, changes the request status and appends the audit event. Any failed invariant aborts the entire transaction.

## Concurrency proof

The MongoDB replica-set integration test creates 50 pending requests and launches 50 leader approvals concurrently for one remaining seat. It verifies:

- Exactly **1 accepted** and **49 rejected** approvals
- Exactly **2 memberships** (leader + winner)
- Stored `memberCount = 2`
- Exactly **1** `JOIN_REQUEST_ACCEPTED` audit event

The test invokes the same transaction helpers used by the API routes.

## Scale and performance evidence

The latest submission-branch CI seed verifies **10,000 synthetic participants, 2,000 teams, 6,000 membership records, 4,000 unassigned participants and 4,000 open seats** (three members per team, two open seats per team and 4,000 unassigned participants). It also assigns profile skills and IANA time zones so the matching endpoint can be exercised against realistic diversity. These are test fixtures, not real registrations.

A 100-virtual-user / 30-second k6 run against a GitHub-hosted runner and disposable MongoDB 7 replica set recorded:

| Metric | Result |
|---|---:|
| Requests | 3,000 |
| Throughput | 97.43 requests/second |
| Average response | 16.00 ms |
| p95 response | 20.92 ms |
| HTTP failures | 0.00% |
| Board checks | 6,000 / 6,000 passed |

This is a reproducible CI regression benchmark, not a production-region capacity claim.

## Security and operational controls

- bcrypt password hashes and signed HttpOnly session cookies
- Server-side role checks and same-origin mutation validation
- Persistent rate limits and Zod request validation
- Hashed, expiring, revocable invite and authentication tokens
- Transactional audit events and privacy-preserving security telemetry
- Bounded SSE streams with reconnect and refresh fallback

## Evidence links

- [CI run — 65/65 tests and 10k/2k/10k seed](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925487)
- [CodeQL run](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925485)
- [Performance report](performance.md)
- [Race integration test](../tests/integration/race.test.ts)
- [Membership transaction implementation](../src/lib/team-requests.ts)

**Preview scope:** The public URL is an interactive frontend preview with browser-local state. The server-side API, MongoDB transactions and concurrency behavior are independently inspectable and test-backed in the repository and CI. The preview is not presented as a live database-connected deployment.
