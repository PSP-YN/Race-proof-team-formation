# Production security and operations

## Runtime configuration

Required: `MONGODB_URI` (MongoDB replica set or Atlas), `JWT_SECRET` (32+ random characters), `NEXT_PUBLIC_APP_URL` (canonical HTTPS origin), and a trusted client IP source. Do not deploy with the development IP fallback. On Vercel, the application uses Vercel's `x-real-ip`; behind another reverse proxy, configure `TRUSTED_CLIENT_IP_HEADER` only when that proxy overwrites the header.

## Email delivery

Email verification and account recovery require a transactional email provider. Configure `RESEND_API_KEY` and a verified `EMAIL_FROM` sender/domain before enabling those flows. Never log or return raw one-time tokens. Tokens are random, stored only as SHA-256 hashes, expire, and are single-use. Configure SPF, DKIM and DMARC for the sender domain. Email-provider delivery, bounce and complaint webhooks must be monitored before production launch.

## Realtime board

The board uses MongoDB change streams over the teams, memberships and invite collections. The endpoint intentionally streams for a bounded interval and closes so EventSource reconnects; this is compatible with short-lived serverless execution better than an unbounded function. MongoDB must support change streams (replica set or sharded cluster). The browser falls back to 15-second refresh if SSE is unavailable. Validate on the actual deployment platform: function duration, connection limits, and Atlas change-stream capacity vary by plan.

## Abuse telemetry

Rate-limit violations are recorded as hashed-identity security events with a 30-day TTL. Do not store raw IP addresses, passwords, invite tokens, reset tokens, or email contents in telemetry. Alert on sustained auth failures, invite creation/revocation spikes, and repeated rate-limit violations. Review audit events separately from security telemetry.

## Abuse monitoring

The restricted `/admin/security` view reads the last seven days of rate-limit telemetry. Set `ADMIN_EMAILS` to a comma-separated allowlist of trusted operator email addresses. Do not grant admin access by client-side flags. Current event coverage includes rate-limit exceedances and failed authentication attempts, with email addresses/IP-derived identities hashed before storage. Configure external alerts for sustained growth and extend event coverage for invitation abuse before a public launch. Security telemetry is not a SIEM and does not replace provider-level log retention or alerting.

## Cloudflare WAF

The repository's `infra/cloudflare/waf.tf` is a reviewed Terraform template, not an active WAF deployment. It deploys Cloudflare's managed ruleset and a conservative custom rule set. Apply only after the production hostname is on a Cloudflare zone and DNS is routed through the proxy. Start custom rules in log mode, inspect false positives, then enable managed challenge/block actions deliberately. Never challenge the SSE endpoint's long-lived requests or API clients without testing.

## Release gates

- CI: typecheck, unit/integration tests, dependency audit, production build, race tests and k6 load test.
- Staging: verify signup/verification, login, password recovery, team create/join/leave, invite create/revoke/accept, leadership transfer, and board SSE reconnect.
- Security: test CSRF/origin enforcement, cookie flags, rate-limit behavior, duplicate requests, token expiry/replay, access control, and log redaction.
- Production: smoke tests against the deployed URL and k6 with a realistic dataset. Record region, instance tier, database tier, VUs, duration, p50/p95/p99 and error rate.
- Recovery: test database backup restoration, email-provider outage behavior, and rollback to the previous deployment.
