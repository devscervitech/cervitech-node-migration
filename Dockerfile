# Both stages must use the same Node.js LTS line (24: maintenance LTS, EOL 2028-04-30).
# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Apply Alpine security updates published since the base image was built, then
# install production dependencies only. The package managers (npm, npx,
# corepack, yarn) are removed in the same layer: the app runs with plain `node`
# and their bundled dependencies would otherwise ship in the image.
RUN apk upgrade --no-cache && \
    npm ci --omit=dev && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v* /root/.npm

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Application files stay root-owned and read-only to the runtime user; the app
# logs to stdout and needs no writable directory.
USER node

# Default listening port (src/config/runtime.ts DEFAULT_PORT); override with PORT.
EXPOSE 8000

# Liveness probe against GET /health on $PORT (default 8000). The script exits
# non-zero on connection errors, timeouts and non-200 responses. An unhealthy
# status is only reported here; restarts depend on the orchestrator.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "dist/healthcheck.js"]

# Start application (exec form: node receives SIGTERM directly)
CMD ["node", "dist/server.js"]
