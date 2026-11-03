# Performance test record

## Latest completed PS1 follow-up CI benchmark

**Run:** [GitHub Actions CI run 41660184028](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41660184028)  
**CodeQL:** [run 41660184205](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41660184205)  
**Tested commit:** `e0651a0b3fc6316cef592ac32ef736c1bff84496`  
**Environment:** GitHub-hosted runner; Next.js production server; disposable MongoDB 7 replica set  
**Dataset:** 10,000 users, 2,000 teams, 8,000 memberships  
**Load:** 100 virtual users for 30 seconds  
**Other verification:** Docker Compose app build/launch smoke; health/security/SSE smoke; 27 black-box API scenarios; 50-contender HTTP API race test

| Metric | Result |
|---|---:|
| Requests | 3,000 |
| Throughput | 98.23 requests/second |
| Average response | 12.86 ms |
| Median response | 5.23 ms |
| p90 response | 12.20 ms |
| p95 response | 28.93 ms |
| Maximum response | 341.47 ms |
| HTTP failures | 0.00% |
| Board checks | 6,000 / 6,000 passed |
| API scenarios | 27 / 27 passed |
| Concurrent HTTP contenders | 50; exactly one successful final-seat join |

The recorded k6 summary provides median, p90 and p95 but not p99. The maximum is a single observed outlier, not a percentile. p99 is intentionally not inferred.

## Acceptance thresholds

The k6 scenario enforces p95 below 200 ms and HTTP failure rate below 1%. Both passed in this CI run. The HTTP API race test separately confirms one successful join when 50 contenders compete for the last seat.

## Interpretation and limitations

This is a synthetic regression benchmark on a GitHub-hosted runner and a disposable local MongoDB replica set. It does **not** establish production capacity, availability, or latency in a user-facing region. It does not include Atlas network latency, production database tier constraints, Vercel cold starts, or real participant traffic. Repeat the test against staging and production before making capacity claims.

## Optimization history

The initial board implementation performed repeated membership lookups across teams. The endpoint was optimized to retrieve the signed-in participant's membership once and return compact membership state with each team. Earlier synthetic CI runs showed higher p95 latency; this latest run supersedes those measurements.

## Production performance gates

- Staged ramp and burst tests
- 15–30 minute soak test
- p50/p95/p99, error rate, and throughput dashboard
- Atlas connection-pool, CPU, memory, and replication metrics
- Hosting cold-start and regional measurements
- Database failover and recovery behavior
- Capacity limits and SLOs based on measured production workload
