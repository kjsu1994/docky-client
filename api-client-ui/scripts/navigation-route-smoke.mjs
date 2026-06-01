import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");
const appSource = readFileSync(path.join(srcDir, "App.jsx"), "utf8");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function walk(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
            walk(fullPath, files);
        } else if (/\.(jsx?|tsx?)$/.test(entry)) {
            files.push(fullPath);
        }
    }
    return files;
}

function normalizeRoutePath(value) {
    return value.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
}

function routeToRegex(routePath) {
    if (routePath === "*") return /^.*$/;
    const parameterized = routePath
        .replace(/\/+$/, "")
        .replace(/:[^/]+/g, "__ROUTE_PARAM__")
        .replace(/\*/g, "__ROUTE_SPLAT__");
    const escaped = parameterized
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/__ROUTE_PARAM__/g, "[^/]+")
        .replace(/__ROUTE_SPLAT__/g, ".*");
    return new RegExp(`^${escaped || "/"}$`);
}

const routePaths = Array.from(appSource.matchAll(/<Route\s+path=["']([^"']+)["']/g), (match) => normalizeRoutePath(match[1]));
const appRoutePatterns = routePaths
    .filter((routePath) => routePath !== "*")
    .map((routePath) => ({ routePath, regex: routeToRegex(routePath) }));

const sourceFiles = walk(srcDir);
const linkPattern = /\b(?:to|href)\s*[:=]\s*["'](\/app[^"']*)["']/g;
const links = [];

for (const filePath of sourceFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(linkPattern)) {
        links.push({ file: relativePath, path: normalizeRoutePath(match[1]) });
    }
}

assert(routePaths.includes("/app"), "App.jsx must define the /app route");
assert(links.length > 0, "No static /app navigation links were found");

const brokenLinks = links.filter((link) => !appRoutePatterns.some((route) => route.regex.test(link.path)));

if (brokenLinks.length) {
    const summary = brokenLinks
        .map((link) => `${link.file}: ${link.path}`)
        .join("\n");
    throw new Error(`Static navigation links without App.jsx route coverage:\n${summary}`);
}

console.log(`navigation-route-smoke ok (${links.length} static /app links, ${appRoutePatterns.length} route patterns)`);
