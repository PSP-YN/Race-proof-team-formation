# CrewForge demonstration runbook

## Objective

Demonstrate the product's core value: team membership remains correct when requests compete for limited capacity. The demo should show a real user flow first and the concurrency evidence second.

## Before the demo

1. Use a dedicated staging deployment and disposable MongoDB database.
2. Confirm the deployed commit SHA matches the submission branch.
3. Configure Resend with a verified sender and test delivery to two accounts.
4. Create two verified test accounts with different roles.
5. Confirm the health endpoint, public board, SSE connection and smoke script.
6. Keep the seeded 10,000-user dataset separate from interactive demo accounts.
7. Have the CI run and performance report open in separate browser tabs.
8. Never display environment variables, tokens, raw invite links, or shared passwords.

## Five-minute walkthrough

| Time | Demonstration | Explain |
|---|---|---|
| 0:00–0:25 | Open the team board | Membership and capacity are database-enforced |
| 0:25–0:55 | Create a team with skills and timezone | Team requirements are explicit |
| 0:55–1:20 | Generate/revoke an invite | Tokens are random, hashed, expiring and revocable |
| 1:20–2:10 | Submit a join request; accept or decline as leader | Authorization, transaction boundary and audit trail |
| 2:10–2:40 | Remove a member or show leadership transfer | Member lifecycle is controlled by server rules |
| 2:40–3:15 | Run skill/time-zone matching | Explain score weights and heuristic limitations |
| 3:15–3:50 | Show live board update in a second session | SSE with reconnect/fallback |
| 3:50–5:00 | Show 50-way API race, CI and k6 report | Exactly one seat winner; state benchmark caveats |

## Technical explanation

The unique membership index prevents one participant from joining multiple teams in the same hackathon. A conditional capacity reservation and membership insertion occur in a MongoDB transaction. Idempotency makes network retries safe. Invitation tokens are random, stored as hashes, expire, and are consumed transactionally.

## Demo recovery

- If email delivery fails, do not bypass verification in production. Use pre-verified staging accounts and explain that the email provider is an external dependency.
- If SSE is blocked by the network or host, show the documented refresh fallback and the CI SSE smoke check.
- If the staging environment is unavailable, use the recorded CI run and local test output. State clearly that the live deployment is unavailable.
- If a demo mutation fails, stop and inspect the state. Do not edit the database live to manufacture a successful result.

## Claims to avoid

Do not claim production deployment, active Cloudflare WAF, production-region latency, guaranteed zero race conditions, or hiring selection unless the corresponding evidence exists. The benchmark in the repository is a CI benchmark, not a production SLA.
