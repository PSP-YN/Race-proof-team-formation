# Local full-stack environment

CrewForge needs a MongoDB replica set because membership and capacity invariants use transactions, while the live board uses change streams. Docker Compose starts MongoDB 7, initializes a single-node replica set, starts the Next.js application, and places a small trusted reverse proxy in front of it.

## Configure and start

```bash
cp .env.example .env
# Set JWT_SECRET and separate unique SEED_DEMO_PASSWORD / JUDGE_DEMO_PASSWORD values (at least 16 characters each).
openssl rand -base64 48
docker compose up --build -d
```

Open **http://localhost:3002**. Use this proxy URL for browser interactions. The app container is bound directly to `127.0.0.1:3001` for diagnostics; browser mutations should go through port 3002 because the local proxy overwrites `X-Forwarded-For` before the production-mode app applies its trusted-client-IP policy. The proxy is loopback-only and does not expose the app to the LAN or public internet.

The local Compose environment uses `NEXT_PUBLIC_APP_URL=http://localhost:3002`. If you run `npm run dev` directly instead of Compose, set `NEXT_PUBLIC_APP_URL=http://localhost:3000` for that dev-server origin and leave `TRUSTED_CLIENT_IP_HEADER` unset.

## Seed the isolated 10k/2k fixture

```bash
docker compose --profile seed run --rm seed
```

The seed is guarded by `ALLOW_DEMO_SEED=true`, refuses `NODE_ENV=production`, requires separate seed and judge-demo passwords, and refuses to overwrite existing data unless explicitly run with `--reset` against an isolated test database. It creates 10,000 synthetic users, 2,000 teams, 6,000 memberships, 4,000 unassigned participants and 4,000 open seats. It also creates two verified judge-only accounts (`judge.leader@crewforge.demo` and `judge.joiner@crewforge.demo`) using `JUDGE_DEMO_PASSWORD`; the 10,000 synthetic fixture users use the separate `SEED_DEMO_PASSWORD`. Profile skills and IANA time zones are populated for matching tests. These records are fixtures, not real participants.

Email verification and recovery remain unavailable unless a real Resend API key and verified sender are configured. Do not fill those variables with placeholder values.

## Verify

```bash
docker compose ps
BASE_URL=http://localhost:3002 npm run smoke
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?directConnection=true&replicaSet=rs0' npm test
MONGODB_TEST_URI='mongodb://127.0.0.1:27017/?directConnection=true&replicaSet=rs0' npm run chaos
```

The direct-connection option is needed for host-run tests because the local replica set advertises its Docker-network hostname (`mongo:27017`). The integration suite uses a separate `crewforge_race_test` database; the process-kill test uses `crewforge_chaos_test`. Both are isolated from the seeded `crewforge` application database.

## Stop and persistence

```bash
docker compose down
```

The database persists in the `crewforge_mongo_data` volume. `docker compose down -v` deletes that local database volume and is destructive.
