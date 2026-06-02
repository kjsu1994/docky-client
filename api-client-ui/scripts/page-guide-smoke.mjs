import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPageGuide } from "../src/common/pageGuides.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, "../src/App.jsx");
const protectedRoutesPath = path.resolve(__dirname, "../src/components/ProtectedRoutes.jsx");
const appSource = await readFile(appPath, "utf8");
const protectedRoutesSource = await readFile(protectedRoutesPath, "utf8");

const protectedRoutePaths = [
    ...(/<Route\s+index\b/.test(protectedRoutesSource) ? ["/app"] : []),
    ...[...protectedRoutesSource.matchAll(/<Route\s+path="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((routePath) => routePath !== "*" && routePath !== "parking")
        .map((routePath) => `/app/${routePath.replace(/^\/+/, "")}`),
];
const routePaths = protectedRoutePaths
    .map((routePath) => routePath
        .replace(":kind", "FREE_BOARD")
        .replace(":boardId", "123"));

const fallbackGuide = getPageGuide("__missing_page_for_smoke__");
const badTextPattern = /[\u3400-\u9fff\uf900-\ufaff\ufffd]/u;
const missing = [];
const corrupted = [];

for (const routePath of routePaths) {
    const guide = getPageGuide(routePath);
    if (!guide || guide === fallbackGuide) {
        missing.push(routePath);
        continue;
    }

    const text = [
        guide.title,
        guide.summary,
        ...(guide.sections || []).flatMap((section) => [
            section.title,
            ...(section.items || []),
        ]),
    ].join("\n");

    if (badTextPattern.test(text)) {
        corrupted.push(routePath);
    }
}

if (missing.length || corrupted.length) {
    if (missing.length) {
        console.error(`Missing page guides: ${missing.join(", ")}`);
    }
    if (corrupted.length) {
        console.error(`Corrupted page guide text: ${corrupted.join(", ")}`);
    }
    process.exit(1);
}

console.log(`page-guide-smoke ok (${routePaths.length} routes)`);
