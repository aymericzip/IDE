# Stage 1: Builder
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Production Runner
FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

# Switch to the non-root user provided by the base image
USER bun

# Copy only the compiled assets and the server script
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/server.ts ./

# Explicitly expose the port
EXPOSE 3000

CMD ["bun", "run", "server.ts"]