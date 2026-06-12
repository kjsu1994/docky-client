const TIER_BY_LEVEL = [
    { code: "CHALLENGER", label: "챌린저", min: 90, max: 100 },
    { code: "GRANDMASTER", label: "그랜드마스터", min: 80, max: 89 },
    { code: "MASTER", label: "마스터", min: 70, max: 79 },
    { code: "DIAMOND", label: "다이아몬드", min: 60, max: 69 },
    { code: "EMERALD", label: "에메랄드", min: 50, max: 59 },
    { code: "PLATINUM", label: "플래티넘", min: 40, max: 49 },
    { code: "GOLD", label: "골드", min: 30, max: 39 },
    { code: "SILVER", label: "실버", min: 20, max: 29 },
    { code: "BRONZE", label: "브론즈", min: 10, max: 19 },
    { code: "IRON", label: "아이언", min: 1, max: 9 },
];

export const LEVEL_FRAME_META = {
    IRON: {
        label: "아이언",
        ringClass: "bg-gradient-to-br from-zinc-500 via-slate-300 to-zinc-800 shadow-slate-400/30",
        badgeClass: "bg-zinc-800 text-white ring-zinc-300",
    },
    BRONZE: {
        label: "브론즈",
        ringClass: "bg-gradient-to-br from-orange-800 via-amber-300 to-stone-700 shadow-orange-300/35",
        badgeClass: "bg-orange-800 text-white ring-amber-200",
    },
    SILVER: {
        label: "실버",
        ringClass: "bg-gradient-to-br from-slate-300 via-white to-slate-600 shadow-slate-300/45",
        badgeClass: "bg-slate-700 text-white ring-white",
    },
    GOLD: {
        label: "골드",
        ringClass: "bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-700 shadow-amber-300/50",
        badgeClass: "bg-amber-600 text-white ring-yellow-200",
    },
    PLATINUM: {
        label: "플래티넘",
        ringClass: "bg-gradient-to-br from-cyan-200 via-slate-100 to-teal-600 shadow-cyan-300/45",
        badgeClass: "bg-teal-700 text-white ring-cyan-100",
    },
    EMERALD: {
        label: "에메랄드",
        ringClass: "bg-gradient-to-br from-emerald-300 via-lime-200 to-teal-700 shadow-emerald-300/50",
        badgeClass: "bg-emerald-700 text-white ring-lime-100",
    },
    DIAMOND: {
        label: "다이아몬드",
        ringClass: "bg-gradient-to-br from-sky-200 via-fuchsia-100 to-blue-700 shadow-sky-300/55",
        badgeClass: "bg-blue-700 text-white ring-sky-100",
    },
    MASTER: {
        label: "마스터",
        ringClass: "bg-gradient-to-br from-violet-400 via-fuchsia-300 to-rose-600 shadow-fuchsia-300/55",
        badgeClass: "bg-violet-800 text-white ring-fuchsia-200",
    },
    GRANDMASTER: {
        label: "그랜드마스터",
        ringClass: "bg-gradient-to-br from-rose-500 via-amber-300 to-violet-800 shadow-rose-300/60",
        badgeClass: "bg-rose-700 text-white ring-amber-200",
    },
    CHALLENGER: {
        label: "챌린저",
        ringClass: "bg-gradient-to-br from-cyan-200 via-amber-200 to-indigo-700 shadow-cyan-300/70",
        badgeClass: "bg-indigo-800 text-white ring-cyan-100",
    },
};

export const rewardTierFromLevel = (level) => {
    const parsed = Number(level);
    const safeLevel = Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 1;
    return TIER_BY_LEVEL.find((tier) => safeLevel >= tier.min && safeLevel <= tier.max) || TIER_BY_LEVEL[TIER_BY_LEVEL.length - 1];
};

export const normalizeRewardTierCode = ({ level, rewardTier, frameCode } = {}) => {
    const explicit = String(rewardTier || frameCode || "")
        .replace(/^FRAME_/i, "")
        .trim()
        .toUpperCase();
    if (explicit && LEVEL_FRAME_META[explicit]) return explicit;
    return rewardTierFromLevel(level).code;
};

export const getLevelFrameMeta = ({ level, rewardTier, frameCode } = {}) => {
    const code = normalizeRewardTierCode({ level, rewardTier, frameCode });
    return {
        code,
        ...LEVEL_FRAME_META[code],
    };
};
