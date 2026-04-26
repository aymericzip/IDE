import { serve, file } from "bun";
import { statSync } from "fs";

const distDir = process.cwd() + "/dist";

const looksLikeStatic = (path: string) => {
  const seg = path.slice(path.lastIndexOf("/") + 1);
  return seg.includes(".") && !/\.html?$/i.test(seg);
};

const server = serve({
  port: 3000,
  fetch(req: Request) {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);

    if (!p || p === "/") p = "/index.html";
    else if (p.endsWith("/")) p = p.slice(0, -1) || "/index.html";

    let filePath = distDir + p;
    let isIndexHtml = p.endsWith("/index.html");

    try {
      const st = statSync(filePath);
      if (st.isDirectory()) {
        filePath = filePath + "/index.html";
        isIndexHtml = true;
      }
    } catch {
      if (looksLikeStatic(p)) {
        return new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      }
      filePath = distDir + "/index.html";
      isIndexHtml = true;
    }

    let bunFile = file(filePath);

    if (bunFile.size === 0) {
      if (looksLikeStatic(p)) {
        return new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      }
      filePath = distDir + "/index.html";
      bunFile = file(filePath);
      isIndexHtml = true;
    }

    const headers = new Headers();
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("X-XSS-Protection", "1; mode=block");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    if (isIndexHtml) {
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    } else {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }

    return new Response(bunFile, { headers });
  },
});

console.log(`Starting Bun static server on port ${server.port}...`);
