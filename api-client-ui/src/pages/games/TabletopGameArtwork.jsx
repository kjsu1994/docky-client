const artShell = (compact, className) => [
  "relative overflow-hidden rounded-2xl border border-white/15 shadow-inner",
  compact ? "h-24 w-full" : "h-36 w-56 max-w-full",
  className,
].filter(Boolean).join(" ");

export const tabletopGameArtProfiles = {
  poker: { label: "포커", accent: "text-emerald-200", backdrop: "from-emerald-950 via-slate-950 to-rose-950" },
  dice: { label: "라스베가스", accent: "text-amber-200", backdrop: "from-amber-600 via-orange-700 to-rose-800" },
  cards: { label: "노땡스", accent: "text-slate-200", backdrop: "from-slate-800 via-slate-950 to-emerald-800" },
  catan: { label: "카탄", accent: "text-amber-100", backdrop: "from-amber-500 via-lime-600 to-sky-700" },
  blokus: { label: "블로커스", accent: "text-cyan-100", backdrop: "from-cyan-600 via-blue-700 to-fuchsia-700" },
  mahe: { label: "마헤", accent: "text-emerald-100", backdrop: "from-emerald-500 via-teal-600 to-yellow-500" },
  dalmuti: { label: "달무티", accent: "text-violet-100", backdrop: "from-violet-700 via-rose-700 to-amber-600" },
  "six-nimmt": { label: "젝스님트", accent: "text-rose-100", backdrop: "from-rose-600 via-amber-600 to-lime-600" },
  telestrations: { label: "텔레스트레이션", accent: "text-sky-100", backdrop: "from-sky-600 via-fuchsia-600 to-amber-500" },
  mafia: { label: "마피아", accent: "text-indigo-100", backdrop: "from-zinc-950 via-indigo-950 to-rose-950" },
  citadels: { label: "시티델", accent: "text-amber-100", backdrop: "from-zinc-950 via-red-950 to-amber-700" },
};

const CardFan = ({ compact }) => (
  <g transform={`translate(${compact ? 92 : 104} ${compact ? 58 : 70})`}>
    {[
      { x: -44, r: -13, fill: "#fff7ed", suit: "#0f172a", text: "A" },
      { x: -18, r: -6, fill: "#ffffff", suit: "#dc2626", text: "K" },
      { x: 8, r: 5, fill: "#ffffff", suit: "#0f172a", text: "Q" },
      { x: 34, r: 13, fill: "#fff1f2", suit: "#dc2626", text: "J" },
    ].map((card) => (
      <g key={`${card.text}-${card.x}`} transform={`translate(${card.x} 0) rotate(${card.r})`}>
        <rect x="-20" y="-34" width="40" height="58" rx="7" fill={card.fill} stroke="rgba(15,23,42,.18)" strokeWidth="2" />
        <text x="-11" y="-16" fill={card.suit} fontSize="14" fontWeight="900">{card.text}</text>
        <circle cx="0" cy="4" r="9" fill={card.suit} opacity=".88" />
      </g>
    ))}
  </g>
);

const DiceTable = () => (
  <g transform="translate(36 32)">
    <ellipse cx="74" cy="56" rx="78" ry="36" fill="rgba(15,23,42,.45)" />
    {[0, 1, 2].map((index) => (
      <g key={index} transform={`translate(${48 + index * 32} ${38 + (index % 2) * 8}) rotate(${index * 8 - 8})`}>
        <rect x="-14" y="-14" width="28" height="28" rx="7" fill="#fff" stroke="rgba(15,23,42,.25)" strokeWidth="2" />
        {[[-6, -6], [0, 0], [6, 6], [6, -6], [-6, 6]].slice(0, index === 0 ? 3 : 5).map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="#0f172a" />
        ))}
      </g>
    ))}
    <rect x="24" y="84" width="104" height="18" rx="9" fill="#fde68a" opacity=".85" />
  </g>
);

