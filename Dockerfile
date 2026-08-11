# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json

RUN npm ci --ignore-scripts

FROM dependencies AS build

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/core packages/core

RUN npm run build \
    && npm prune --omit=dev

FROM node:22-alpine AS api
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4310

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/core/package.json ./packages/core/package.json
COPY --from=build --chown=node:node /app/packages/core/dist ./packages/core/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
RUN mkdir -p /app/apps/api/data \
    && chown node:node /app/apps/api/data \
    && chmod 0700 /app/apps/api/data

USER node
EXPOSE 4310

CMD ["node", "apps/api/dist/server.js"]

FROM nginxinc/nginx-unprivileged:1.29-alpine AS web

COPY --chown=101:101 apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
