# Stage 1: install exact deps from the lockfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Stage 2: generate Prisma client + build Next.js (standalone output)
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# build never opens a real DB (all pages are force-dynamic); placeholder keeps Prisma quiet
ENV DATABASE_URL="file:/tmp/build-placeholder.sqlite"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Stage 3: minimal runtime image — standalone bundle only
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Docker sets HOSTNAME to the container id; server.js would bind to that and be unreachable
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Prisma's query engine links against openssl; tzdata gives Node the named zone below
# (container clocks default to UTC, which drifted snapshot date labels by a day in the evening PDT)
RUN apk add --no-cache openssl tzdata
ENV TZ=America/Los_Angeles
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Next's file tracing can miss Prisma's native engine; copy it explicitly
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
