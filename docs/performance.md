# Performance test record

## CI board-read benchmark

**Result: PASS** The 100-VU board test passed on the disposable GitHub Actions environment.

- Latest run: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41516567113
- Tested commit: `5fc57ca299394f21787da2fdda0eb19f695edbf8`
- Date: 2026-11-02
- Runtime: Next.js 16.4.4 production server
- Database: MongoDB 7 replica set in a disposable Docker container
- Dataset: 10,000 users, 2,000 teams, 8,000 memberships; board endpoint returns at most 200 teams
- Load: 100 virtual users for 30 seconds; smoke checks for database health, board JSON and initial SSE connection ran before the load test
- k6: 2.3.0

| Metric | Latest run |
|---|---:|
| Requests | 3,000 |
| Throughput | 97.23 requests/second |
| Average response | 17.63 ms |
| Median response | 5.64 ms |
| p90 | 10.31 ms |
| p95 | 18.32 ms |
| Maximum | 593.67 ms |
| HTTP failures | 0.00% |
| Board status / JSON checks | 100% passed (6,000/6,000) |

Acceptance thresholds: p95 below 200 ms and HTTP failure rate below 1%. Both passed.

## Previous benchmark

The earlier CI benchmark on commit `bdf3d22e740ecb5de475f36c0630fa20308702f7` measured p95 at 21.78 ms, 2,998 requests, 96.69 requests/second and 0% HTTP failures. The current run above supersedes it as the latest measurement.

## Interpretation and limitations

These are repeatable CI benchmarks against a local MongoDB replica set and GitHub-hosted runners. They demonstrate the board endpoint's behavior under the stated synthetic load and seeded dataset. They are not measurements of Vercel, MongoDB Atlas network latency, a production region, or end-to-end browser rendering. Repeat the same test against the deployed URL before making production performance claims.

The initial benchmark before the membership-query optimization measured p95 at 516.24 ms. The board endpoint was changed to retrieve only the signed-in user's membership once and return a compact membership flag instead of joining all members for every team. Subsequent CI runs passed with zero failed requests.
