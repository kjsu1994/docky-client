const DEFAULT_BASE_URL = "https://docky.co.kr";
const TIMEOUT_MS = Number(process.env.PRODUCTION_SMOKE_TIMEOUT_MS || 12000);

const baseUrl = new URL(process.env.PRODUCTION_BASE_URL || DEFAULT_BASE_URL);
if (baseUrl.protocol !== "https:") {
  throw new Error(`production-domain-smoke: expected https base URL, got ${baseUrl.href}`);
}

const withTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "docky-production-domain-smoke/1.0",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`production-domain-smoke: ${message}`);
};

const rootResponse = await withTimeout(baseUrl);
assert(rootResponse.ok, `${baseUrl.href} returned ${rootResponse.status}`);
assert(rootResponse.url.startsWith(baseUrl.origin), `redirect escaped production origin: ${rootResponse.url}`);

const contentType = rootResponse.headers.get("content-type") || "";
assert(contentType.includes("text/html"), `root content-type must be text/html, got ${contentType || "missing"}`);

const html = await rootResponse.text();
assert(/<div\s+id=["']root["']/.test(html), "root app mount node is missing");
assert(!/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(html), "root HTML references a local development host");
assert(!/%VITE_|process\.env\.NODE_ENV/.test(html), "root HTML contains unresolved build-time placeholders");

const assetPaths = Array.from(html.matchAll(/(?:src|href)=["']([^"']*\.(?:js|css))["']/g))
  .map((match) => match[1])
  .filter((asset) => !asset.startsWith("http") || asset.startsWith(baseUrl.origin));

assert(assetPaths.length > 0, "root HTML did not reference built JS/CSS assets");

const sampledAssets = assetPaths.slice(0, 6);
for (const assetPath of sampledAssets) {
  const assetUrl = new URL(assetPath, baseUrl);
  const response = await withTimeout(assetUrl, { method: "HEAD" });
  assert(response.ok, `${assetUrl.href} returned ${response.status}`);
  const assetType = response.headers.get("content-type") || "";
  assert(
    assetType.includes("javascript")
      || assetType.includes("css")
      || assetType.includes("text/plain")
      || assetType.includes("application/octet-stream"),
    `${assetUrl.href} has unexpected content-type ${assetType || "missing"}`,
  );
}

console.log(`production-domain-smoke ok (${baseUrl.origin}, ${sampledAssets.length} assets checked)`);
