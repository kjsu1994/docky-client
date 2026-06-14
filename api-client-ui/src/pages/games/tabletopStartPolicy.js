const soloAiStartGames = new Set([
  "catan",
  "blokus",
  "mahe",
  "dalmuti",
  "citadels",
  "six-nimmt",
  "telestrations",
  "mafia",
]);

const intrinsicSoloAiStartGames = new Set([
  "poker",
]);

export const supportsTabletopSoloAiStart = (game, minPlayers = 0) => (
  intrinsicSoloAiStartGames.has(String(game || "").toLowerCase())
    ? Number(minPlayers || 0) >= 1
    : soloAiStartGames.has(String(game || "").toLowerCase()) && Number(minPlayers || 0) > 1
);

export const supportsTabletopAiBotStart = supportsTabletopSoloAiStart;

export const canUseTabletopSoloAiStart = ({ game, playerCount = 0, minPlayers = 0 } = {}) => (
  Number(playerCount || 0) === 1 && supportsTabletopSoloAiStart(game, minPlayers)
);
