const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function headerIncludes(headers, name, expected) {
    return String(headers.get(name) || "").toLowerCase().includes(expected.toLowerCase());
}

async function fetchResource(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, options);
    await response.arrayBuffer();
    return response;
}

const htmlResponse = await fetch(`${baseUrl}/app`, {
    headers: {
        "Cache-Control": "no-cache",
    },
});
const html = await htmlResponse.text();

assert(htmlResponse.status === 200, `/app returned ${htmlResponse.status}`);
assert(headerIncludes(htmlResponse.headers, "content-type", "text/html"), "/app is not served as text/html");
assert(!headerIncludes(htmlResponse.headers, "cache-control", "immutable"), "/app HTML must not use immutable asset caching");

const assets = Array.from(html.matchAll(/\/(assets\/[^"']+\.(?:js|css))/g), (match) => `/${match[1]}`);
const cssAsset = assets.find((asset) => asset.endsWith(".css"));
const jsAsset = assets.find((asset) => asset.endsWith(".js"));

assert(cssAsset, "/app HTML did not reference a built CSS asset");
assert(jsAsset, "/app HTML did not reference a built JS asset");

async function assertImmutableAsset(asset, expectedContentType) {
    const response = await fetchResource(asset, {
        headers: {
            "Accept-Encoding": "gzip",
            "Cache-Control": "no-cache",
        },
    });

    assert(response.status === 200, `${asset} returned ${response.status}`);
    assert(headerIncludes(response.headers, "content-type", expectedContentType), `${asset} content-type was ${response.headers.get("content-type")}`);
    assert(headerIncludes(response.headers, "cache-control", "public"), `${asset} missing public cache-control`);
    assert(headerIncludes(response.headers, "cache-control", "max-age=31536000"), `${asset} missing one-year max-age`);
    assert(headerIncludes(response.headers, "cache-control", "immutable"), `${asset} missing immutable cache-control`);
    assert(headerIncludes(response.headers, "content-encoding", "gzip"), `${asset} missing gzip content-encoding`);
    assert(headerIncludes(response.headers, "vary", "Accept-Encoding"), `${asset} missing Vary: Accept-Encoding`);
    assert(headerIncludes(response.headers, "x-content-type-options", "nosniff"), `${asset} missing X-Content-Type-Options: nosniff`);
}

await assertImmutableAsset(cssAsset, "text/css");
await assertImmutableAsset(jsAsset, "javascript");

console.log(`home-assets-smoke ok (${cssAsset}, ${jsAsset})`);
