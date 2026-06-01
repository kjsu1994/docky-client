import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapGameData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const asNumberArray = (value) => Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [];

const RANK_LABELS = {
    "LUCKY (YACHT)": "럭키 요트",
    STRAIGHT: "스트레이트",
    "FOUR CARD": "포카드",
    "FULL HOUSE": "풀 하우스",
    TRIPLE: "트리플",
    "TWO PAIR": "투 페어",
    "ONE PAIR": "원 페어",
    NONE: "역 없음",
};

export const normalizeDiceResult = (response) => {
    const data = unwrapGameData(response);
    const rankName = data.rankName ?? data.rank_name ?? "NONE";
    return {
        dice: asNumberArray(data.dice),
        rankName,
        rankLabel: RANK_LABELS[rankName] || rankName,
        marbles: toNumber(data.marbles),
        canReroll: Boolean(data.canReroll ?? data.can_reroll),
    };
};

export const normalizePlinkoResult = (response) => {
    const data = unwrapGameData(response);
    return {
        marblesUsed: toNumber(data.marblesUsed ?? data.marbles_used),
        landingSlots: asNumberArray(data.landingSlots ?? data.landing_slots),
        multipliers: asNumberArray(data.multipliers),
        earnedPoint: toNumber(data.earnedPoint ?? data.earned_point),
        totalPoint: toNumber(data.totalPoint ?? data.total_point),
    };
};

export const luckyPlinkoErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const luckyPlinkoAdapter = {
    async rollDice() {
        const response = await api.post("/game/dice/roll");
        return normalizeDiceResult(response);
    },

    async rerollDice(heldIndices) {
        const response = await api.post("/game/dice/reroll", heldIndices);
        return normalizeDiceResult(response);
    },

    async playPlinko() {
        const response = await api.post("/game/plinko/play");
        return normalizePlinkoResult(response);
    },
};
