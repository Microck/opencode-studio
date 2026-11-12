FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY client-next/package*.json ./client-next/
RUN cd client-next && npm ci --ignore-scripts
COPY client-next/ ./client-next/
RUN test ! -e client-next/.env && test ! -e client-next/.env.production
ENV STUDIO_PROXY_API=1 NEXT_PUBLIC_STUDIO_PROXY=1 NEXT_TELEMETRY_DISABLED=1
RUN cd client-next && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOME=/home/node STUDIO_STANDALONE=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends util-linux && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server/ ./server/
COPY scripts/start-production.cjs ./scripts/start-production.cjs
COPY --from=build /app/client-next/.next/standalone/ ./client-next/.next/standalone/
COPY --from=build /app/client-next/.next/static/ ./client-next/.next/standalone/.next/static/
COPY --from=build /app/client-next/public/ ./client-next/.next/standalone/public/
USER node
EXPOSE 3000
CMD ["node", "scripts/start-production.cjs"]
