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

# ---- Muse: bundle the inspiration fetcher (fetcher-mcp) + Chromium so live
# inspiration works inside the container (ADR D3 — "include by default"). This
# adds ~300MB. Best-effort: if it fails (e.g. no apt/network in the build env),
# the image still builds and Muse falls back to the offline pattern-based
# dossier at runtime. Remove this block for a lean image (Muse still works, just
# without live web inspiration).
# Chromium installs to the default cache under HOME (/root/.cache/ms-playwright);
# the MCP fetcher is spawned with HOME in its env (see server/muse/mcp/realClient.js),
# so it's found at runtime.
RUN (npm install -g fetcher-mcp \
     && npx --yes playwright install --with-deps chromium) \
    || echo "Muse: skipped Chromium bundling — live inspiration will fall back to patterns"

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