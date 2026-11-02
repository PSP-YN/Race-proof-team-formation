# Engineering decisions and industry patterns

CrewForge applies established backend and platform-engineering patterns to a high-contention team-formation workflow. The objective is not to maximize the number of technologies; it is to choose the simplest architecture that enforces correctness and can be operated by a small team.

## 1. Database-enforced invariants

**Problem:** Browser-side checks and application-level read-then-write logic are vulnerable to races. Two requests can both observe the final seat as available.

**Decision:** Use a unique membership index plus a conditional capacity update in a MongoDB transaction. The database is the final authority for membership and capacity.

**Alternatives considered:** Client-side optimistic checks, in-memory locks, Redis distributed locks, and a single atomic update. Client-side checks cannot enforce cross-request correctness. In-memory locks do not coordinate across serverless instances. Redis locks introduce another distributed dependency and still require careful fencing. The database transaction and unique index keep the invariant close to the source of truth.

**Trade-off:** Transactions require a replica set or sharded cluster and add database work. That is intentional: consistency is more important than a small reduction in write latency for this operation.

## 2. Idempotent mutations

**Problem:** Browsers, proxies, and mobile networks retry requests. A retry must not create a second membership or consume another invite.

**Decision:** Mutating join requests carry a request-bound idempotency key. The stored record binds the key to the user, hackathon, and team. Reuse for the same operation is replay-safe; reuse for another target is rejected.

**Trade-off:** Idempotency records require indexes, retention policy, and clear semantics. They are preferable to pretending every request is delivered exactly once.

## 3. SSE for one-way live updates

**Problem:** Team boards need server-to-client invalidation events, not bidirectional collaboration channels.

**Decision:** Use MongoDB change streams and Server-Sent Events, with bounded stream duration, browser reconnection, and periodic refresh fallback.

**Alternatives considered:** WebSockets, polling only, and a managed pub/sub broker. WebSockets are justified when clients need frequent bidirectional messages. Polling is simpler but increases idle requests and update delay. A broker is useful at larger scale or across multiple services, but adds infrastructure and operational cost. SSE is an appropriate fit for one-way board invalidation.

**Trade-off:** Change streams consume database connections and require replica-set support. The bounded stream and fallback reduce dependence on long-lived serverless connections, but the actual hosting plan must be load-tested.

## 4. Password and token handling

- Passwords use bcrypt hashing with a cost factor of 12 and enforce bcrypt's 72-byte input limit.
- Session tokens are signed, short-lived JWTs stored in HttpOnly, SameSite cookies.
- Password reset increments a session version to invalidate older sessions.
- Verification, reset, and invitation tokens are high-entropy random values; only hashes are stored.
- Tokens are expiring and single-use.

The remaining operational controls are provider-level email delivery monitoring, secret rotation procedures, and deployment-specific cookie/origin validation.

## 5. Abuse controls

**Decision:** Same-origin mutation checks, persistent rate-limit counters, per-account/per-IP limits, and privacy-preserving telemetry.

A global email-only lockout would allow an attacker to deny service to a victim by repeatedly targeting their address. The current login limits combine an IP ceiling with an identity-and-IP bucket. Trusted IP extraction is mandatory in production; the app fails closed if it cannot identify the client safely.

**Trade-off:** MongoDB-backed counters add write load. For substantially higher request volume, move rate-limit state to a dedicated low-latency store or edge rate-limiting service after measuring contention and defining consistency requirements.

## 6. Operational security at the edge

The repository includes a Cloudflare Terraform template for managed WAF rules. It is not active until the production domain is on a Cloudflare zone and traffic is proxied through it. Rules should begin in log mode, be tested against authentication, APIs, and SSE, and only then be promoted to challenge/block actions.

## 7. Performance engineering

The public board is bounded to a maximum of 200 teams and returns a compact membership flag rather than fetching every member record for every team. The CI workflow uses a 10,000-user / 2,000-team / 8,000-membership fixture and a 100-VU / 30-second k6 run.

The CI benchmark is useful for regression detection, not a production capacity guarantee. A production program should add:

- Staged ramp tests and a burst test
- A 15–30 minute soak test
- p50/p95/p99 and error-rate dashboards
- Atlas connection-pool, CPU, memory, and replication monitoring
- Cold-start and regional network measurements
- Explicit SLOs and error budgets based on observed production traffic

## 8. What should change at larger scale

Do not introduce infrastructure speculatively. Revisit the architecture when measurements show a bottleneck:

| Trigger | Candidate next step |
|---|---|
| Rate-limit writes dominate database load | Redis or an edge rate-limit service |
| Change-stream connection pressure grows | Dedicated event gateway or broker |
| Board query cost grows beyond bounded dataset | Pagination, precomputed read model, and targeted indexes |
| Email delivery becomes operationally critical | Provider webhooks, retry queue, bounce/complaint processing |
| Audit data volume grows | Dedicated append-only audit store and retention pipeline |
| Multi-region writes become necessary | Revisit data partitioning and consistency model before adding replicas |

The guiding principle is measured complexity: preserve the current correctness invariants while adding components only when a quantified requirement justifies them.
