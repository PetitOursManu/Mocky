# Mocky's video render worker: HyperFrames (Apache-2.0) draws the films, and
# Remotion is the fallback when it cannot (`engine.js`).
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
# fonts renders every glyph as a hollow box, and `INSTALLED_FONT_STACK` in
# `remotion/composition.js` names "Liberation Sans" for every burnt-in caption in
# every one of the five compositions precisely because this line is what puts a
# family on the machine. Drop it and every film renders as rows of rectangles,
# burnt into an mp4 nobody previewed.
#
# It is no longer the only family, and it is still the floor. The typefaces art
# directions name — sixty-odd OFL families — come from the @fontsource packages
# in package.json and are BUNDLED as files by the renderer, so nothing is fetched
# while a film renders. A direction naming a face the catalogue does not carry
# still gets Liberation in the right class (sans, serif or mono), through CSS's own
# fallback, rather than a failure. See remotion/fonts/index.js.
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
        unzip \
    && rm -rf /var/lib/apt/lists/*

# ---- ffmpeg ----
# Required. It was best-effort while Remotion was the only engine, because
# @remotion/renderer carries its own ffmpeg; HyperFrames, the default engine,
# encodes with the system's, and an image without it would build, boot and then
# fail every film on the default engine. It also gives the container ffprobe,
# for "is the file this worker returned actually a video".
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

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
# Puppeteer arrives with the HyperFrames producer and would download a Chrome of
# its own at install. HyperFrames renders with ONE pinned headless shell, checked
# by digest, installed below; a second Chrome is 170 MB nobody runs.
ENV PUPPETEER_SKIP_DOWNLOAD=1

# ---- Remotion, the fallback, or not ----
# HyperFrames draws every film; Remotion only renders one HyperFrames could not
# (`engine.js`). `--build-arg WITH_REMOTION=false` builds the image without it,
# and with it goes the one licence in this image that is not Apache or MIT —
# the question the README asks before you build stops applying. The cost is the
# fallback: a film HyperFrames fails is a failed export. Struck from the manifest
# BEFORE the install, in the same layer: an uninstall afterwards left the bytes in
# the layer below and made the image heavier, and `--omit=optional` is not an
# answer, since esbuild ships its binary that way.
ARG WITH_REMOTION=true
RUN if [ "$WITH_REMOTION" = "false" ]; then \
      npm pkg delete dependencies.remotion 'dependencies.@remotion/bundler' \
        'dependencies.@remotion/renderer' 'dependencies.@remotion/three'; \
    fi \
    && npm install --no-audit --no-fund && npm cache clean --force
ENV MOCKY_VIDEO_FALLBACK=$WITH_REMOTION

# ---- Chromium ----
# ONE browser for both engines: the headless shell HyperFrames is pinned to.
# HyperFrames refuses any other build (it checks the folder's digest), so the
# version here moves with @hyperframes/producer in package.json — never on its
# own. Remotion, now the fallback, is handed the same binary through
# `PRODUCER_HEADLESS_SHELL_PATH` (render.js) instead of downloading the build it
# would pick: it rendered the reference corpus on it frame for frame, and a
# second Chrome for an engine that only runs when the first one failed is
# 230 MB of image nobody uses. Done at build time, because this container has no
# egress once it runs.
RUN npm run ensure-browser:hyperframes
ENV PRODUCER_HEADLESS_SHELL_PATH=/home/node/.cache/puppeteer/chrome-headless-shell/linux-158.0.8127.88/chrome-headless-shell-linux64/chrome-headless-shell

# ---- The worker itself ----
COPY --chown=node:node remotion ./remotion
COPY --chown=node:node engine.js render.js render.hyperframes.js server.js validate.js staging.js encoding.js qc.js ./

ENV NODE_ENV=production
ENV PORT=3030

EXPOSE 3030

# The same probe Mocky's admin panel makes, so a container reporting itself
# healthy is a container that would answer the panel.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
