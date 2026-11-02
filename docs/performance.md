# Performance test record

## CI board-read benchmark

**Result: PASS** The 100-VU board test passed on the disposable GitHub Actions environment.

- Run: https://github.com/PSP-YN/Race-proof-team-formation/actions/runs/41465540797
- Tested commit: `bdf3d22e740ecb5de475f36c0630fa20308702f7` (ancestor of the current PR head; subsequent changes do not modify the board read path).
- Date: 2026-11-02
- Runtime: Next.js 16.4.4 production server
- Database: MongoDB 7 replica set in a disposable Docker container
- Dataset: 10,000 users, 2,000 teams, 8,000 memberships; board endpoint returns at most 200 teams
- Load: 100 virtual users for 30 seconds
- k6: 2.3.0

| Metric | Result |
|---|---:|
| Requests | 2,998 |
| Throughput | 96.69 requests/second |
| Average response | 21.74 ms |
| Median response | 7.45 ms |
| p90 | 14.51 ms |
| p95 | 21.78 ms |
| Maximum | 710.40 ms |
| HTTP failures | 0.00% |
| Board status / JSON checks | 100% passed |

Acceptance thresholds: p95 below 200 ms and HTTP failure rate below 1%. Both passed.

## Interpretation and limitations

This is a repeatable CI benchmark against a local MongoDB replica set and a GitHub-hosted runner. It demonstrates the board endpoint's behavior under the stated synthetic load and seeded dataset. It is not a measurement of Vercel, MongoDB Atlas network latency, a production region, or end-to-end browser rendering. Repeat the same test against the deployed URL before claiming production performance.

The initial benchmark before the membership-query optimization measured p95 at 516.24 ms. The board endpoint was changed to retrieve only the signed-in user's membership once and return a compact membership flag instead of joining all members for every team. The rerun passed at p95 21.78 ms with zero failed requests.
