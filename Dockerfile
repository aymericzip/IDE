# Stage 1: Build static assets (Vite + TypeScript)
FROM oven/bun:1.3.13 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Serve using standard Bun (JS Web Server)
FROM oven/bun:1.3.13-alpine
WORKDIR /app

# Copy the built output from builder
COPY --from=builder /app/dist ./dist

# Copy the custom JS static server we created
COPY server.ts ./server.ts

EXPOSE 3000

# Run the Bun JS server
CMD ["bun", "run", "server.ts"]
