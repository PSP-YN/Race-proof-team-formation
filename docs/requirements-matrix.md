# Hack4Hack PS1 requirement-to-evidence matrix

The challenge prioritizes concurrency correctness, then defendable design decisions, code quality, testing and UX. This matrix keeps implemented work separate from deployment and manual-review tasks.

| PS1 requirement | Implementation | Evidence / status |
|---|---|---|
| React UI for full team flow | Next.js/React board, team creation/edit, invitations, join requests, leader decisions, member removal, leave/leadership transfer | Code in `src/app/page.tsx`; keyboard/mobile manual checks still required |
| Team min/max size | Zod validation and server-side invariant checks | Unit tests + API invalid-size scenario |
| Invite links expire | 192-bit opaque invite token, SHA-256 hash at rest, expiry and revocation | Invite APIs and lifecycle tests/docs |
| One team per person per hackathon | Unique membership index | MongoDB duplicate-key guard and race test |
| Leader accepts/declines join requests | Pending request model; leader-only GET/PATCH; transactionally accepted membership | `/api/teams/[teamId]/requests`; API suite |
| Leader can remove members | Leader-only transactional DELETE and audit event | `/api/teams/[teamId]`; API suite |
| Leadership passes when leader leaves | Leave transaction selects earliest remaining member | Existing leave API; manual staging test |
| Last member leaving deletes team | Team is marked `deleted` and removed from open board | Existing leave API; logical deletion preserves audit history |
| 50 simultaneous requests for last seat | 50-contender MongoDB integration race | `tests/integration/race.test.ts`; exactly one successful membership |
| Idempotent retry | Request-bound idempotency for direct joins; pending join request duplicate replay | API tests and unique indexes |
| Real-time board | MongoDB change stream → bounded SSE → browser EventSource; fallback refresh | Smoke test checks SSE connection; deployed cross-session check pending |
| Auth, validation, brute-force controls | bcrypt, verified email, JWT cookie, Zod, rate limiting, origin checks, token hashing | CI smoke + black-box API tests; external security review pending |
| Audit log every team change | Transactional audit records for create/join/leave/settings/invite/request/member actions | DB audit collection and test suite |
| Complementary skills and time zone | Skill coverage + IANA timezone compatibility + capacity score | Unit tests and match API checks |
| 20+ API tests in CI | `scripts/api-tests.mjs` exercises 20+ endpoint scenarios | 27/27 scenarios passed in CI run 41660184028; includes 50 concurrent HTTP requests through the actual join API |
| 10,000 users / 2,000 teams seed | Seed script and CI verification | CI run 41660184028 validated 10,000 users, 2,000 teams and 8,000 memberships |
| 100 concurrent users, board p95 <200 ms | k6, 100 VUs / 30 seconds | Latest successful follow-up CI run 41660184028: p95 28.93 ms; synthetic only |
| Mobile and keyboard-only | Responsive CSS, visible focus, reduced-motion preference, 44px button minimum | Manual mobile/screen-reader/keyboard/axe review still required |
| Deployed live URL | Requires Vercel, Atlas, email provider and domain | **Not deployed yet** |
| Docker Compose bonus | Docker standalone image + MongoDB replica-set Compose; CI run 41660184028 successfully built, launched, and smoke-tested the container app | Build/launch must be verified by CI or local Docker before claiming validated |
| Design document | `docs/design-summary.md` | Added |
| Walkthrough video (≤5 min) | Script in `docs/demo-runbook.md` | **Video recording still required** |

## Final submission gate

Before submitting, make sure the PR branch is merged, latest CI and CodeQL are green, deployment is reachable, staging black-box/security tests pass, the load report reflects the deployed URL, and the 5-minute video is uploaded. Do not present CI-only benchmark numbers as production measurements.
