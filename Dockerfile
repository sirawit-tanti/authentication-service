# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# -----------------------------------------------------------------------------
# Base stage
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base

WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json ./

# -----------------------------------------------------------------------------
# Development stage
# -----------------------------------------------------------------------------
FROM base AS development

RUN npm ci

COPY . .

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Build stage
# -----------------------------------------------------------------------------
FROM base AS build

RUN npm ci

COPY . .

RUN npm run build

# Remove development dependencies after the build is complete.
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Production stage
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]