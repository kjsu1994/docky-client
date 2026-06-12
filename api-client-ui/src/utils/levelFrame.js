const TIER_BY_LEVEL = [
    { code: "CHALLENGER", label: "Challenger", min: 90, max: 100 },
    { code: "GRANDMASTER", label: "Grandmaster", min: 80, max: 89 },
    { code: "MASTER", label: "Master", min: 70, max: 79 },
    { code: "DIAMOND", label: "Diamond", min: 60, max: 69 },
    { code: "EMERALD", label: "Emerald", min: 50, max: 59 },
    { code: "PLATINUM", label: "Platinum", min: 40, max: 49 },
    { code: "GOLD", label: "Gold", min: 30, max: 39 },
    { code: "SILVER", label: "Silver", min: 20, max: 29 },
    { code: "BRONZE", label: "Bronze", min: 10, max: 19 },
    { code: "IRON", label: "Iron", min: 1, max: 9 },
];

export const LEVEL_FRAME_META = {
    IRON: {
        label: "Iron",
        frameClass: "bg-gradient-to-br from-zinc-300 via-zinc-600 to-slate-950 shadow-zinc-400/30",
        glowClass: "bg-zinc-500/25",
        innerRingClass: "ring-zinc-100/90",
        badgeClass: "bg-zinc-800 text-white ring-zinc-200",
    },
    BRONZE: {
        label: "Bronze",
        frameClass: "bg-gradient-to-br from-amber-200 via-orange-700 to-stone-950 shadow-orange-300/35",
        glowClass: "bg-orange-500/25",
        innerRingClass: "ring-amber-100/90",
        badgeClass: "bg-orange-800 text-white ring-amber-200",
    },
    SILVER: {
        label: "Silver",
        frameClass: "bg-gradient-to-br from-white via-slate-300 to-slate-700 shadow-slate-300/45",
        glowClass: "bg-slate-300/35",
        innerRingClass: "ring-white/95",
        badgeClass: "bg-slate-700 text-white ring-white",
    },
    GOLD: {
        label: "Gold",
        frameClass: "bg-gradient-to-br from-yellow-100 via-amber-400 to-orange-800 shadow-amber-300/55",
        glowClass: "bg-amber-400/35",
        innerRingClass: "ring-yellow-100/95",
        badgeClass: "bg-amber-600 text-white ring-yellow-200",
    },
    PLATINUM: {
        label: "Platinum",
        frameClass: "bg-gradient-to-br from-cyan-100 via-slate-100 to-teal-700 shadow-cyan-300/45",
        glowClass: "bg-cyan-300/30",
        innerRingClass: "ring-cyan-50/95",
        badgeClass: "bg-teal-700 text-white ring-cyan-100",
    },
    EMERALD: {
        label: "Emerald",
        frameClass: "bg-gradient-to-br from-emerald-100 via-emerald-400 to-teal-950 shadow-emerald-300/50",
        glowClass: "bg-emerald-400/30",
        innerRingClass: "ring-emerald-50/95",
        badgeClass: "bg-emerald-700 text-white ring-lime-100",
    },
    DIAMOND: {
        label: "Diamond",
        frameClass: "bg-gradient-to-br from-sky-100 via-cyan-300 to-blue-800 shadow-sky-300/55",
        glowClass: "bg-sky-400/30",
        innerRingClass: "ring-sky-50/95",
        badgeClass: "bg-blue-700 text-white ring-sky-100",
    },
    MASTER: {
        label: "Master",
        frameClass: "bg-gradient-to-br from-fuchsia-100 via-violet-500 to-rose-900 shadow-fuchsia-300/55",
        glowClass: "bg-fuchsia-400/35",
        innerRingClass: "ring-fuchsia-100/95",
        badgeClass: "bg-violet-800 text-white ring-fuchsia-200",
    },
    GRANDMASTER: {
        label: "Grandmaster",
        frameClass: "bg-gradient-to-br from-rose-100 via-amber-300 to-violet-950 shadow-rose-300/60",
        glowClass: "bg-rose-400/35",
        innerRingClass: "ring-rose-100/95",
        badgeClass: "bg-rose-700 text-white ring-amber-200",
    },
    CHALLENGER: {
        label: "Challenger",
        frameClass: "bg-[conic-gradient(from_25deg,#cffafe,#fef3c7,#818cf8,#22d3ee,#cffafe)] shadow-cyan-300/70",
        glowClass: "bg-cyan-300/40",
        innerRingClass: "ring-cyan-50/95",
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
