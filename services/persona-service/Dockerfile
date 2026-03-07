FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
ENV PORT=8080
8081
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
USER nodeuser
EXPOSE 8080
8081
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080
8081/health || exit 1
