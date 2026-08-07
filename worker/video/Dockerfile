# Mocky's Remotion render worker.
#
# READ worker/video/README.md BEFORE BUILDING THIS. Remotion is free for
# individuals, non-profits and companies with up to three employees; past that
# it needs a paid Company Licence. Building this image is the moment that
# question becomes yours — which is the entire reason it is a separate image and
# a separate compose profile.
#
# node:22-bookworm-slim, and the Debian release is pinned rather than left to
# `node:22-slim`. The Chromium libraries below are named per release — libasound2
# became libasound2t64 in the release after bookworm — so a floating tag turns
# this into a build that works until Debian moves and then fails on a package
# name.
FROM node:22-bookworm-slim

# ---- Chromium's system libraries ----
# Remotion renders each frame in a headless Chrome it downloads itself; these
# are the shared objects that binary links against. Not best-effort: without
# them there is no renderer at all, and an image that builds and then fails
# every render is worse than one that refuses to build.
#
# fonts-liberation is in the same line and is not padding. A container with no
# fonts renders every glyph as a hollow box, and `ImageSequenceVideo.jsx` names
# "Liberation Sans" for its burnt-in captions precisely because this line is what
# puts a family on the machine. Drop it and every overlay renders as a row of
# rectangles, burnt into an mp4 nobody previewed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-liberation \
        libasound2 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libgbm-dev \
        libnss3 \
        libpango-1.0-0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon-dev \
        libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

# ---- ffmpeg ----
# Best-effort, and worth being honest about what it is for: @remotion/renderer
# carries its own ffmpeg build, so this layer is not what makes a render work.
# It is here so that ffprobe exists inside a container that, by design, has no
# egress to install anything later — and "is the file this worker just returned
# actually a video" is the first question anyone asks when a render looks wrong.
RUN (apt-get update \
     && apt-get install -y --no-install-recommends ffmpeg \
     && rm -rf /var/lib/apt/lists/*) \
    || echo "ffmpeg not installed — renders still work; ffprobe is unavailable for debugging"

# Drop root before anything of ours is installed, rather than chowning a
# Remotion install afterwards: `chown -R` over these node_modules would copy
# several hundred megabytes into a second layer for no gain.
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# ---- Dependencies ----
# `npm install`, not `npm ci`, because no lockfile is committed. Generating one
# means installing Remotion inside the Mocky repository, which is precisely the
# contamination this sub-project exists to avoid. What replaces it is stricter
# in the way that matters here: the three @remotion packages are pinned to an
# exact version in package.json, so two builds of the same commit ship the same
# renderer — the lesson the main image learned when `npx --yes playwright
# install` resolved to whatever had been published that morning.
COPY --chown=node:node package.json ./
RUN npm install --no-audit --no-fund && npm cache clean --force

# ---- Chromium ----
# Remotion's own downloader, which is the officially supported way to get a
# browser it has tested against — a distribution Chromium is a different build
# with different flags, and the failures that produces surface as blank frames
# rather than as an error. Done at build time so the first render does not spend
# its budget fetching ~150 MB; server.js calls ensureBrowser() again at boot, so
# an image built without network still recovers instead of failing forever.
RUN npm run ensure-browser

# ---- The worker itself ----
COPY --chown=node:node remotion ./remotion
COPY --chown=node:node render.js server.js validate.js staging.js ./

ENV NODE_ENV=production
ENV PORT=3030

EXPOSE 3030

# The same probe Mocky's admin panel makes, so a container reporting itself
# healthy is a container that would answer the panel.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
