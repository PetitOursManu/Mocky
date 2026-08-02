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

# ---- Scroll-driven video: ffmpeg ----
# A generated clip is cut into a JPEG sequence the preview scrubs through
# (server/videos/frames.js). Frames rather than a <video> because seeking an
# inter-frame compressed MP4 from a scroll handler stutters — and because
# frames are images, which the sandboxed preview is already allowed to load.
#
# Best-effort, like the Chromium layer below: a build host without apt must not
# fail the whole image. Without it the feature reports itself unavailable, says
# so in the Muse panel, and nothing else changes. Adds ~120 MB.
RUN (apt-get update \
     && apt-get install -y --no-install-recommends ffmpeg \
     && rm -rf /var/lib/apt/lists/*) \
    || echo "ffmpeg not installed — scroll-driven video will report itself unavailable"

# ---- Muse: bundle the inspiration fetcher (fetcher-mcp) + Chromium so live
# inspiration works inside the container (ADR D3 — "include by default").
# Adds ~300 MB.
#
# Versions are pinned: `npx --yes playwright install` resolved to whatever was
# published that day, so two builds of the same commit could ship different
# browsers.
#
# PLAYWRIGHT_BROWSERS_PATH is set BEFORE the install, and deliberately outside
# /root: the container no longer runs as root (see USER below), so a browser
# left in /root/.cache would be unreadable at runtime.
#
# Still best-effort — a build host without network or apt must not fail the
# whole image; Muse falls back to the offline pattern dossier. But the failure
# now leaves a marker the server can report, instead of vanishing into a log
# line nobody reads.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV FETCHER_MCP_VERSION=0.2.1
ENV PLAYWRIGHT_VERSION=1.49.1
RUN (npm install -g "fetcher-mcp@${FETCHER_MCP_VERSION}" \
     && npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
     && chmod -R a+rX /ms-playwright) \
    || (echo "Muse: Chromium bundling skipped — live inspiration falls back to patterns" \
        && touch /app/.no-chromium)

# Copy built frontend + server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

# Muse's MCP server declarations. server/muse/mcp/config.js resolves this
# relative to ROOT_DIR (/app); without it the host starts zero servers and live
# web inspiration silently falls back to the offline pattern dossier — while the
# Chromium layer above is still paid for at build time.
COPY --from=builder /app/mocky.mcp.json ./mocky.mcp.json

# Data directory for the JSON file store (accounts, sessions, projects).
# Owned by `node` so the unprivileged runtime user can write to it — and so the
# files in the mounted volume are not root-owned, which made backups and
# rootless Docker painful.
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8787
# Inside a container, listening on loopback would make the published port reach
# nothing. The equivalent protection lives on the host side of the mapping in
# docker-compose.yml (MOCKY_BIND, 127.0.0.1 by default).
ENV MOCKY_HOST=0.0.0.0

EXPOSE 8787

# Persist user data across container restarts
VOLUME ["/app/server/data"]

# Drop root. Nothing here needs it.
USER node

# Health is about the things that actually break: a data directory that is not
# writable, and a missing build. /api/config answered 200 from memory in both
# cases, so an unusable instance reported itself healthy.
# MOCKY_PORT is honoured because the server prefers it over PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MOCKY_PORT||process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start the Express server (serves dist/ + API + provider proxy)
CMD ["node", "server/index.js"]
