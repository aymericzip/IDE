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

EXPOSE 3000
CMD ["bun", "--eval", "\
const dir = process.cwd() + '/dist';\
const looksLikeStatic = (path) => {\
  const seg = path.slice(path.lastIndexOf('/') + 1);\
  return seg.includes('.') && !/\\.html?$/i.test(seg);\
};\
Bun.serve({\
  port: 3000,\
  fetch(req) {\
    const url = new URL(req.url);\
    let p = decodeURIComponent(url.pathname);\
    if (!p || p === '/') p = '/index.html';\
    else if (p.endsWith('/')) p = p.slice(0, -1) || '/index.html';\
    let abs = dir + p;\
    let filePath = abs;\
    try {\
      const st = Bun.statSync(abs);\
      if (st.isDirectory()) filePath = abs + '/index.html';\
    } catch {\
      if (looksLikeStatic(p)) return new Response('Not Found', { status: 404 });\
      filePath = dir + '/index.html';\
    }\
    let file = Bun.file(filePath);\
    if (!file.size) {\
      if (looksLikeStatic(p)) return new Response('Not Found', { status: 404 });\
      file = Bun.file(dir + '/index.html');\
    }\
    return new Response(file);\
  },\
});\
console.log('Listening on port 3000');\
"]
