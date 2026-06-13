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
    tailwindConfig,
    header,
    bottomNav,
    protectedRoutes,
    gamesHub,
    mypage,
    boardList,
    boardDetail,
    boardForm,
    chat,
    comments,
    addressSearchBox,
    adminMfaGate,
    gameRoomChatPanel,
    gameRoomPlayersPanel,
] = await Promise.all([
    readSource("src/index.css"),
    readSource("index.html"),
    readSource("public/theme-shim.js"),
    readSource("src/utils/themePreference.js"),
    readSource("src/contexts/ThemeContext.jsx"),
    readSource("src/App.jsx"),
    readSource("tailwind.config.js"),
    readSource("src/components/Header.jsx"),
    readSource("src/components/BottomNav.jsx"),
    readSource("src/components/ProtectedRoutes.jsx"),
    readSource("src/pages/games/GamesHub.jsx"),
    readSource("src/pages/home/Mypage.jsx"),
    readSource("src/pages/boards/BoardList.jsx"),
    readSource("src/pages/boards/BoardDetail.jsx"),
    readSource("src/pages/boards/BoardForm.jsx"),
    readSource("src/pages/chat/Chat.jsx"),
    readSource("src/components/Comments.jsx"),
    readSource("src/common/AddressSearchBox.jsx"),
    readSource("src/components/AdminMfaGate.jsx"),
    readSource("src/common/GameRoomChatPanel.jsx"),
    readSource("src/common/GameRoomPlayersPanel.jsx"),
]);

const failures = [];
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};
const assertIncludesAll = (sourceName, source, tokens) => {
    for (const token of tokens) {
        assert(source.includes(token), `${sourceName}: ${token} token is missing`);
    }
};

