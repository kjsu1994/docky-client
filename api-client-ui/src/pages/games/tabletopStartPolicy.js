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

export const supportsTabletopSoloAiStart = (game, minPlayers = 0) => (
  soloAiStartGames.has(String(game || "").toLowerCase()) && Number(minPlayers || 0) > 1
);

export const canUseTabletopSoloAiStart = ({ game, playerCount = 0, minPlayers = 0 } = {}) => (
  Number(playerCount || 0) === 1 && supportsTabletopSoloAiStart(game, minPlayers)
);
