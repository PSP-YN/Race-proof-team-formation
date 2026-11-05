# Performance test record

## Previous published CI baseline (pre-seed correction)

**Run:** [GitHub Actions submission CI run 41873925487](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41873925487)

**Tested commit:** `a809e7dab2bbcc4630aad75634a50fade3bc332b` (PR #12 submission-readiness branch)

**Environment:** GitHub-hosted runner, Next.js production server, MongoDB 7 disposable Docker replica set

**Dataset:** 10,000 users, 2,000 teams, 10,000 memberships (the earlier fully occupied seed)

**Load:** 100 virtual users for 30 seconds

**Smoke checks:** health/database, security headers/cache policy, cross-origin mutation rejection, board JSON, SSE connection and initial event

| Metric | Result |
|---|---:|
| Requests | 3,000 |
| Throughput | 97.43 requests/second |
| Average response | 16.00 ms |
| Median response | 5.40 ms |
| p90 response | 13.08 ms |
| p95 response | 20.92 ms |
| Maximum response | 522.40 ms |
| HTTP failures | 0.00% |
| Board checks | 6,000 / 6,000 passed |

The recorded k6 summary provides median, p90 and p95 but not p99. The maximum is a single observed outlier, not a percentile. p99 is intentionally not inferred.

**Comparison runs:** [PR CI run 41672742336](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41672742336) recorded 97.65 requests/second and 89.81 ms p95; [PR CI run 41672190102](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41672190102) recorded 98.08 requests/second and 28.05 ms p95; the earlier [main-branch baseline 41523345249](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41523345249) recorded 97.75 requests/second and 10.77 ms p95. All runs recorded 0% HTTP failures. Variation between runner executions should be treated as benchmark variance, not a production latency trend.

The same run verified 10,000 seeded users, 2,000 teams and 10,000 memberships; all 65 tests passed, including the 50-contender final-seat approval race. This run predates the current seed correction and transaction-kill test.

## Current local verification (new seed; CI rerun pending)

The current branch now seeds **10,000 synthetic users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants, 4,000 open seats and 2 judge-only accounts**. A fresh isolated Compose seed run verified these exact counts and was dropped afterwards. The local test suite passes **71/71 tests**, the transaction-kill rollback test passes, and typecheck, production build, dependency audit and five smoke checks pass.

The 100-VU benchmark above must not be presented as a measurement of the corrected 6,000-membership / 4,000-open-seat dataset. A new CI run on the updated PR commit is required; replace this section with its actual metrics after it completes.

## Acceptance thresholds

The k6 scenario enforces p95 below 200 ms and HTTP failure rate below 1%. Both passed in the previous published baseline. The corrected seed must pass the same thresholds in the next CI run.

## Interpretation and limitations

These are synthetic regression benchmarks on GitHub-hosted runners and disposable MongoDB replica sets. They do **not** establish production capacity, availability, or latency in a user-facing region. They do not include Atlas network latency, production database tier constraints, Vercel cold starts, or real participant traffic. Repeat the test against staging and production before making capacity claims.

## Optimization history

The initial board implementation performed repeated membership lookups across teams. The endpoint was optimized to retrieve the signed-in participant's membership once and return compact membership state with each team. Earlier synthetic CI runs showed higher p95 latency; runner-to-runner variation is benchmark variance, not a production latency trend.

## Production performance gates

- Staged ramp and burst tests
- 15–30 minute soak test
- p50/p95/p99, error rate, and throughput dashboard
- Atlas connection-pool, CPU, memory, and replication metrics
- Hosting cold-start and regional measurements
- Database failover and recovery behavior
- Capacity limits and SLOs based on measured production workload
