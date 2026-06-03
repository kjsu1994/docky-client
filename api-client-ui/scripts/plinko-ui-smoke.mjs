import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const protectedRoutes = readFileSync("src/components/ProtectedRoutes.jsx", "utf8");
const gamesHub = readFileSync("src/pages/games/GamesHub.jsx", "utf8");
const tabletop = readFileSync("src/pages/games/TabletopGame.jsx", "utf8");
const tabletopSmoke = readFileSync("scripts/tabletop-ui-smoke.mjs", "utf8");
const smokeAll = readFileSync("scripts/smoke-all.mjs", "utf8");

const normalizedRoutes = protectedRoutes.replace(/\s+/g, " ");
const pokerSources = [gamesHub, tabletop, tabletopSmoke].join("\n");

assert(!protectedRoutes.includes("LuckyPlinko"), "plinko-ui-smoke: deprecated LuckyPlinko route import must not remain.");
assert(
    normalizedRoutes.includes('<Route path="plinko" element={<Navigate to="/app/poker" replace />} />'),
    "plinko-ui-smoke: legacy /app/plinko route must redirect to /app/poker.",
);
assert(!gamesHub.includes("Lucky Plinko"), "plinko-ui-smoke: deprecated Lucky Plinko card must not appear in the games hub.");
assert(!gamesHub.includes('"/app/plinko"'), "plinko-ui-smoke: games hub must not preload or link the deprecated Plinko route.");
assert(!gamesHub.includes('preview: "plinko"'), "plinko-ui-smoke: deprecated Plinko preview must not remain in the games hub.");
assert(!existsSync("src/pages/games/LuckyPlinko.jsx"), "plinko-ui-smoke: deprecated LuckyPlinko component file must be removed.");
assert(!existsSync("src/adapters/luckyPlinkoAdapter.js"), "plinko-ui-smoke: deprecated Lucky Plinko adapter must be removed.");

for (const snippet of [
    "TEXAS_HOLDEM",
    "FIVE_CARD_DRAW",
    "내 족보",
    "추천 판단",
    "5장 드로우",
    "최대 3장 교체",
]) {
    assert(pokerSources.includes(snippet), `plinko-ui-smoke: poker UX guard missing ${snippet}`);
}

assert(
    smokeAll.includes('["run", "smoke:tabletop-ui"]'),
    "plinko-ui-smoke: smoke:all must keep the tabletop smoke that exercises poker room flow.",
);

console.log("plinko-ui-smoke ok (legacy plinko route redirects to poker; poker UX guards remain)");