const CatanIsland = () => {
  const tiles = [
    [64, 28, "#84cc16"], [96, 28, "#f59e0b"], [128, 28, "#64748b"],
    [48, 56, "#16a34a"], [80, 56, "#d97706"], [112, 56, "#eab308"], [144, 56, "#38bdf8"],
    [64, 84, "#facc15"], [96, 84, "#22c55e"], [128, 84, "#a16207"],
  ];
  return (
    <g>
      {tiles.map(([x, y, fill], index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <polygon points="0,-17 14.7,-8.5 14.7,8.5 0,17 -14.7,8.5 -14.7,-8.5" fill={fill} stroke="rgba(255,255,255,.72)" strokeWidth="2" />
          <circle r="5" fill="rgba(255,255,255,.86)" />
          <text y="3" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="900">{[8, 5, 10, 6, 9, 3, 4, 11, 2, 12][index]}</text>
        </g>
      ))}
      <path d="M44 106c28-16 47-2 68-16 19-12 34 3 54-12" fill="none" stroke="#78350f" strokeWidth="5" strokeLinecap="round" opacity=".72" />
    </g>
  );
};

const BlokusGrid = () => (
  <g transform="translate(38 24)">
    <rect width="128" height="96" rx="14" fill="rgba(15,23,42,.55)" />
    {Array.from({ length: 48 }, (_, index) => {
      const x = index % 8;
      const y = Math.floor(index / 8);
      const key = `${x}:${y}`;
      const fills = {
        "0:0": "#3b82f6", "1:0": "#3b82f6", "2:0": "#3b82f6", "2:1": "#3b82f6",
        "6:1": "#f43f5e", "6:2": "#f43f5e", "7:2": "#f43f5e", "7:3": "#f43f5e",
        "1:5": "#22c55e", "2:5": "#22c55e", "2:4": "#22c55e", "3:4": "#22c55e",
        "5:5": "#fde047", "6:5": "#fde047", "6:4": "#fde047", "7:4": "#fde047",
      };
      return <rect key={key} x={8 + x * 14} y={8 + y * 14} width="10" height="10" rx="2" fill={fills[key] || "rgba(255,255,255,.12)"} />;
    })}
  </g>
);

const MaheTrack = () => (
  <g transform="translate(102 72)">
    <circle r="52" fill="rgba(255,255,255,.16)" />
    <circle r="32" fill="rgba(254,243,199,.72)" />
    {Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
      return <circle key={index} cx={Math.cos(angle) * 48} cy={Math.sin(angle) * 48} r={index === 3 ? 7 : 5} fill={index === 3 ? "#10b981" : "#fff"} opacity=".95" />;
    })}
    <ellipse cx="0" cy="0" rx="20" ry="14" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
    <text y="5" textAnchor="middle" fill="#92400e" fontSize="15" fontWeight="900">7</text>
  </g>
);

const DalmutiCourt = () => (
  <g transform="translate(102 70)">
    {[
      [-42, -8, -10, "#fef3c7", "1"],
      [0, -14, 0, "#ede9fe", "2"],
      [42, -8, 10, "#f0abfc", "광"],
    ].map(([x, y, r, fill, label]) => (
      <g key={label} transform={`translate(${x} ${y}) rotate(${r})`}>
        <rect x="-24" y="-38" width="48" height="68" rx="9" fill={fill} stroke="rgba(255,255,255,.7)" strokeWidth="2" />
        <text y="5" textAnchor="middle" fill="#1e293b" fontSize="26" fontWeight="900">{label}</text>
      </g>
    ))}
    <path d="M-58 38h116" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round" opacity=".8" />
  </g>
);

const SixNimmtRows = () => (
  <g transform="translate(34 24)">
    {[0, 1, 2, 3].map((row) => (
      <g key={row} transform={`translate(0 ${row * 25})`}>
        <rect width="136" height="19" rx="6" fill="rgba(255,255,255,.14)" />
        {[0, 1, 2, 3, 4].map((col) => (
          <rect key={col} x={8 + col * 25} y="3" width="18" height="13" rx="3" fill={col <= (row + 1) % 5 ? "#fff" : "rgba(255,255,255,.12)"} opacity={col <= (row + 1) % 5 ? ".92" : "1"} />
        ))}
      </g>
    ))}
    <circle cx="128" cy="88" r="14" fill="#ef4444" />
    <text x="128" y="93" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900">6</text>
  </g>
);

