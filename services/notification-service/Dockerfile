FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

FROM base AS deps
COPY package*.json ./
# notification-service does not commit a lockfile, so npm ci would fail.
RUN npm install --omit=dev && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
ENV PORT=8083
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
USER nodeuser
EXPOSE 8083
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8083/health || exit 1
