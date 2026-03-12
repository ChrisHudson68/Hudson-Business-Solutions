FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm run build


FROM node:22-slim AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

ENV NODE_ENV=production
ENV PORT=5555
ENV DB_PATH=/data/database.db
ENV UPLOAD_DIR=/data

EXPOSE 5555

CMD ["sh", "-c", "mkdir -p /data /data/receipts /data/tenant_logos && node dist/index.js"]