# Mocky's documentation site, served by Lumy: the pages, search, and the
# dashboard where readers' feedback arrives. See docs/deployment.md.
#
# Build it from the repository root, since it needs docs/ as well as docs-site/:
#
#   docker build -f docs-site/Dockerfile -t mocky-docs .
#   docker run -p 127.0.0.1:4000:4000 -v mocky-docs-data:/data mocky-docs
#
# The pages are rebuilt into /data/dist at every start. /data also keeps the
# dashboard account and the feedback, so it is the one volume to persist.
FROM node:22-slim

# The same Lumy as `npm run docs` and the CI check: the version is read from
# package-lock.json rather than written a second time here.
COPY package-lock.json /tmp/mocky-lock.json
RUN npm install -g "lumy-docs@$(node -p "require('/tmp/mocky-lock.json').packages['node_modules/lumy-docs'].version")" \
 && npm cache clean --force \
 && rm /tmp/mocky-lock.json

WORKDIR /site
COPY docs ./docs
COPY docs-site ./docs-site
RUN rm -rf docs-site/dist docs-site/.lumy \
 && mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    LUMY_DATA_DIR=/data \
    LUMY_OUT_DIR=/data/dist
VOLUME ["/data"]
EXPOSE 4000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:4000/_lumy/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["lumy", "serve", "--root", "/site/docs-site", "--host", "0.0.0.0", "--port", "4000"]
