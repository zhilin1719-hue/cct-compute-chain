FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install --global pnpm@11.19.0 && pnpm install --frozen-lockfile
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATABASE_PATH=/app/data/cct.sqlite
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY scripts ./scripts
RUN mkdir -p /app/data /app/backups && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
