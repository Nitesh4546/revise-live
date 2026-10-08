# Multi-stage Dockerfile for Single-Instance ReviseLive Deployment
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci

COPY . .
RUN npm run build --workspace=client

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --omit=dev --workspace=server

COPY server ./server
COPY --from=builder /app/client/dist ./client/dist

# Run as non-root node user for container security
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server/src/server.js"]
