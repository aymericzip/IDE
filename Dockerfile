# Build static assets (Vite + TypeScript)
FROM oven/bun:1.3.13 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Serve dist/
FROM oven/bun:1.3.13
WORKDIR /app
COPY --from=builder /app/dist ./dist

EXPOSE 80
CMD ["bun", "--eval", "\
const dir = import.meta.dir + '/dist';\
Bun.serve({\
  port: 3000,\
  fetch(req) {\
    const url = new URL(req.url);\
    let path = dir + url.pathname;\
    let file = Bun.file(path);\
    if (!file.size) file = Bun.file(dir + '/index.html');\
    return new Response(file);\
  },\
});\
console.log('Listening on port 3000');\
"]
