import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const readSource = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [
    css,
    indexHtml,
    shim,
    themePreference,
    themeContext,
    app,
    mypage,
] = await Promise.all([
    readSource("src/index.css"),
    readSource("index.html"),
    readSource("public/theme-shim.js"),
    readSource("src/utils/themePreference.js"),
    readSource("src/contexts/ThemeContext.jsx"),
    readSource("src/App.jsx"),
    readSource("src/pages/home/Mypage.jsx"),
]);

const failures = [];
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};

assert(css.includes("--app-bg:"), "src/index.css: app background token is missing");
assert(css.includes("--app-bg-vibe:"), "src/index.css: shell background token is missing");
assert(css.includes("--app-ink:"), "src/index.css: app ink token is missing");
assert(css.includes("color-scheme: light dark;"), "src/index.css: system color-scheme support is missing");
assert(css.includes("@media (prefers-color-scheme: dark)"), "src/index.css: system dark-mode media query is missing");
assert(css.includes('html[data-theme="light"]'), "src/index.css: manual light override is missing");
assert(css.includes('html[data-theme="dark"]'), "src/index.css: manual dark override is missing");
assert(/body\s*\{[\s\S]*background:\s*var\(--app-bg\)/.test(css), "src/index.css: body must use --app-bg");
assert(/\.bg-vibe\s*\{[\s\S]*background:\s*var\(--app-bg-vibe\)/.test(css), "src/index.css: .bg-vibe must use --app-bg-vibe");

const themeShimIndex = indexHtml.indexOf("/theme-shim.js");
const globalShimIndex = indexHtml.indexOf("/global-shim.js");
assert(themeShimIndex >= 0, "index.html: theme shim is not loaded");
assert(globalShimIndex >= 0, "index.html: global shim is not loaded");
assert(themeShimIndex >= 0 && themeShimIndex < globalShimIndex, "index.html: theme shim must run before global shim");

for (const [sourceName, source] of [
    ["public/theme-shim.js", shim],
    ["src/utils/themePreference.js", themePreference],
]) {
    assert(source.includes("docky.theme"), `${sourceName}: shared theme storage key is missing`);
    assert(source.includes("light") && source.includes("dark") && source.includes("system"), `${sourceName}: theme values are incomplete`);
    assert(source.includes("dataset.theme"), `${sourceName}: html data-theme application is missing`);
}

assert(themePreference.includes("writeStoredThemePreference"), "src/utils/themePreference.js: write helper is missing");
assert(themePreference.includes("resolveThemePreference"), "src/utils/themePreference.js: resolved theme helper is missing");
assert(themeContext.includes("ThemeProvider"), "src/contexts/ThemeContext.jsx: provider is missing");
assert(themeContext.includes("matchMedia(\"(prefers-color-scheme: dark)\")"), "src/contexts/ThemeContext.jsx: OS theme listener is missing");
assert(app.includes("<ThemeProvider>") && app.includes("</ThemeProvider>"), "src/App.jsx: ThemeProvider is not wired");

assert(mypage.includes("useTheme()"), "src/pages/home/Mypage.jsx: theme context is not used");
assert(mypage.includes('activeTab === "settings"'), "src/pages/home/Mypage.jsx: settings tab is missing");
assert(mypage.includes('role="radiogroup"'), "src/pages/home/Mypage.jsx: theme selector must be a radiogroup");
assert(mypage.includes('role="radio"') && mypage.includes("aria-checked={active}"), "src/pages/home/Mypage.jsx: theme options must expose radio state");

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log("theme-background-smoke ok");
