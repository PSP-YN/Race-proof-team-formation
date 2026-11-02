# Performance test record

## Latest CI board benchmark

**Run:** [GitHub Actions run 41521925695](https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41520214037)  
**Tested commit:** `d8e0ae02762514c81fc30244a51c5aed1bcc91b3`  
**Environment:** GitHub-hosted runner, Next.js 16.4.4 production server, MongoDB 7 disposable Docker replica set  
**Dataset:** 10,000 users, 2,000 teams, 8,000 memberships  
**Load:** 100 virtual users for 30 seconds  
**Smoke checks:** database health, board JSON, initial SSE connection

| Metric | Result |
|---|---:|
| Requests | 3,000 |
| Throughput | 97.08 requests/second |
| Average response | 17.56 ms |
| Median response | 5.59 ms |
| p90 response | 10.42 ms |
| p95 response | 17.63 ms |
| Maximum response | 558.26 ms |
| HTTP failures | 0.00% |
| Board checks | 6,000 / 6,000 passed |

The recorded k6 summary provides median, p90 and p95 but not p99. The maximum is a single observed outlier, not a percentile. p99 is intentionally not inferred.

## Acceptance thresholds

The k6 scenario enforces a p95 response-time threshold below 200 ms and an HTTP failure rate below 1%. Both thresholds passed in the recorded CI run.

## Previous benchmark

The earlier CI run on commit `5fc57ca299394f21787da2fdda0eb19f695edbf8` reported 3,000 requests, 97.23 requests/second, 17.63 ms average response, 18.32 ms p95, and 0% HTTP failures. The newer run above supersedes it.

## Optimization history

The initial board implementation performed repeated membership lookups across teams. The board endpoint was optimized to retrieve the signed-in participant's membership once and return compact membership state with each team. The subsequent synthetic CI runs showed materially lower p95 latency than the initial 516.24 ms measurement. Do not attribute the entire difference to one change without a controlled benchmark; runner and dataset conditions can also affect results.

## Interpretation and limitations

These results show the board endpoint's behavior under the stated synthetic CI workload. They do not measure:

- Vercel cold starts or production serverless execution
- Network latency between Vercel and MongoDB Atlas
- Atlas cluster tier, region, connection pool contention, or change-stream capacity
- Browser rendering, real user journeys, or email delivery
- Production traffic distribution, burst patterns, or long-duration soak behavior

The reported 97.08 requests/second is throughput under this specific test, not a capacity guarantee. The benchmark does not establish a production SLA.

## Required deployed benchmark

After deployment, run:

```bash
BASE_URL=https://your-production-domain.example npm run smoke
BASE_URL=https://your-production-domain.example npm run loadtest
```

Record the exact commit SHA, deployment region/runtime, MongoDB Atlas tier and region, dataset size, VUs, duration, p50/p95/p99, throughput, error rate, and any cold-start behavior. Run a short smoke test first, then staged load increases. Do not begin with an unbounded stress test against production.

A production release should also include a soak test, a burst test, and database connection/CPU monitoring. Set explicit operational budgets based on the selected hosting and database plans rather than copying the CI threshold blindly.
