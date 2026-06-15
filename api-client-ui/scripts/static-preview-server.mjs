import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "dist");
const port = Number(process.env.STATIC_PREVIEW_PORT || 4180);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

http.createServer((request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    let filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(root, "index.html");
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error?.stack || error));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`static-preview ${port}`);
});
