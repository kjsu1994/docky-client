import { Link } from "react-router-dom";
import { ArrowRight, Dices, Sparkles } from "lucide-react";

const games = [
  {
    title: "Lucky Plinko",
    description: "(1인) 혼자 플레이하는 빠칭코",
    to: "/app/plinko",
    tone: "from-emerald-500 via-teal-500 to-cyan-500",
    players: "1인",
    mode: "싱글",
    preview: "plinko",
    highlights: ["즉시 플레이", "혼자 진행"],
    featured: false,
  },
  {
    title: "Las Vegas",
    description: "(2~6인) 실시간 방 입장형 보드게임 / 주사위를 배팅하여 더 많은 금액을 쟁취하세요.",
    to: "/app/games/las-vegas",
    tone: "from-amber-500 via-orange-500 to-rose-500",
    players: "2~6인",
    mode: "방 입장",
    preview: "dice",
    highlights: ["실시간 방", "주사위 배팅"],
    featured: false,
  },
  {
    title: "No Thanks",
    description: "(3~6인) 실시간 방 입장형 보드게임 / 카드와 토큰을 적절히 교환하여 더 낮은 점수를 획득하세요",
    to: "/app/games/no-thanks",
    tone: "from-slate-700 via-slate-900 to-emerald-700",
    players: "3~6인",
    mode: "카드",
    preview: "cards",
    highlights: ["실시간 방", "카드 선택"],
    featured: false,
  },
  {
    title: "카탄",
    description: "(3~6인) 방 입장형 전략 보드게임 / 기본판과 구현된 공식 확장·시나리오를 선택할 수 있습니다.",
    to: "/app/games/catan",
    tone: "from-amber-500 via-lime-500 to-sky-500",
    players: "3~6인",
    mode: "전략",
    preview: "catan",
    highlights: ["기본판", "5~6인", "공식 확장"],
    featured: true,
  },
  {
    title: "블로커스",
    description: "(2~4인) 코너 접촉 배치 게임 / 본게임과 공식 인원 변형을 지원합니다.",
    to: "/app/games/blokus",
    tone: "from-cyan-500 via-blue-500 to-fuchsia-500",
    players: "2~4인",
    mode: "배치",
    preview: "blokus",
    highlights: ["본게임", "듀오", "팀전"],
    featured: true,
  },
  {
    title: "마헤",
    description: "(2~7인) 거북이 경주 게임 / 주사위 선택과 업고 가기 흐름을 지원합니다.",
    to: "/app/games/mahe",
    tone: "from-emerald-500 via-teal-500 to-yellow-400",
    players: "2~7인",
    mode: "경주",
    preview: "mahe",
    highlights: ["본게임", "업고 가기", "확률 안내"],
    featured: true,
  },
  {
    title: "달무티",
    description: "(4~8인) 계급형 클라이밍 카드게임 / 세금과 혁명 규칙을 서버 판정으로 지원합니다.",
    to: "/app/games/dalmuti",
    tone: "from-violet-500 via-rose-500 to-amber-500",
    players: "4~8인",
    mode: "계급 카드",
    preview: "dalmuti",
    highlights: ["본게임", "세금", "혁명"],
    featured: true,
  },
];

const gameRoutePreloads = {
  "/app/games/las-vegas": () => import("./LasVegasGame.jsx"),
  "/app/games/no-thanks": () => import("./NoThanksGame.jsx"),
  "/app/games/catan": () => import("./TabletopGame.jsx"),
  "/app/games/blokus": () => import("./TabletopGame.jsx"),
  "/app/games/mahe": () => import("./TabletopGame.jsx"),
  "/app/games/dalmuti": () => import("./TabletopGame.jsx"),
};

const preloadedRoutes = new Set();

const preloadGameRoute = (to) => {
  const preload = gameRoutePreloads[to];
  if (!preload || preloadedRoutes.has(to)) return;
  preloadedRoutes.add(to);
  preload().catch(() => preloadedRoutes.delete(to));
};

