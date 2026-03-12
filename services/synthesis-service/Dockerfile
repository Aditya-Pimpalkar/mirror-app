FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

FROM base AS production
ENV NODE_ENV=production
ENV PORT=8082
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force
COPY src ./src
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
USER nodeuser
EXPOSE 8082
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8082/health || exit 1
