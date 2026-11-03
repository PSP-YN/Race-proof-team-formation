# CrewForge threat model

## Scope

This is a practical application-level threat model for the current repository. It is not a formal penetration-test report or security certification. The production deployment, cloud accounts, domain, email provider, and database configuration are outside the code-only verification boundary until configured and tested.

## Assets

- User credentials and password hashes
- Session cookies and session signing secret
- Email verification and password-reset tokens
- Invitation tokens and membership state
- Team capacity, leader assignments, and hackathon membership
- Audit records and security telemetry
- MongoDB credentials and Resend API key
- Production environment and deployment integrity

## Trust boundaries

1. Browser to Next.js API routes
2. Next.js application to MongoDB
3. Next.js application to Resend
4. Internet traffic through hosting and optional Cloudflare edge
5. Operator browser to the restricted security dashboard
6. GitHub contributors and CI workflows to the deployment pipeline

## Threat actors

- Unauthenticated internet users
- Authenticated users attempting to exceed their permissions
- Malicious or compromised team members
- Automated credential-stuffing and invitation-abuse traffic
- A malicious dependency or compromised CI workflow
- An operator who misconfigures secrets, database access, or edge rules

## Threats and controls

| Threat | Potential impact | Current controls | Residual risk / next validation |
|---|---|---|---|
| Password database disclosure | Account compromise | bcrypt hashes; no plaintext password storage | Review bcrypt cost and credential exposure procedures |
| Session theft | Account takeover | HttpOnly, SameSite cookie; signed expiring JWT; session-version check | HTTPS, secure cookie behavior, XSS review, and rotation need deployed tests |
| Cross-site mutation | Unauthorized team or account action | Same-origin Origin/Referer validation | Verify behavior through actual proxy and custom domain |
| Brute-force login | Account takeover or service abuse | Per-IP and per-identity/IP rate limits; hashed failure telemetry | Test distributed credential stuffing and tune limits |
| Duplicate team membership | Integrity violation | Unique membership index and transaction | Validate on Atlas replica set under concurrent load |
| Over-capacity team | Integrity violation | Conditional capacity reservation in transaction | Run contention tests against deployed database tier |
| Invite replay or theft | Unauthorized membership | High-entropy opaque token; hash at rest; expiry; revocation; transactional consumption | Avoid exposing invite URLs in analytics, logs, or screenshots |
| Password-reset replay | Account takeover | Single-use hashed expiring token; session version increment | Test concurrent reset requests and provider-delivery failure |
| Unauthorized admin access | Exposure of telemetry | Server-side ADMIN_EMAILS allowlist | Verify with non-admin account on deployed system |
| Sensitive telemetry leakage | Privacy breach | Hashed identity keys; no raw password/token/IP in security events | Review platform logs and external alert destinations |
| Database outage | Failed writes or degraded app | Error handling; health endpoint; bounded operations | Test failover, backup restore, and timeout behavior |
| Dependency compromise | Code execution or data theft | npm audit, lockfile, Dependabot, CodeQL | Pin critical GitHub Actions to reviewed SHAs and review dependency updates |
| CI token abuse | Repository compromise | Read-only CI permissions; one-time lockfile bootstrap is complete and no longer part of the workflow | Review all workflow changes and keep privileged tokens scoped |
| WAF false positives | User lockout or broken SSE | Terraform template and log-mode rollout guidance | WAF is not deployed; test before enforcement |

## Security invariants

- Never expose secrets in client bundles or repository files.
- Never store raw invite, verification, or reset tokens.
- Never trust UI state as authorization.
- Never accept a membership mutation without database-level invariant enforcement.
- Never run the demo seed against production.
- Never expose sensitive telemetry or authentication responses to shared caches.
- Never treat a green CI result as proof of deployed security.

## Incident response checklist

1. Identify the affected asset and the last known safe deployment.
2. Revoke or rotate exposed credentials immediately.
3. Invalidate affected sessions by incrementing session versions or rotating the signing secret where appropriate.
4. Revoke outstanding invite or recovery tokens if token exposure is suspected.
5. Preserve relevant logs while minimizing personal data.
6. Restore from a verified backup if integrity is compromised.
7. Patch, add a regression test, and deploy through the normal CI process.
8. Document scope, timeline, impact, and corrective actions.

## Required pre-production exercises

- Attempt cross-origin writes from an unrelated origin.
- Test login, verification, recovery, and invite token expiry/replay.
- Attempt team creation, edits, invite revocation, and admin access as unauthorized users.
- Run 50+ concurrent requests for one remaining team seat.
- Simulate MongoDB unavailability and Atlas failover.
- Restore a database backup to a separate cluster.
- Verify that hosting logs, email logs, and alerts do not contain raw secrets or tokens.
- Test Cloudflare rules in log mode before challenge/block enforcement.

## Open security work

- Production configuration and deployment validation
- Provider-level email bounce/complaint webhook processing
- Production backup/restore evidence
- External penetration test and accessibility/security review
- Monitoring ownership, incident-response contacts, and secret-rotation schedule
