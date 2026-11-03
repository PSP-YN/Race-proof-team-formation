# Performance test record

## Latest main-branch CI benchmark

**Run:** [GitHub Actions main CI run 41673400104](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41673400104)

**Tested commit:** `8b7e039f1c0a065e073b0d6e53e1e9571356873e` (PR #11 merge commit)

**Environment:** GitHub-hosted runner, Next.js production server, MongoDB 7 disposable Docker replica set

**Dataset:** 10,000 users, 2,000 teams, 8,000 memberships

**Load:** 100 virtual users for 30 seconds

**Smoke checks:** health/database, security headers/cache policy, cross-origin mutation rejection, board JSON, SSE connection and initial event

| Metric | Result |
|---|---:|
| Requests | 3,000 |
| Throughput | 97.84 requests/second |
| Average response | 13.69 ms |
| Median response | 5.22 ms |
| p90 response | 8.13 ms |
| p95 response | 11.01 ms |
| Maximum response | 453.91 ms |
| HTTP failures | 0.00% |
| Board checks | 6,000 / 6,000 passed |

The recorded k6 summary provides median, p90 and p95 but not p99. The maximum is a single observed outlier, not a percentile. p99 is intentionally not inferred.

**Comparison runs:** [PR CI run 41672742336](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41672742336) recorded 97.65 requests/second and 89.81 ms p95; [PR CI run 41672190102](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41672190102) recorded 98.08 requests/second and 28.05 ms p95; the earlier [main-branch baseline 41523345249](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41523345249) recorded 97.75 requests/second and 10.77 ms p95. All runs recorded 0% HTTP failures. Variation between runner executions should be treated as benchmark variance, not a production latency trend.

## Acceptance thresholds

The k6 scenario enforces p95 below 200 ms and HTTP failure rate below 1%. Both passed in the latest main-branch CI run.

## Interpretation and limitations

This is a synthetic regression benchmark on a GitHub-hosted runner and a disposable local MongoDB replica set. It does **not** establish production capacity, availability, or latency in a user-facing region. It does not include Atlas network latency, production database tier constraints, Vercel cold starts, or real participant traffic. Repeat the test against staging and production before making capacity claims.

## Optimization history

The initial board implementation performed repeated membership lookups across teams. The endpoint was optimized to retrieve the signed-in participant's membership once and return compact membership state with each team. Earlier synthetic CI runs showed higher p95 latency; the newest result supersedes those measurements.

## Production performance gates

- Staged ramp and burst tests
- 15–30 minute soak test
- p50/p95/p99, error rate, and throughput dashboard
- Atlas connection-pool, CPU, memory, and replication metrics
- Hosting cold-start and regional measurements
- Database failover and recovery behavior
- Capacity limits and SLOs based on measured production workload
