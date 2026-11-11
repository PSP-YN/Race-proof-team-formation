# Hack4Hack Crew Hiring Challenge — submission and interview guide

## One-sentence pitch

CrewForge is a race-safe hackathon team formation platform: it prevents duplicate membership and over-capacity teams at the database layer, even when many participants attempt to claim the last seat concurrently.

## Problem and approach

A normal team directory is easy to build but fails under event-scale contention. Two participants can claim the final seat at once, or one participant can join two teams through separate requests. CrewForge treats those as data-integrity invariants rather than UI validation problems.

- Unique database index enforces one membership per participant per hackathon.
- A conditional capacity reservation and membership insert occur in one MongoDB transaction.
- Idempotency keys make safe retries deterministic.
- Invitation tokens are opaque, hashed at rest, expiring and single-use.
- Leadership succession and invite revocation happen as a transactional lifecycle operation.

## Five-minute demo path

1. Open the team board and explain that capacity and membership are server-enforced.
2. Create a team with explicit skill needs and a maximum size.
3. Open the leader's invite manager, generate an invitation and revoke it.
4. Demonstrate that a revoked/expired invite cannot be accepted.
5. Submit a join request with a second account; switch to the leader account, accept it, and show the membership count and pending queue update.
6. As the leader, remove a non-leader member and show the member count and audit event update.
7. Open teammate matching and explain the score: 65% uncovered skill coverage, 20% time-zone proximity (candidate IANA zone versus current members, DST-aware), and 15% open-seat capacity. Missing member time-zone data receives a neutral score.
8. Open the restricted security dashboard as an allowlisted operator and explain hashed telemetry.
9. Show the CI run: 10,000 users, 2,000 teams, 6,000 memberships; 50 pending requests and 50 concurrent leader approvals for one remaining seat; smoke checks; 100-VU k6 test.

Use a disposable staging database and test accounts. Do not demo production with seeded accounts or a shared demo password.

## Evidence to show

- GitHub Actions CI run: typecheck, unit/integration tests, npm audit, production build, smoke checks and k6.
- Race test: exactly one accepted leader approval among 50 pending requests competing for one remaining seat.
- Load test: 100 VUs for 30 seconds; latest benchmark is in docs/performance.md.
- Audit trail and invite lifecycle behavior.
- Architecture notes in docs/architecture.md.

Be precise: the recorded load test is a GitHub Actions runner against a local MongoDB replica set. It is not a production-region or deployed Vercel measurement. The final deployed smoke and load test are still required after hosting and database configuration.

## Questions you should be able to answer

**Why MongoDB transactions and unique indexes?** Transactions keep membership insertion, capacity reservation and audit records consistent. Unique indexes provide the final database-level guard against duplicate membership, even if requests race.

**Why idempotency?** Network retries are normal. The same key and same team is a replay; reuse for a different team is a conflict.

**Why SSE instead of WebSockets?** The board primarily broadcasts server-to-client invalidation events. SSE is simpler, reconnects natively in browsers and works for this one-way flow. The stream is bounded for serverless runtimes; MongoDB change streams provide the source of truth.

**What are the trade-offs?** Change streams need a replica set and consume database connections. Serverless duration and connection limits must be measured on the target host. The UI falls back to periodic refresh if SSE is unavailable.

**How does matching work?** Candidate skills are compared with declared team needs after removing skills already represented by current members. The score is 65% uncovered skill coverage, 20% average circular UTC-offset proximity between the candidate and current members, and 15% available capacity. IANA time zones are captured at registration and evaluated at request time so daylight-saving changes are respected. Missing member time-zone data receives a neutral 50% time-zone component, not a mismatch penalty.

**What remains external?** Email delivery needs a verified Resend sender; the managed WAF needs a Cloudflare zone with DNS proxied; production smoke and load tests need a configured host and production-like database.

## Hiring discussion

Describe the work you personally understand and can defend. If AI tools helped implement parts of the code, be transparent about that and explain how you reviewed, tested and corrected the implementation. Be ready to walk through the race condition, transaction boundary, unique index, SSE lifecycle and threat model without relying on a prepared script.

Do not claim that the system is production-deployed, WAF-protected or production-benchmarked until those checks have actually run. A clear, evidence-backed explanation is stronger than inflated claims.


## Submission packaging

The repository includes a MIT license, contribution rules, Code of Conduct, vulnerability reporting policy, pull-request template, issue templates, Dependabot configuration, and CodeQL workflow. The test matrix and demo runbook are maintained separately so a reviewer can inspect the technical claims and reproduce the demonstration.

For the submission, link directly to:
- Repository: https://github.com/PSP-YN/Race-proof-team-formation
- CI evidence: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41517226227
- Performance report: [docs/performance.md](performance.md)
- Architecture: [docs/architecture.md](architecture.md)
- Test matrix: [docs/test-strategy.md](test-strategy.md)
- Demo script: [docs/demo-runbook.md](demo-runbook.md)

Do not claim the service is deployed or production-benchmarked until the external production gates are complete.
