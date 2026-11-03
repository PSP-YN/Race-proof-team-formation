# Security Policy

## Supported versions

Security fixes are applied to the current default branch. There are no separately maintained release branches at this stage.

## Reporting a vulnerability

Do not disclose exploitable vulnerabilities in public issues or pull requests.

Use GitHub's private vulnerability reporting flow when it is enabled for this repository:
https://github.com/PSP-YN/Race-proof-team-formation/security/advisories/new

If private reporting is unavailable, contact the repository maintainer through GitHub and request a private channel. Include reproduction steps, affected commit or route, impact, and any safe proof of concept. Do not include real user data or live secrets.

## Response expectations

The maintainer will acknowledge a report as soon as reasonably practical, validate the issue, coordinate a fix, and agree on disclosure timing with the reporter. No fixed response-time SLA is promised for this project.

## Security-sensitive areas

Pay particular attention to:

- Authentication, session cookies, email verification, and password recovery
- Authorization and leader-only team/invitation operations
- Same-origin checks, trusted client IP extraction, and rate limits
- MongoDB transaction boundaries, unique indexes, and idempotency
- Invite and recovery token hashing, expiry, and replay resistance
- Security telemetry and log redaction
- Server-side environment variables and deployment configuration

Never commit credentials or include them in issue reports. Rotate any secret that may have been exposed.
