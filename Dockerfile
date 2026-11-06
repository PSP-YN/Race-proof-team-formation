FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=http://localhost:3002
ARG NEXT_PUBLIC_HACKATHON_ID=hack4hack-crew-hiring-2026
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_HACKATHON_ID=$NEXT_PUBLIC_HACKATHON_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["npm", "start"]
