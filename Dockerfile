# ---- Stage 1: Build the frontend ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install ALL deps (including devDeps for the build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ---- Stage 2: Production runtime ----
FROM node:20-slim AS runtime

WORKDIR /app

# Copy package files and install ONLY production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend + server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

# Data directory for JSON file store (accounts, sessions, projects)
RUN mkdir -p /app/server/data

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8787

# Expose the Express server port
EXPOSE 8787

# Persist user data across container restarts
VOLUME ["/app/server/data"]

# Healthcheck — hit the config endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/config').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Start the Express server (serves dist/ + API + provider proxy)
CMD ["node", "server/index.js"]