// Zero-dependency static file server for analyzer/dist.
//
// Replaces `npx serve`, which hangs on its "Need to install packages" prompt
// when the package isn't cached and no TTY is attached.
//
//   node serve.mjs [--dir <path>] [--port <n>]

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, normalize, sep } from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const ROOT = resolve(argOf("--dir", join(import.meta.dirname, "dist")));
const PORT = Number(argOf("--port", process.env.PORT || 5174));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

async function tryFile(path) {
  try {
    const s = await stat(path);
    return s.isFile() ? path : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

    // Contain every request inside ROOT — reject path traversal.
    const candidate = resolve(join(ROOT, normalize(urlPath)));
    if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) {
      res.writeHead(403).end("403 Forbidden");
      return;
    }

    let file =
      (await tryFile(candidate)) ||
      (await tryFile(join(candidate, "index.html"))) ||
      // SPA fallback: unknown non-asset routes serve index.html
      (extname(candidate) === "" ? await tryFile(join(ROOT, "index.html")) : null);

    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 Not Found");
      return;
    }

    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
      "content-length": body.length,
      "cache-control": "no-cache",
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("500 " + err.message);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT}`);
  console.log(`http://localhost:${PORT}`);
});
