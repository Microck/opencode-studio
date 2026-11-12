FROM node:22-bookworm-slim
WORKDIR /opt/opencode
COPY deploy/opencode-cli/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force && mkdir /workspace && chown node:node /workspace
ENV HOME=/home/node NODE_ENV=production
USER node
WORKDIR /workspace
EXPOSE 4096
ENTRYPOINT ["/opt/opencode/node_modules/.bin/opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
