# Architecture

## Collections
- users: normalized email and bcrypt password hash.
- teams: team metadata, leader, status and authoritative memberCount.
- memberships: one participant per hackathon, enforced by unique compound index (hackathonId,userId).
- idempotency: user-scoped request keys.
- audit: append-only event history.
- invites: index definitions are prepared for expiring invite tokens; invite lifecycle endpoints are not implemented yet.

## Concurrency model
Joining runs in a MongoDB transaction: insert the unique participant membership, then atomically increment the team counter only when memberCount < maxSize. If either operation fails, the transaction aborts. The unique membership index prevents joining two teams in one hackathon; the conditional counter update prevents overfilling a team. MongoDB transaction retry behavior handles write conflicts. A replica set is required (MongoDB Atlas qualifies).

## Deployment
Deploy to Vercel with MongoDB Atlas. Set MONGODB_URI, JWT_SECRET (32+ characters), NEXT_PUBLIC_APP_URL, SEED_HACKATHON_ID and NEXT_PUBLIC_HACKATHON_ID. Configure a MongoDB replica set.

## Security and remaining requirements
Passwords use bcrypt cost 12; sessions use signed HttpOnly SameSite=Lax cookies. Add edge rate limiting and strict origin/CSRF checks before public production use. Implement invite lifecycle, leader-only edit operations, skill/time-zone matching with explanations, server-push updates, seed tooling, and measured load/race evidence. The board currently polls every five seconds.
