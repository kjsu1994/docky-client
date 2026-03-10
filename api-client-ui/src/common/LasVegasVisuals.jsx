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
        <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
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
        <div className={`w-24 rounded-xl border border-white/30 bg-gradient-to-br ${palette.bg} p-2 shadow-lg ${className}`}>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/80">Las Vegas</div>
            <div className={`mt-1 text-sm font-black ${palette.text}`}>{Number(amount).toLocaleString("ko-KR")}원</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/30" />
        </div>
    );
};

export const DiceCountBadge = ({ value = 1, count = 0 }) => {
    return (
        <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-black text-slate-700 shadow-sm">
            <DiceFace value={value} size={18} />
            <span>x{count}</span>
        </div>
    );
};

