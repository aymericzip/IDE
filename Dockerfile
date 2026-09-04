# Stage 1: Builder

FROM oven/bun:1.4.0-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Production Runner
FROM oven/bun:1.4.0-alpine AS runner
WORKDIR /app

# Switch to the non-root user provided by the base image
USER bun

# Copy only the compiled assets and the server script
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/server.ts ./

# Explicitly expose the port
EXPOSE 3000

# Probes the server rather than the process table, so a Bun process that is
# alive but no longer serving is reported unhealthy. Uses `bun` instead of wget
# or curl because it is the one binary this image is guaranteed to have.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "process.exit((await fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz')).ok?0:1)"

# The process only ever reads from ./dist, so it needs no writable layer:
#   docker run --read-only --tmpfs /tmp \
#     --cap-drop=ALL --security-opt=no-new-privileges -p 3000:3000 <image>
CMD ["bun", "run", "server.ts"]
