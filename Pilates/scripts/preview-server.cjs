const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PILATES_PREVIEW_PORT || 4173);
const host = "127.0.0.1";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  let target = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);

  if (!target.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(root, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(target).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Pilates a mà: http://${host}:${port}/\n`);
});