const TelestrationsBook = () => (
  <g transform="translate(34 26)">
    {[
      [0, 4, "#eff6ff", "문장"],
      [48, 0, "#ffffff", "그림"],
      [96, 8, "#fffbeb", "추측"],
    ].map(([x, y, fill, label], index) => (
      <g key={label} transform={`translate(${x} ${y})`}>
        <rect width="46" height="78" rx="8" fill={fill} stroke="rgba(15,23,42,.18)" strokeWidth="2" />
        <text x="23" y="18" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="900">{label}</text>
        {index === 1 ? <path d="M13 52c8-24 17 6 27-18" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" /> : <path d="M10 38h26M10 50h20M10 62h28" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />}
      </g>
    ))}
  </g>
);

const MafiaNight = () => (
  <g>
    <circle cx="50" cy="34" r="17" fill="#fde68a" opacity=".9" />
    <path d="M0 118c26-22 43-12 64-28 27-21 46 4 78-20 17-13 35-7 62 8v58H0Z" fill="rgba(15,23,42,.62)" />
    {[
      [70, 78, "#ef4444"], [103, 70, "#38bdf8"], [134, 82, "#94a3b8"],
    ].map(([x, y, fill]) => (
      <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
        <circle r="10" fill={fill} />
        <path d="M-14 32c2-17 8-25 14-25s12 8 14 25" fill={fill} opacity=".9" />
      </g>
    ))}
  </g>
);

const CitadelsCity = () => (
  <g transform="translate(28 30)">
    {[0, 1, 2, 3, 4].map((index) => (
      <g key={index} transform={`translate(${index * 31} ${index % 2 ? 16 : 4})`}>
        <rect width="24" height={70 - index * 5} rx="5" fill={["#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#22c55e"][index]} />
        <path d="M0 0 12-12 24 0Z" fill="rgba(255,255,255,.72)" />
        <rect x="8" y="20" width="8" height="14" rx="2" fill="rgba(15,23,42,.38)" />
      </g>
    ))}
    <path d="M-4 92h160" stroke="#fde68a" strokeWidth="8" strokeLinecap="round" />
  </g>
);

const NoThanksCard = () => (
  <g transform="translate(102 70)">
    <rect x="-34" y="-48" width="68" height="88" rx="12" fill="#fff" stroke="rgba(15,23,42,.22)" strokeWidth="2" />
    <text y="9" textAnchor="middle" fill="#0f172a" fontSize="44" fontWeight="900">24</text>
    {[0, 1, 2, 3, 4].map((index) => (
      <circle key={index} cx={-56 + index * 16} cy="48" r="7" fill="#f59e0b" stroke="#fff7ed" strokeWidth="2" />
    ))}
  </g>
);

export const TabletopGameArtwork = ({ type, compact = false, className = "" }) => {
  const profile = tabletopGameArtProfiles[type] || tabletopGameArtProfiles.cards;
  const content = {
    poker: <CardFan compact={compact} />,
    dice: <DiceTable />,
    cards: <NoThanksCard />,
    catan: <CatanIsland />,
    blokus: <BlokusGrid />,
    mahe: <MaheTrack />,
    dalmuti: <DalmutiCourt />,
    "six-nimmt": <SixNimmtRows />,
    telestrations: <TelestrationsBook />,
    mafia: <MafiaNight />,
    citadels: <CitadelsCity />,
  }[type] || <NoThanksCard />;

  return (
    <div className={`${artShell(compact, className)} bg-gradient-to-br ${profile.backdrop}`} data-smoke="tabletop-game-artwork">
      <svg viewBox="0 0 204 136" className="h-full min-h-[inherit] w-full" role="img" aria-label={`${profile.label} 게임 아트워크`}>
        <rect width="204" height="136" fill="rgba(15,23,42,.12)" />
        <path d="M-20 104C30 70 70 126 118 88s68-6 114-34" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="18" strokeLinecap="round" />
        {content}
      </svg>
      <div className={`absolute bottom-2 left-2 rounded-full bg-slate-950/55 px-2.5 py-1 text-[10px] font-black ${profile.accent} ring-1 ring-white/15`}>
        {profile.label}
      </div>
    </div>
  );
};

export default TabletopGameArtwork;