const gameSections = [
  {
    title: "신규 보드게임",
    description: "공식 규칙과 확장 선택, 방 만들기와 코드 입장 흐름을 갖춘 보드게임입니다.",
    games: games.filter((game) => game.featured),
  },
  {
    title: "기존 게임",
    description: "가볍게 바로 시작하거나 기존 실시간 방 흐름으로 즐기는 게임입니다.",
    games: games.filter((game) => !game.featured),
  },
];

const GameCard = ({ game }) => {
  const titleId = `game-card-${game.preview}-title`;
  const descId = `game-card-${game.preview}-desc`;
  const highlightText = (game.highlights || []).join(", ");

  return (
    <Link
      to={game.to}
      aria-describedby={descId}
      aria-label={`${game.title} 입장하기 · ${game.players} · ${game.mode}${highlightText ? ` · ${highlightText}` : ""}`}
      className={`group relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br ${game.tone} p-[1px] shadow-lg transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70`}
      onFocus={() => preloadGameRoute(game.to)}
      onPointerEnter={() => preloadGameRoute(game.to)}
    >
      <div className="flex h-full min-w-0 flex-col rounded-[calc(1rem-1px)] bg-white/95 p-4 backdrop-blur sm:p-5">
        <div className={`overflow-hidden rounded-2xl bg-gradient-to-br ${game.tone} p-3`} aria-hidden="true">
          <div className="flex min-h-36 min-w-0 items-center justify-center rounded-xl bg-white/20 p-3">
            <GamePreview type={game.preview} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
            <Dices className="h-3 w-3" />
            {game.players}
          </span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">{game.mode}</span>
        </div>
        <h2 id={titleId} className="mt-4 text-xl font-black text-slate-900 sm:text-2xl">{game.title}</h2>
        <p id={descId} className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{game.description}</p>
        {!!game.highlights?.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {game.highlights.map((highlight) => (
              <span key={highlight} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                {highlight}
              </span>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <div className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition-all group-hover:bg-primary-600 sm:w-auto">
          입장하기
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
};

const GamePreview = ({ type }) => {
  if (type === "catan") {
    const tiles = [
      { x: 76, y: 24, fill: "#2f8f5b", token: "8", mark: "tree" },
      { x: 108, y: 24, fill: "#f2c94c", token: "5", mark: "field" },
      { x: 140, y: 24, fill: "#7f8792", token: "10", mark: "mountain" },
      { x: 60, y: 52, fill: "#c96f3d", token: "6", mark: "hill" },
      { x: 92, y: 52, fill: "#8ccf5f", token: "9", mark: "grass" },
      { x: 124, y: 52, fill: "#d8b46f", token: "", mark: "desert" },
      { x: 156, y: 52, fill: "#38bdf8", token: "", mark: "sea" },
      { x: 76, y: 80, fill: "#f59e0b", token: "3", mark: "gold" },
      { x: 108, y: 80, fill: "#2f8f5b", token: "11", mark: "tree" },
      { x: 140, y: 80, fill: "#f2c94c", token: "4", mark: "field" },
      { x: 92, y: 108, fill: "#8ccf5f", token: "2", mark: "grass" },
      { x: 124, y: 108, fill: "#c96f3d", token: "12", mark: "hill" },
    ];
    return (
      <svg viewBox="0 0 216 140" className="h-36 w-full max-w-[240px] drop-shadow-sm">
        <rect x="0" y="0" width="216" height="140" rx="24" fill="rgba(255,255,255,.18)" />
        <path d="M8 92C38 70 50 110 82 88S130 78 160 94s40 4 50-8" fill="none" stroke="#075985" strokeWidth="6" strokeLinecap="round" opacity=".22" />
        {tiles.map((tile, index) => (
          <g key={`${tile.x}-${tile.y}-${index}`} transform={`translate(${tile.x} ${tile.y})`}>
            <polygon points="0,-18 15.6,-9 15.6,9 0,18 -15.6,9 -15.6,-9" fill={tile.fill} stroke="rgba(255,255,255,.82)" strokeWidth="2" />
            {tile.mark === "tree" && <path d="M-7 7-2-8 3 7M1 7 6-5 10 7" fill="none" stroke="#14532d" strokeWidth="2" opacity=".48" />}
            {tile.mark === "field" && <path d="M-8-8v16M0-9v18M8-8v16" stroke="#a16207" strokeWidth="1.5" opacity=".42" />}
            {tile.mark === "mountain" && <path d="M-10 9-3-10 3 1l3-6 8 14Z" fill="#475569" opacity=".5" />}
            {tile.mark === "hill" && <path d="M-13 7C-6-4 0 12 7 0c4-7 9-3 12 2" fill="none" stroke="#7c2d12" strokeWidth="2" opacity=".38" />}
            {tile.mark === "grass" && <path d="M-11 6C-6 1-2 10 3 4s8-5 12 1" fill="none" stroke="#166534" strokeWidth="2" opacity=".35" />}
            {tile.mark === "gold" && <path d="M0-9 6 0 0 9-6 0Z" fill="#fef3c7" opacity=".6" />}
            {!!tile.token && (
              <g>
                <circle r="7" fill="rgba(255,255,255,.9)" />
                <text y="3.2" textAnchor="middle" className="fill-slate-800 text-[8px] font-black">{tile.token}</text>
              </g>
            )}
          </g>
        ))}
        <path d="M62 65 92 51 124 65M92 105 124 106 140 80" fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <circle cx="92" cy="51" r="5" fill="#dc2626" stroke="#fff" strokeWidth="2" />
        <circle cx="124" cy="106" r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "blokus") {
    const pieces = [
      { color: "bg-blue-500", cells: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]] },
      { color: "bg-rose-500", cells: [[7, 0], [7, 1], [7, 2], [6, 2], [5, 2]] },
      { color: "bg-emerald-500", cells: [[1, 7], [2, 7], [2, 8], [3, 8], [4, 8]] },
      { color: "bg-yellow-300", cells: [[8, 6], [8, 7], [7, 7], [8, 8], [9, 8]] },
      { color: "bg-fuchsia-500", cells: [[4, 3], [4, 4], [5, 4], [6, 4]] },
    ];
    const cellColors = new Map();
    pieces.forEach((piece) => piece.cells.forEach(([x, y]) => cellColors.set(`${x}:${y}`, piece.color)));
    return (
      <div className="relative max-w-full rounded-2xl bg-slate-950 p-2 shadow-inner">
        <div className="grid h-36 w-36 grid-cols-10 gap-1">
          {Array.from({ length: 100 }, (_, index) => {
            const x = index % 10;
            const y = Math.floor(index / 10);
            const color = cellColors.get(`${x}:${y}`);
            return (
              <span
                key={`${x}-${y}`}
                className={`rounded-[3px] ${color || "bg-white/10"} ${color ? "shadow-sm ring-1 ring-white/25" : ""}`}
              />
            );
          })}
        </div>
        <span className="absolute left-2 top-2 h-3 w-3 rounded-full bg-blue-400 ring-2 ring-white/70" />
        <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-rose-400 ring-2 ring-white/70" />
        <span className="absolute bottom-2 left-2 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white/70" />
        <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-yellow-300 ring-2 ring-white/70" />
      </div>
    );
  }

  if (type === "mahe") {
    return (
      <svg viewBox="0 0 160 160" className="h-36 w-36 drop-shadow-sm">
        <circle cx="80" cy="80" r="78" fill="#ccfbf1" />
        <circle cx="80" cy="80" r="50" fill="#fde68a" opacity=".92" />
        <circle cx="80" cy="80" r="34" fill="#facc15" opacity=".56" />
        {Array.from({ length: 18 }, (_, index) => {
          const angle = (index / 18) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 41;
          const y = 50 + Math.sin(angle) * 41;
          const active = index === 4;
          const stack = index === 9;
          return (
            <g key={index} transform={`translate(${(x / 100) * 160} ${(y / 100) * 160})`}>
              <circle r={active ? 8 : 6.5} fill={active ? "#10b981" : "#ffffff"} stroke={active ? "#047857" : "#99f6e4"} strokeWidth="2" />
              {stack && (
                <g transform="translate(0 -12)">
                  <circle r="5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <circle cy="-7" r="5" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
                </g>
              )}
            </g>
          );
        })}
        <g transform="translate(80 80)">
          <ellipse rx="22" ry="16" fill="#fff7ed" stroke="#f59e0b" strokeWidth="2" />
          <text y="5" textAnchor="middle" className="fill-amber-700 text-[16px] font-black">7</text>
        </g>
        <g transform="translate(112 118)">
          {[0, 1, 2].map((index) => (
            <rect key={index} x={index * 13} y={index % 2 ? -3 : 0} width="12" height="12" rx="3" fill="#ffffff" stroke="#0f766e" strokeWidth="1.2" />
          ))}
        </g>
      </svg>
    );
  }

  if (type === "dalmuti" || type === "cards") {
    const ranks = type === "dalmuti"
      ? [
          { rank: "1", name: "달무티", tone: "from-amber-200 via-white to-rose-100", textClass: "text-slate-900" },
          { rank: "2", name: "대주교", tone: "from-violet-100 via-white to-sky-100", textClass: "text-slate-900" },
          { rank: "광", name: "광대", tone: "from-violet-700 via-fuchsia-600 to-amber-400", textClass: "text-white" },
        ]
      : [
          { rank: "3", name: "카드", tone: "from-white to-slate-100", textClass: "text-slate-900" },
          { rank: "9", name: "카드", tone: "from-white to-slate-100", textClass: "text-slate-900" },
          { rank: "24", name: "카드", tone: "from-white to-slate-100", textClass: "text-slate-900" },
        ];
    return (
      <div className="relative h-36 w-52 max-w-full">
        {ranks.map((card, index) => (
          <div
            key={`${card.rank}-${index}`}
            className={`absolute bottom-1 left-1/2 flex aspect-[2/3] h-32 origin-bottom -translate-x-1/2 flex-col justify-between rounded-2xl border border-white/70 bg-gradient-to-br ${card.tone} ${card.textClass} p-2 shadow-xl ring-1 ring-slate-900/5`}
            style={{ transform: `translateX(calc(-50% + ${(index - 1) * 42}px)) rotate(${(index - 1) * 7}deg)` }}
          >
            <span className="text-xs font-black opacity-70">{card.rank}</span>
            <div className="flex flex-1 flex-col items-center justify-center">
              <span className="text-3xl font-black">{card.rank}</span>
              <span className="mt-1 rounded-full bg-white/65 px-2 py-0.5 text-[10px] font-black text-slate-700">{card.name}</span>
            </div>
            <span className="rotate-180 text-xs font-black opacity-70">{card.rank}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "dice") {
    const dotMap = {
      1: [4],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    return (
      <div className="flex items-center justify-center gap-3">
        {[1, 5, 6].map((value) => (
          <div key={value} className="grid h-16 w-16 grid-cols-3 grid-rows-3 gap-1 rounded-2xl bg-white p-3 shadow-lg">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className={dotMap[value].includes(index) ? "rounded-full bg-slate-900" : ""} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-32 max-w-52 rounded-b-[2rem] border-x border-b border-emerald-100 bg-emerald-50">
      {Array.from({ length: 18 }, (_, index) => (
        <span key={index} className="absolute h-2 w-2 rounded-full bg-teal-500" style={{ left: `${12 + (index % 6) * 15}%`, top: `${12 + Math.floor(index / 6) * 20}%` }} />
      ))}
      <span className="absolute bottom-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-cyan-500 shadow-lg" />
    </div>
  );
};

export const GamesHub = () => {
  return (
    <div className="animate-fade-in space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            게임 허브
          </div>
          <h1 className="mt-4 text-2xl font-black text-slate-900 sm:text-4xl">게임을 선택하세요</h1>
          <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
            방 만들기, 방 코드 입장, 준비하기 흐름은 게임마다 동일하게 유지됩니다.
          </p>
        </div>
      </section>

      {gameSections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">{section.title}</h2>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">{section.description}</p>
            </div>
            <div className="text-[11px] font-black text-slate-400">{section.games.length}개</div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.games.map((game) => (
              <GameCard key={game.to} game={game} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default GamesHub;
