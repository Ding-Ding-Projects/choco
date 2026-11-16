# Material Choco hub. No npm install is needed: the server has no runtime dependencies
# and the UI bundle is committed under ui/vendor.
FROM node:22-alpine
ENV NODE_ENV=production MATERIAL_CHOCO_DATA=/data MATERIAL_CHOCO_PORT=8080 MATERIAL_CHOCO_HOST=0.0.0.0
WORKDIR /app
COPY package.json CHANGELOG.md ./
COPY shared ./shared
COPY core ./core
COPY hub ./hub
COPY ui ./ui
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD wget -qO- http://127.0.0.1:8080/api/status >/dev/null || exit 1
CMD ["node", "hub/server.js"]