assert(css.includes("--app-bg:"), "src/index.css: app background token is missing");
assert(css.includes("--app-bg-vibe:"), "src/index.css: shell background token is missing");
assert(css.includes("--app-ink:"), "src/index.css: app ink token is missing");
assert(css.includes("--color-surface:"), "src/index.css: surface token is missing");
assert(css.includes("--color-text-muted:"), "src/index.css: muted text token is missing");
assert(css.includes("--color-border:"), "src/index.css: border token is missing");
assert(css.includes("--color-control:"), "src/index.css: control token is missing");
assert(css.includes("color-scheme: light dark;"), "src/index.css: system color-scheme support is missing");
assert(css.includes("@media (prefers-color-scheme: dark)"), "src/index.css: system dark-mode media query is missing");
assert(css.includes('html[data-theme="light"]'), "src/index.css: manual light override is missing");
assert(css.includes('html[data-theme="dark"]'), "src/index.css: manual dark override is missing");
assert(/body\s*\{[\s\S]*background:\s*var\(--app-bg\)/.test(css), "src/index.css: body must use --app-bg");
assert(/\.bg-vibe\s*\{[\s\S]*background:\s*var\(--app-bg-vibe\)/.test(css), "src/index.css: .bg-vibe must use --app-bg-vibe");
assert(/\.glass\s*\{[\s\S]*rgb\(var\(--color-surface\)/.test(css), "src/index.css: .glass must use surface tokens");
assert(/\.input-base\s*\{[\s\S]*bg-control/.test(css), "src/index.css: inputs must use control tokens");
assert(css.includes(".board-contents") && css.includes(".rich-board-editor"), "src/index.css: board content theme rules are missing");

for (const token of ["surface", "ink", "line", "control", "focus"]) {
    assert(tailwindConfig.includes(`${token}:`), `tailwind.config.js: ${token} semantic color is missing`);
}

const themeShimIndex = indexHtml.indexOf("/theme-shim.js");
const globalShimIndex = indexHtml.indexOf("/global-shim.js");
assert(themeShimIndex >= 0, "index.html: theme shim is not loaded");
assert(globalShimIndex >= 0, "index.html: global shim is not loaded");
assert(themeShimIndex >= 0 && themeShimIndex < globalShimIndex, "index.html: theme shim must run before global shim");
assert(indexHtml.includes('name="theme-color"'), "index.html: theme-color meta is missing");

for (const [sourceName, source] of [
    ["public/theme-shim.js", shim],
    ["src/utils/themePreference.js", themePreference],
]) {
    assert(source.includes("docky.theme"), `${sourceName}: shared theme storage key is missing`);
    assert(source.includes("light") && source.includes("dark") && source.includes("system"), `${sourceName}: theme values are incomplete`);
    assert(source.includes("dataset.theme"), `${sourceName}: html data-theme application is missing`);
    assert(source.includes("theme-color"), `${sourceName}: browser theme-color synchronization is missing`);
}

assert(themePreference.includes("writeStoredThemePreference"), "src/utils/themePreference.js: write helper is missing");
assert(themePreference.includes("resolveThemePreference"), "src/utils/themePreference.js: resolved theme helper is missing");
assert(themeContext.includes("ThemeProvider"), "src/contexts/ThemeContext.jsx: provider is missing");
assert(themeContext.includes("matchMedia(\"(prefers-color-scheme: dark)\")"), "src/contexts/ThemeContext.jsx: OS theme listener is missing");
assert(themeContext.includes('window.addEventListener("storage"'), "src/contexts/ThemeContext.jsx: cross-tab preference sync is missing");
assert(app.includes("<ThemeProvider>") && app.includes("</ThemeProvider>"), "src/App.jsx: ThemeProvider is not wired");

assert(protectedRoutes.includes("<Route index element={<GamesHub />} />"), "src/components/ProtectedRoutes.jsx: /app must keep GamesHub as the index route");
assert(header.includes('to="/app/mypage?tab=settings"'), "src/components/Header.jsx: settings shortcut link is missing");
assert(header.includes('aria-label="설정으로 이동"'), "src/components/Header.jsx: settings shortcut accessibility label is missing");
assert(header.includes("bg-surface") && header.includes("text-ink-subtle"), "src/components/Header.jsx: header shortcut controls must use semantic theme tokens");
assert(bottomNav.includes("border-line") && bottomNav.includes("text-ink-subtle"), "src/components/BottomNav.jsx: bottom nav must use semantic theme tokens");
assert(gamesHub.includes("border-line bg-surface"), "src/pages/games/GamesHub.jsx: games hub shell must use semantic surface tokens");

assert(mypage.includes("useTheme()"), "src/pages/home/Mypage.jsx: theme context is not used");
assert(mypage.includes('activeTab === "settings"'), "src/pages/home/Mypage.jsx: settings tab is missing");
assert(mypage.includes("getMypageTabFromSearch") && mypage.includes('get("tab")'), "src/pages/home/Mypage.jsx: settings deep link support is missing");
assert(mypage.includes('role="radiogroup"'), "src/pages/home/Mypage.jsx: theme selector must be a radiogroup");
assert(mypage.includes('role="radio"') && mypage.includes("aria-checked={active}"), "src/pages/home/Mypage.jsx: theme options must expose radio state");

for (const [sourceName, source, tokens] of [
    ["src/pages/boards/BoardList.jsx", boardList, ["text-ink", "border-line", "bg-control"]],
    ["src/pages/boards/BoardDetail.jsx", boardDetail, ["board-contents", "text-ink", "border-line", "bg-control"]],
    ["src/pages/boards/BoardForm.jsx", boardForm, ["rich-board-editor", "text-ink", "border-line", "bg-surface"]],
    ["src/pages/chat/Chat.jsx", chat, ["bg-surface", "bg-control", "text-ink", "border-line"]],
    ["src/components/Comments.jsx", comments, ["text-ink", "text-ink-muted", "text-ink-subtle"]],
    ["src/common/AddressSearchBox.jsx", addressSearchBox, ["bg-surface", "bg-control", "text-ink", "border-line"]],
    ["src/components/AdminMfaGate.jsx", adminMfaGate, ["bg-surface", "bg-control", "text-ink", "border-line"]],
    ["src/common/GameRoomChatPanel.jsx", gameRoomChatPanel, ["bg-surface", "bg-control", "text-ink", "border-line"]],
    ["src/common/GameRoomPlayersPanel.jsx", gameRoomPlayersPanel, ["bg-surface", "bg-control", "text-ink", "border-line"]],
]) {
    assertIncludesAll(sourceName, source, tokens);
}

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log("theme-background-smoke ok");
