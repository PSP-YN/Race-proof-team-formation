# Production readiness and operations

## Current release status

The application now includes the moderated join-request queue, leader accept/decline transactions, and leader-only member removal. These workflows pass the local MongoDB 7 replica-set integration suite. The existing Vercel project is linked, but its Production environment currently has only JWT_SECRET, NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_HACKATHON_ID configured. MONGODB_URI, RESEND_API_KEY and EMAIL_FROM are absent, so a working full-stack deployment and staging tests are blocked until those external credentials are added. Do not deploy a placeholder database URI or skip email verification.

## Required services

- **Application hosting:** Vercel project connected to this GitHub repository.
- **Database:** MongoDB Atlas replica set or sharded cluster with transactions and change streams enabled.
- **Email:** Resend account with a verified sender domain.
- **Domain and edge security:** production domain with DNS and, if using the provided WAF, a proxied Cloudflare zone.
- **Monitoring:** hosting logs, MongoDB metrics, email delivery/bounce monitoring, and an alert destination.

## Environment variables

Configure secrets directly in the hosting provider's encrypted environment settings. Do not paste them into chat, commit them, or expose them through a `NEXT_PUBLIC_*` variable.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas replica-set URI |
| `JWT_SECRET` | Yes | Session signing key; at least 32 random characters |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical HTTPS application origin |
| `RESEND_API_KEY` | Yes for email flows | Resend API credential |
| `EMAIL_FROM` | Yes for email flows | Verified sender identity |
| `ADMIN_EMAILS` | Yes for operations dashboard | Comma-separated operator email allowlist |
| `SECURITY_ALERT_WEBHOOK` | Optional | Private webhook for threshold alerts |
| `TRUSTED_CLIENT_IP_HEADER` | Self-hosted only | Header overwritten by a trusted reverse proxy; Vercel uses its platform-provided client IP header |
| `SEED_HACKATHON_ID` | Optional | Demo seed scope |
| `NEXT_PUBLIC_HACKATHON_ID` | Optional | Client-visible hackathon identifier |

Generate a session secret locally with:

```bash
openssl rand -base64 48
```

Do not use the example values in `.env.example` as production credentials.

## MongoDB Atlas setup

1. Create a production cluster in the region closest to the Vercel deployment region.
2. Create a dedicated database user with only the privileges required for the CrewForge database.
3. Restrict network access to the hosting platform's documented egress path. Do not use a permanent `0.0.0.0/0` allow rule as a shortcut.
4. Use a replica-set connection string with TLS and retryable writes enabled.
5. Confirm the cluster tier supports transactions and change streams.
6. Set practical connection and resource limits for the selected tier. The app's connection pool settings must be validated against serverless instance concurrency.
7. Enable automated backups and define a retention policy.
8. Test a backup restore into a separate database before launch.
9. Monitor connections, CPU, memory, replication lag, slow queries, and change-stream load.

Never run the demo seed against a production database. The seed script requires explicit opt-in and refuses to run when `NODE_ENV=production`.

## Vercel setup

1. Import `PSP-YN/Race-proof-team-formation` into Vercel.
2. Set the production branch to `main`.
3. Add the required environment variables to Production and Preview scopes as appropriate. Use separate Atlas databases and Resend sender settings for staging and production.
4. Set the canonical custom domain and configure DNS.
5. Deploy only after the production environment variables are present.
6. Confirm the deployed commit SHA matches the intended release commit.
7. Verify that the deployment is using the expected Node.js runtime and that the selected plan's function-duration limits are compatible with the bounded SSE handler.
8. Configure rollback to the last known-good deployment.

Do not create a production deployment with placeholder database credentials or a placeholder JWT secret.

## Resend setup

1. Add the sender domain to Resend.
2. Publish the exact SPF and DKIM records supplied by Resend.
3. Configure DMARC with an initial monitoring policy, then tighten it after validating legitimate delivery.
4. Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel.
5. Test verification, resend verification, password recovery, expiry, replay, and delivery failure.
6. Monitor bounces, complaints, provider errors, and sender reputation.

The application sends transactional email directly through the Resend API. Provider delivery webhooks and bounce/complaint processing are not implemented as a complete event pipeline; monitor those in the provider console until a dedicated webhook workflow is added.

## Cloudflare WAF

`infra/cloudflare/waf.tf` is a Terraform template, not an active deployment. The connected Cloudflare account previously reported zero zones. To activate it:

1. Add the production domain to Cloudflare.
2. Verify authoritative nameservers and DNS records.
3. Proxy the application hostname through Cloudflare.
4. Review the Terraform plan and the exact ruleset IDs/API permissions before apply.
5. Start custom rules in log mode.
6. Test login, registration, email links, team mutations, API clients, and SSE before enabling challenge/block actions.
7. Monitor false positives and never apply broad rules that interrupt SSE reconnects or legitimate API requests.

## Application behavior and security

- MongoDB transactions and unique indexes enforce team membership/capacity invariants.
- Mutating API routes require same-origin requests.
- Rate limits use a trusted client IP source and persistent MongoDB counters.
- Sessions use HttpOnly, SameSite=Lax cookies and session-version invalidation.
- Verification, recovery, and invite tokens are stored as hashes and are single-use/expiring.
- Security telemetry stores hashed identity keys, not raw passwords, tokens, or raw IP addresses.
- Admin telemetry access is checked server-side against `ADMIN_EMAILS`.

The current telemetry is basic abuse monitoring, not a SIEM. Add provider-level alerting and incident response procedures before a high-volume public event.

## Deployment verification

After a successful deployment, run:

```bash
BASE_URL=https://your-production-domain.example npm run smoke
BASE_URL=https://your-production-domain.example npm run loadtest
```

Start with smoke checks. Then increase load gradually in staging and record:

- Deployment SHA, region, runtime, plan, and cold-start behavior
- MongoDB Atlas tier, region, connections, CPU, and replication metrics
- Dataset size, VUs, duration, throughput, p50/p95/p99, and error rate
- SSE connection behavior and reconnect frequency
- Email delivery and failure behavior

Do not begin with a large stress test against production. Set a test window and a stop condition based on database and hosting metrics.

## Release gates

- [ ] PR review complete and all required CI checks green
- [ ] No unresolved security review findings
- [ ] Production secrets configured in hosting settings
- [ ] Atlas backup and restore procedure verified
- [ ] Resend sender and delivery flows verified
- [ ] Domain and TLS verified
- [ ] WAF reviewed and tested, if enabled
- [ ] Black-box matrix in [docs/test-strategy.md](test-strategy.md) completed in staging
- [ ] Deployed smoke checks pass
- [ ] Staged load and soak tests recorded
- [ ] Rollback procedure rehearsed
- [ ] Production monitoring and alert ownership assigned

A release is not production-ready until the deployment-specific gates have evidence attached.
