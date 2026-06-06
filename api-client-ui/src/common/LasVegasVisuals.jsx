import React from "react";

const pipMap = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
    6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]],
};

const moneyPalette = {
    10000: { bg: "from-cyan-500 to-blue-600", text: "text-white" },
    20000: { bg: "from-emerald-500 to-teal-600", text: "text-white" },
    30000: { bg: "from-violet-500 to-indigo-600", text: "text-white" },
    40000: { bg: "from-amber-500 to-orange-600", text: "text-white" },
    50000: { bg: "from-rose-500 to-red-600", text: "text-white" },
    60000: { bg: "from-slate-600 to-slate-800", text: "text-white" },
    70000: { bg: "from-fuchsia-500 to-pink-600", text: "text-white" },
    80000: { bg: "from-lime-500 to-green-600", text: "text-white" },
    90000: { bg: "from-yellow-400 to-amber-500", text: "text-slate-900" },
};

export const DiceFace = ({ value = 1, size = 48, className = "" }) => {
    const safe = Math.max(1, Math.min(6, Number(value) || 1));
    return (
        <svg viewBox="0 0 100 100" width={size} height={size} className={className} data-smoke="las-vegas-dice-face" aria-label={`${safe}번 주사위`}>
            <defs>
                <linearGradient id={`dice-grad-${safe}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f3f4f6" />
                </linearGradient>
            </defs>
            <rect x="8" y="8" width="84" height="84" rx="18" fill={`url(#dice-grad-${safe})`} stroke="#cbd5e1" strokeWidth="4" />
            {(pipMap[safe] || []).map((pip, idx) => (
                <circle key={`${safe}-${idx}`} cx={pip[0]} cy={pip[1]} r="7" fill="#0f172a" />
            ))}
        </svg>
    );
};

export const MoneyCard = ({ amount = 10000, className = "" }) => {
    const palette = moneyPalette[amount] || moneyPalette[10000];
    return (
        <div className={`w-24 rounded-xl border border-white/30 bg-gradient-to-br ${palette.bg} p-2 shadow-lg ${className}`} data-smoke="las-vegas-money-card">
            <div className="text-[9px] font-black text-white/80">라스베가스</div>
            <div className={`mt-1 text-sm font-black ${palette.text}`}>{Number(amount).toLocaleString("ko-KR")}원</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/30" />
        </div>
    );
};

export const DiceCountBadge = ({ value = 1, count = 0 }) => {
    return (
        <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-black text-slate-700 shadow-sm" data-smoke="las-vegas-dice-count-badge">
            <DiceFace value={value} size={18} />
            <span>{count}개</span>
        </div>
    );
};

export const CasinoTableSign = ({ value = 1, hot = false, className = "" }) => {
    const safe = Math.max(1, Math.min(6, Number(value) || 1));
    const accent = hot ? "#facc15" : "#22d3ee";
    return (
        <svg viewBox="0 0 96 96" className={className} data-smoke="las-vegas-casino-sign-art" role="img" aria-label={`${safe}번 카지노 표지`}>
            <defs>
                <linearGradient id={`casino-sign-${safe}-${hot ? "hot" : "base"}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={hot ? "#78350f" : "#064e3b"} />
                    <stop offset="100%" stopColor={hot ? "#111827" : "#0f172a"} />
                </linearGradient>
            </defs>
            <rect x="8" y="10" width="80" height="72" rx="20" fill={`url(#casino-sign-${safe}-${hot ? "hot" : "base"})`} stroke={accent} strokeWidth="4" />
            <path d="M18 62c12 7 47 7 60 0" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="25" cy="25" r="4" fill={accent} />
            <circle cx="71" cy="25" r="4" fill={accent} />
            <text x="48" y="56" textAnchor="middle" fontSize="34" fontWeight="900" fill="#ffffff">{safe}</text>
            <text x="48" y="72" textAnchor="middle" fontSize="9" fontWeight="900" fill="rgba(255,255,255,0.72)">카지노</text>
        </svg>
    );
};

export const CasinoEmptyLaneArt = ({ lane = "dice", casinoNo = 0, className = "" }) => {
    const isMoney = lane === "money";
    const title = isMoney ? "머니 대기" : "주사위 대기";
    const detail = isMoney ? "정산 카드가 들어오면 보상 총액이 표시됩니다." : "첫 배팅이 놓이면 경쟁 주사위가 표시됩니다.";
    const accent = isMoney ? "#fbbf24" : "#38bdf8";
    const dark = isMoney ? "#78350f" : "#075985";

    return (
        <div
            className={`flex min-h-[52px] w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-slate-200 ${className}`}
            data-smoke="las-vegas-casino-empty-lane"
            data-lane={lane}
        >
            <svg
                viewBox="0 0 96 56"
                className="h-12 w-20 shrink-0"
                role="img"
                aria-label={`${casinoNo || ""}번 카지노 ${title}`}
                data-smoke="las-vegas-casino-empty-lane-art"
            >
                <rect x="4" y="6" width="88" height="44" rx="14" fill="#0f172a" stroke={accent} strokeWidth="3" />
                <path d="M16 40h64" stroke="rgba(255,255,255,.22)" strokeWidth="3" strokeLinecap="round" />
                {isMoney ? (
                    <>
                        <rect x="21" y="17" width="24" height="18" rx="5" fill={dark} stroke="#fde68a" strokeWidth="2" data-smoke="las-vegas-casino-empty-lane-node" />
                        <rect x="38" y="14" width="24" height="18" rx="5" fill="#92400e" stroke="#fde68a" strokeWidth="2" data-smoke="las-vegas-casino-empty-lane-node" />
                        <path d="M27 26h10M44 23h11" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" />
                    </>
                ) : (
                    <>
                        <rect x="22" y="15" width="22" height="22" rx="7" fill="#f8fafc" stroke={accent} strokeWidth="2" data-smoke="las-vegas-casino-empty-lane-node" />
                        <circle cx="33" cy="26" r="3" fill="#0f172a" />
                        <rect x="52" y="15" width="22" height="22" rx="7" fill="#e0f2fe" stroke={accent} strokeWidth="2" data-smoke="las-vegas-casino-empty-lane-node" />
                        <circle cx="59" cy="22" r="2.5" fill="#0f172a" />
                        <circle cx="67" cy="30" r="2.5" fill="#0f172a" />
                    </>
                )}
                <text x="48" y="49" textAnchor="middle" fontSize="8" fontWeight="900" fill="#f8fafc">
                    {casinoNo ? `${casinoNo}번` : "카지노"}
                </text>
            </svg>
            <div className="min-w-0">
                <div className="text-[11px] font-black text-white">{title}</div>
                <div className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-relaxed text-slate-300">{detail}</div>
            </div>
        </div>
    );
};
