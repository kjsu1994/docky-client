import { readFileSync } from "node:fs";

const readSource = (path) => readFileSync(path, "utf8");

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(`game-motion-smoke: ${message}`);
    }
};

const packageJson = JSON.parse(readSource("package.json"));
const css = readSource("src/index.css");
const protectedLayout = readSource("src/components/ProtectedAppLayout.jsx");
const motion = readSource("src/utils/motion.js");
const gameMotionHook = readSource("src/hooks/useGameGsapMotion.js");
const pixiLayer = readSource("src/pages/games/PixiBoardLayer.jsx");
const gamesHub = readSource("src/pages/games/GamesHub.jsx");
const lasVegas = readSource("src/pages/games/LasVegasGame.jsx");
const mahe = readSource("src/pages/games/MaheBoard.jsx");
const noThanks = readSource("src/pages/games/NoThanksGame.jsx");

assert(packageJson.dependencies?.gsap, "gsap dependency is missing");
assert(packageJson.dependencies?.["pixi.js"], "pixi.js dependency is missing");

assert(motion.includes('import("gsap")'), "GSAP must be loaded dynamically");
assert(motion.includes("prefers-reduced-motion: reduce"), "motion helper must respect reduced-motion preferences");
assert(gameMotionHook.includes("animateFromToWithGsap"), "game GSAP hook must use the shared GSAP helper");
assert(gameMotionHook.includes("querySelectorAll"), "game GSAP hook must target scoped gameplay anchors");

assert(pixiLayer.includes('import("pixi.js")'), "PixiJS must be loaded dynamically");
for (const snippet of [
    "data-pixi-ready",
    "data-pixi-game",
    "data-pixi-object-count",
    "data-pixi-fps",
    "data-pixi-memory-mb",
    "preserveDrawingBuffer: true",
    "app.ticker.maxFPS = 30",
]) {
    assert(pixiLayer.includes(snippet), `PixiBoardLayer missing ${snippet}`);
}

for (const [sourceName, source, snippets] of [
    ["LasVegasGame.jsx", lasVegas, [
        "useGameGsapMotion",
        'data-gsap="las-vegas-casino"',
        'data-gsap="las-vegas-dice-stack"',
        'data-gsap="las-vegas-recent-action"',
    ]],
    ["MaheBoard.jsx", mahe, [
        "useGameGsapMotion",
        'data-gsap="mahe-dice-face"',
        'data-gsap="mahe-score-row"',
    ]],
    ["NoThanksGame.jsx", noThanks, [
        "useGameGsapMotion",
        'data-gsap="no-thanks-card-stage"',
    ]],
]) {
    for (const snippet of snippets) {
        assert(source.includes(snippet), `${sourceName} missing ${snippet}`);
    }
}

assert(!protectedLayout.includes("CustomCursorEntry"), "protected app layout must not mount the custom cursor");
assert(!lasVegas.includes("PixiBoardLayer"), "LasVegasGame must not render a duplicate Pixi board above the main play board");
assert(!lasVegas.includes('dataSmoke="las-vegas-pixi-board-layer"'), "LasVegasGame must not render duplicate top Pixi board art");
assert(!lasVegas.includes('data-gsap="las-vegas-pixi"'), "LasVegasGame must not animate a removed top Pixi layer");
assert(!lasVegas.includes("opacity: 0.78"), "LasVegas dice motion must not fade the whole play surface on every roll");
assert(!mahe.includes("PixiBoardLayer"), "MaheBoard must not render a duplicate Pixi board above the main play board");
assert(!mahe.includes('dataSmoke="mahe-pixi-board-layer"'), "MaheBoard must not render duplicate top Pixi board art");
assert(!mahe.includes("opacity: 0.82"), "Mahe dice motion must not fade the whole play surface on every roll");
for (const snippet of ["--mouse-x", ".spotlight-card::before", ".cursor-dot", ".cursor-outline", ".cursor-hover"]) {
    assert(!css.includes(snippet), `index.css still contains removed mouse effect selector ${snippet}`);
}

for (const snippet of [
    "GameCardSelectionPanel",
    "GameCardMotionPreview",
    "gameCardMotionKinds",
    'data-smoke="game-card-selection-panel"',
    'dataSmoke="game-card-hover-art"',
    'variant="hero"',
    'data-game-selected={selected ? "true" : "false"}',
    'data-touch-preview-mode="tap"',
    'data-compact-auto-preview={compactCards ? "visible-cards" : "hover"}',
    "activeGamePreviews",
    "setActiveGamePreviews",
    ".slice(0, 4)",
    "(hover: none)",
    "handleEntryClick",
]) {
    assert(gamesHub.includes(snippet), `GamesHub hover/hold expansion missing ${snippet}`);
}

assert(!gamesHub.includes('data-smoke="game-card-selection-art"'), "GamesHub must not render duplicate lower motion art in selection panels");
assert(!gamesHub.includes("hover:col-span-2"), "GamesHub cards must not reflow the grid on hover");
assert(!gamesHub.includes("xl:hover:col-span-2"), "GamesHub desktop hover must not push the last column to a new row");
assert(gamesHub.includes("grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"), "GamesHub card grid must keep two mobile columns and four desktop columns");

for (const snippet of [
    "poker-pot",
    "casino-dice",
    "no-thanks",
    "catan-trade",
    "blokus-grid",
    "mahe-turtle",
    "dalmuti-crown",
    "six-row",
    "sketch-pass",
    "mafia-night",
    "citadels-build",
    "arena-target",
    "fortress-siege",
    "tower-defense",
    "kart-lap",
    "bomb-fuse",
    "snake-trail",
    "coin-stack",
    "rpg-tree",
]) {
    assert(gamesHub.includes(snippet), `GamesHub missing unique card motion kind ${snippet}`);
}

for (const snippet of [
    "game-card-dice-roll",
    "game-card-card-fan",
    "game-card-turtle-run",
    "game-card-projectile-arc",
    "game-card-bar-eq",
]) {
    assert(css.includes(snippet), `index.css missing game hub animation ${snippet}`);
}

console.log("game-motion-smoke ok");
