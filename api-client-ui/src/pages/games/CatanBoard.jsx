import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Dices, Shield } from "lucide-react";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import { GameResultSpotlight } from "./GameUxAssets.jsx";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const catanTerrain = {
  FOREST: { label: "숲", fill: "#2f8f5b", text: "#ffffff" },
  PASTURE: { label: "목초지", fill: "#8ccf5f", text: "#17350f" },
  FIELD: { label: "밀밭", fill: "#f2c94c", text: "#4a3500" },
  HILL: { label: "언덕", fill: "#c96f3d", text: "#ffffff" },
  MOUNTAIN: { label: "산", fill: "#7f8792", text: "#ffffff" },
  DESERT: { label: "사막", fill: "#d8b46f", text: "#5a3c10" },
  GOLD: { label: "금광", fill: "#f59e0b", text: "#451a03" },
  SEA: { label: "바다", fill: "#38bdf8", text: "#075985" },
  UNEXPLORED: { label: "미발견", fill: "#475569", text: "#f8fafc" },
};

const catanTerrainPatternIds = {
  FOREST: "catan-terrain-forest",
  PASTURE: "catan-terrain-pasture",
  FIELD: "catan-terrain-field",
  HILL: "catan-terrain-hill",
  MOUNTAIN: "catan-terrain-mountain",
  DESERT: "catan-terrain-desert",
  GOLD: "catan-terrain-gold",
  SEA: "catan-terrain-sea",
  UNEXPLORED: "catan-terrain-unexplored",
};

const catanResourceLabels = {
  BRICK: "벽돌",
  LUMBER: "목재",
  WOOL: "양털",
  GRAIN: "곡물",
  ORE: "광석",
  WOOL_GRAIN: "양털/곡물",
};

const catanTerrainResourceType = {
  FOREST: "LUMBER",
  PASTURE: "WOOL",
  FIELD: "GRAIN",
  HILL: "BRICK",
  MOUNTAIN: "ORE",
  GOLD: "GOLD",
};

const catanResourceKeys = ["BRICK", "LUMBER", "WOOL", "GRAIN", "ORE"];
const catanResourceEntries = catanResourceKeys.map((key) => [key, catanResourceLabels[key]]);
const emptyCatanResourceCounts = () => Object.fromEntries(catanResourceKeys.map((key) => [key, 0]));

const catanResourceArtProfiles = {
  BRICK: { fill: "#dc2626", stroke: "#7f1d1d", wash: "#fecaca", ink: "#fff7ed" },
  LUMBER: { fill: "#92400e", stroke: "#451a03", wash: "#fde68a", ink: "#fff7ed" },
  WOOL: { fill: "#f8fafc", stroke: "#64748b", wash: "#e0f2fe", ink: "#0f172a" },
  GRAIN: { fill: "#facc15", stroke: "#a16207", wash: "#fef9c3", ink: "#451a03" },
  ORE: { fill: "#64748b", stroke: "#1e293b", wash: "#e2e8f0", ink: "#f8fafc" },
};

const CatanResourceTokenArt = ({ type, count = 0, bankCount = null, className = "" }) => {
  const profile = catanResourceArtProfiles[type] || catanResourceArtProfiles.BRICK;
  const label = catanResourceLabels[type] || type;
  const safeCount = Math.max(0, Number(count || 0));
  const bankLabel = bankCount == null ? "은행 -" : `은행 ${bankCount}`;
  const countScale = Math.min(1, safeCount / 6);

  return (
    <svg
      viewBox="0 0 96 112"
      className={className}
      data-smoke="catan-resource-token-art"
      role="img"
      aria-label={`${label} 보유 ${safeCount}장, ${bankLabel}`}
    >
      <rect x="7" y="7" width="82" height="98" rx="16" fill={profile.wash} stroke={profile.stroke} strokeWidth="3" />
      <rect x="15" y="15" width="66" height="82" rx="12" fill="#ffffff" opacity=".72" />
      <g transform="translate(48 44)">
        {type === "BRICK" && (
          <>
            <rect x="-25" y="-18" width="22" height="13" rx="3" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            <rect x="-1" y="-18" width="26" height="13" rx="3" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            <rect x="-18" y="-3" width="36" height="13" rx="3" fill="#ef4444" stroke={profile.stroke} strokeWidth="2" />
            <rect x="-26" y="12" width="24" height="13" rx="3" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            <rect x="4" y="12" width="22" height="13" rx="3" fill="#ef4444" stroke={profile.stroke} strokeWidth="2" />
          </>
        )}
        {type === "LUMBER" && (
          <>
            {[-14, 0, 14].map((offset) => (
              <g key={offset} transform={`translate(${offset} ${offset === 0 ? 4 : 0}) rotate(${offset / 2})`}>
                <rect x="-6" y="-25" width="12" height="50" rx="6" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
                <path d="M-2-18c5 8-4 16 2 25" fill="none" stroke={profile.wash} strokeWidth="2" strokeLinecap="round" opacity=".65" />
              </g>
            ))}
          </>
        )}
        {type === "WOOL" && (
          <>
            {[
              [-16, -4, 14], [0, -14, 16], [16, -4, 14], [-9, 11, 14], [11, 10, 15],
            ].map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            ))}
            <circle cx="5" cy="0" r="8" fill={profile.stroke} opacity=".8" />
          </>
        )}
        {type === "GRAIN" && (
          <>
            <path d="M0 28V-27" stroke={profile.stroke} strokeWidth="4" strokeLinecap="round" />
            {[-19, -10, -1, 8, 17].map((y, index) => (
              <g key={y}>
                <ellipse cx="-10" cy={y} rx="7" ry="11" fill={profile.fill} stroke={profile.stroke} strokeWidth="1.7" transform={`rotate(${-35 - index * 3} -10 ${y})`} />
                <ellipse cx="10" cy={y + 3} rx="7" ry="11" fill={profile.fill} stroke={profile.stroke} strokeWidth="1.7" transform={`rotate(${35 + index * 3} 10 ${y + 3})`} />
              </g>
            ))}
          </>
        )}
        {type === "ORE" && (
          <>
            <polygon points="-22,12 -14,-18 6,-26 26,-8 20,22 -6,28" fill={profile.fill} stroke={profile.stroke} strokeWidth="2.4" />
            <polygon points="-6,-10 8,-18 17,-5 8,5" fill="#94a3b8" opacity=".72" />
            <polygon points="-18,12 -7,5 5,25 -8,26" fill="#334155" opacity=".55" />
          </>
        )}
      </g>
      <rect x="18" y="78" width="58" height="16" rx="8" fill={profile.stroke} opacity=".9" />
      <rect x="18" y="78" width={Math.max(8, 58 * countScale)} height="16" rx="8" fill={profile.fill} />
      <text x="48" y="72" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">{label}</text>
      <text x="48" y="91" textAnchor="middle" fill={profile.ink} fontSize="12" fontWeight="900">{safeCount}장</text>
    </svg>
  );
};

const CatanResourceStrategyArt = ({
  resources = {},
  buildSignals = [],
  tradeSummary = "",
  scoreRace = [],
  myCardCount = 0,
  phase = "",
  myTurn = false,
}) => {
  const resourceTotal = catanResourceKeys.reduce((sum, key) => sum + Math.max(0, Number(resources?.[key] || 0)), 0);
  const readyBuilds = buildSignals.filter((item) => item.ready).length;
  const affordableBuilds = buildSignals.filter((item) => item.affordable || item.ready).length;
  const leader = scoreRace[0];
  const tradeReady = /가능|교환|항구|은행/.test(tradeSummary || "");
  const nodes = [
    {
      key: "resource",
      x: 58,
      y: 83,
      label: "자원",
      value: `${resourceTotal}장`,
      active: resourceTotal > 0,
      fill: "#f59e0b",
    },
    {
      key: "build",
      x: 150,
      y: 52,
      label: "건설",
      value: readyBuilds ? `${readyBuilds}개` : affordableBuilds ? "차례" : "부족",
      active: readyBuilds > 0,
      fill: "#10b981",
    },
    {
      key: "trade",
      x: 242,
      y: 92,
      label: "교환",
      value: tradeReady ? "검토" : "대기",
      active: tradeReady,
      fill: "#0ea5e9",
    },
    {
      key: "score",
      x: 334,
      y: 62,
      label: "승점",
      value: leader ? `${leader.points}/${leader.target}` : "-",
      active: Boolean(leader),
      fill: "#8b5cf6",
    },
  ];

  return (
    <svg
      viewBox="0 0 390 150"
      className="h-auto w-full"
      data-smoke="catan-resource-strategy-art"
      role="img"
      aria-label="카탄 자원에서 건설, 교환, 승점 압박으로 이어지는 전략 흐름"
      focusable="false"
    >
      <rect x="8" y="8" width="374" height="134" rx="24" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <path d="M58 83C96 40 118 35 150 52s55 68 92 40 59-68 92-30" fill="none" stroke="#334155" strokeWidth="13" strokeLinecap="round" />
      <path d="M58 83C96 40 118 35 150 52s55 68 92 40 59-68 92-30" fill="none" stroke={myTurn ? "#fbbf24" : "#64748b"} strokeWidth="4" strokeLinecap="round" />
      <text x="24" y="32" fontSize="11" fontWeight="900" fill="#fde68a">자원 전략 지도</text>
      <text x="24" y="51" fontSize="17" fontWeight="900" fill="#ffffff">자원 → 건설 → 교환 → 승점</text>
      <text x="24" y="126" fontSize="10" fontWeight="900" fill="#cbd5e1">{`${myTurn ? "내 차례" : "관찰"} · 손패 ${myCardCount} · ${phase || "상태 확인"}`}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="catan-resource-strategy-node" data-strategy-key={node.key} data-active={node.active ? "true" : "false"}>
          <circle cx={node.x} cy={node.y} r="23" fill={node.active ? "#ffffff" : "#f8fafc"} stroke={node.active ? node.fill : "#cbd5e1"} strokeWidth="4" />
          <circle cx={node.x} cy={node.y} r="7" fill={node.active ? node.fill : "#94a3b8"} />
          <text x={node.x} y={node.y - 31} textAnchor="middle" fontSize="10" fontWeight="900" fill="#f8fafc">{node.label}</text>
          <text x={node.x} y={node.y + 39} textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const CatanResourceStrategyPanel = ({
  resources = {},
  resourceBank = {},
  buildSignals = [],
  scoreRace = [],
  myCardCount = 0,
  tradeSummary = "",
  phase = "",
  myTurn = false,
  className = "",
}) => {
  const resourceTotal = catanResourceKeys.reduce((sum, key) => sum + Math.max(0, Number(resources?.[key] || 0)), 0);
  const readyBuildCount = buildSignals.filter((item) => item.ready).length;

  return (
    <section
      className={`rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 text-white shadow-lg ${className}`}
      data-smoke="catan-resource-strategy-panel"
      data-phase={phase || ""}
      data-my-turn={myTurn ? "true" : "false"}
      data-resource-total={resourceTotal}
      data-ready-builds={readyBuildCount}
      data-card-count={myCardCount}
      aria-label="카탄 자원과 건설 판단"
    >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-amber-200">Resource Board</div>
        <div className="mt-1 text-base font-black">자원과 다음 건설 판단</div>
        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
          {myTurn ? "내 보유 자원으로 가능한 건설·교환 신호를 즉시 확인합니다." : "자원은 충분해도 실제 실행은 내 차례에만 가능합니다."}
        </div>
      </div>
      <div className="rounded-xl bg-white/10 px-3 py-2 text-right ring-1 ring-white/10">
        <div className="text-[10px] font-black text-slate-400">손패 압박</div>
        <div className="text-xl font-black text-amber-100">{myCardCount}</div>
        <div className="text-[10px] font-bold text-slate-400">{phase === "DISCARD" ? "버리기 단계" : "자원+상품"}</div>
      </div>
    </div>
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <CatanResourceStrategyArt
        resources={resources}
        buildSignals={buildSignals}
        tradeSummary={tradeSummary}
        scoreRace={scoreRace}
        myCardCount={myCardCount}
        phase={phase}
        myTurn={myTurn}
      />
    </div>
    <div className="mt-4 grid grid-cols-5 gap-1.5">
      {catanResourceEntries.map(([key]) => (
        <CatanResourceTokenArt
          key={key}
          type={key}
          count={resources?.[key] ?? 0}
          bankCount={resourceBank?.[key] ?? null}
          className="h-24 w-full"
        />
      ))}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2" data-smoke="catan-build-readiness-list">
      {buildSignals.map((item) => (
        <div
          key={item.key}
          className={`min-h-[92px] rounded-xl border px-3 py-2 ${item.ready ? "border-emerald-300/40 bg-emerald-400/15" : item.affordable ? "border-amber-300/40 bg-amber-400/15" : "border-white/10 bg-white/10"}`}
          data-smoke="catan-build-readiness-card"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-black">{item.label}</div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? "bg-emerald-300 text-emerald-950" : item.affordable ? "bg-amber-200 text-amber-950" : "bg-white/10 text-slate-300"}`}>
              {item.ready ? "가능" : item.affordable ? "차례 대기" : "재료 부족"}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">{item.cost}</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-400">{item.detail}</div>
        </div>
      ))}
    </div>
    <div className="mt-4 rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black text-slate-200">승점 레이스</div>
        <div className="text-[10px] font-bold text-slate-400">{tradeSummary}</div>
      </div>
      <div className="mt-2 space-y-2">
        {scoreRace.map((player) => (
          <div key={player.seatNo} data-smoke="catan-score-race-item">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className={player.isMe ? "text-amber-100" : "text-slate-300"}>{player.name}</span>
              <span className="text-slate-400">{player.points}/{player.target}점</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${player.isMe ? "bg-amber-300" : "bg-sky-300"}`}
                style={{ width: `${player.progress}%` }}
              />
            </div>
          </div>
        ))}
        {!scoreRace.length && <div className="text-xs font-bold text-slate-500">플레이어 승점 정보가 아직 없습니다.</div>}
      </div>
    </div>
    </section>
  );
};

const CatanVictoryTrackArt = ({ rows = [], target = 10, leaderSeatNo = 0, mySeatNo = 0 }) => {
  const visibleRows = rows.slice(0, 4);
  const safeTarget = Math.max(1, Number(target || 10));

  return (
    <svg
      data-smoke="catan-victory-track-art"
      viewBox="0 0 420 230"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 승리 트랙 목표 ${safeTarget}점`}
      focusable="false"
    >
      <rect x="12" y="12" width="396" height="206" rx="28" fill="#f8fafc" stroke="#fde68a" strokeWidth="3" />
      <path d="M36 184c44-42 78-50 116-24 31 22 62 19 100-11 46-36 90-25 132 35v32H36Z" fill="#fef3c7" opacity=".7" />
      <rect x="54" y="46" width="300" height="16" rx="8" fill="#e2e8f0" />
      <path d="M354 36v44" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
      <path d="M340 43h34l-9 10 9 10h-34Z" fill="#f59e0b" stroke="#92400e" strokeWidth="2" />
      <text x="354" y="30" textAnchor="middle" fontSize="13" fontWeight="900" fill="#92400e">목표 {safeTarget}</text>
      {visibleRows.map((row, index) => {
        const y = 86 + index * 35;
        const progress = Math.max(0, Math.min(1, Number(row.visiblePoints || 0) / safeTarget));
        const x = 54 + progress * 300;
        const isLeader = row.seatNo === leaderSeatNo;
        const isMe = row.seatNo === mySeatNo;
        const fill = isLeader ? "#f59e0b" : isMe ? "#06b6d4" : "#94a3b8";
        return (
          <g key={row.seatNo || index} data-smoke="catan-victory-track-node">
            <rect x="54" y={y - 7} width="300" height="14" rx="7" fill="#e2e8f0" />
            <rect x="54" y={y - 7} width={Math.max(10, x - 54)} height="14" rx="7" fill={fill} opacity=".9" />
            <circle cx={x} cy={y} r={isLeader ? 16 : 13} fill="#ffffff" stroke={fill} strokeWidth={isLeader ? 5 : 4} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{row.visiblePoints}</text>
            <text x="32" y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">{index + 1}</text>
            <text x="368" y={y + 4} fontSize="11" fontWeight="900" fill={isLeader ? "#92400e" : isMe ? "#0e7490" : "#475569"}>
              {isLeader ? "선두" : isMe ? "나" : `${row.remaining}점 남음`}
            </text>
          </g>
        );
      })}
      <rect x="38" y="188" width="154" height="28" rx="14" fill="#ffffff" stroke="#fde68a" />
      <text x="115" y="207" textAnchor="middle" fontSize="12" fontWeight="900" fill="#92400e">공개 승점 기준</text>
      <rect x="218" y="188" width="150" height="28" rx="14" fill="#ffffff" stroke="#bae6fd" />
      <text x="293" y="207" textAnchor="middle" fontSize="12" fontWeight="900" fill="#075985">내 숨은 점수 포함</text>
    </svg>
  );
};

const CatanVictoryTrackPanel = ({ rows = [], target = 10, phase = "", mySeatNo = 0 }) => {
  if (!rows.length) return null;
  const leader = rows[0];
  const mine = rows.find((row) => row.seatNo === mySeatNo) || null;
  const safeTarget = Math.max(1, Number(target || 10));
  const leaderRemaining = Math.max(0, safeTarget - Number(leader?.visiblePoints || 0));
  const myRemaining = mine ? Math.max(0, safeTarget - Number(mine.visiblePoints || 0)) : null;
  const gap = mine ? Math.max(0, Number(leader?.visiblePoints || 0) - Number(mine.visiblePoints || 0)) : 0;
  const finished = phase === "FINISHED";
  const items = [
    {
      label: finished ? "승자" : "선두",
      value: leader ? `${leader.name} ${leader.visiblePoints}점` : "-",
      detail: leaderRemaining <= 0 ? "목표 점수에 도달한 상태입니다." : `목표까지 ${leaderRemaining}점 남았습니다.`,
      tone: "border-amber-100 bg-amber-50 text-amber-900",
    },
    {
      label: "내 격차",
      value: mine ? (gap > 0 ? `${gap}점 차이` : "동률/선두권") : "참가 대기",
      detail: mine ? `내 목표까지 ${myRemaining}점 남았습니다.` : "내 좌석 점수 정보가 아직 없습니다.",
      tone: "border-sky-100 bg-sky-50 text-sky-900",
    },
    {
      label: "보너스 압력",
      value: `${rows.reduce((sum, row) => sum + row.bonusCount, 0)}개 신호`,
      detail: "최장 교역로, 최대 기사력, 특별/임무/방어자 점수 같은 공개 보너스 신호입니다.",
      tone: "border-violet-100 bg-violet-50 text-violet-900",
    },
    {
      label: "판단 기준",
      value: finished ? "결과 확인" : "점수 레이스",
      detail: "상대는 공개 승점 중심, 내 점수는 서버가 내려준 내 승점 정보를 함께 읽습니다.",
      tone: "border-slate-200 bg-white text-slate-700",
    },
  ];

  return (
    <section data-smoke="catan-victory-track-panel" className="mb-3 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem]">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.05fr]">
        <CatanVictoryTrackArt rows={rows} target={safeTarget} leaderSeatNo={leader?.seatNo || 0} mySeatNo={mySeatNo} />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-amber-700">승리 트랙</div>
              <div className="mt-1 text-base font-black text-slate-950">누가 목표에 가장 가까운지 확인</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                목표 {safeTarget}점까지 남은 거리와 공개 보너스 압력을 보드 조작 전에 읽습니다.
              </div>
            </div>
            <span className="rounded-full border border-amber-100 bg-white px-3 py-1 text-[11px] font-black text-amber-700">
              목표까지 {leaderRemaining}점
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {items.map((item) => (
              <div key={item.label} data-smoke="catan-victory-track-item" className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black opacity-60">{item.label}</div>
                    <div className="mt-0.5 text-sm font-black leading-snug">{item.value}</div>
                  </div>
                </div>
                <div className="mt-1 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CatanActionAtlasArt = ({ activeKey = "build", items = [] }) => {
  const profiles = {
    build: { x: 74, label: "건설", color: "#059669", wash: "#d1fae5" },
    target: { x: 190, label: "대상", color: "#0284c7", wash: "#e0f2fe" },
    trade: { x: 306, label: "교환", color: "#d97706", wash: "#fef3c7" },
  };
  const activeProfile = profiles[activeKey] || profiles.build;
  const activeIndex = Math.max(0, ["build", "target", "trade"].indexOf(activeKey));
  const progressWidth = 116 * activeIndex;

  return (
    <svg
      data-smoke="catan-action-atlas-art"
      viewBox="0 0 380 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 액션 아틀라스 ${activeProfile.label}`}
      focusable="false"
    >
      <rect x="10" y="10" width="360" height="190" rx="28" fill="#f8fafc" stroke="#bbf7d0" strokeWidth="3" />
      <path d="M38 152c46-31 86-39 120-22 40 20 77 18 112-6 31-21 55-12 78 26v40H38Z" fill={activeProfile.wash} opacity="0.72" />
      <path d="M74 102h232" fill="none" stroke="#d1d5db" strokeWidth="10" strokeLinecap="round" />
      <path d={`M74 102h${progressWidth}`} fill="none" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
      {Object.entries(profiles).map(([key, profile]) => {
        const active = key === activeKey;
        return (
          <g key={key} data-smoke="catan-action-atlas-node">
            <circle cx={profile.x} cy="102" r={active ? 34 : 27} fill={active ? profile.color : "#ffffff"} stroke={active ? "#0f172a" : "#cbd5e1"} strokeWidth={active ? 5 : 3} />
            {key === "build" && (
              <g>
                <path d={`M${profile.x - 18} 111l18-20 18 20v18h-36Z`} fill={active ? "#ffffff" : profile.wash} stroke={active ? "#ffffff" : profile.color} strokeWidth="2" />
                <path d={`M${profile.x - 10} 129v-14h20v14`} fill="none" stroke={active ? profile.color : "#064e3b"} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {key === "target" && (
              <g>
                <circle cx={profile.x} cy="102" r="14" fill={active ? "#ffffff" : profile.wash} stroke={active ? "#ffffff" : profile.color} strokeWidth="3" />
                <path d={`M${profile.x - 22} 102h44M${profile.x} 80v44`} stroke={active ? profile.color : "#075985"} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {key === "trade" && (
              <g>
                <path d={`M${profile.x - 20} 95h36l-8-8M${profile.x + 20} 112h-36l8 8`} fill="none" stroke={active ? "#ffffff" : profile.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={profile.x - 21} cy="115" r="5" fill={active ? "#ffffff" : profile.wash} />
                <circle cx={profile.x + 21} cy="92" r="5" fill={active ? "#ffffff" : profile.wash} />
              </g>
            )}
            <text x={profile.x} y="60" textAnchor="middle" fontSize="13" fontWeight="900" fill={active ? "#0f172a" : "#64748b"}>{profile.label}</text>
          </g>
        );
      })}
      <rect x="44" y="24" width="116" height="28" rx="14" fill="#ffffff" stroke="#bbf7d0" />
      <text x="102" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#047857">{activeProfile.label} 판단</text>
      <rect x="206" y="24" width="110" height="28" rx="14" fill="#ffffff" stroke="#dbeafe" />
      <text x="261" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1e3a8a">근거 {items.length}개</text>
      <rect x="60" y="166" width="260" height="24" rx="12" fill="#ffffff" stroke="#e2e8f0" />
      <text x="190" y="182" textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">선택값과 버튼 잠금 이유를 먼저 확인</text>
    </svg>
  );
};

const CatanActionAtlasPanel = ({ title = "", detail = "", activeKey = "build", items = [] }) => (
  <section data-smoke="catan-action-atlas-panel" className="mb-3 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem]">
    <div className="grid gap-3">
      <CatanActionAtlasArt activeKey={activeKey} items={items} />
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-emerald-600">액션 아틀라스</div>
            <div className="mt-1 text-base font-black text-slate-950">{title}</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{detail}</div>
          </div>
          <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[11px] font-black text-emerald-700">
            {items.filter((item) => item.ready).length}/{items.length} 준비
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.key} data-smoke="catan-action-atlas-item" className={`rounded-xl border px-3 py-2 ${item.ready ? "border-emerald-100 bg-white" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                  <div className="mt-0.5 text-sm font-black leading-snug text-slate-900">{item.value}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {item.ready ? "준비" : "잠금"}
                </span>
              </div>
              <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const buildCatanActionRouteItems = ({
  phase = "SETUP",
  phaseLabel = "",
  myTurn = false,
  activeName = "",
  lastRoll = null,
  mustDiscard = false,
  discardTotal = 0,
  discardRequired = 0,
  myGoldChoice = null,
  goldRequired = 0,
  myAqueductChoice = null,
  catanBuildTargetReady = false,
  catanRobberTargetReady = false,
  hasSelectedTarget = false,
  buildMode = "",
  catanBuildTargetKind = "",
  selectedBuildActionDisabled = false,
  canMaritimeTrade = false,
  canBuyDevelopmentCard = false,
  actionProgressCount = 0,
  pendingDomesticTrade = false,
  catanTradeSummary = "",
  catanTurnGuidance = "",
  winnerSeatNo = 0,
  winnerVictoryPoints = 0,
  winningPoints = 10,
}) => {
  const normalizedPhase = String(phase || "SETUP");
  const activePlayerLabel = activeName || "상대";
  const specialTurnReady = Boolean(mustDiscard || myGoldChoice || myAqueductChoice);
  const actionSupportReady = Boolean(canMaritimeTrade || canBuyDevelopmentCard || actionProgressCount > 0 || pendingDomesticTrade);
  const targetReady = normalizedPhase === "ROBBER" ? catanRobberTargetReady : catanBuildTargetReady || hasSelectedTarget;
  const mainReady = (() => {
    if (normalizedPhase === "FINISHED") return Boolean(winnerSeatNo);
    if (normalizedPhase === "ROLL") return myTurn;
    if (normalizedPhase === "DISCARD") return mustDiscard && Number(discardRequired) > 0 && Number(discardTotal) === Number(discardRequired);
    if (normalizedPhase === "GOLD_CHOICE") return Boolean(myGoldChoice);
    if (normalizedPhase === "AQUEDUCT_CHOICE") return Boolean(myAqueductChoice);
    if (normalizedPhase === "ROBBER") return myTurn && catanRobberTargetReady;
    if (normalizedPhase === "SETUP") return myTurn && catanBuildTargetReady;
    if (normalizedPhase === "ACTION") return myTurn && (actionSupportReady || (catanBuildTargetReady && !selectedBuildActionDisabled));
    return myTurn || specialTurnReady;
  })();

  const stateValue = (() => {
    if (normalizedPhase === "FINISHED") return winnerSeatNo ? `승자 확정 ${winnerVictoryPoints}/${winningPoints}점` : "결과 확정";
    if (normalizedPhase === "ROLL") return lastRoll ? `최근 주사위 ${lastRoll}` : "주사위 대기";
    if (normalizedPhase === "DISCARD") return mustDiscard ? `${discardTotal}/${discardRequired}장 버리기` : "버리기 대기";
    if (normalizedPhase === "GOLD_CHOICE") return myGoldChoice ? `${goldRequired}장 선택` : "금광 보상 대기";
    if (normalizedPhase === "AQUEDUCT_CHOICE") return myAqueductChoice ? "수로 보상 선택" : "수로 보상 대기";
    if (normalizedPhase === "ROBBER") return "도적/해적 이동";
    if (normalizedPhase === "ACTION") return myTurn ? "내 행동 단계" : `${activePlayerLabel} 행동`;
    if (normalizedPhase === "SETUP") return "초기 배치";
    return phaseLabel || normalizedPhase;
  })();

  const targetValue = (() => {
    if (normalizedPhase === "FINISHED") return "결과 확인";
    if (normalizedPhase === "DISCARD") return mustDiscard ? "버릴 카드 수 입력" : "다른 플레이어 대기";
    if (normalizedPhase === "GOLD_CHOICE") return myGoldChoice ? "받을 자원 입력" : "선택 순서 대기";
    if (normalizedPhase === "AQUEDUCT_CHOICE") return myAqueductChoice ? "수로 자원 선택" : "선택 순서 대기";
    if (normalizedPhase === "ROBBER") return catanRobberTargetReady ? "대상 타일 선택 완료" : "타일 선택 필요";
    if (normalizedPhase === "SETUP") return catanBuildTargetReady ? "정점+간선 선택 완료" : "정점과 간선 선택";
    if (normalizedPhase === "ACTION") {
      if (catanBuildTargetReady) return `${catanBuildTargetKind || "대상"} 선택 완료`;
      if (hasSelectedTarget) return "선택값 확인";
      return `${catanBuildTargetKind || catanBuildModeLabels[buildMode] || "건설 대상"} 선택`;
    }
    return hasSelectedTarget ? "선택 완료" : "선택 대기";
  })();

  const mainValue = (() => {
    if (normalizedPhase === "FINISHED") return "승리 근거 검토";
    if (normalizedPhase === "ROLL") return "주사위 굴리기";
    if (normalizedPhase === "DISCARD") return mustDiscard ? "버리기 제출" : "대기";
    if (normalizedPhase === "GOLD_CHOICE") return "자원 받기";
    if (normalizedPhase === "AQUEDUCT_CHOICE") return "자원 받기";
    if (normalizedPhase === "ROBBER") return catanRobberTargetReady ? "이동 실행" : "대상 필요";
    if (normalizedPhase === "SETUP") return catanBuildTargetReady ? "초기 배치 실행" : "배치 대상 필요";
    if (normalizedPhase === "ACTION") {
      if (pendingDomesticTrade) return "거래 응답";
      if (catanBuildTargetReady) return selectedBuildActionDisabled ? "조건 확인" : `${catanBuildModeLabels[buildMode] || "건설"} 실행`;
      if (canMaritimeTrade) return "해상 교환";
      if (canBuyDevelopmentCard) return "개발 카드 구매";
      if (actionProgressCount > 0) return `진행 카드 ${actionProgressCount}장`;
      if (selectedBuildActionDisabled) return "조건 확인";
      return "건설/교환 선택";
    }
    return phaseLabel || "단계 처리";
  })();

  const finishValue = (() => {
    if (normalizedPhase === "FINISHED") return "게임 종료";
    if (normalizedPhase === "ACTION") {
      if (pendingDomesticTrade) return "거래 처리 후 종료";
      return myTurn ? "행동 후 종료" : "상대 턴 대기";
    }
    if (normalizedPhase === "ROLL") return "행동 단계로 이동";
    if (normalizedPhase === "SETUP") return "다음 배치 순서";
    if (["DISCARD", "GOLD_CHOICE", "AQUEDUCT_CHOICE", "ROBBER"].includes(normalizedPhase)) return "처리 후 계속";
    return "다음 단계";
  })();

  return [
    {
      key: "state",
      label: "상태 확인",
      value: stateValue,
      ready: myTurn || specialTurnReady || normalizedPhase === "FINISHED",
      detail: catanTurnGuidance || "현재 단계와 차례 권한을 확인한 뒤 다음 버튼으로 이동합니다.",
    },
    {
      key: "target",
      label: "보드 대상",
      value: targetValue,
      ready: targetReady || ["DISCARD", "GOLD_CHOICE", "AQUEDUCT_CHOICE", "FINISHED"].includes(normalizedPhase),
      detail: normalizedPhase === "ROBBER"
        ? "선택한 타일과 약탈 후보가 도적/해적 이동 버튼의 근거가 됩니다."
        : "보드 클릭이나 입력값이 실제 실행 버튼의 근거가 됩니다.",
    },
    {
      key: "main",
      label: "실행 버튼",
      value: mainValue,
      ready: mainReady,
      detail: normalizedPhase === "ACTION"
        ? "건설, 교환, 카드 버튼은 기존 조건을 그대로 읽어 가능한 행동만 강조합니다."
        : "필요한 선택값이 채워지면 현재 단계의 제출 버튼으로 이어집니다.",
    },
    {
      key: "finish",
      label: "턴 종료",
      value: finishValue,
      ready: normalizedPhase === "FINISHED" || (normalizedPhase === "ACTION" && myTurn),
      detail: normalizedPhase === "ACTION"
        ? (actionSupportReady ? `${catanTradeSummary || "교환/카드 선택"}도 확인한 뒤 턴 종료로 넘깁니다.` : "할 일을 마치면 턴 종료 버튼으로 다음 차례를 넘깁니다.")
        : "현재 특수 처리가 끝나면 서버의 다음 단계 흐름을 그대로 따릅니다.",
    },
  ];
};

const CatanActionRouteArt = ({ items = [] }) => {
  const routeItems = items.length ? items : [
    { key: "state", label: "상태", ready: false },
    { key: "target", label: "대상", ready: false },
    { key: "main", label: "실행", ready: false },
    { key: "finish", label: "종료", ready: false },
  ];
  const activeIndex = Math.max(0, routeItems.findIndex((item) => !item.ready));
  const nodes = routeItems.map((item, index) => ({
    ...item,
    x: 54 + index * 92,
    active: index === activeIndex,
  }));

  return (
    <svg data-smoke="catan-action-route-art" viewBox="0 0 380 170" role="img" aria-label="카탄 액션 루트" className="h-auto w-full">
      <rect x="8" y="10" width="364" height="150" rx="18" fill="#f8fafc" stroke="#bae6fd" strokeWidth="2" />
      <path d="M48 112C92 58 132 58 168 112S248 164 324 74" fill="none" stroke="#7dd3fc" strokeWidth="9" strokeLinecap="round" />
      <path d="M48 112C92 58 132 58 168 112S248 164 324 74" fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
      {nodes.map((item, index) => (
        <g key={item.key} data-smoke="catan-action-route-node" data-route-key={item.key}>
          {index < nodes.length - 1 && (
            <path d={`M${item.x + 32} 82H${nodes[index + 1].x - 32}`} stroke={item.ready ? "#0f766e" : "#cbd5e1"} strokeWidth="4" strokeLinecap="round" />
          )}
          <rect x={item.x - 34} y={item.active ? 48 : 54} width="68" height="58" rx="14" fill={item.ready ? "#ccfbf1" : "#ffffff"} stroke={item.active ? "#0f766e" : item.ready ? "#14b8a6" : "#cbd5e1"} strokeWidth={item.active ? "3" : "2"} />
          <circle cx={item.x} cy={item.active ? 66 : 72} r="13" fill={item.ready ? "#0f766e" : "#e2e8f0"} />
          <text x={item.x} y={item.active ? 70 : 76} textAnchor="middle" fontSize="12" fontWeight="900" fill={item.ready ? "#ffffff" : "#475569"}>{index + 1}</text>
          <text x={item.x} y={item.active ? 98 : 104} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{item.label}</text>
        </g>
      ))}
      <rect x="28" y="20" width="124" height="26" rx="13" fill="#ffffff" stroke="#bae6fd" />
      <text x="90" y="37" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0369a1">카탄 액션 루트</text>
      <rect x="208" y="130" width="126" height="24" rx="12" fill="#ffffff" stroke="#99f6e4" />
      <text x="271" y="146" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f766e">버튼 조건은 그대로 유지</text>
    </svg>
  );
};

const CatanActionRoutePanel = ({
  phase = "SETUP",
  myTurn = false,
  buildMode = "",
  targetReady = false,
  canMaritimeTrade = false,
  canBuyDevelopmentCard = false,
  actionProgressCount = 0,
  items = [],
}) => (
  <section
    data-smoke="catan-action-route-panel"
    data-phase={phase}
    data-my-turn={myTurn ? "true" : "false"}
    data-build-mode={buildMode || "none"}
    data-target-ready={targetReady ? "true" : "false"}
    data-can-trade={canMaritimeTrade ? "true" : "false"}
    data-can-development={canBuyDevelopmentCard ? "true" : "false"}
    data-action-count={String(actionProgressCount)}
    className="mb-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-3 shadow-sm sm:rounded-[1.5rem]"
  >
    <div className="grid gap-3">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-sky-700">카탄 액션 루트</div>
            <div className="mt-1 text-base font-black text-slate-950">상태 확인 → 보드 대상 → 실행 버튼 → 턴 종료</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">현재 단계에서 실제 버튼까지 이어지는 순서만 보여주는 읽기 전용 안내입니다.</div>
          </div>
          <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-[11px] font-black text-sky-700">
            {items.filter((item) => item.ready).length}/{items.length} 준비
          </span>
        </div>
        <div data-smoke="catan-action-route-art" className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
          {items.map((item) => (
            <span key={`route-chip-${item.key}`} data-smoke="catan-action-route-node" data-route-key={item.key} className={`rounded-full px-2.5 py-1 ${item.ready ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
              {item.label}: {item.value}
            </span>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.key} data-smoke="catan-action-route-item" data-route-key={item.key} className={`rounded-xl border px-3 py-2 ${item.ready ? "border-teal-100 bg-white" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                  <div className="mt-0.5 text-sm font-black leading-snug text-slate-900">{item.value}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-600"}`}>
                  {item.ready ? "준비" : "확인"}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const catanDiscardPlannerTone = (status = "waiting") => {
  if (status === "ready") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (status === "over") return "border-rose-100 bg-rose-50 text-rose-800";
  if (status === "under") return "border-orange-100 bg-orange-50 text-orange-800";
  return "border-slate-100 bg-slate-50 text-slate-600";
};

const buildCatanDiscardPlannerItems = ({
  mustDiscard = false,
  discardRequired = 0,
  discardTotal = 0,
  resourceRows = [],
  commodityRows = [],
  pendingNames = [],
  explorersPiratesRule = false,
  robberLocked = false,
} = {}) => {
  const required = Math.max(0, Number(discardRequired) || 0);
  const total = Math.max(0, Number(discardTotal) || 0);
  const remaining = Math.max(0, required - total);
  const over = Math.max(0, total - required);
  const selectedRows = [...resourceRows, ...commodityRows].filter((row) => Number(row.selected || 0) > 0);
  const selectionText = selectedRows.length
    ? selectedRows.map((row) => `${row.label} ${row.selected}`).join(" · ")
    : "아직 선택 없음";
  const waitText = pendingNames.length ? pendingNames.join(" · ") : "대기 없음";
  const status = !mustDiscard ? "waiting" : total === required ? "ready" : total > required ? "over" : "under";
  const nextValue = explorersPiratesRule ? "해적 이동" : robberLocked ? "도적 잠금 유지" : "도둑 이동";

  return [
    {
      key: "requirement",
      label: "필요 장수",
      value: mustDiscard ? `${required}장 정확히` : "내 차례 아님",
      detail: mustDiscard ? "보유 카드 절반을 정확히 선택해야 다음 단계로 넘어갑니다." : `${waitText} 플레이어의 선택을 기다립니다.`,
      status: mustDiscard ? "under" : "waiting",
    },
    {
      key: "selection",
      label: "선택한 카드",
      value: `${total}/${required}장`,
      detail: status === "ready"
        ? "필요 장수와 일치합니다. 제출 버튼으로 확정할 수 있습니다."
        : status === "over"
          ? `${over}장 초과 선택했습니다. 숫자를 줄여야 합니다.`
          : mustDiscard
            ? `${remaining}장을 더 골라야 합니다.`
            : "현재 내가 버릴 대상이 아닙니다.",
      status,
    },
    {
      key: "composition",
      label: "선택 구성",
      value: selectionText,
      detail: selectedRows.length ? "입력칸에서 고른 자원/상품 구성을 그대로 요약합니다." : "아래 입력칸에서 버릴 자원을 고르면 여기에 바로 요약됩니다.",
      status: selectedRows.length ? "ready" : "waiting",
    },
    {
      key: "next",
      label: "다음 처리",
      value: nextValue,
      detail: "모든 대상자가 정확히 버리면 서버가 7 처리의 다음 단계를 진행합니다.",
      status: status === "ready" ? "ready" : "waiting",
    },
  ];
};

const CatanDiscardPlannerArt = ({ items = [], discardTotal = 0, discardRequired = 0, mustDiscard = false }) => {
  const required = Math.max(0, Number(discardRequired) || 0);
  const total = Math.max(0, Number(discardTotal) || 0);
  const safeRequired = Math.max(1, required);
  const progress = Math.max(0, Math.min(1.15, total / safeRequired));
  const ready = mustDiscard && required > 0 && total === required;
  const over = mustDiscard && total > required;
  const accent = ready ? "#059669" : over ? "#e11d48" : mustDiscard ? "#d97706" : "#64748b";
  const nodes = [
    { key: "requirement", x: 74, y: 126 },
    { key: "selection", x: 206, y: 76 },
    { key: "composition", x: 346, y: 126 },
    { key: "next", x: 486, y: 76 },
  ];

  return (
    <svg
      data-smoke="catan-discard-planner-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 버리기 ${total}/${required}장 선택`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#fff7ed" stroke={accent} strokeWidth="3" />
      <path d="M74 126C132 50 206 46 278 102c76 59 141 55 208-26" fill="none" stroke="#fed7aa" strokeWidth="18" strokeLinecap="round" />
      <path d="M74 126C132 50 206 46 278 102c76 59 141 55 208-26" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#7c2d12">7 처리 · 버리기 플래너</text>
      <rect x="32" y="160" width="496" height="18" rx="9" fill="#ffedd5" stroke="#fdba74" strokeWidth="2" />
      <rect x="32" y="160" width={Math.min(496, 496 * progress)} height="18" rx="9" fill={accent} opacity=".86" />
      <text x="280" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill={ready || over ? "#ffffff" : "#7c2d12"}>{total}/{required}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#dcfce7" : item.status === "over" ? "#ffe4e6" : item.status === "under" ? "#fef3c7" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "over" ? "#e11d48" : item.status === "under" ? "#d97706" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-discard-planner-node" data-discard-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#431407">{item.label || node.key}</text>
          </g>
        );
      })}
    </svg>
  );
};

const CatanDiscardPlannerPanel = ({
  resources = {},
  commodities = {},
  discardForm = {},
  discardCommodityForm = {},
  discardRequired = 0,
  discardTotal = 0,
  mustDiscard = false,
  pendingNames = [],
  citiesKnightsRule = false,
  explorersPiratesRule = false,
  robberLocked = false,
}) => {
  const resourceRows = catanResourceEntries.map(([key, label]) => ({
    key,
    label,
    owned: Math.max(0, Number(resources?.[key] || 0)),
    selected: Math.max(0, Number(discardForm?.[key] || 0)),
  }));
  const commodityRows = citiesKnightsRule
    ? Object.entries(catanCommodityLabels).map(([key, label]) => ({
      key,
      label,
      owned: Math.max(0, Number(commodities?.[key] || 0)),
      selected: Math.max(0, Number(discardCommodityForm?.[key] || 0)),
    }))
    : [];
  const items = buildCatanDiscardPlannerItems({
    mustDiscard,
    discardRequired,
    discardTotal,
    resourceRows,
    commodityRows,
    pendingNames,
    explorersPiratesRule,
    robberLocked,
  });
  const selectedRows = [...resourceRows, ...commodityRows].filter((row) => row.selected > 0);

  return (
    <section
      data-smoke="catan-discard-planner-panel"
      data-must-discard={mustDiscard ? "true" : "false"}
      data-discard-required={Math.max(0, Number(discardRequired) || 0)}
      data-discard-total={Math.max(0, Number(discardTotal) || 0)}
      data-pending-count={pendingNames.length}
      className="rounded-2xl border border-orange-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanDiscardPlannerArt
          items={items}
          discardTotal={discardTotal}
          discardRequired={discardRequired}
          mustDiscard={mustDiscard}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-orange-700">버리기 플래너</div>
              <div className="mt-1 text-lg font-black text-slate-950">정확히 몇 장을 버려야 하는지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                아래 숫자 입력으로 선택한 자원과 상품을 읽어, 제출 전에 부족/초과 상태를 한 번 더 보여줍니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${mustDiscard ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-600"}`}>
              {mustDiscard ? "내가 버릴 차례" : "다른 플레이어 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-discard-planner-item"
                data-discard-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanDiscardPlannerTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(selectedRows.length ? selectedRows : resourceRows.slice(0, 5)).map((row) => (
              <span
                key={row.key}
                data-smoke="catan-discard-planner-chip"
                data-discard-key={row.key}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.selected ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}
              >
                {row.label} {row.selected}/{row.owned}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanResourceByTerrain = {
  HILL: "BRICK",
  FOREST: "LUMBER",
  PASTURE: "WOOL",
  FIELD: "GRAIN",
  MOUNTAIN: "ORE",
};

const catanCommodityLabels = {
  PAPER: "종이",
  CLOTH: "직물",
  COIN: "동전",
};

const catanCargoLabels = {
  SETTLER: "정착민",
  FISH: "물고기",
  SPICE: "향신료",
  CREW: "승무원",
  OLD_BOOT: "낡은 장화",
};

const cargoTypesOf = (carrier) => {
  const cargoTypes = get(carrier, "cargo_types", "cargoTypes", []);
  if (Array.isArray(cargoTypes) && cargoTypes.length) return cargoTypes;
  const cargoType = get(carrier, "cargo_type", "cargoType", "");
  return cargoType ? [cargoType] : [];
};
const cargoLabelOf = (carrier) => {
  const cargoTypes = cargoTypesOf(carrier);
  return cargoTypes.length ? cargoTypes.map((cargoType) => catanCargoLabels[cargoType] || cargoType).join(" · ") : "없음";
};

const catanCargoMarks = {
  SETTLER: { fill: "#f59e0b", stroke: "#78350f", label: "정" },
  FISH: { fill: "#e0f2fe", stroke: "#0369a1", label: "어" },
  SPICE: { fill: "#fef3c7", stroke: "#92400e", label: "향" },
  CREW: { fill: "#ede9fe", stroke: "#6d28d9", label: "승" },
};

const cargoMarkOf = (cargoType) => catanCargoMarks[cargoType] || { fill: "#e2e8f0", stroke: "#334155", label: "?" };

const catanMissionLabels = {
  FISH: "어장",
  SPICE: "향신료 마을",
  PIRATE_LAIR: "해적 소굴",
};

const catanSpiceAdvantageLabels = {
  SWIFT_VOYAGE: "빠른 항해",
  PIRATE_BONUS: "해적 보너스",
  FAST_GOLD: "빠른 금",
  SUCCESS: "성공",
  MISS: "실패",
};

const catanSpiceAdvantageShortLabels = {
  SWIFT_VOYAGE: "항해",
  PIRATE_BONUS: "해적",
  FAST_GOLD: "금",
};

const catanImprovementLabels = {
  SCIENCE: "과학",
  TRADE: "상업",
  POLITICS: "정치",
};

const catanDevelopmentLabels = {
  ANY: "3:1 항구",
  DEVELOPMENT_CARD: "개발 카드",
  KNIGHT: "기사",
  VICTORY_POINT: "승점",
  ROAD_BUILDING: "도로 건설",
  YEAR_OF_PLENTY: "풍년",
  MONOPOLY: "독점",
};

const catanBuildingLabels = {
  SETTLEMENT: "마을",
  CITY: "도시",
  HARBOR_SETTLEMENT: "항구 정착지",
};

const catanRouteLabels = {
  ROAD: "도로",
  SHIP: "배",
  BRIDGE: "다리",
};

const catanBuildModeLabels = {
  ROAD: "도로",
  BRIDGE: "다리",
  SHIP: "배",
  MOVE_SHIP: "배 이동",
  KNIGHT: "기사",
  CITY_WALL: "성벽",
  SETTLEMENT: "마을",
  CITY: "도시",
  HARBOR_SETTLEMENT: "항구 정착지",
};

const catanProgressLabels = {
  ALCHEMIST: "연금술사",
  CRANE: "기중기",
  ENGINEER: "기술자",
  INVENTOR: "발명가",
  IRRIGATION: "관개",
  MEDICINE: "의학",
  MINING: "채광",
  PRINTER: "인쇄술",
  ROAD_BUILDING: "도로 건설",
  SMITH: "대장장이",
  COMMERCIAL_HARBOR: "상업 항구",
  MASTER_MERCHANT: "대상인",
  MERCHANT: "상인",
  MERCHANT_FLEET: "상선단",
  RESOURCE_MONOPOLY: "자원 독점",
  TRADE_MONOPOLY: "상품 독점",
  BISHOP: "주교",
  CONSTITUTION: "헌법",
  DESERTER: "탈영병",
  DIPLOMAT: "외교관",
  INTRIGUE: "음모",
  SABOTEUR: "파괴 공작",
  SPY: "첩자",
  WARLORD: "장군",
  WEDDING: "혼례",
};

const catanProgressVictoryTypes = new Set(["PRINTER", "CONSTITUTION"]);

const catanEventDieLabels = {
  BARBARIAN_SHIP: "야만인선",
  SCIENCE: "과학",
  TRADE: "상업",
  POLITICS: "정치",
  FRIENDLY_ROBBER_DESERT: "친절한 도둑 사막 이동",
};

const playableProgressTypes = new Set([
  "ALCHEMIST",
  "CRANE",
  "ENGINEER",
  "INVENTOR",
  "IRRIGATION",
  "MEDICINE",
  "MINING",
  "ROAD_BUILDING",
  "SMITH",
  "WARLORD",
  "RESOURCE_MONOPOLY",
  "TRADE_MONOPOLY",
  "BISHOP",
  "COMMERCIAL_HARBOR",
  "DESERTER",
  "DIPLOMAT",
  "INTRIGUE",
  "MASTER_MERCHANT",
  "MERCHANT",
  "MERCHANT_FLEET",
  "SPY",
  "SABOTEUR",
  "WEDDING",
]);

const catanProgressTimingLabel = (cardType) => {
  if (catanProgressVictoryTypes.has(cardType)) return "자동 승점";
  if (cardType === "ALCHEMIST") return "주사위 전";
  if (playableProgressTypes.has(cardType)) return "행동 단계";
  return "상태 확인";
};

const catanProgressTimingClass = (cardType) => {
  if (catanProgressVictoryTypes.has(cardType)) return "bg-amber-50 text-amber-700";
  if (cardType === "ALCHEMIST") return "bg-emerald-50 text-emerald-700";
  if (playableProgressTypes.has(cardType)) return "bg-white text-slate-700";
  return "bg-slate-100 text-slate-500";
};

const catanProgressDiscardTone = (status = "waiting") => {
  if (status === "ready") return "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-950";
  if (status === "protected") return "border-amber-100 bg-amber-50 text-amber-950";
  if (status === "active") return "border-violet-100 bg-violet-50 text-violet-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const buildCatanProgressDiscardPlannerItems = ({
  nonVictoryCards = [],
  progressCards = [],
  selectedCardId = "",
  discardRequired = 0,
  mustDiscardProgress = false,
  pendingNames = [],
} = {}) => {
  const safeNonVictoryCards = listOf(nonVictoryCards);
  const safeProgressCards = listOf(progressCards);
  const required = Math.max(0, Number(discardRequired) || 0);
  const victoryCards = safeProgressCards.filter((card) => catanProgressVictoryTypes.has(get(card, "type", "type", "")));
  const selectedCard = safeNonVictoryCards.find((card) => String(card.id) === String(selectedCardId)) || safeNonVictoryCards[0] || null;
  const selectedType = get(selectedCard, "type", "type", "");
  const waitText = pendingNames.length ? pendingNames.join(" · ") : "대기 없음";

  return [
    {
      key: "limit",
      label: "보유 한도",
      value: `비승점 ${safeNonVictoryCards.length}/4장`,
      detail: required > 0 ? `${required}장을 버리면 진행 카드 한도 안으로 돌아갑니다.` : "현재 진행 카드 한도 안에 있습니다.",
      status: required > 0 ? "active" : "ready",
    },
    {
      key: "selection",
      label: "버릴 카드",
      value: selectedCard ? (catanProgressLabels[selectedType] || selectedType || "선택 카드") : "선택 필요",
      detail: mustDiscardProgress ? "아래 선택 상자의 카드가 그대로 제출됩니다." : `${waitText} 플레이어의 선택을 기다립니다.`,
      status: mustDiscardProgress && selectedCard ? "ready" : "waiting",
    },
    {
      key: "excluded",
      label: "제외 카드",
      value: `자동 승점 ${victoryCards.length}장`,
      detail: "인쇄술과 헌법 같은 승점 진행 카드는 버리기 후보에서 제외됩니다.",
      status: victoryCards.length ? "protected" : "waiting",
    },
    {
      key: "next",
      label: "다음 처리",
      value: mustDiscardProgress ? "카드 제출" : "대기",
      detail: "대상자가 초과 카드를 버리면 서버가 다음 카탄 단계로 진행합니다.",
      status: mustDiscardProgress ? "active" : "waiting",
    },
  ];
};

const CatanProgressDiscardPlannerArt = ({ items = [], selectedCardId = "", discardRequired = 0, nonVictoryCount = 0, mustDiscardProgress = false }) => {
  const required = Math.max(0, Number(discardRequired) || 0);
  const accent = mustDiscardProgress ? "#a21caf" : "#64748b";
  const progress = Math.max(0.08, Math.min(1, Number(nonVictoryCount || 0) / Math.max(4, Number(nonVictoryCount || 0))));
  const nodes = [
    { key: "limit", x: 72, y: 124 },
    { key: "selection", x: 204, y: 72 },
    { key: "excluded", x: 344, y: 124 },
    { key: "next", x: 486, y: 72 },
  ];

  return (
    <svg
      data-smoke="catan-progress-discard-planner-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 진행 카드 버리기 ${required}장`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#fdf4ff" stroke={accent} strokeWidth="3" />
      <path d="M70 124C139 42 214 45 282 104c73 64 143 58 204-32" fill="none" stroke="#f5d0fe" strokeWidth="18" strokeLinecap="round" />
      <path d="M70 124C139 42 214 45 282 104c73 64 143 58 204-32" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#701a75">진행 카드 한도 정리</text>
      <rect x="32" y="160" width="496" height="18" rx="9" fill="#fae8ff" stroke="#e879f9" strokeWidth="2" />
      <rect x="32" y="160" width={496 * progress} height="18" rx="9" fill={accent} opacity=".82" />
      <text x="280" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">비승점 {nonVictoryCount}장 · 버리기 {required}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#f0fdf4" : item.status === "protected" ? "#fef3c7" : item.status === "active" ? "#fae8ff" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "protected" ? "#d97706" : item.status === "active" ? "#a21caf" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-progress-discard-planner-node" data-progress-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#581c87">{item.label || node.key}</text>
          </g>
        );
      })}
      {selectedCardId && (
        <text x="528" y="42" textAnchor="end" fontSize="10" fontWeight="900" fill="#86198f">선택 {selectedCardId}</text>
      )}
    </svg>
  );
};

const CatanProgressDiscardPlannerPanel = ({
  progressCards = [],
  nonVictoryCards = [],
  selectedCardId = "",
  discardRequired = 0,
  mustDiscardProgress = false,
  pendingNames = [],
}) => {
  const safeNonVictoryCards = listOf(nonVictoryCards);
  const items = buildCatanProgressDiscardPlannerItems({
    nonVictoryCards: safeNonVictoryCards,
    progressCards,
    selectedCardId,
    discardRequired,
    mustDiscardProgress,
    pendingNames,
  });

  return (
    <section
      data-smoke="catan-progress-discard-planner-panel"
      data-must-discard-progress={mustDiscardProgress ? "true" : "false"}
      data-progress-discard-required={Math.max(0, Number(discardRequired) || 0)}
      data-non-victory-count={safeNonVictoryCards.length}
      data-selected-card-id={selectedCardId || ""}
      className="rounded-2xl border border-fuchsia-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanProgressDiscardPlannerArt
          items={items}
          selectedCardId={selectedCardId}
          discardRequired={discardRequired}
          nonVictoryCount={safeNonVictoryCards.length}
          mustDiscardProgress={mustDiscardProgress}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-fuchsia-700">진행 카드 버리기 플래너</div>
              <div className="mt-1 text-lg font-black text-slate-950">4장 한도 안으로 정리</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                승점 진행 카드는 제외하고, 실제 버릴 후보와 선택된 카드를 제출 전에 다시 보여줍니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${mustDiscardProgress ? "bg-fuchsia-100 text-fuchsia-800" : "bg-slate-100 text-slate-600"}`}>
              {mustDiscardProgress ? "내가 버릴 차례" : "다른 플레이어 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-progress-discard-planner-item"
                data-progress-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanProgressDiscardTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {safeNonVictoryCards.slice(0, 8).map((card) => {
              const cardType = get(card, "type", "type", "");
              const selected = String(card.id) === String(selectedCardId);
              return (
                <span
                  key={card.id}
                  data-smoke="catan-progress-discard-planner-chip"
                  data-card-id={card.id}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${selected ? "bg-fuchsia-100 text-fuchsia-800" : "bg-slate-100 text-slate-500"}`}
                >
                  {catanProgressLabels[cardType] || cardType}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanDomesticTradeReviewTone = (status = "waiting") => {
  if (status === "ready") return "border-emerald-100 bg-emerald-50 text-emerald-950";
  if (status === "warning") return "border-amber-100 bg-amber-50 text-amber-950";
  if (status === "mine") return "border-sky-100 bg-sky-50 text-sky-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const catanTradeBundleRows = (values = {}) => catanResourceKeys
  .map((key) => ({
    key,
    label: catanResourceLabels[key] || key,
    count: Math.max(0, Number(values?.[key] || 0)),
  }))
  .filter((row) => row.count > 0);

const catanTradeBundleText = (values = {}) => {
  const rows = catanTradeBundleRows(values);
  return rows.length ? rows.map((row) => `${row.label} ${row.count}`).join(" · ") : "없음";
};

const buildCatanDomesticTradeReviewItems = ({
  offer = {},
  request = {},
  proposerName = "",
  targetName = "",
  proposerSeatNo = 0,
  targetSeatNo = 0,
  mySeatNo = 0,
  resources = {},
} = {}) => {
  const offerRows = catanTradeBundleRows(offer);
  const requestRows = catanTradeBundleRows(request);
  const offerTotal = offerRows.reduce((sum, row) => sum + row.count, 0);
  const requestTotal = requestRows.reduce((sum, row) => sum + row.count, 0);
  const isTarget = Number(targetSeatNo) === Number(mySeatNo);
  const isProposer = Number(proposerSeatNo) === Number(mySeatNo);
  const canPayRequest = requestRows.every((row) => Number(resources?.[row.key] || 0) >= row.count);
  const roleValue = isTarget ? "응답자" : isProposer ? "제안자" : "관전";
  const decisionValue = isTarget ? "수락 또는 거절" : isProposer ? "제안 취소 가능" : "결과 대기";

  return [
    {
      key: "route",
      label: "거래 주체",
      value: `${proposerName || "제안자"} → ${targetName || "응답자"}`,
      detail: `내 위치: ${roleValue}`,
      status: isTarget ? "ready" : isProposer ? "mine" : "waiting",
    },
    {
      key: "offer",
      label: "상대가 주는 것",
      value: catanTradeBundleText(offer),
      detail: `제공 묶음 ${offerTotal}장`,
      status: offerTotal > 0 ? "ready" : "waiting",
    },
    {
      key: "request",
      label: isTarget ? "내가 주는 것" : "요청 묶음",
      value: catanTradeBundleText(request),
      detail: isTarget
        ? canPayRequest ? "보유 자원으로 수락할 수 있는 요청입니다." : "요청 자원이 부족하면 수락이 실패할 수 있습니다."
        : `요청 묶음 ${requestTotal}장`,
      status: isTarget && !canPayRequest ? "warning" : requestTotal > 0 ? "ready" : "waiting",
    },
    {
      key: "decision",
      label: "응답 선택",
      value: decisionValue,
      detail: isTarget ? "수락하면 제공/요청 묶음이 서버에서 교환됩니다." : isProposer ? "상대 응답 전까지 제안을 취소할 수 있습니다." : "해당 플레이어의 응답을 기다립니다.",
      status: isTarget ? "ready" : isProposer ? "mine" : "waiting",
    },
  ];
};

const CatanDomesticTradeReviewArt = ({ items = [], offer = {}, request = {}, myRole = "waiting" }) => {
  const offerTotal = catanTradeBundleRows(offer).reduce((sum, row) => sum + row.count, 0);
  const requestTotal = catanTradeBundleRows(request).reduce((sum, row) => sum + row.count, 0);
  const accent = myRole === "target" ? "#059669" : myRole === "proposer" ? "#0284c7" : "#64748b";
  const nodes = [
    { key: "route", x: 74, y: 122 },
    { key: "offer", x: 206, y: 74 },
    { key: "request", x: 346, y: 122 },
    { key: "decision", x: 486, y: 74 },
  ];

  return (
    <svg
      data-smoke="catan-domestic-trade-review-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 거래 제안 제공 ${offerTotal}장 요청 ${requestTotal}장`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#ecfdf5" stroke={accent} strokeWidth="3" />
      <path d="M72 122C124 58 184 44 252 86c76 47 135 54 226-22" fill="none" stroke="#bbf7d0" strokeWidth="18" strokeLinecap="round" />
      <path d="M72 122C124 58 184 44 252 86c76 47 135 54 226-22" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#064e3b">거래 제안 해석</text>
      <rect x="54" y="160" width="210" height="18" rx="9" fill="#d1fae5" stroke="#34d399" strokeWidth="2" />
      <rect x="318" y="160" width="176" height="18" rx="9" fill="#dbeafe" stroke="#38bdf8" strokeWidth="2" />
      <text x="159" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill="#065f46">제공 {offerTotal}장</text>
      <text x="406" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill="#075985">요청 {requestTotal}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#dcfce7" : item.status === "warning" ? "#fef3c7" : item.status === "mine" ? "#e0f2fe" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "warning" ? "#d97706" : item.status === "mine" ? "#0284c7" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-domestic-trade-review-node" data-trade-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#064e3b">{item.label || node.key}</text>
          </g>
        );
      })}
    </svg>
  );
};

const CatanDomesticTradeReviewPanel = ({
  offer = {},
  request = {},
  proposerName = "",
  targetName = "",
  proposerSeatNo = 0,
  targetSeatNo = 0,
  mySeatNo = 0,
  resources = {},
}) => {
  const myRole = Number(targetSeatNo) === Number(mySeatNo)
    ? "target"
    : Number(proposerSeatNo) === Number(mySeatNo)
      ? "proposer"
      : "waiting";
  const items = buildCatanDomesticTradeReviewItems({
    offer,
    request,
    proposerName,
    targetName,
    proposerSeatNo,
    targetSeatNo,
    mySeatNo,
    resources,
  });

  return (
    <section
      data-smoke="catan-domestic-trade-review-panel"
      data-trade-role={myRole}
      data-offer-total={catanTradeBundleRows(offer).reduce((sum, row) => sum + row.count, 0)}
      data-request-total={catanTradeBundleRows(request).reduce((sum, row) => sum + row.count, 0)}
      className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanDomesticTradeReviewArt items={items} offer={offer} request={request} myRole={myRole} />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-emerald-700">거래 제안 해석</div>
              <div className="mt-1 text-lg font-black text-slate-950">무엇을 주고 무엇을 받는지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                현재 제안의 제공/요청 묶음과 내가 눌러야 할 실제 버튼을 응답 전에 정리합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${myRole === "target" ? "bg-emerald-100 text-emerald-800" : myRole === "proposer" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}`}>
              {myRole === "target" ? "응답 필요" : myRole === "proposer" ? "내 제안" : "응답 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-domestic-trade-review-item"
                data-trade-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanDomesticTradeReviewTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanWeddingResponseTone = (status = "waiting") => {
  if (status === "ready") return "border-emerald-100 bg-emerald-50 text-emerald-950";
  if (status === "over") return "border-amber-100 bg-amber-50 text-amber-950";
  if (status === "active") return "border-pink-100 bg-pink-50 text-pink-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const catanWeddingSelectedRows = (resources = {}, commodities = {}) => [
  ...catanResourceKeys.map((key) => ({
    key,
    label: catanResourceLabels[key] || key,
    count: Math.max(0, Number(resources?.[key] || 0)),
    type: "resource",
  })),
  ...Object.entries(catanCommodityLabels).map(([key, label]) => ({
    key,
    label,
    count: Math.max(0, Number(commodities?.[key] || 0)),
    type: "commodity",
  })),
].filter((row) => row.count > 0);

const catanWeddingBundleRows = ({
  resources = {},
  commodities = {},
  resourceSelection = {},
  commoditySelection = {},
} = {}) => [
  ...catanResourceKeys.map((key) => ({
    key,
    label: catanResourceLabels[key] || key,
    held: Math.max(0, Number(resources?.[key] || 0)),
    selected: Math.max(0, Number(resourceSelection?.[key] || 0)),
    type: "resource",
  })),
  ...Object.entries(catanCommodityLabels).map(([key, label]) => ({
    key,
    label,
    held: Math.max(0, Number(commodities?.[key] || 0)),
    selected: Math.max(0, Number(commoditySelection?.[key] || 0)),
    type: "commodity",
  })),
].filter((row) => row.held > 0 || row.selected > 0);

const catanWeddingBundleText = (resources = {}, commodities = {}) => {
  const rows = catanWeddingSelectedRows(resources, commodities);
  return rows.length ? rows.map((row) => `${row.label} ${row.count}`).join(" · ") : "아직 선택 없음";
};

const buildCatanWeddingResponseItems = ({
  attackerName = "",
  mustRespondWedding = false,
  weddingRequired = 0,
  weddingTotal = 0,
  weddingResources = {},
  weddingCommodities = {},
  resources = {},
  commodities = {},
  pendingNames = [],
} = {}) => {
  const required = Math.max(0, Number(weddingRequired) || 0);
  const total = Math.max(0, Number(weddingTotal) || 0);
  const selectedRows = catanWeddingSelectedRows(weddingResources, weddingCommodities);
  const availableTotal = catanWeddingBundleRows({ resources, commodities }).reduce((sum, row) => sum + row.held, 0);
  const selectionStatus = !mustRespondWedding ? "waiting" : total === required ? "ready" : total > required ? "over" : "active";
  const pendingText = pendingNames.length ? pendingNames.join(" · ") : "대상 없음";

  return [
    {
      key: "trigger",
      label: "혼례 대상",
      value: attackerName ? `${attackerName}의 혼례` : "혼례 응답",
      detail: mustRespondWedding ? "내가 줄 카드 선택 대상입니다." : `응답 대기: ${pendingText}`,
      status: mustRespondWedding ? "active" : "waiting",
    },
    {
      key: "requirement",
      label: "필요 장수",
      value: mustRespondWedding ? `${required}장 정확히` : "다른 플레이어 대기",
      detail: mustRespondWedding ? `보유 ${availableTotal}장 기준으로 제출 장수를 맞춥니다.` : "대상 플레이어의 선택이 끝나면 다음 단계로 진행됩니다.",
      status: mustRespondWedding ? "active" : "waiting",
    },
    {
      key: "selection",
      label: "선택한 카드",
      value: `${total}/${required}장`,
      detail: !mustRespondWedding
        ? "현재는 내가 제출할 차례가 아닙니다."
        : total === required
          ? "제출 버튼을 누르기 전 구성만 마지막으로 확인하면 됩니다."
          : total > required
            ? "필요 장수보다 많이 골랐습니다."
            : "아직 필요한 장수보다 적게 골랐습니다.",
      status: selectionStatus,
    },
    {
      key: "composition",
      label: "선택 구성",
      value: catanWeddingBundleText(weddingResources, weddingCommodities),
      detail: selectedRows.length ? `자원/상품 합계 ${total}장` : "아래 입력에서 줄 자원이나 상품을 고릅니다.",
      status: selectedRows.length ? selectionStatus : "waiting",
    },
  ];
};

const CatanWeddingResponseArt = ({ items = [], weddingRequired = 0, weddingTotal = 0, mustRespondWedding = false }) => {
  const required = Math.max(0, Number(weddingRequired) || 0);
  const total = Math.max(0, Number(weddingTotal) || 0);
  const progress = required > 0 ? Math.min(1, total / required) : 0;
  const accent = !mustRespondWedding ? "#64748b" : total === required ? "#db2777" : total > required ? "#d97706" : "#ec4899";
  const nodes = [
    { key: "trigger", x: 72, y: 122 },
    { key: "requirement", x: 206, y: 74 },
    { key: "selection", x: 346, y: 122 },
    { key: "composition", x: 486, y: 74 },
  ];

  return (
    <svg
      data-smoke="catan-wedding-response-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 혼례 응답 선택 ${total}장 필요 ${required}장`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#fdf2f8" stroke={accent} strokeWidth="3" />
      <path d="M70 122C128 46 190 48 250 92c70 52 140 58 232-24" fill="none" stroke="#fbcfe8" strokeWidth="18" strokeLinecap="round" />
      <path d="M70 122C128 46 190 48 250 92c70 52 140 58 232-24" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#831843">혼례 응답 경로</text>
      <rect x="34" y="160" width="492" height="18" rx="9" fill="#fce7f3" stroke="#f472b6" strokeWidth="2" />
      <rect x="34" y="160" width={492 * progress} height="18" rx="9" fill={accent} opacity=".84" />
      <text x="280" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill={progress > 0.38 ? "#ffffff" : "#831843"}>선택 {total}장 · 필요 {required}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#dcfce7" : item.status === "over" ? "#fef3c7" : item.status === "active" ? "#fce7f3" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "over" ? "#d97706" : item.status === "active" ? "#db2777" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-wedding-response-node" data-wedding-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#831843">{item.label || node.key}</text>
          </g>
        );
      })}
    </svg>
  );
};

const CatanWeddingResponsePanel = ({
  attackerName = "",
  mustRespondWedding = false,
  weddingRequired = 0,
  weddingTotal = 0,
  weddingResources = {},
  weddingCommodities = {},
  resources = {},
  commodities = {},
  pendingNames = [],
}) => {
  const items = buildCatanWeddingResponseItems({
    attackerName,
    mustRespondWedding,
    weddingRequired,
    weddingTotal,
    weddingResources,
    weddingCommodities,
    resources,
    commodities,
    pendingNames,
  });
  const bundleRows = catanWeddingBundleRows({
    resources,
    commodities,
    resourceSelection: weddingResources,
    commoditySelection: weddingCommodities,
  });

  return (
    <section
      data-smoke="catan-wedding-response-panel"
      data-must-wedding={mustRespondWedding ? "true" : "false"}
      data-wedding-required={Math.max(0, Number(weddingRequired) || 0)}
      data-wedding-total={Math.max(0, Number(weddingTotal) || 0)}
      data-pending-count={pendingNames.length}
      className="rounded-2xl border border-pink-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanWeddingResponseArt
          items={items}
          weddingRequired={weddingRequired}
          weddingTotal={weddingTotal}
          mustRespondWedding={mustRespondWedding}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-pink-700">혼례 응답 플래너</div>
              <div className="mt-1 text-lg font-black text-slate-950">정확히 몇 장을 줄지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                제출 버튼을 누르기 전에 필요 장수, 현재 선택 수, 자원/상품 구성을 한 번에 확인합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${mustRespondWedding ? "bg-pink-100 text-pink-800" : "bg-slate-100 text-slate-600"}`}>
              {mustRespondWedding ? "응답 필요" : "응답 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-wedding-response-item"
                data-wedding-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanWeddingResponseTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bundleRows.slice(0, 8).map((row) => (
              <span
                key={row.key}
                data-smoke="catan-wedding-response-chip"
                data-card-key={row.key}
                data-selected={row.selected > 0 ? "true" : "false"}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.selected > 0 ? "bg-pink-100 text-pink-800" : "bg-slate-100 text-slate-500"}`}
              >
                {row.label} 보유 {row.held} · 선택 {row.selected}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanEventLabels = {
  SETUP_BUILD: "초기 배치",
  ROLL: "주사위",
  ROLL_SEVEN: "7 처리",
  RESOURCE_SUPPLY_SHORTAGE: "자원 공급 부족",
  CATAN_EVENT_DIE: "이벤트 주사위",
  DRAW_PROGRESS_CARD: "진행 카드 획득",
  DISCARD_RESOURCES: "자원 버림",
  DISCARD_PROGRESS_CARD: "진행 카드 버림",
  PROGRESS_CARD_LIMIT: "진행 카드 한도",
  CHOOSE_GOLD_RESOURCE: "금광 선택",
  AQUEDUCT_AVAILABLE: "수로 선택 가능",
  CHOOSE_AQUEDUCT_RESOURCE: "수로 자원 선택",
  MOVE_ROBBER: "도적 이동",
  MOVE_PIRATE: "해적 이동",
  BUILD_ROAD: "도로 건설",
  BUILD_BRIDGE: "다리 건설",
  BUILD_SHIP: "배 건설",
  MOVE_SHIP: "배 이동",
  FOREIGN_ISLAND_BONUS: "외딴 섬 보너스",
  FORGOTTEN_TRIBE_GIFT: "잊힌 부족 선물",
  FORGOTTEN_TRIBE_HARBOR: "선물 항구 배치",
  CLOTH_TRADE_START: "부족 마을 직물 교역",
  CLOTH_PRODUCTION: "직물 생산",
  CLOTH_DEPLETION_FINISH: "직물 고갈 종료",
  DISCOVER_HEX: "탐험 발견",
  BUILD_SETTLER: "정착민 준비",
  LOAD_SETTLER: "정착민 승선",
  BUILD_CREW: "승무원 준비",
  UNLOAD_CREW_TO_PIRATE_LAIR: "해적 소굴 공격",
  PIRATE_LAIR_CAPTURED: "해적 소굴 점령",
  ROLL_FISH_HAUL: "어획물 출현",
  CATCH_FISH: "어획물 적재",
  COLLECT_SPICE: "향신료 적재",
  SELL_RESOURCE_FOR_GOLD: "빠른 금 교환",
  CHASE_AWAY_PIRATE: "해적 몰아내기",
  TRANSFER_CARGO: "화물 교환",
  DELIVER_CARGO: "의회 납품",
  PIRATE_REMOVED_FISH: "해적 어획물 제거",
  FOUND_SETTLEMENT_FROM_SHIP: "상륙 마을 건설",
  PAY_PIRATE_TRIBUTE: "해적 통행료",
  BUILD_KNIGHT: "기사 배치",
  ACTIVATE_KNIGHT: "기사 활성화",
  PROMOTE_KNIGHT: "기사 승급",
  MOVE_KNIGHT: "기사 이동",
  KNIGHT_DISPLACED: "기사 밀림",
  KNIGHT_DISPLACED_REMOVED: "기사 제거",
  MOVE_DISPLACED_KNIGHT: "밀린 기사 이동",
  CHASE_ROBBER_WITH_KNIGHT: "기사 도적 추방",
  BUILD_CITY_IMPROVEMENT: "도시 발전",
  BUILD_CITY_WALL: "도시 성벽",
  PLAY_PROGRESS_CARD: "진행 카드 사용",
  BARBARIAN_DEFENDED: "야만인 방어",
  BARBARIAN_RAID: "야만인 약탈",
  BARBARIAN_CITY_PILLAGED: "도시 약탈",
  DEFENDER_PROGRESS_AVAILABLE: "방어자 진행 카드",
  CHOOSE_DEFENDER_PROGRESS_CARD: "방어자 카드 선택",
  BUILD_SETTLEMENT: "마을 건설",
  BUILD_HARBOR_SETTLEMENT: "항구 정착지 건설",
  BUILD_CITY: "도시 건설",
  GAIN_GOLD: "금 획득",
  RIVER_GOLD: "강 골드 획득",
  SPEND_GOLD_FOR_RESOURCE: "골드 자원 교환",
  CAMEL_BID_START: "낙타 입찰 시작",
  BID_CAMEL: "낙타 입찰",
  CAMEL_PLACER: "낙타 배치권",
  PLACE_CAMEL: "낙타 배치",
  BARBARIAN_LANDS: "야만인 상륙",
  RECRUIT_BARBARIAN_KNIGHT: "방어 기사 배치",
  EXPEL_BARBARIANS: "야만인 격퇴",
  BUY_DEVELOPMENT_CARD: "개발 카드 구입",
  PLAY_DEVELOPMENT_CARD: "개발 카드 사용",
  PROGRESS_ALCHEMIST: "연금술사",
  PROGRESS_COMMERCIAL_HARBOR: "상업 항구",
  COMMERCIAL_HARBOR_EXCHANGE: "상업 항구 교환",
  DOMESTIC_TRADE_PROPOSED: "플레이어 거래 제안",
  DOMESTIC_TRADE_ACCEPTED: "플레이어 거래 성립",
  DOMESTIC_TRADE_REJECTED: "플레이어 거래 거절",
  DOMESTIC_TRADE_CANCELLED: "플레이어 거래 취소",
  PROGRESS_SPY_REVEAL: "첩자 카드 확인",
  PROGRESS_DESERTER: "탈영병",
  DESERTER_REMOVE_KNIGHT: "탈영 기사 제거",
  DESERTER_PLACE_KNIGHT: "탈영 기사 배치",
  PROGRESS_INTRIGUE: "음모",
  INTRIGUE_MOVE_KNIGHT: "음모 기사 이동",
  PROGRESS_MERCHANT_FLEET: "상선단",
  MASTER_MERCHANT_TAKE: "대상인 카드 선택",
  PROGRESS_INVENTOR: "발명가",
  PROGRESS_SABOTEUR: "파괴 공작",
  PROGRESS_SPY: "첩자",
  WEDDING_GIVE_CARDS: "혼례 카드 제공",
  FISHERMEN_TOKEN: "물고기 토큰 획득",
  FISHERMEN_OLD_BOOT: "낡은 장화 획득",
  FISHERMEN_EMPTY_SUPPLY: "물고기 토큰 부족",
  SPEND_FISH_MOVE_ROBBER: "물고기로 도둑 이동",
  SPEND_FISH_STEAL_RESOURCE: "물고기로 자원 뽑기",
  SPEND_FISH_TAKE_RESOURCE: "물고기로 자원 획득",
  SPEND_FISH_BUILD_ROAD: "물고기로 도로 건설",
  SPEND_FISH_DRAW_DEVELOPMENT: "물고기로 개발 카드",
  GIVE_OLD_BOOT: "낡은 장화 넘기기",
  MARITIME_TRADE: "해상 교환",
  END_TURN: "턴 종료",
};

const catanColorFill = {
  RED: "#ef4444",
  BLUE: "#2563eb",
  WHITE: "#f8fafc",
  ORANGE: "#f97316",
  GREEN: "#16a34a",
  BROWN: "#92400e",
};

const catanDiceDotPositions = {
  1: [[24, 24]],
  2: [[15, 15], [33, 33]],
  3: [[15, 15], [24, 24], [33, 33]],
  4: [[15, 15], [33, 15], [15, 33], [33, 33]],
  5: [[15, 15], [33, 15], [24, 24], [15, 33], [33, 33]],
  6: [[15, 13], [33, 13], [15, 24], [33, 24], [15, 35], [33, 35]],
};

const CatanDiceFaceArt = ({ value = 0, red = false, muted = false, className = "" }) => {
  const safeValue = Number(value || 0);
  const dots = catanDiceDotPositions[safeValue] || [];
  const shellFill = red ? "#dc2626" : muted ? "#e2e8f0" : "#ffffff";
  const stroke = red ? "#7f1d1d" : "#0f172a";
  const ink = red ? "#fff7ed" : muted ? "#64748b" : "#0f172a";

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      data-smoke="catan-dice-face-art"
      role="img"
      aria-label={safeValue > 0 ? `${red ? "적색 " : ""}주사위 ${safeValue}` : "주사위 대기"}
    >
      <rect x="4" y="4" width="40" height="40" rx="11" fill={shellFill} stroke={stroke} strokeWidth="3" opacity={muted ? ".86" : "1"} />
      <rect x="9" y="9" width="30" height="30" rx="8" fill="rgba(255,255,255,.22)" />
      {dots.length ? dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" fill={ink} />
      )) : (
        <path d="M17 24h14" stroke={ink} strokeWidth="4" strokeLinecap="round" opacity=".75" />
      )}
    </svg>
  );
};

const CatanDiceOutcomePanel = ({
  diceFaces = [],
  lastRoll = 0,
  redDie = 0,
  eventDie = "",
  phase = "",
  myTurn = false,
  pendingDiscardCount = 0,
  productionSummary = [],
  resourceBank = {},
  robberLocked = false,
  explorersPiratesRule = false,
  citiesKnightsRule = false,
}) => {
  const normalizedFaces = Array.isArray(diceFaces) ? diceFaces.map(Number).filter((value) => value > 0) : [];
  const inferredWhiteDie = redDie > 0 && lastRoll > redDie && lastRoll - redDie <= 6 ? lastRoll - redDie : 0;
  const faces = normalizedFaces.length
    ? normalizedFaces.slice(0, 3)
    : redDie > 0
      ? [redDie, inferredWhiteDie || 0]
      : [0, 0];
  const isSeven = Number(lastRoll || 0) === 7;
  const hasRoll = Number(lastRoll || 0) > 0;
  const eventLabel = eventDie ? catanEventDieLabels[eventDie] || eventDie : "이벤트 없음";
  const productionText = productionSummary.length
    ? productionSummary.map((item) => `${item.label} ${item.count}`).join(" · ")
    : hasRoll && !isSeven
      ? "생산 후보 없음"
      : "굴림 후 표시";
  const primaryTitle = !hasRoll
    ? phase === "ROLL" ? "주사위 굴림 대기" : "최근 굴림 없음"
    : isSeven
      ? explorersPiratesRule ? "7 처리 · 해적 이동" : robberLocked ? "7 처리 · 도적 잠금" : "7 처리 · 도둑 압박"
      : `생산 숫자 ${lastRoll}`;
  const primaryDetail = !hasRoll
    ? myTurn ? "굴림 전 개발 카드나 진행 카드 타이밍을 먼저 확인하고, 주사위를 굴리면 생산 근거가 여기로 이동합니다." : "현재 플레이어의 주사위 굴림을 기다리는 중입니다."
    : isSeven
      ? pendingDiscardCount > 0
        ? `${pendingDiscardCount}명이 손패를 줄인 뒤 ${explorersPiratesRule ? "해적" : "도둑"} 이동 단계로 이어집니다.`
        : robberLocked
          ? "첫 야만인 침공 전이라 도적 이동 없이 손패 처리만 확인합니다."
          : `${explorersPiratesRule ? "해적" : "도둑"}을 옮길 타일과 훔칠 대상을 확인해야 합니다.`
      : `${productionText} · 도둑이 막은 타일과 은행 잔량은 실제 지급 결과에 영향을 줍니다.`;
  const signalItems = [
    {
      key: "roll",
      label: "굴림 결과",
      value: hasRoll ? String(lastRoll) : "대기",
      detail: hasRoll ? primaryTitle : phase === "ROLL" ? "주사위 버튼 대기" : "최근 기록 없음",
      tone: hasRoll ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600",
    },
    {
      key: "event",
      label: citiesKnightsRule ? "이벤트 주사위" : "이벤트",
      value: eventLabel,
      detail: citiesKnightsRule ? "야만인선/진행 카드 계열 신호를 확인합니다." : "기본판은 이벤트 주사위가 없을 수 있습니다.",
      tone: eventDie ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-600",
    },
    {
      key: "discard",
      label: "손패 압박",
      value: isSeven ? `${pendingDiscardCount}명 확인` : "없음",
      detail: isSeven ? "8장 이상 보유자는 절반을 버립니다." : "7이 아닐 때는 생산/행동 단계가 중심입니다.",
      tone: isSeven ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-700",
    },
    {
      key: "bank",
      label: "은행 신호",
      value: `${catanResourceKeys.reduce((sum, key) => sum + Math.max(0, Number(resourceBank?.[key] || 0)), 0)}장`,
      detail: "자원 공급 부족 이벤트가 있으면 지급량이 달라질 수 있습니다.",
      tone: "bg-sky-50 text-sky-800",
    },
  ];

  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" data-smoke="catan-dice-outcome-panel">
      <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="bg-slate-950 p-4 text-white">
          <div className="text-[11px] font-black uppercase tracking-wide text-amber-200">Dice Readout</div>
          <div className="mt-2 flex items-center gap-2">
            {faces.map((face, index) => (
              <CatanDiceFaceArt key={`${face}-${index}`} value={face} red={redDie > 0 && index === 0} muted={!face} className="h-16 w-16" />
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            <div className="text-[11px] font-black text-slate-300">결과 해석</div>
            <div className="mt-1 text-sm font-black leading-snug text-white">{primaryTitle}</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-300">{primaryDetail}</div>
          </div>
        </div>
        <div className="p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {signalItems.map((item) => (
              <div key={item.key} className={`min-h-[96px] rounded-xl border border-slate-100 px-3 py-2 ${item.tone}`} data-smoke="catan-dice-signal-item">
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-1 truncate text-sm font-black">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {catanResourceKeys.map((key) => {
              const produced = productionSummary.find((item) => item.key === key);
              return (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2" data-smoke="catan-dice-production-item">
                  <div className="text-[10px] font-black text-slate-500">{catanResourceLabels[key]}</div>
                  <div className="mt-1 text-sm font-black text-slate-950">{produced?.count || 0}개 후보</div>
                  <div className="mt-1 text-[10px] font-bold text-slate-500">은행 {resourceBank?.[key] ?? "-"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const keyboardActivateProps = (onActivate) => ({
  role: "button",
  tabIndex: 0,
  onKeyDown: (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate();
  },
});

const TabletopHistoryEmptyArt = ({ tone = "slate", gameLabel = "기록", nextLabel = "첫 행동" }) => {
  const palette = {
    slate: { bg: "#0f172a", node: "#38bdf8", accent: "#f59e0b", line: "#e2e8f0", soft: "#dbeafe" },
    blokus: { bg: "#111827", node: "#06b6d4", accent: "#a855f7", line: "#e0f2fe", soft: "#cffafe" },
    mahe: { bg: "#064e3b", node: "#22c55e", accent: "#facc15", line: "#dcfce7", soft: "#bbf7d0" },
    catan: { bg: "#451a03", node: "#f59e0b", accent: "#0ea5e9", line: "#fef3c7", soft: "#fde68a" },
    "six-nimmt": { bg: "#7f1d1d", node: "#f97316", accent: "#84cc16", line: "#fff7ed", soft: "#fed7aa" },
  }[tone] || {
    bg: "#0f172a",
    node: "#38bdf8",
    accent: "#f59e0b",
    line: "#e2e8f0",
    soft: "#dbeafe",
  };
  const nodes = [
    { key: "start", x: 48, y: 66, label: "시작", fill: palette.node },
    { key: "action", x: 128, y: 38, label: nextLabel, fill: palette.accent },
    { key: "log", x: 208, y: 70, label: "기록", fill: "#64748b" },
  ];
  return (
    <svg
      viewBox="0 0 260 116"
      role="img"
      aria-label={`${gameLabel} 첫 기록 대기 안내`}
      className="h-auto w-full"
      data-smoke="tabletop-history-empty-art"
    >
      <rect x="8" y="8" width="244" height="100" rx="18" fill={palette.bg} />
      <path d="M48 66C78 20 112 28 140 48s55 44 88 6" fill="none" stroke={palette.line} strokeWidth="5" strokeLinecap="round" opacity=".82" />
      <rect x="28" y="84" width="204" height="12" rx="6" fill={palette.soft} opacity=".22" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="tabletop-history-empty-node" data-history-node={node.key}>
          <circle cx={node.x} cy={node.y} r="17" fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="22" y="26" fontSize="9" fontWeight="900" fill="#bfdbfe">최근 행동</text>
      <text x="238" y="26" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{gameLabel}</text>
    </svg>
  );
};

const TabletopHistoryEmptyState = ({
  game = "tabletop",
  title = "아직 기록이 없습니다",
  detail = "첫 행동이 끝나면 이 영역에 최근 기록이 쌓입니다.",
  nextAction = "첫 행동",
}) => {
  const gameLabel = title;
  const items = [
    { label: "현재 상태", value: "기록 대기", detail: "아직 서버가 전달한 행동 로그가 없습니다." },
    { label: "다음 변화", value: nextAction, detail: "첫 행동이 처리되면 최근 기록, 주체, 결과가 같은 위치에 표시됩니다." },
  ];
  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2"
      data-smoke="tabletop-history-empty-state"
      data-history-game={game}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,190px)_1fr]">
        <div className="overflow-hidden rounded-lg bg-slate-950">
          <TabletopHistoryEmptyArt tone={game} gameLabel={gameLabel} nextLabel={nextAction} />
        </div>
        <div className="min-w-0 p-1">
          <div className="text-xs font-black text-slate-900">{title}</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{detail}</div>
          <div className="mt-2 grid gap-1.5">
            {items.map((item) => (
              <div key={item.label} className="rounded-lg bg-white px-2 py-1.5" data-smoke="tabletop-history-empty-item">
                <div className="text-[9px] font-black text-slate-400">{item.label}</div>
                <div className="text-[11px] font-black text-slate-900">{item.value}</div>
                <div className="text-[10px] font-bold leading-snug text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const hexPoints = (x, y, radius) =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(" ");

const CatanBoard = ({ gameState, players: roomPlayers, mySeatNo, onAction }) => {
  const [selectedVertexId, setSelectedVertexId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedHexId, setSelectedHexId] = useState(null);
  const [targetSeatNo, setTargetSeatNo] = useState("");
  const [buildMode, setBuildMode] = useState("ROAD");
  const [knightMoveSourceId, setKnightMoveSourceId] = useState(null);
  const [shipMoveFromEdgeId, setShipMoveFromEdgeId] = useState(null);
  const [shipMovePath, setShipMovePath] = useState([]);
  const [tradeForm, setTradeForm] = useState({ give: "BRICK", receive: "LUMBER" });
  const [domesticTradeTargetSeatNo, setDomesticTradeTargetSeatNo] = useState("");
  const [domesticOfferForm, setDomesticOfferForm] = useState(emptyCatanResourceCounts);
  const [domesticRequestForm, setDomesticRequestForm] = useState(emptyCatanResourceCounts);
  const [discardForm, setDiscardForm] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [discardCommodityForm, setDiscardCommodityForm] = useState({ PAPER: 0, CLOTH: 0, COIN: 0 });
  const [goldForm, setGoldForm] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [camelBidForm, setCamelBidForm] = useState({ WOOL: 0, GRAIN: 0 });
  const [masterMerchantResources, setMasterMerchantResources] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [masterMerchantCommodities, setMasterMerchantCommodities] = useState({ PAPER: 0, CLOTH: 0, COIN: 0 });
  const [weddingResources, setWeddingResources] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [weddingCommodities, setWeddingCommodities] = useState({ PAPER: 0, CLOTH: 0, COIN: 0 });
  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedProgressCardId, setSelectedProgressCardId] = useState("");
  const [roadCardEdges, setRoadCardEdges] = useState([]);
  const [selectedImprovementType, setSelectedImprovementType] = useState("SCIENCE");
  const [selectedCommodityType, setSelectedCommodityType] = useState("PAPER");
  const [selectedAqueductResourceType, setSelectedAqueductResourceType] = useState("BRICK");
  const [selectedSpyCardId, setSelectedSpyCardId] = useState("");
  const [alchemistDice, setAlchemistDice] = useState({ red: 1, white: 1 });
  const phase = gameState?.phase || "SETUP";
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const pairedTurnRule = Boolean(get(gameState, "paired_turn_rule", "pairedTurnRule", false));
  const seafarersRule = Boolean(get(gameState, "seafarers_rule", "seafarersRule", false));
  const citiesKnightsRule = Boolean(get(gameState, "cities_knights_rule", "citiesKnightsRule", false));
  const tradersBarbariansRule = Boolean(get(gameState, "traders_barbarians_rule", "tradersBarbariansRule", false));
  const fishermenRule = Boolean(get(gameState, "fishermen_rule", "fishermenRule", false));
  const riversRule = Boolean(get(gameState, "rivers_rule", "riversRule", false));
  const caravansRule = Boolean(get(gameState, "caravans_rule", "caravansRule", false));
  const barbarianAttackRule = Boolean(get(gameState, "barbarian_attack_rule", "barbarianAttackRule", false));
  const explorersPiratesRule = Boolean(get(gameState, "explorers_pirates_rule", "explorersPiratesRule", false));
  const friendlyRobberRule = Boolean(get(gameState, "friendly_robber_rule", "friendlyRobberRule", false));
  const seafarersScenarioCode = get(gameState, "seafarers_scenario_code", "seafarersScenarioCode", "");
  const catanianOneSeatNo = Number(get(gameState, "catanian_one_seat_no", "catanianOneSeatNo", 0));
  const catanianTwoSeatNo = Number(get(gameState, "catanian_two_seat_no", "catanianTwoSeatNo", 0));
  const turnNo = Number(get(gameState, "turn_no", "turnNo", 0));
  const robberHexId = Number(get(gameState, "robber_hex_id", "robberHexId", 0));
  const pirateHexId = Number(get(gameState, "pirate_hex_id", "pirateHexId", 0));
  const fishHaulDie = Number(get(gameState, "fish_haul_die", "fishHaulDie", 0));
  const fishHaulsInSupply = Number(get(gameState, "fish_hauls_in_supply", "fishHaulsInSupply", 0));
  const councilDockEdgeIds = get(gameState, "council_dock_edge_ids", "councilDockEdgeIds", []);
  const barbarianPosition = Number(get(gameState, "barbarian_position", "barbarianPosition", 0));
  const barbarianTrackLength = Number(get(gameState, "barbarian_track_length", "barbarianTrackLength", 7));
  const barbarianAttacks = Number(get(gameState, "barbarian_attacks", "barbarianAttacks", 0));
  const citiesKnightsRobberLocked = citiesKnightsRule && barbarianAttacks <= 0;
  const merchantSeatNo = Number(get(gameState, "merchant_seat_no", "merchantSeatNo", 0));
  const merchantHexId = Number(get(gameState, "merchant_hex_id", "merchantHexId", 0));
  const merchantResourceType = get(gameState, "merchant_resource_type", "merchantResourceType", "");
  const merchantFleetSeatNo = Number(get(gameState, "merchant_fleet_seat_no", "merchantFleetSeatNo", 0));
  const merchantFleetCardType = get(gameState, "merchant_fleet_card_type", "merchantFleetCardType", "");
  const oasisHexId = Number(get(gameState, "oasis_hex_id", "oasisHexId", 0));
  const camelSupply = Number(get(gameState, "camel_supply", "camelSupply", 0));
  const pendingCamelPlacements = Number(get(gameState, "pending_camel_placements", "pendingCamelPlacements", 0));
  const camelBidCurrentSeatNo = Number(get(gameState, "camel_bid_current_seat_no", "camelBidCurrentSeatNo", 0));
  const camelPlacerSeatNo = Number(get(gameState, "camel_placer_seat_no", "camelPlacerSeatNo", 0));
  const camelStartEdgeIds = get(gameState, "camel_start_edge_ids", "camelStartEdgeIds", []);
  const camelBids = get(gameState, "camel_bids", "camelBids", []);
  const barbarianAttackSupply = Number(get(gameState, "barbarian_attack_supply", "barbarianAttackSupply", 0));
  const pendingDeserterAttackerSeatNo = Number(get(gameState, "pending_deserter_attacker_seat_no", "pendingDeserterAttackerSeatNo", 0));
  const pendingDeserterTargetSeatNo = Number(get(gameState, "pending_deserter_target_seat_no", "pendingDeserterTargetSeatNo", 0));
  const pendingDeserterKnightLevel = Number(get(gameState, "pending_deserter_knight_level", "pendingDeserterKnightLevel", 0));
  const pendingIntrigueAttackerSeatNo = Number(get(gameState, "pending_intrigue_attacker_seat_no", "pendingIntrigueAttackerSeatNo", 0));
  const pendingIntrigueTargetSeatNo = Number(get(gameState, "pending_intrigue_target_seat_no", "pendingIntrigueTargetSeatNo", 0));
  const pendingIntrigueKnightLevel = Number(get(gameState, "pending_intrigue_knight_level", "pendingIntrigueKnightLevel", 0));
  const pendingDisplacedKnightTargetSeatNo = Number(get(gameState, "pending_displaced_knight_target_seat_no", "pendingDisplacedKnightTargetSeatNo", 0));
  const pendingDisplacedKnightLevel = Number(get(gameState, "pending_displaced_knight_level", "pendingDisplacedKnightLevel", 0));
  const pendingCommercialHarborSeatNo = Number(get(gameState, "pending_commercial_harbor_seat_no", "pendingCommercialHarborSeatNo", 0));
  const pendingCommercialHarborResourceType = get(gameState, "pending_commercial_harbor_resource_type", "pendingCommercialHarborResourceType", "");
  const pendingCommercialHarborSeatNos = get(gameState, "pending_commercial_harbor_seat_nos", "pendingCommercialHarborSeatNos", []);
  const pendingMasterMerchantAttackerSeatNo = Number(get(gameState, "pending_master_merchant_attacker_seat_no", "pendingMasterMerchantAttackerSeatNo", 0));
  const pendingMasterMerchantTargetSeatNo = Number(get(gameState, "pending_master_merchant_target_seat_no", "pendingMasterMerchantTargetSeatNo", 0));
  const pendingMasterMerchantCount = Number(get(gameState, "pending_master_merchant_count", "pendingMasterMerchantCount", 0));
  const pendingSpyAttackerSeatNo = Number(get(gameState, "pending_spy_attacker_seat_no", "pendingSpyAttackerSeatNo", 0));
  const pendingSpyTargetSeatNo = Number(get(gameState, "pending_spy_target_seat_no", "pendingSpyTargetSeatNo", 0));
  const pendingWeddingAttackerSeatNo = Number(get(gameState, "pending_wedding_attacker_seat_no", "pendingWeddingAttackerSeatNo", 0));
  const pendingWeddingSeatNos = get(gameState, "pending_wedding_seat_nos", "pendingWeddingSeatNos", []);
  const lastRoll = Number(get(gameState, "last_roll", "lastRoll", 0));
  const redDie = Number(get(gameState, "red_die", "redDie", 0));
  const eventDie = get(gameState, "event_die", "eventDie", "");
  const dice = get(gameState, "dice", "dice", []);
  const hexes = get(gameState, "hexes", "hexes", []);
  const fogIslandsRule = seafarersScenarioCode === "FOG_ISLANDS";
  const throughDesertRule = seafarersScenarioCode === "THROUGH_DESERT";
  const forgottenTribeRule = seafarersScenarioCode === "FORGOTTEN_TRIBE";
  const clothForCatanRule = seafarersScenarioCode === "CLOTH";
  const hiddenFogCount = hexes.filter((hex) => !Boolean(get(hex, "discovered", "discovered", true))).length;
  const vertices = get(gameState, "vertices", "vertices", []);
  const edges = get(gameState, "edges", "edges", []);
  const ports = get(gameState, "ports", "ports", []);
  const fishingGrounds = get(gameState, "fishing_grounds", "fishingGrounds", []);
  const clothVillages = get(gameState, "cloth_villages", "clothVillages", []);
  const clothVillageGeneralSupply = Number(get(gameState, "cloth_village_general_supply", "clothVillageGeneralSupply", 0));
  const catanPlayers = get(gameState, "players", "players", []);
  const events = get(gameState, "events", "events", []);
  const pendingDiscardSeatNos = get(gameState, "pending_discard_seat_nos", "pendingDiscardSeatNos", []);
  const pendingProgressDiscardSeatNos = get(gameState, "pending_progress_discard_seat_nos", "pendingProgressDiscardSeatNos", []);
  const pendingDefenderProgressSeatNos = get(gameState, "pending_defender_progress_seat_nos", "pendingDefenderProgressSeatNos", []);
  const pendingGoldChoices = get(gameState, "pending_gold_choices", "pendingGoldChoices", []);
  const pendingAqueductChoices = get(gameState, "pending_aqueduct_choices", "pendingAqueductChoices", []);
  const pendingDomesticTrade = get(gameState, "pending_domestic_trade", "pendingDomesticTrade", null);
  const winningPoints = Number(get(gameState, "winning_points", "winningPoints", 10));
  const catanRuleBrief = (() => {
    const targetText = `목표 ${winningPoints}점`;
    if (explorersPiratesRule) {
      return {
        title: "탐험가와 해적",
        summary: "항구 정착지에서 출항해 미발견 해역을 탐험하고, 물고기·향신료·해적 소굴 임무로 점수를 쌓습니다.",
        chips: [targetText, "도둑 없음", "해적 이동", "화물 1대형/2소형"],
        tone: "border-sky-100 bg-sky-50 text-sky-900",
        chipTone: "bg-white/80 text-sky-700",
      };
    }
    if (citiesKnightsRule) {
      return {
        title: "도시와 기사",
        summary: "상품, 도시 발전, 기사 활성화, 야만인 침공이 핵심입니다. 첫 야만인 침공 전에는 도둑 이동이 잠깁니다.",
        chips: [targetText, "두 번째 배치 도시", "진행 카드", "야만인 트랙"],
        tone: "border-rose-100 bg-rose-50 text-rose-900",
        chipTone: "bg-white/80 text-rose-700",
      };
    }
    if (clothForCatanRule) {
      return {
        title: "항해사: 카탄에 천을",
        summary: "부족 마을과 배로 연결해 직물을 얻고, 직물 2개마다 승점 1점을 추가합니다.",
        chips: [targetText, "부족 마을", "직물 교역", "고갈 종료"],
        tone: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-900",
        chipTone: "bg-white/80 text-fuchsia-700",
      };
    }
    if (forgottenTribeRule) {
      return {
        title: "항해사: 잊힌 부족",
        summary: "부족 섬에는 정착할 수 없고, 배가 선물 해안에 닿으면 승점·개발 카드·항구 선물을 받습니다.",
        chips: [targetText, "선물 해안", "부족 섬 정착 불가", "13점"],
        tone: "border-teal-100 bg-teal-50 text-teal-900",
        chipTone: "bg-white/80 text-teal-700",
      };
    }
    if (throughDesertRule) {
      return {
        title: "항해사: 사막을 지나서",
        summary: "사막 장벽 너머 외국 지역을 개척합니다. 새 외국 지역에 처음 마을을 세우면 특별 승점 2점을 받습니다.",
        chips: [targetText, "본섬 초기 배치", "외국 지역 보너스", "14점"],
        tone: "border-amber-100 bg-amber-50 text-amber-900",
        chipTone: "bg-white/80 text-amber-800",
      };
    }
    if (fogIslandsRule) {
      return {
        title: "항해사: 안개 섬",
        summary: "배나 도로가 안개에 닿으면 타일이 공개됩니다. 발견한 육지는 해당 자원 보상을 주고, 금광은 선택 보상으로 처리됩니다.",
        chips: [targetText, `미발견 ${hiddenFogCount}개`, "특별 승점 없음", "12점"],
        tone: "border-slate-200 bg-slate-50 text-slate-800",
        chipTone: "bg-white text-slate-600",
      };
    }
    if (seafarersScenarioCode === "FOUR_ISLANDS") {
      return {
        title: "항해사: 네 개의 섬",
        summary: "초기 배치한 섬이 홈 섬입니다. 홈이 아닌 섬에 처음 마을을 세우면 섬마다 특별 승점 2점을 얻습니다.",
        chips: [targetText, "홈 섬 기록", "외국 섬 보너스", "13점"],
        tone: "border-cyan-100 bg-cyan-50 text-cyan-900",
        chipTone: "bg-white/80 text-cyan-700",
      };
    }
    if (seafarersScenarioCode === "NEW_SHORES") {
      return {
        title: "항해사: 새 해안",
        summary: "본섬에서 시작해 배로 외딴 섬을 개척합니다. 플레이어별 첫 외국 섬 마을은 특별 승점 2점입니다.",
        chips: [targetText, "배와 해적", "외딴 섬", "14점"],
        tone: "border-cyan-100 bg-cyan-50 text-cyan-900",
        chipTone: "bg-white/80 text-cyan-700",
      };
    }
    if (barbarianAttackRule) {
      return {
        title: "상인과 야만인: 야만인 침공",
        summary: "해안 야만인이 생산지를 점령할 수 있고, 기사 개발 카드로 방어 기사를 모집해 격퇴 점수를 얻습니다.",
        chips: [targetText, "해안 점령", "방어 기사", "12점"],
        tone: "border-red-100 bg-red-50 text-red-900",
        chipTone: "bg-white/80 text-red-700",
      };
    }
    if (caravansRule) {
      return {
        title: "상인과 야만인: 대상단",
        summary: "마을이나 도시 건설 뒤 낙타 입찰이 열리고, 낙타 행렬은 길 길이와 인접 건물 점수에 영향을 줍니다.",
        chips: [targetText, "낙타 입찰", "경로 보너스", "12점"],
        tone: "border-orange-100 bg-orange-50 text-orange-900",
        chipTone: "bg-white/80 text-orange-700",
      };
    }
    if (riversRule) {
      return {
        title: "상인과 야만인: 카탄의 강",
        summary: "강가 건설과 다리로 골드를 얻고, 골드 보유량에 따라 부유/빈곤 정착민 점수가 바뀝니다.",
        chips: [targetText, "다리", "골드 교환", "부유/빈곤"],
        tone: "border-emerald-100 bg-emerald-50 text-emerald-900",
        chipTone: "bg-white/80 text-emerald-700",
      };
    }
    if (fishermenRule) {
      return {
        title: "상인과 야만인: 카탄의 낚시꾼",
        summary: "낚시터에서 물고기 토큰을 얻고, 물고기 시장 액션으로 도둑 이동·자원 획득·도로 건설 등을 선택합니다.",
        chips: [targetText, "낚시터", "물고기 시장", "낡은 장화"],
        tone: "border-sky-100 bg-sky-50 text-sky-900",
        chipTone: "bg-white/80 text-sky-700",
      };
    }
    if (friendlyRobberRule) {
      return {
        title: "상인과 야만인: 친절한 도둑",
        summary: "공개 승점 2점 이하 플레이어의 건물 옆으로 도둑을 옮길 수 없어 초반 탈락감을 줄입니다.",
        chips: [targetText, "2점 이하 보호", "도둑 제한", "10점"],
        tone: "border-lime-100 bg-lime-50 text-lime-900",
        chipTone: "bg-white/80 text-lime-700",
      };
    }
    if (tradersBarbariansRule) {
      return {
        title: pairedTurnRule ? "상인과 야만인: 항만장 5~6인" : "상인과 야만인: 항만장",
        summary: "항구 위 마을과 도시는 항만 점수를 만들고, 단독 3점 이상 선두가 항만장 보너스 2점을 받습니다.",
        chips: [targetText, "항구 점수", "항만장 +2", pairedTurnRule ? "5~6인" : "3~4인"],
        tone: "border-indigo-100 bg-indigo-50 text-indigo-900",
        chipTone: "bg-white/80 text-indigo-700",
      };
    }
    if (pairedTurnRule) {
      return {
        title: "5~6인 확장",
        summary: "카타니안 1이 주사위와 행동을 진행한 뒤 카타니안 2가 후속 행동을 하고, 두 표식이 함께 이동합니다.",
        chips: [targetText, "카타니안 1/2", "확장 보드", "5~6인"],
        tone: "border-amber-100 bg-amber-50 text-amber-900",
        chipTone: "bg-white/80 text-amber-800",
      };
    }
    return {
      title: "기본판",
      summary: "자원 생산, 건설, 항구 교환, 플레이어 거래, 개발 카드, 최장 교역로와 최대 기사력으로 10점을 먼저 달성합니다.",
      chips: [targetText, "3~4인", "거래", "개발 카드"],
      tone: "border-slate-200 bg-slate-50 text-slate-800",
      chipTone: "bg-white text-slate-600",
    };
  })();
  const winnerSeatNo = Number(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
  const myPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === mySeatNo);
  const winnerPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === winnerSeatNo);
  const winnerVictoryPoints = Number(get(winnerPlayer, "victory_points", "victoryPoints", get(winnerPlayer, "public_victory_points", "publicVictoryPoints", winningPoints)));
  const resources = get(myPlayer, "resources", "resources", {});
  const resourceBank = get(gameState, "resource_bank", "resourceBank", {});
  const commodities = get(myPlayer, "commodities", "commodities", {});
  const cityImprovements = get(myPlayer, "city_improvements", "cityImprovements", {});
  const metropolisTypes = get(myPlayer, "metropolis_types", "metropolisTypes", []);
  const developmentCards = get(myPlayer, "development_cards", "developmentCards", []);
  const devCardAlreadyPlayedThisTurn = Number(get(myPlayer, "dev_card_played_turn_no", "devCardPlayedTurnNo", 0)) === turnNo;
  const playableDevelopmentCards = useMemo(
    () => developmentCards.filter((card) => {
      const purchasedTurnNo = Number(get(card, "purchased_turn_no", "purchasedTurnNo", 0));
      return card.type !== "VICTORY_POINT" && purchasedTurnNo < turnNo;
    }),
    [developmentCards, turnNo]
  );
  const lockedDevelopmentCards = useMemo(
    () => developmentCards.filter((card) => {
      const purchasedTurnNo = Number(get(card, "purchased_turn_no", "purchasedTurnNo", 0));
      return card.type !== "VICTORY_POINT" && purchasedTurnNo >= turnNo;
    }),
    [developmentCards, turnNo]
  );
  const passiveDevelopmentVictoryCards = useMemo(
    () => developmentCards.filter((card) => card.type === "VICTORY_POINT"),
    [developmentCards]
  );
  const progressCards = get(myPlayer, "progress_cards", "progressCards", []);
  const fishermenTokens = get(myPlayer, "fishermen_tokens", "fishermenTokens", []);
  const fishermenFishTotal = Number(get(myPlayer, "fishermen_fish_total", "fishermenFishTotal", 0));
  const myHasOldBoot = Boolean(get(myPlayer, "has_old_boot", "hasOldBoot", false));
  const myGold = Number(get(myPlayer, "gold", "gold", 0));
  const riverGoldTradesUsed = Number(get(myPlayer, "river_gold_trade_turn_no", "riverGoldTradeTurnNo", -1)) === turnNo
    ? Number(get(myPlayer, "river_gold_trades_this_turn", "riverGoldTradesThisTurn", 0))
    : 0;
  const riverGoldTradesRemaining = Math.max(0, 2 - riverGoldTradesUsed);
  const myTurn = activeSeatNo === mySeatNo;
  const domesticResourceTradeRule = !citiesKnightsRule && !explorersPiratesRule;
  const radius = hexes.length > 25 ? 5.2 : 7.2;
  const vertexById = useMemo(() => new Map(vertices.map((vertex) => [Number(vertex.id), vertex])), [vertices]);
  const edgeById = useMemo(() => new Map(edges.map((edge) => [Number(edge.id), edge])), [edges]);
  const clothVillageByVertexId = useMemo(
    () => new Map(clothVillages.map((village) => [Number(get(village, "vertex_id", "vertexId", 0)), village])),
    [clothVillages]
  );
  const clothVillagesWithSupply = clothVillages.filter((village) => Number(get(village, "supply", "supply", 0)) > 0).length;
  const connectedClothVillageCount = clothVillages.filter((village) => (get(village, "connected_seat_nos", "connectedSeatNos", []) || []).length > 0).length;
  const playerName = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const numberedAreaList = (values, suffix = "번") => (values || [])
    .map((value) => `${value}${suffix}`)
    .join(", ");
  const selectedHex = hexes.find((hex) => Number(hex.id) === Number(selectedHexId));
  const robberTargets = useMemo(() => {
    if (!selectedHex) return [];
    const owners = new Set();
    if (selectedHex.terrain === "SEA") {
      (selectedHex.edgeIds || selectedHex.edge_ids || []).forEach((edgeId) => {
        const edge = edgeById.get(Number(edgeId));
        const owner = Number(get(edge, "owner_seat_no", "ownerSeatNo", 0));
        if (owner && owner !== mySeatNo && get(edge, "route_type", "routeType", "") === "SHIP") owners.add(owner);
      });
    } else {
      (selectedHex.vertexIds || selectedHex.vertex_ids || []).forEach((vertexId) => {
        const owner = Number(get(vertexById.get(Number(vertexId)), "owner_seat_no", "ownerSeatNo", 0));
        if (owner && owner !== mySeatNo) owners.add(owner);
      });
    }
    return Array.from(owners)
      .map((seatNo) => catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === seatNo))
      .filter(Boolean)
      .filter((player) => Number(get(player, "resource_count", "resourceCount", 0)) > 0);
  }, [selectedHex, vertexById, edgeById, catanPlayers, mySeatNo]);
  const fishStealTargets = catanPlayers
    .filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "resource_count", "resourceCount", 0)) + Number(get(player, "commodity_count", "commodityCount", 0)) > 0);
  const oldBootTargets = catanPlayers
    .filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "public_victory_points", "publicVictoryPoints", get(player, "victory_points", "victoryPoints", 0))) >= Number(get(myPlayer, "public_victory_points", "publicVictoryPoints", get(myPlayer, "victory_points", "victoryPoints", 0))));
  const domesticTradeTargets = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo);
  const fishActionTargets = Array.from(new Map([...fishStealTargets, ...oldBootTargets].map((player) => [Number(get(player, "seat_no", "seatNo", 0)), player])).values());
  const myCardCount = Number(get(myPlayer, "resource_count", "resourceCount", 0)) + Number(get(myPlayer, "commodity_count", "commodityCount", 0));
  const discardRequired = Math.floor(myCardCount / 2);
  const discardTotal = Object.values(discardForm).reduce((sum, value) => sum + Number(value || 0), 0)
    + Object.values(discardCommodityForm).reduce((sum, value) => sum + Number(value || 0), 0);
  const mustDiscard = pendingDiscardSeatNos.map(Number).includes(mySeatNo);
  const mustChooseDefenderProgress = pendingDefenderProgressSeatNos.map(Number).includes(mySeatNo);
  const mustMoveDisplacedKnight = phase === "DISPLACED_KNIGHT_MOVE" && pendingDisplacedKnightTargetSeatNo === mySeatNo;
  const mustRespondWedding = pendingWeddingSeatNos.map(Number).includes(mySeatNo);
  const weddingRequired = mustRespondWedding ? Math.min(2, myCardCount) : 0;
  const weddingTotal = Object.values(weddingResources).reduce((sum, value) => sum + Number(value || 0), 0)
    + Object.values(weddingCommodities).reduce((sum, value) => sum + Number(value || 0), 0);
  const myGoldChoice = pendingGoldChoices.find((choice) => Number(get(choice, "seat_no", "seatNo", 0)) === mySeatNo);
  const myAqueductChoice = pendingAqueductChoices.find((choice) => Number(get(choice, "seat_no", "seatNo", 0)) === mySeatNo);
  const spyTargetPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === pendingSpyTargetSeatNo);
  const revealedSpyCards = get(spyTargetPlayer, "progress_cards", "progressCards", []);
  const selectedSpyCard = revealedSpyCards.find((card) => card.id === selectedSpyCardId);
  const masterMerchantTargetPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === pendingMasterMerchantTargetSeatNo);
  const masterMerchantTargetResources = get(masterMerchantTargetPlayer, "resources", "resources", {});
  const masterMerchantTargetCommodities = get(masterMerchantTargetPlayer, "commodities", "commodities", {});
  const masterMerchantTotal = Object.values(masterMerchantResources).reduce((sum, value) => sum + Number(value || 0), 0)
    + Object.values(masterMerchantCommodities).reduce((sum, value) => sum + Number(value || 0), 0);
  const goldRequired = Number(get(myGoldChoice, "amount", "amount", 0));
  const goldTotal = Object.values(goldForm).reduce((sum, value) => sum + Number(value || 0), 0);
  const bankAvailableFor = (resource, amount = 1) => {
    const bankCount = resourceBank?.[resource];
    return bankCount == null || Number(bankCount) >= amount;
  };
  const resourceRequestWithinBank = (values) => catanResourceKeys.every((key) => bankAvailableFor(key, Number(values?.[key] || 0)));
  const yearOfPlentyRequest = useMemo(() => {
    if (!tradeForm.give || !tradeForm.receive) {
      return {};
    }
    return [tradeForm.give, tradeForm.receive].reduce((acc, resource) => {
      if (catanResourceKeys.includes(resource)) {
        acc[resource] = Number(acc[resource] || 0) + 1;
      }
      return acc;
    }, {});
  }, [tradeForm.give, tradeForm.receive]);
  const yearOfPlentyWithinBank = resourceRequestWithinBank(yearOfPlentyRequest);
  const goldChoiceWithinBank = resourceRequestWithinBank(goldForm);
  const aqueductWithinBank = bankAvailableFor(selectedAqueductResourceType, 1);
  const selectedDevCard = playableDevelopmentCards.find((card) => card.id === selectedCardId);
  const selectedDevCardPurchasedTurnNo = Number(get(selectedDevCard, "purchased_turn_no", "purchasedTurnNo", 0));
  const canPlaySelectedDevelopmentCard = myTurn
    && Boolean(selectedDevCard)
    && !devCardAlreadyPlayedThisTurn
    && selectedDevCardPurchasedTurnNo < turnNo
    && (
      (selectedDevCard?.type === "YEAR_OF_PLENTY" && yearOfPlentyWithinBank)
      || selectedDevCard?.type === "MONOPOLY"
      || (selectedDevCard?.type === "KNIGHT" && Boolean(selectedHexId))
      || (selectedDevCard?.type === "ROAD_BUILDING" && roadCardEdges.length > 0)
    );
  const selectedProgressCard = progressCards.find((card) => card.id === selectedProgressCardId);
  const selectedProgressType = get(selectedProgressCard, "type", "type", "");
  const selectedProgressSupported = playableProgressTypes.has(selectedProgressType);
  const selectedProgressBlockedByRobberLock = selectedProgressType === "BISHOP" && citiesKnightsRobberLocked;
  const actionProgressCards = useMemo(
    () => progressCards.filter((card) => {
      const cardType = get(card, "type", "type", "");
      return playableProgressTypes.has(cardType) && cardType !== "ALCHEMIST" && !catanProgressVictoryTypes.has(cardType);
    }),
    [progressCards]
  );
  const passiveProgressVictoryCards = progressCards.filter((card) => catanProgressVictoryTypes.has(get(card, "type", "type", "")));
  const sevenDiscardMessage = explorersPiratesRule
    ? "7이 나왔습니다. 손패가 8장 이상인 플레이어는 절반을 버린 뒤 해적선을 이동합니다."
    : citiesKnightsRobberLocked
      ? "7이 나왔습니다. 손패가 8장 이상인 플레이어는 절반을 버리고, 첫 야만인 침공 전이라 도적 이동 없이 행동을 이어갑니다."
      : "7이 나왔습니다. 손패가 8장 이상인 플레이어는 절반을 버린 뒤 도적을 이동합니다.";
  const nonVictoryProgressCards = progressCards.filter((card) => !catanProgressVictoryTypes.has(get(card, "type", "type", "")));
  const selectedDiscardProgressCardId = nonVictoryProgressCards.some((card) => card.id === selectedProgressCardId)
    ? selectedProgressCardId
    : nonVictoryProgressCards[0]?.id || "";
  const progressDiscardRequired = Math.max(0, nonVictoryProgressCards.length - 4);
  const mustDiscardProgress = pendingProgressDiscardSeatNos.map(Number).includes(mySeatNo);
  const alchemistCards = progressCards.filter((card) => get(card, "type", "type", "") === "ALCHEMIST");
  const selectedAlchemistCardId = selectedProgressType === "ALCHEMIST" ? selectedProgressCardId : alchemistCards[0]?.id || "";
  const catanTradeCardLabels = useMemo(
    () => Object.fromEntries(citiesKnightsRule ? [...catanResourceEntries, ...Object.entries(catanCommodityLabels)] : catanResourceEntries),
    [citiesKnightsRule]
  );
  const catanTradeCardEntries = useMemo(() => Object.entries(catanTradeCardLabels), [catanTradeCardLabels]);
  const tradeRatioFor = (cardType) => {
    let ratio = 4;
    if (merchantFleetSeatNo === mySeatNo && cardType === merchantFleetCardType) {
      ratio = 2;
    }
    if (merchantSeatNo === mySeatNo && cardType === merchantResourceType) {
      ratio = 2;
    }
    vertices.forEach((vertex) => {
      if (Number(get(vertex, "owner_seat_no", "ownerSeatNo", 0)) !== mySeatNo) {
        return;
      }
      const portType = get(vertex, "port_type", "portType", "");
      if (portType === "ANY") {
        ratio = Math.min(ratio, 3);
      } else if (portType && portType === cardType) {
        ratio = Math.min(ratio, 2);
      }
    });
    return ratio;
  };
  const giveTradeRatio = tradeRatioFor(tradeForm.give);
  const tradeGiveCount = catanResourceKeys.includes(tradeForm.give)
    ? Number(resources?.[tradeForm.give] || 0)
    : Number(commodities?.[tradeForm.give] || 0);
  const maritimeReceiveWithinBank = !catanResourceKeys.includes(tradeForm.receive) || bankAvailableFor(tradeForm.receive, 1);
  const canMaritimeTrade = myTurn && tradeForm.give !== tradeForm.receive && tradeGiveCount >= giveTradeRatio && maritimeReceiveWithinBank;
  const canBuyDevelopmentCard = myTurn
    && !citiesKnightsRule
    && !explorersPiratesRule
    && Number(resources?.GRAIN || 0) >= 1
    && Number(resources?.WOOL || 0) >= 1
    && Number(resources?.ORE || 0) >= 1;
  const canAffordCatanCost = (cost) => Object.entries(cost || {}).every(([key, amount]) => Number(resources?.[key] || 0) >= Number(amount || 0));
  const canAffordRoad = canAffordCatanCost({ BRICK: 1, LUMBER: 1 });
  const canAffordShip = seafarersRule && canAffordCatanCost({ LUMBER: 1, WOOL: 1 });
  const canAffordSettlement = canAffordCatanCost({ BRICK: 1, LUMBER: 1, WOOL: 1, GRAIN: 1 });
  const canAffordCity = canAffordCatanCost({ GRAIN: 2, ORE: 3 });
  const canAffordDevelopment = canAffordCatanCost({ GRAIN: 1, WOOL: 1, ORE: 1 });
  const catanBuildSignals = [
    {
      key: "road",
      label: seafarersRule ? "도로/배" : "도로",
      affordable: canAffordRoad || canAffordShip,
      ready: myTurn && phase === "ACTION" && (canAffordRoad || canAffordShip),
      cost: seafarersRule ? "도로: 벽돌+목재 · 배: 목재+양털" : "벽돌 1 + 목재 1",
      detail: canAffordRoad || canAffordShip ? "연결 후보를 보드에서 고르면 확장 경로를 만들 수 있습니다." : "초반 확장은 벽돌, 목재, 양털 확보가 핵심입니다.",
    },
    {
      key: "settlement",
      label: explorersPiratesRule ? "정착지/항구" : "마을",
      affordable: canAffordSettlement,
      ready: myTurn && phase === "ACTION" && canAffordSettlement,
      cost: "벽돌 1 + 목재 1 + 양털 1 + 곡물 1",
      detail: canAffordSettlement ? "빈 정점을 선택하면 생산 기반을 넓힐 준비가 됐습니다." : "네 자원을 한 벌로 모으면 다음 생산 거점이 열립니다.",
    },
    {
      key: "city",
      label: "도시",
      affordable: canAffordCity,
      ready: myTurn && phase === "ACTION" && canAffordCity,
      cost: "곡물 2 + 광석 3",
      detail: canAffordCity ? "기존 마을을 도시로 키워 생산과 승점을 동시에 올릴 수 있습니다." : "곡물과 광석이 모이면 승점 압박이 크게 올라갑니다.",
    },
    {
      key: "card",
      label: citiesKnightsRule ? "진행 카드" : explorersPiratesRule ? "미션 보상" : "개발 카드",
      affordable: citiesKnightsRule ? actionProgressCards.length > 0 : canAffordDevelopment,
      ready: citiesKnightsRule ? myTurn && phase === "ACTION" && actionProgressCards.length > 0 : canBuyDevelopmentCard,
      cost: citiesKnightsRule ? `사용 가능 진행 카드 ${actionProgressCards.length}장` : explorersPiratesRule ? "어장·향신료·해적 소굴 진행" : "곡물 1 + 양털 1 + 광석 1",
      detail: citiesKnightsRule
        ? "진행 카드는 현재 단계와 대상 조건을 함께 확인해야 합니다."
        : explorersPiratesRule
          ? "미션 토큰과 화물 전달 상태가 승점으로 이어지는지 보드에서 확인하세요."
          : canAffordDevelopment ? "주사위 전후 카드 사용 타이밍을 확인하세요." : "곡물, 양털, 광석 조합이 카드 선택지를 만듭니다.",
    },
  ];
  const catanScoreRace = catanPlayers
    .map((player) => {
      const seatNo = Number(get(player, "seat_no", "seatNo", 0));
      const victoryPoints = Number(get(player, "victory_points", "victoryPoints", 0));
      const publicVictoryPoints = Number(get(player, "public_victory_points", "publicVictoryPoints", victoryPoints));
      const points = seatNo === mySeatNo ? victoryPoints : publicVictoryPoints;
      return {
        seatNo,
        name: playerName(seatNo),
        points,
        target: winningPoints,
        progress: Math.max(0, Math.min(100, Math.round((points / Math.max(1, winningPoints)) * 100))),
        isMe: seatNo === mySeatNo,
      };
    })
    .filter((player) => player.seatNo)
    .sort((a, b) => b.points - a.points || (b.isMe ? 1 : 0))
    .slice(0, 4);
  const catanVictoryTrackRows = catanPlayers
    .map((player) => {
      const seatNo = Number(get(player, "seat_no", "seatNo", 0));
      const victoryPoints = Number(get(player, "victory_points", "victoryPoints", 0));
      const publicVictoryPoints = Number(get(player, "public_victory_points", "publicVictoryPoints", victoryPoints));
      const visiblePoints = seatNo === mySeatNo ? victoryPoints : publicVictoryPoints;
      const developmentVictoryPoints = Number(get(player, "development_victory_points", "developmentVictoryPoints", 0));
      const bonusCount = [
        Boolean(get(player, "has_longest_road", "hasLongestRoad", false)),
        Boolean(get(player, "has_largest_army", "hasLargestArmy", false)),
        Number(get(player, "special_victory_points", "specialVictoryPoints", 0)) > 0,
        Number(get(player, "mission_victory_points", "missionVictoryPoints", 0)) > 0,
        Number(get(player, "defender_points", "defenderPoints", 0)) > 0,
        (get(player, "metropolis_types", "metropolisTypes", []) || []).length > 0,
      ].filter(Boolean).length;
      return {
        seatNo,
        name: playerName(seatNo),
        visiblePoints,
        publicVictoryPoints,
        hiddenPoints: seatNo === mySeatNo ? Math.max(0, victoryPoints - publicVictoryPoints) + developmentVictoryPoints : 0,
        remaining: Math.max(0, winningPoints - visiblePoints),
        progress: Math.max(0, Math.min(100, Math.round((visiblePoints / Math.max(1, winningPoints)) * 100))),
        bonusCount,
        isMe: seatNo === mySeatNo,
      };
    })
    .filter((player) => player.seatNo)
    .sort((a, b) => b.visiblePoints - a.visiblePoints || b.bonusCount - a.bonusCount || (b.isMe ? 1 : 0));
  const catanTradeSummary = canMaritimeTrade
    ? `${catanTradeCardLabels[tradeForm.give] || tradeForm.give} ${giveTradeRatio}:1 교환 가능`
    : `${catanTradeCardLabels[tradeForm.give] || tradeForm.give} ${tradeGiveCount}/${giveTradeRatio}장`;
  const catanDiceFaces = Array.isArray(dice)
    ? dice.map((item) => Number(typeof item === "object" ? get(item, "value", "value", 0) : item)).filter((value) => value > 0)
    : [];
  const catanProductionSummary = useMemo(() => {
    if (!lastRoll || lastRoll === 7) return [];
    const counts = {};
    hexes.forEach((hex) => {
      const token = Number(get(hex, "number_token", "numberToken", 0));
      if (token !== lastRoll) return;
      if (Number(hex.id) === robberHexId) return;
      const terrainKey = String(get(hex, "terrain", "terrain", "") || "").toUpperCase();
      const resourceKey = catanTerrainResourceType[terrainKey];
      if (!resourceKey || !catanResourceKeys.includes(resourceKey)) return;
      counts[resourceKey] = Number(counts[resourceKey] || 0) + 1;
    });
    return catanResourceKeys
      .map((key) => ({ key, label: catanResourceLabels[key], count: Number(counts[key] || 0) }))
      .filter((item) => item.count > 0);
  }, [hexes, lastRoll, robberHexId]);
  const positiveResourceMap = (values) => Object.fromEntries(
    catanResourceKeys
      .map((key) => [key, Math.max(0, Number(values?.[key] || 0))])
      .filter(([, value]) => value > 0)
  );
  const resourceMapTotal = (values) => Object.values(values || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
  const resourceBundleLabel = (values) => {
    const entries = Object.entries(values || {}).filter(([, value]) => Number(value || 0) > 0);
    if (!entries.length) return "없음";
    return entries.map(([key, value]) => `${catanResourceLabels[key] || key} ${value}`).join(", ");
  };
  const pendingTradeOffer = get(pendingDomesticTrade, "offer_resources", "offerResources", {});
  const pendingTradeRequest = get(pendingDomesticTrade, "request_resources", "requestResources", {});
  const pendingTradeProposerSeatNo = Number(get(pendingDomesticTrade, "proposer_seat_no", "proposerSeatNo", 0));
  const pendingTradeTargetSeatNo = Number(get(pendingDomesticTrade, "target_seat_no", "targetSeatNo", 0));
  const domesticOfferTotal = resourceMapTotal(domesticOfferForm);
  const domesticRequestTotal = resourceMapTotal(domesticRequestForm);
  const domesticOfferExceeded = catanResourceKeys.some((key) => Number(domesticOfferForm[key] || 0) > Number(resources?.[key] || 0));
  const richerPlayers = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "victory_points", "victoryPoints", 0)) > Number(get(myPlayer, "victory_points", "victoryPoints", 0)))
    .filter((player) => Number(get(player, "resource_count", "resourceCount", 0)) + Number(get(player, "commodity_count", "commodityCount", 0)) > 0);
  const spyTargets = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "progress_card_count", "progressCardCount", 0)) > 0);
  const deserterTargets = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => vertices.some((vertex) => Number(get(vertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0)) === Number(get(player, "seat_no", "seatNo", 0))));
  const selectedVertex = selectedVertexId ? vertexById.get(Number(selectedVertexId)) : null;
  const selectedEdge = selectedEdgeId ? edgeById.get(Number(selectedEdgeId)) : null;
  const selectedHexTerrain = get(selectedHex, "terrain", "terrain", "");
  const selectedHexToken = Number(get(selectedHex, "number_token", "numberToken", 0));
  const selectedHexMissionType = get(selectedHex, "mission_type", "missionType", "");
  const selectedHexBarbarianCount = Number(get(selectedHex, "barbarian_count", "barbarianCount", 0));
  const selectedVertexOwner = Number(get(selectedVertex, "owner_seat_no", "ownerSeatNo", 0));
  const selectedVertexBuilding = get(selectedVertex, "building_type", "buildingType", "");
  const selectedVertexPortType = get(selectedVertex, "port_type", "portType", "");
  const selectedClothVillage = selectedVertex ? clothVillageByVertexId.get(Number(selectedVertex.id)) : null;
  const selectedEdgeOwner = Number(get(selectedEdge, "owner_seat_no", "ownerSeatNo", 0));
  const selectedEdgeRouteType = get(selectedEdge, "route_type", "routeType", "");
  const selectedEdgeCargoLabel = cargoLabelOf(selectedEdge);
  const selectedKnightOwner = Number(get(selectedVertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
  const selectedOwnKnight = selectedKnightOwner === mySeatNo;
  const selectedKnightLevel = Number(get(selectedVertex, "knight_level", "knightLevel", 0));
  const selectedKnightActive = Boolean(get(selectedVertex, "knight_active", "knightActive", false));
  const selectedKnightActivatedTurnNo = Number(get(selectedVertex, "knight_activated_turn_no", "knightActivatedTurnNo", 0));
  const selectedKnightHexIds = get(selectedVertex, "hex_ids", "hexIds", []) || [];
  const selectedKnightTouchesRobber = selectedKnightHexIds.map(Number).includes(robberHexId);
  const selectedVertexTouchesOwnRoute = Boolean(selectedVertex)
    && (get(selectedVertex, "edge_ids", "edgeIds", []) || []).some((edgeId) => {
      const edge = edgeById.get(Number(edgeId));
      return edge && Number(get(edge, "owner_seat_no", "ownerSeatNo", 0)) === mySeatNo;
    });
  const remainingKnightCount = Number(get(myPlayer, "remaining_knights", "remainingKnights", 0));
  const selectedVertexKnightBuildWarning = !selectedVertex
    ? ""
    : selectedVertexOwner || selectedKnightOwner
      ? "이미 건물이나 기사가 있는 교차점에는 기사를 배치할 수 없습니다."
      : !selectedVertexTouchesOwnRoute
        ? "기사는 내 도로망에 닿은 빈 교차점에만 배치할 수 있습니다."
        : remainingKnightCount <= 0
          ? "남은 기사 말이 없습니다."
          : "";
  const selectedVertexCanBuildKnight = Boolean(selectedVertex)
    && !selectedVertexKnightBuildWarning;
  const selectedBuildActionDisabled = !myTurn
    || (buildMode === "KNIGHT" && selectedVertex && !selectedVertexCanBuildKnight);
  const hasFortress = Number(cityImprovements?.POLITICS || 0) >= 3;
  const canPromoteKnightLevel = (level) => level > 0 && level < 3 && (level < 2 || hasFortress);
  const selectedKnightCanPromote = selectedOwnKnight && canPromoteKnightLevel(selectedKnightLevel);
  const smithEligibleKnightCount = vertices.filter((vertex) => Number(get(vertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0)) === mySeatNo)
    .filter((vertex) => canPromoteKnightLevel(Number(get(vertex, "knight_level", "knightLevel", 0))))
    .length;
  const selectedProgressBlockedByFortress = selectedProgressType === "SMITH" && smithEligibleKnightCount <= 0;
  const knightMoveSource = knightMoveSourceId ? vertexById.get(Number(knightMoveSourceId)) : null;
  const knightMoveSourceOwner = Number(get(knightMoveSource, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
  const knightMoveSourceActive = Boolean(get(knightMoveSource, "knight_active", "knightActive", false));
  const knightMoveSourceActivatedTurnNo = Number(get(knightMoveSource, "knight_activated_turn_no", "knightActivatedTurnNo", 0));
  const knightMoveSourceLevel = Number(get(knightMoveSource, "knight_level", "knightLevel", 0));
  const knightMoveSourceLabel = knightMoveSource
    ? [
        `${playerName(knightMoveSourceOwner)} 기사 ${knightMoveSourceLevel}`,
        knightMoveSourceActive ? "활성" : "비활성",
      ].join(" · ")
    : "미지정";
  const selectedHexCanReceiveRobber = Boolean(selectedHex)
    && selectedHex.terrain !== "SEA"
    && Number(get(selectedHex, "number_token", "numberToken", 0)) > 0
    && Number(selectedHex.id) !== robberHexId;
  const selectedVertexCanReceiveKnight = Boolean(selectedVertex)
    && Number(selectedVertex.id) !== Number(knightMoveSourceId)
    && !get(selectedVertex, "owner_seat_no", "ownerSeatNo", null);
  const selectedKnightMoveTargetOwner = Number(get(selectedVertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
  const selectedKnightMoveTargetLevel = Number(get(selectedVertex, "knight_level", "knightLevel", 0));
  const selectedKnightDestinationReachable = useMemo(() => {
    if (!knightMoveSource || !selectedVertex || !knightMoveSourceOwner) return false;
    const sourceId = Number(knightMoveSource.id);
    const destinationId = Number(selectedVertex.id);
    if (!sourceId || !destinationId || sourceId === destinationId) return false;
    const visited = new Set([sourceId]);
    const frontier = [sourceId];
    while (frontier.length) {
      const currentId = frontier.shift();
      if (currentId === destinationId) return true;
      const current = vertexById.get(Number(currentId));
      if (!current) continue;
      if (currentId !== sourceId) {
        const currentOwner = Number(get(current, "owner_seat_no", "ownerSeatNo", 0));
        const currentKnightOwner = Number(get(current, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
        if ((currentOwner && currentOwner !== knightMoveSourceOwner) || (currentKnightOwner && currentKnightOwner !== knightMoveSourceOwner)) {
          continue;
        }
      }
      const currentEdgeIds = get(current, "edge_ids", "edgeIds", []) || [];
      currentEdgeIds.forEach((edgeId) => {
        const edge = edgeById.get(Number(edgeId));
        if (!edge || Number(get(edge, "owner_seat_no", "ownerSeatNo", 0)) !== knightMoveSourceOwner) return;
        const vertexAId = Number(get(edge, "vertex_aid", "vertexAId", 0));
        const vertexBId = Number(get(edge, "vertex_bid", "vertexBId", 0));
        const nextId = vertexAId === currentId ? vertexBId : vertexBId === currentId ? vertexAId : 0;
        if (nextId && !visited.has(nextId)) {
          visited.add(nextId);
          frontier.push(nextId);
        }
      });
    }
    return false;
  }, [edgeById, knightMoveSource, knightMoveSourceOwner, selectedVertex, vertexById]);
  const selectedKnightCanMove = knightMoveSourceOwner === mySeatNo
    && knightMoveSourceActive
    && knightMoveSourceActivatedTurnNo !== turnNo
    && selectedVertexCanReceiveKnight
    && selectedKnightDestinationReachable
    && (selectedKnightMoveTargetOwner === 0 || (selectedKnightMoveTargetOwner !== mySeatNo && selectedKnightMoveTargetLevel < knightMoveSourceLevel));
  const selectedKnightCanChaseRobber = selectedOwnKnight
    && selectedKnightActive
    && selectedKnightActivatedTurnNo !== turnNo
    && selectedKnightTouchesRobber
    && selectedHexCanReceiveRobber
    && !citiesKnightsRobberLocked;
  const selectedTargetSummaryItems = [];
  if (selectedHex) {
    const producedResource = catanResourceByTerrain[selectedHexTerrain];
    const hexDetails = [
      catanTerrain[selectedHexTerrain]?.label || selectedHexTerrain || "타일",
      selectedHexToken > 0 ? `숫자 ${selectedHexToken}` : "숫자 없음",
    ];
    if (producedResource) hexDetails.push(`생산 ${catanResourceLabels[producedResource] || producedResource}`);
    if (!Boolean(get(selectedHex, "discovered", "discovered", true))) hexDetails.push("미발견");
    if (robberHexId === Number(selectedHex.id)) hexDetails.push("도적");
    if (pirateHexId === Number(selectedHex.id)) hexDetails.push("해적");
    if (selectedHexMissionType) hexDetails.push(catanMissionLabels[selectedHexMissionType] || selectedHexMissionType);
    if (selectedHexBarbarianCount > 0) hexDetails.push(`야만인 ${selectedHexBarbarianCount}`);

    selectedTargetSummaryItems.push({
      key: "hex",
      label: "선택 타일",
      value: hexDetails.join(" · "),
      tone: "border-sky-100 bg-sky-50 text-sky-700",
    });
  }
  if (selectedEdge) {
    const edgeDetails = [
      selectedEdgeRouteType ? catanRouteLabels[selectedEdgeRouteType] || selectedEdgeRouteType : "빈 간선",
    ];
    if (selectedEdgeOwner) edgeDetails.unshift(playerName(selectedEdgeOwner));
    if (Boolean(get(selectedEdge, "bridge_site", "bridgeSite", false)) && selectedEdgeRouteType !== "BRIDGE") edgeDetails.push("다리 자리");
    if (Boolean(get(selectedEdge, "camel", "camel", false))) edgeDetails.push("낙타");
    if (selectedEdgeCargoLabel !== "없음") edgeDetails.push(`화물 ${selectedEdgeCargoLabel}`);
    if (councilDockEdgeIds.map(Number).includes(Number(selectedEdge.id))) edgeDetails.push("의회 선착장");
    if (get(selectedEdge, "forgotten_tribe_gift_type", "forgottenTribeGiftType", "")) edgeDetails.push("부족 선물");

    selectedTargetSummaryItems.push({
      key: "edge",
      label: "선택 간선",
      value: edgeDetails.join(" · "),
      tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
    });
  }
  if (selectedVertex) {
    const vertexDetails = [
      selectedVertexOwner
        ? `${playerName(selectedVertexOwner)} ${catanBuildingLabels[selectedVertexBuilding] || selectedVertexBuilding || "건물"}`
        : "빈 교차점",
    ];
    if (selectedVertexPortType) {
      vertexDetails.push(selectedVertexPortType === "ANY" ? "항구 3:1" : `${catanResourceLabels[selectedVertexPortType] || selectedVertexPortType} 항구 2:1`);
    }
    if (Boolean(get(selectedVertex, "city_wall", "cityWall", false))) vertexDetails.push("성벽");
    if (selectedKnightOwner) vertexDetails.push(`${playerName(selectedKnightOwner)} 기사 ${selectedKnightLevel}${selectedKnightActive ? " 활성" : " 비활성"}`);
    const vertexCargoLabel = cargoLabelOf(selectedVertex);
    if (vertexCargoLabel !== "없음") vertexDetails.push(`화물 ${vertexCargoLabel}`);
    if (selectedClothVillage) {
      const connectedSeatNos = get(selectedClothVillage, "connected_seat_nos", "connectedSeatNos", []) || [];
      const connectedText = connectedSeatNos.length ? connectedSeatNos.map(playerName).join(", ") : "없음";
      vertexDetails.push(`부족 마을 ${get(selectedClothVillage, "number_token", "numberToken", "-")} · 직물 ${get(selectedClothVillage, "supply", "supply", 0)}개 · 연결 ${connectedText}`);
    }

    selectedTargetSummaryItems.push({
      key: "vertex",
      label: "선택 교차점",
      value: vertexDetails.join(" · "),
      tone: "border-amber-100 bg-amber-50 text-amber-700",
    });
  }
  const hasSelectedTarget = selectedTargetSummaryItems.length > 0;
  const mySpiceAdvantageCounts = useMemo(() => {
    const counts = { SWIFT_VOYAGE: 0, PIRATE_BONUS: 0, FAST_GOLD: 0 };
    hexes.forEach((hex) => {
      const missionType = get(hex, "mission_type", "missionType", "");
      const advantageType = get(hex, "spice_advantage_type", "spiceAdvantageType", "");
      const crewSeatNos = get(hex, "crew_seat_nos", "crewSeatNos", []) || [];
      if (missionType === "SPICE" && counts[advantageType] !== undefined && crewSeatNos.map(Number).includes(mySeatNo)) {
        counts[advantageType] += 1;
      }
    });
    return counts;
  }, [hexes, mySeatNo]);
  const fastGoldUsed = Number(get(myPlayer, "fast_gold_sales_turn_no", "fastGoldSalesTurnNo", -1)) === turnNo
    ? Number(get(myPlayer, "fast_gold_sales_this_turn", "fastGoldSalesThisTurn", 0))
    : 0;
  const fastGoldRemaining = Math.max(0, mySpiceAdvantageCounts.FAST_GOLD - fastGoldUsed);
  const shipMoveMaxSteps = 4 + mySpiceAdvantageCounts.SWIFT_VOYAGE;
  const shipMoveMaxEdges = shipMoveMaxSteps + 1;

  useEffect(() => {
    if (!playableDevelopmentCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(playableDevelopmentCards[0]?.id || "");
    }
  }, [playableDevelopmentCards, selectedCardId]);

  useEffect(() => {
    const selectableProgressCards = phase === "ACTION" ? actionProgressCards : progressCards;
    if (!selectableProgressCards.some((card) => card.id === selectedProgressCardId)) {
      setSelectedProgressCardId(selectableProgressCards[0]?.id || "");
    }
  }, [actionProgressCards, phase, progressCards, selectedProgressCardId]);

  useEffect(() => {
    setRoadCardEdges([]);
  }, [selectedProgressType, selectedDevCard?.type]);

  useEffect(() => {
    if (revealedSpyCards.some((card) => card.id === selectedSpyCardId)) {
      return;
    }
    setSelectedSpyCardId(revealedSpyCards[0]?.id || "");
  }, [revealedSpyCards, selectedSpyCardId]);

  useEffect(() => {
    if (catanTradeCardLabels[tradeForm.give] && catanTradeCardLabels[tradeForm.receive]) {
      return;
    }
    setTradeForm({
      give: catanTradeCardLabels[tradeForm.give] ? tradeForm.give : "BRICK",
      receive: catanTradeCardLabels[tradeForm.receive] ? tradeForm.receive : "LUMBER",
    });
  }, [catanTradeCardLabels, tradeForm.give, tradeForm.receive]);

  useEffect(() => {
    if (selectedProgressType === "MASTER_MERCHANT" || selectedProgressType === "SPY" || selectedProgressType === "DESERTER") {
      return;
    }
    if (!robberTargets.some((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(targetSeatNo))) {
      setTargetSeatNo(robberTargets[0] ? String(get(robberTargets[0], "seat_no", "seatNo", "")) : "");
    }
  }, [robberTargets, targetSeatNo, selectedProgressType]);

  const setupBuild = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      notifyError("정착지와 도로 위치를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "SETUP_BUILD", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
    setSelectedVertexId(null);
    setSelectedEdgeId(null);
  };

  const build = async () => {
    if (buildMode === "ROAD") {
      if (!selectedEdgeId) {
        notifyError("도로 위치를 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_ROAD", edge_id: selectedEdgeId });
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "BRIDGE") {
      if (!selectedEdgeId) {
        notifyError("다리를 놓을 강 간선을 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_BRIDGE", edge_id: selectedEdgeId });
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "SHIP") {
      if (!selectedEdgeId) {
        notifyError("배를 놓을 해상 간선을 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_SHIP", edge_id: selectedEdgeId });
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "MOVE_SHIP") {
      const path = explorersPiratesRule && shipMovePath.length >= 2 ? shipMovePath : [shipMoveFromEdgeId, selectedEdgeId].filter(Boolean);
      if (path.length < 2) {
        notifyError("이동할 배와 새 해상 간선을 선택해주세요.");
        return;
      }
      await onAction({ action_type: "MOVE_SHIP", edge_ids: path });
      setShipMoveFromEdgeId(null);
      setShipMovePath([]);
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "KNIGHT") {
      if (!selectedVertexId) {
        notifyError("기사를 놓을 교차점을 선택해주세요.");
        return;
      }
      if (!selectedVertexCanBuildKnight) {
        notifyError(selectedVertexKnightBuildWarning || "기사 배치 조건을 확인해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_KNIGHT", vertex_id: selectedVertexId });
      setSelectedVertexId(null);
      return;
    }
    if (buildMode === "CITY_WALL") {
      if (!selectedVertexId) {
        notifyError("성벽을 세울 도시를 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_CITY_WALL", vertex_id: selectedVertexId });
      setSelectedVertexId(null);
      return;
    }
    if (!selectedVertexId) {
      notifyError("교차점을 선택해주세요.");
      return;
    }
    const actionType = buildMode === "CITY"
      ? "BUILD_CITY"
      : buildMode === "HARBOR_SETTLEMENT"
        ? "BUILD_HARBOR_SETTLEMENT"
        : "BUILD_SETTLEMENT";
    await onAction({ action_type: actionType, vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const moveRobber = async () => {
    if (!selectedHexId) {
      notifyError(explorersPiratesRule ? "해적을 보낼 바다 칸을 선택해주세요." : "도적을 옮길 타일을 선택해주세요.");
      return;
    }
    if (explorersPiratesRule && selectedHex?.terrain !== "SEA") {
      notifyError("E&P에서는 도적 대신 해적선을 바다 칸에 놓습니다.");
      return;
    }
    if (citiesKnightsRobberLocked) {
      notifyError("첫 야만인 침공 전에는 도적을 이동하지 않습니다.");
      return;
    }
    await onAction({
      action_type: selectedHex?.terrain === "SEA" ? "MOVE_PIRATE" : "MOVE_ROBBER",
      hex_id: selectedHexId,
      target_seat_no: targetSeatNo ? Number(targetSeatNo) : null,
    });
    setSelectedHexId(null);
    setTargetSeatNo("");
  };

  const maritimeTrade = async () => {
    if (tradeForm.give === tradeForm.receive) {
      notifyError("서로 다른 자원을 선택해주세요.");
      return;
    }
    if (!maritimeReceiveWithinBank) {
      notifyError("은행에 받을 자원이 부족합니다.");
      return;
    }
    await onAction({ action_type: "MARITIME_TRADE", resource_type: tradeForm.give, target_resource_type: tradeForm.receive });
  };

  const proposeDomesticTrade = async () => {
    const target = Number(domesticTradeTargetSeatNo);
    const offerResources = positiveResourceMap(domesticOfferForm);
    const requestResources = positiveResourceMap(domesticRequestForm);
    if (!target) {
      notifyError("거래할 플레이어를 선택해주세요.");
      return;
    }
    if (resourceMapTotal(offerResources) <= 0 || resourceMapTotal(requestResources) <= 0) {
      notifyError("줄 자원과 받을 자원을 각각 1개 이상 입력해주세요.");
      return;
    }
    if (domesticOfferExceeded) {
      notifyError("내가 가진 자원보다 많이 제안할 수 없습니다.");
      return;
    }
    await onAction({
      action_type: "PROPOSE_TRADE",
      target_seat_no: target,
      resources: offerResources,
      target_resources: requestResources,
    });
    setDomesticOfferForm(emptyCatanResourceCounts());
    setDomesticRequestForm(emptyCatanResourceCounts());
  };

  const respondDomesticTrade = async (actionType) => {
    await onAction({ action_type: actionType });
  };

  const buildSettler = async () => {
    const vertexBuilding = get(selectedVertex, "building_type", "buildingType", "");
    const edgeRoute = get(selectedEdge, "route_type", "routeType", "");
    if (vertexBuilding === "HARBOR_SETTLEMENT") {
      await onAction({ action_type: "BUILD_SETTLER", vertex_id: selectedVertexId });
      return;
    }
    if (edgeRoute === "SHIP") {
      await onAction({ action_type: "BUILD_SETTLER", edge_id: selectedEdgeId });
      return;
    }
    notifyError("항구 정착지나 빈 배를 선택해주세요.");
  };

  const loadSettler = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      notifyError("정착민이 있는 항구와 싣고 갈 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "LOAD_SETTLER", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
  };

  const buildCrew = async () => {
    const vertexBuilding = get(selectedVertex, "building_type", "buildingType", "");
    const edgeRoute = get(selectedEdge, "route_type", "routeType", "");
    if (vertexBuilding === "HARBOR_SETTLEMENT") {
      await onAction({ action_type: "BUILD_CREW", vertex_id: selectedVertexId });
      return;
    }
    if (edgeRoute === "SHIP") {
      await onAction({ action_type: "BUILD_CREW", edge_id: selectedEdgeId });
      return;
    }
    notifyError("승무원을 놓을 항구 정착지나 항구와 닿은 배를 선택해주세요.");
  };

  const unloadCrewToPirateLair = async () => {
    if (!selectedHexId || !selectedEdgeId) {
      notifyError("해적 소굴과 승무원이 탄 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "UNLOAD_CREW_TO_PIRATE_LAIR", hex_id: selectedHexId, edge_id: selectedEdgeId });
  };

  const rollFishHaul = async () => {
    await onAction({ action_type: "ROLL_FISH_HAUL" });
  };

  const catchFish = async () => {
    if (!selectedHexId || !selectedEdgeId) {
      notifyError("어획물이 있는 어장과 비어 있는 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "CATCH_FISH", hex_id: selectedHexId, edge_id: selectedEdgeId });
  };

  const spendFish = async (actionType, extra = {}) => {
    await onAction({ action_type: actionType, ...extra });
  };

  const collectSpice = async () => {
    if (!selectedHexId || !selectedEdgeId) {
      notifyError("향신료 마을과 승무원이 탄 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "COLLECT_SPICE", hex_id: selectedHexId, edge_id: selectedEdgeId });
  };

  const sellResourceForGold = async () => {
    if (fastGoldRemaining <= 0) {
      notifyError("이번 턴에 사용할 빠른 금 이점이 없습니다.");
      return;
    }
    await onAction({ action_type: "SELL_RESOURCE_FOR_GOLD", resource_type: tradeForm.give });
  };

  const spendGoldForResource = async () => {
    if (myGold < 2 || riverGoldTradesRemaining <= 0) {
      notifyError("골드 2개와 남은 교환 횟수를 확인해주세요.");
      return;
    }
    await onAction({ action_type: "SPEND_GOLD_FOR_RESOURCE", resource_type: tradeForm.receive });
  };

  const bidCamel = async () => {
    const wool = Math.max(0, Number(camelBidForm.WOOL) || 0);
    const grain = Math.max(0, Number(camelBidForm.GRAIN) || 0);
    await onAction({ action_type: "BID_CAMEL", resources: { WOOL: wool, GRAIN: grain } });
  };

  const placeCamel = async () => {
    if (!selectedEdgeId) {
      notifyError("낙타를 놓을 경로를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "PLACE_CAMEL", edge_id: selectedEdgeId });
    setSelectedEdgeId(null);
  };

  const recruitBarbarianKnight = async () => {
    if (!selectedDevCard || selectedDevCard.type !== "KNIGHT") {
      notifyError("사용할 기사 개발 카드를 선택해주세요.");
      return;
    }
    if (!selectedEdgeId) {
      notifyError("방어 기사를 놓을 경로를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "RECRUIT_BARBARIAN_KNIGHT", card_ids: [selectedDevCard.id], edge_id: selectedEdgeId });
    setSelectedEdgeId(null);
  };

  const expelBarbarians = async () => {
    if (!selectedHexId) {
      notifyError("격퇴할 야만인 타일을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "EXPEL_BARBARIANS", hex_id: selectedHexId });
    setSelectedHexId(null);
  };

  const chaseAwayPirate = async () => {
    if (!selectedHexId) {
      notifyError("해적을 보낼 바다 칸을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "CHASE_AWAY_PIRATE", hex_id: selectedHexId });
  };

  const transferCargo = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      notifyError("항구 정착지와 맞닿은 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "TRANSFER_CARGO", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
  };

  const deliverCargo = async () => {
    if (!selectedEdgeId) {
      notifyError("의회 선착장에 닿은 화물 실은 배를 선택해주세요.");
      return;
    }
    const cargoType = cargoTypesOf(selectedEdge).find((type) => type === "FISH" || type === "SPICE");
    if (!cargoType) {
      notifyError("납품할 어획물이나 향신료가 실린 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "DELIVER_CARGO", edge_id: selectedEdgeId, resource_type: cargoType });
  };

  const foundSettlementFromShip = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      notifyError("정착민 배와 상륙할 교차점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "FOUND_SETTLEMENT_FROM_SHIP", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
    setSelectedVertexId(null);
    setSelectedEdgeId(null);
  };

  const discardResources = async () => {
    if (discardTotal !== discardRequired) {
      notifyError(`${discardRequired}장을 정확히 버려야 합니다.`);
      return;
    }
    await onAction({ action_type: "DISCARD_RESOURCES", resources: discardForm, commodities: discardCommodityForm });
    setDiscardForm({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
    setDiscardCommodityForm({ PAPER: 0, CLOTH: 0, COIN: 0 });
  };

  const discardProgressCard = async () => {
    const card = nonVictoryProgressCards.find((item) => item.id === selectedDiscardProgressCardId);
    if (!card) {
      notifyError("버릴 진행 카드를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "DISCARD_PROGRESS_CARD", card_ids: [card.id] });
  };

  const chooseGoldResources = async () => {
    if (!myGoldChoice) return;
    if (goldTotal !== goldRequired) {
      notifyError(`${goldRequired}장을 정확히 선택해주세요.`);
      return;
    }
    if (!goldChoiceWithinBank) {
      notifyError("은행에 선택한 자원이 부족합니다.");
      return;
    }
    await onAction({ action_type: "CHOOSE_GOLD_RESOURCE", resources: goldForm });
    setGoldForm({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  };

  const chooseAqueductResource = async () => {
    if (!myAqueductChoice) return;
    if (!aqueductWithinBank) {
      notifyError("은행에 선택한 자원이 부족합니다.");
      return;
    }
    await onAction({ action_type: "CHOOSE_AQUEDUCT_RESOURCE", resource_type: selectedAqueductResourceType });
  };

  const chooseMasterMerchantCards = async () => {
    if (pendingMasterMerchantAttackerSeatNo !== mySeatNo) return;
    if (masterMerchantTotal !== pendingMasterMerchantCount) {
      notifyError(`${pendingMasterMerchantCount}장을 정확히 선택해주세요.`);
      return;
    }
    await onAction({ action_type: "CHOOSE_MASTER_MERCHANT_CARDS", resources: masterMerchantResources, commodities: masterMerchantCommodities });
    setMasterMerchantResources({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
    setMasterMerchantCommodities({ PAPER: 0, CLOTH: 0, COIN: 0 });
  };

  const chooseSpyProgressCard = async () => {
    if (!selectedSpyCard) {
      notifyError("가져올 진행 카드를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "CHOOSE_SPY_PROGRESS_CARD", card_ids: [selectedSpyCard.id] });
  };

  const chooseDefenderProgressCard = async () => {
    if (!mustChooseDefenderProgress) {
      notifyError("방어자 진행 카드를 고를 차례가 아닙니다.");
      return;
    }
    await onAction({ action_type: "CHOOSE_DEFENDER_PROGRESS_CARD", improvement_type: selectedImprovementType });
  };

  const respondWeddingCards = async () => {
    if (!mustRespondWedding) return;
    if (weddingTotal !== weddingRequired) {
      notifyError(`${weddingRequired}장을 정확히 선택해주세요.`);
      return;
    }
    await onAction({ action_type: "RESPOND_WEDDING_CARDS", resources: weddingResources, commodities: weddingCommodities });
    setWeddingResources({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
    setWeddingCommodities({ PAPER: 0, CLOTH: 0, COIN: 0 });
  };

  const buyDevelopmentCard = async () => {
    await onAction({ action_type: "BUY_DEVELOPMENT_CARD" });
  };

  const addRoadCardEdge = () => {
    if (!selectedEdgeId) {
      notifyError("도로 카드로 놓을 간선을 선택해주세요.");
      return;
    }
    setRoadCardEdges((prev) => [...prev.filter((edgeId) => edgeId !== selectedEdgeId), selectedEdgeId].slice(-2));
  };

  const addProgressHex = () => {
    if (!selectedHexId) {
      notifyError("진행 카드에 사용할 타일을 선택해주세요.");
      return;
    }
    setRoadCardEdges((prev) => [...prev.filter((hexId) => hexId !== selectedHexId), selectedHexId].slice(-2));
  };

  const playDevelopmentCard = async () => {
    if (!selectedDevCard) {
      notifyError("사용할 개발 카드를 선택해주세요.");
      return;
    }
    const cardType = selectedDevCard.type;
    const payload = {
      action_type: "PLAY_DEVELOPMENT_CARD",
      card_ids: [selectedDevCard.id],
    };
    if (cardType === "KNIGHT") {
      if (!selectedHexId) {
        notifyError("기사가 이동시킬 도적 타일을 선택해주세요.");
        return;
      }
      payload.hex_id = selectedHexId;
      payload.target_seat_no = targetSeatNo ? Number(targetSeatNo) : null;
    }
    if (cardType === "ROAD_BUILDING") {
      if (!roadCardEdges.length) {
        notifyError("도로 건설 카드로 놓을 간선을 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (cardType === "YEAR_OF_PLENTY") {
      if (!yearOfPlentyWithinBank) {
        notifyError("은행에 선택한 자원이 부족합니다.");
        return;
      }
      payload.resource_type = tradeForm.give;
      payload.target_resource_type = tradeForm.receive;
    }
    if (cardType === "MONOPOLY") {
      payload.resource_type = tradeForm.give;
    }
    await onAction(payload);
    setSelectedHexId(null);
    setTargetSeatNo("");
    setRoadCardEdges([]);
  };

  const playAlchemistCard = async () => {
    if (!selectedAlchemistCardId) {
      notifyError("연금술사 카드를 선택해주세요.");
      return;
    }
    await onAction({
      action_type: "PLAY_PROGRESS_CARD",
      card_ids: [selectedAlchemistCardId],
      anchor_x: Number(alchemistDice.red),
      anchor_y: Number(alchemistDice.white),
    });
  };

  const activateKnight = async () => {
    if (!selectedOwnKnight) {
      notifyError("내 기사를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "ACTIVATE_KNIGHT", vertex_id: selectedVertexId });
  };

  const promoteKnight = async () => {
    if (!selectedOwnKnight) {
      notifyError("내 기사를 선택해주세요.");
      return;
    }
    if (!selectedKnightCanPromote) {
      notifyError("강한 기사를 최강 기사로 승급하려면 정치 3단계 요새가 필요합니다.");
      return;
    }
    await onAction({ action_type: "PROMOTE_KNIGHT", vertex_id: selectedVertexId });
  };

  const markKnightMoveSource = () => {
    if (!selectedOwnKnight) {
      notifyError("이동할 내 기사를 선택해주세요.");
      return;
    }
    if (!selectedKnightActive) {
      notifyError("활성화된 기사만 이동할 수 있습니다.");
      return;
    }
    if (selectedKnightActivatedTurnNo === turnNo) {
      notifyError("이번 턴에 활성화한 기사는 다음 턴부터 행동할 수 있습니다.");
      return;
    }
    setKnightMoveSourceId(selectedVertexId);
    notifySuccess("기사 이동 출발점을 지정했습니다.");
  };

  const moveKnight = async () => {
    if (!knightMoveSourceId) {
      notifyError("이동할 기사의 출발점을 먼저 지정해주세요.");
      return;
    }
    if (!selectedVertexId) {
      notifyError("기사가 이동할 교차점을 선택해주세요.");
      return;
    }
    if (!selectedKnightCanMove) {
      notifyError("내 도로망으로 실제 연결된 빈 교차점이나 더 약한 상대 기사만 선택할 수 있습니다.");
      return;
    }
    await onAction({
      action_type: "MOVE_KNIGHT",
      vertex_id: Number(knightMoveSourceId),
      target_vertex_id: Number(selectedVertexId),
    });
    setKnightMoveSourceId(null);
    setSelectedVertexId(null);
  };

  const chaseRobberWithKnight = async () => {
    if (citiesKnightsRobberLocked) {
      notifyError("첫 야만인 침공 전에는 기사로 도적을 쫓아낼 수 없습니다.");
      return;
    }
    if (!selectedOwnKnight) {
      notifyError("도적과 닿아 있는 내 기사를 선택해주세요.");
      return;
    }
    if (!selectedKnightActive) {
      notifyError("활성화된 기사만 도적을 쫓아낼 수 있습니다.");
      return;
    }
    if (selectedKnightActivatedTurnNo === turnNo) {
      notifyError("이번 턴에 활성화한 기사는 다음 턴부터 행동할 수 있습니다.");
      return;
    }
    if (!selectedKnightTouchesRobber) {
      notifyError("도적과 닿아 있는 기사를 선택해주세요.");
      return;
    }
    if (!selectedHexCanReceiveRobber) {
      notifyError("도적을 옮길 숫자 타일을 선택해주세요.");
      return;
    }
    await onAction({
      action_type: "CHASE_ROBBER_WITH_KNIGHT",
      vertex_id: selectedVertexId,
      hex_id: selectedHexId,
      target_seat_no: targetSeatNo ? Number(targetSeatNo) : null,
    });
    setSelectedHexId(null);
    setTargetSeatNo("");
  };

  const moveDisplacedKnight = async () => {
    if (!mustMoveDisplacedKnight) {
      notifyError("밀려난 기사를 옮길 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId) {
      notifyError("밀려난 기사가 이동할 빈 교차점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "MOVE_DISPLACED_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const removeDeserterKnight = async () => {
    if (phase !== "DESERTER_REMOVE" || pendingDeserterTargetSeatNo !== mySeatNo) {
      notifyError("탈영할 기사를 고를 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId || selectedKnightOwner !== mySeatNo) {
      notifyError("제거할 내 기사를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "REMOVE_DESERTER_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const placeDeserterKnight = async () => {
    if (phase !== "DESERTER_PLACE" || pendingDeserterAttackerSeatNo !== mySeatNo) {
      notifyError("탈영 기사를 배치할 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId) {
      notifyError("탈영 기사를 배치할 정점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "PLACE_DESERTER_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const moveIntrigueKnight = async () => {
    if (phase !== "INTRIGUE_MOVE" || pendingIntrigueTargetSeatNo !== mySeatNo) {
      notifyError("음모로 밀려난 기사를 옮길 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId) {
      notifyError("기사를 옮길 정점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "MOVE_INTRIGUE_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const respondCommercialHarbor = async () => {
    if (phase !== "COMMERCIAL_HARBOR" || !pendingCommercialHarborSeatNos.map(Number).includes(mySeatNo)) {
      notifyError("상업 항구 응답 차례가 아닙니다.");
      return;
    }
    if (!commodities?.[selectedCommodityType]) {
      notifyError("줄 상품을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "RESPOND_COMMERCIAL_HARBOR", resource_type: selectedCommodityType });
  };

  const buildCityImprovement = async () => {
    await onAction({ action_type: "BUILD_CITY_IMPROVEMENT", improvement_type: selectedImprovementType });
  };

  const playProgressCard = async () => {
    if (!selectedProgressCard) {
      notifyError("사용할 진행 카드를 선택해주세요.");
      return;
    }
    if (!selectedProgressSupported) {
      notifyError("현재 단계에서 사용할 수 없는 진행 카드입니다.");
      return;
    }
    const payload = {
      action_type: "PLAY_PROGRESS_CARD",
      card_ids: [selectedProgressCard.id],
    };
    if (selectedProgressType === "ALCHEMIST") {
      notifyError("연금술사는 주사위 단계에서만 사용할 수 있습니다.");
      return;
    }
    if (selectedProgressType === "ENGINEER") {
      if (!selectedVertexId) {
        notifyError("성벽을 세울 도시를 선택해주세요.");
        return;
      }
      payload.vertex_id = selectedVertexId;
    }
    if (selectedProgressType === "MEDICINE") {
      if (!selectedVertexId) {
        notifyError("도시로 올릴 마을을 선택해주세요.");
        return;
      }
      payload.vertex_id = selectedVertexId;
    }
    if (selectedProgressType === "CRANE") {
      payload.improvement_type = selectedImprovementType;
    }
    if (selectedProgressType === "INVENTOR") {
      if (roadCardEdges.length < 2) {
        notifyError("숫자 토큰을 바꿀 타일 2개를 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (selectedProgressType === "INTRIGUE") {
      if (!selectedVertexId || !selectedKnightOwner || selectedKnightOwner === mySeatNo) {
        notifyError("내 도로에 닿은 상대 기사를 선택해주세요.");
        return;
      }
      payload.vertex_id = selectedVertexId;
    }
    if (selectedProgressType === "BISHOP") {
      if (citiesKnightsRobberLocked) {
        notifyError("주교는 첫 야만인 침공 후부터 사용할 수 있습니다.");
        return;
      }
      if (!selectedHexId || selectedHex?.terrain === "SEA") {
        notifyError("주교로 옮길 육지 타일을 선택해주세요.");
        return;
      }
      payload.hex_id = selectedHexId;
    }
    if (selectedProgressType === "COMMERCIAL_HARBOR") {
      payload.resource_type = tradeForm.give;
    }
    if (selectedProgressType === "DESERTER") {
      const target = targetSeatNo ? Number(targetSeatNo) : Number(get(deserterTargets[0], "seat_no", "seatNo", 0));
      if (!target) {
        notifyError("탈영시킬 상대를 선택해주세요.");
        return;
      }
      payload.target_seat_no = target;
    }
    if (selectedProgressType === "MASTER_MERCHANT") {
      const target = targetSeatNo ? Number(targetSeatNo) : Number(get(richerPlayers[0], "seat_no", "seatNo", 0));
      if (!target) {
        notifyError("대상 플레이어를 선택해주세요.");
        return;
      }
      payload.target_seat_no = target;
    }
    if (selectedProgressType === "MERCHANT") {
      if (!selectedHexId || !catanResourceByTerrain[selectedHex?.terrain]) {
        notifyError("상인을 놓을 생산 타일을 선택해주세요.");
        return;
      }
      payload.hex_id = selectedHexId;
    }
    if (selectedProgressType === "MERCHANT_FLEET") {
      payload.resource_type = tradeForm.give;
    }
    if (selectedProgressType === "SPY") {
      const target = targetSeatNo ? Number(targetSeatNo) : Number(get(spyTargets[0], "seat_no", "seatNo", 0));
      if (!target) {
        notifyError("진행 카드를 가져올 플레이어를 선택해주세요.");
        return;
      }
      payload.target_seat_no = target;
    }
    if (selectedProgressType === "ROAD_BUILDING") {
      if (!roadCardEdges.length) {
        notifyError("도로 건설 카드로 놓을 간선을 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (selectedProgressType === "DIPLOMAT") {
      if (!roadCardEdges.length) {
        notifyError("외교관으로 제거할 열린 도로를 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (selectedProgressType === "RESOURCE_MONOPOLY") {
      payload.resource_type = tradeForm.give;
    }
    if (selectedProgressType === "TRADE_MONOPOLY") {
      payload.resource_type = selectedCommodityType;
    }
    await onAction(payload);
    setRoadCardEdges([]);
    setSelectedVertexId(null);
  };

  const clearSelectedTargets = () => {
    setSelectedHexId(null);
    setSelectedEdgeId(null);
    setSelectedVertexId(null);
  };

  const pairedTurnOneStatus = phase === "SETUP"
    ? "첫 주사위"
    : activeSeatNo === catanianOneSeatNo
      ? phase === "ROLL" ? "주사위/행동" : "행동 중"
      : "대기";
  const pairedTurnTwoStatus = phase === "SETUP"
    ? "후속 행동"
    : activeSeatNo === catanianTwoSeatNo
      ? "행동 중"
      : "대기";
  const pairedTurnHint = phase === "SETUP"
    ? "초기 배치가 끝나면 카타니안 1이 주사위를 굴리고 행동한 뒤, 카타니안 2가 같은 라운드의 후속 행동을 합니다."
    : activeSeatNo === catanianTwoSeatNo
      ? "카타니안 2의 행동이 끝나면 두 표식이 한 칸씩 왼쪽으로 이동합니다."
      : "카타니안 1이 주사위와 행동을 마치면 카타니안 2가 바로 행동합니다.";
  const pairedTurnMyRole = mySeatNo === catanianOneSeatNo
    ? "내 표식은 카타니안 1입니다."
    : mySeatNo === catanianTwoSeatNo
      ? "내 표식은 카타니안 2입니다."
      : "내 차례가 아니면 다음 표식 이동을 기다립니다.";
  const pairedTurnActionNotice = phase === "SETUP"
    ? "초기 배치 중에는 일반 카탄 순서를 따르고, 본게임 시작 후 표식이 적용됩니다."
    : activeSeatNo === catanianTwoSeatNo
      ? "카타니안 2는 주사위를 굴리지 않고 후속 행동만 진행합니다. 종료하면 표식이 이동합니다."
      : activeSeatNo === catanianOneSeatNo
        ? phase === "ROLL"
          ? "카타니안 1이 주사위를 굴린 뒤 행동을 진행합니다."
          : "카타니안 1이 턴을 종료하면 카타니안 2가 바로 후속 행동을 합니다."
        : "다른 플레이어 턴입니다. 현재 표식과 다음 이동 순서를 확인하세요.";
  const catanPhaseLabel = phase === "SETUP" ? "초기 배치"
    : phase === "ROLL" ? "주사위 단계"
      : phase === "DISCARD" ? "자원 버리기"
        : phase === "PROGRESS_DISCARD" ? "진행 카드 버리기"
          : phase === "DEFENDER_PROGRESS_CHOICE" ? "방어자 카드 선택"
            : phase === "GOLD_CHOICE" ? "금광 자원 선택"
              : phase === "AQUEDUCT_CHOICE" ? "수로 자원 선택"
                : phase === "ROBBER" ? (explorersPiratesRule ? "해적 이동" : "도적 이동")
                  : phase === "COMMERCIAL_HARBOR" ? "상업 항구 응답"
                    : phase === "MASTER_MERCHANT_CHOOSE" ? "대상인 카드 선택"
                      : phase === "SPY_CHOOSE" ? "첩자 카드 선택"
                        : phase === "WEDDING_GIVE" ? "혼례 카드 제공"
                          : phase === "DESERTER_REMOVE" ? "탈영 기사 선택"
                            : phase === "DESERTER_PLACE" ? "탈영 기사 배치"
                              : phase === "INTRIGUE_MOVE" ? "음모 기사 이동"
                                : phase === "DISPLACED_KNIGHT_MOVE" ? "밀려난 기사 이동"
                                  : phase === "CAMEL_BID" ? "낙타 입찰"
                                    : phase === "PLACE_CAMEL" ? "낙타 배치"
                                      : phase === "FINISHED" ? "게임 종료"
                                        : "건설과 교환";
  const catanTurnGuidance = (() => {
    if (phase === "FINISHED") {
      return winnerSeatNo > 0 ? `${playerName(winnerSeatNo)} 승리, 최종 ${winnerVictoryPoints}점입니다.` : "게임이 종료되었습니다.";
    }
    if (phase === "SETUP") {
      return myTurn ? "정점과 이어진 간선을 선택한 뒤 초기 배치를 진행하세요." : `${playerName(activeSeatNo)}의 초기 배치를 기다리는 중입니다.`;
    }
    if (phase === "ROLL") {
      if (!myTurn) return `${playerName(activeSeatNo)}의 주사위 단계를 기다리는 중입니다.`;
      if (!citiesKnightsRule && !explorersPiratesRule && playableDevelopmentCards.length > 0) {
        return "주사위를 굴리기 전에 사용 가능한 개발 카드를 먼저 쓸 수 있습니다.";
      }
      return "주사위를 굴려 생산을 진행하세요.";
    }
    if (phase === "DISCARD") {
      return mustDiscard ? `${discardRequired}장을 정확히 골라 버려야 도둑 단계로 넘어갑니다.` : "자원을 버려야 하는 플레이어를 기다리는 중입니다.";
    }
    if (phase === "ROBBER") {
      return myTurn ? `${explorersPiratesRule ? "해적" : "도적"}을 옮길 타일을 선택하고, 훔칠 대상이 있으면 함께 고르세요.` : `${playerName(activeSeatNo)}의 ${explorersPiratesRule ? "해적" : "도적"} 이동을 기다리는 중입니다.`;
    }
    if (phase === "GOLD_CHOICE") {
      return myGoldChoice ? `${goldRequired}장의 자원을 선택하세요. 은행 잔량이 부족한 조합은 사용할 수 없습니다.` : "금광 보상을 선택할 플레이어를 기다리는 중입니다.";
    }
    if (phase === "AQUEDUCT_CHOICE") {
      return myAqueductChoice ? "받을 자원 1장을 선택하세요. 은행에 남은 자원만 선택할 수 있습니다." : "수로 보상을 선택할 플레이어를 기다리는 중입니다.";
    }
    if (phase === "ACTION") {
      if (pendingDomesticTrade) {
        if (pendingTradeTargetSeatNo === mySeatNo) return "거래 제안을 확인하고 수락 또는 거절을 선택하세요.";
        if (pendingTradeProposerSeatNo === mySeatNo) return "상대의 응답을 기다리거나 제안을 취소할 수 있습니다.";
        return "진행 중인 플레이어 거래가 마무리될 때까지 새 거래는 잠시 보류됩니다.";
      }
      if (!myTurn) return `${playerName(activeSeatNo)}의 행동 단계를 기다리는 중입니다.`;
      if (selectedEdgeId && ["ROAD", "BRIDGE", "SHIP", "MOVE_SHIP"].includes(buildMode)) {
        return "선택한 간선으로 건설 또는 이동 액션을 실행할 수 있습니다.";
      }
      if (selectedVertexId && ["SETTLEMENT", "CITY", "HARBOR_SETTLEMENT", "KNIGHT", "CITY_WALL"].includes(buildMode)) {
        return "선택한 정점으로 건설 또는 기사 액션을 실행할 수 있습니다.";
      }
      return "건설, 교환, 개발 카드 사용을 진행한 뒤 턴을 종료하세요.";
    }
    return myTurn ? "필요한 보드 대상을 선택하고 표시된 액션을 진행하세요." : `${playerName(activeSeatNo)}의 처리를 기다리는 중입니다.`;
  })();
  const catanQuickFacts = [
    { label: "단계", value: catanPhaseLabel },
    { label: "차례", value: phase === "FINISHED" ? "종료" : myTurn ? "내 차례" : playerName(activeSeatNo) },
    { label: "목표", value: `${winningPoints}점` },
    { label: "선택", value: hasSelectedTarget ? `${selectedTargetSummaryItems.length}곳` : "없음" },
  ];
  const catanLatestEvent = events[events.length - 1];
  const catanLatestEventType = String(get(catanLatestEvent, "event_type", "eventType", "") || "");
  const catanLatestEventSeatNo = Number(get(catanLatestEvent, "seat_no", "seatNo", 0));
  const catanLatestText = catanLatestEvent
    ? `${catanLatestEventSeatNo ? `${playerName(catanLatestEventSeatNo)} · ` : ""}${catanEventLabels[catanLatestEventType] || catanLatestEventType || "최근 행동"}`
    : "아직 기록 없음";
  const catanSelectedText = hasSelectedTarget
    ? selectedTargetSummaryItems.map((item) => `${item.label} ${item.value}`).join(" · ")
    : "타일, 간선, 정점을 선택하면 가능한 행동 근거가 여기에 정리됩니다.";
  const catanFlowItems = [
    {
      label: "단계",
      value: catanPhaseLabel,
      detail: catanTurnGuidance,
      icon: "stage",
      tone: phase === "FINISHED" ? "done" : myTurn ? "active" : "neutral",
    },
    {
      label: "승점 압박",
      value: phase === "FINISHED" && winnerSeatNo ? `${playerName(winnerSeatNo)} ${winnerVictoryPoints}/${winningPoints}점` : `${winningPoints}점 목표`,
      detail: catanRuleBrief.title,
      icon: phase === "FINISHED" ? "win" : "score",
      tone: phase === "FINISHED" ? "done" : "neutral",
    },
    {
      label: "선택 대상",
      value: hasSelectedTarget ? `${selectedTargetSummaryItems.length}곳 선택` : "대상 미선택",
      detail: catanSelectedText,
      icon: "decision",
      tone: hasSelectedTarget ? "active" : "waiting",
    },
    {
      label: "최근 근거",
      value: lastRoll ? `주사위 ${lastRoll}` : catanLatestText,
      detail: lastRoll ? `${catanLatestText} · 이벤트 주사위 ${eventDie ? catanEventDieLabels[eventDie] || eventDie : "없음"}` : catanRuleBrief.summary,
      icon: "recent",
      tone: lastRoll ? "active" : "neutral",
    },
  ];
  const catanEdgeBuildModes = ["ROAD", "BRIDGE", "SHIP", "MOVE_SHIP"];
  const catanVertexBuildModes = ["SETTLEMENT", "CITY", "HARBOR_SETTLEMENT", "KNIGHT", "CITY_WALL"];
  const catanBuildTargetKind = catanEdgeBuildModes.includes(buildMode) ? "간선" : "교차점";
  const catanBuildTargetReady = phase === "SETUP"
    ? Boolean(selectedVertexId && selectedEdgeId)
    : phase === "ACTION" && (
      buildMode === "MOVE_SHIP"
        ? explorersPiratesRule
          ? shipMovePath.length >= 2
          : Boolean(shipMoveFromEdgeId && selectedEdgeId)
        : catanEdgeBuildModes.includes(buildMode)
          ? Boolean(selectedEdgeId)
          : catanVertexBuildModes.includes(buildMode)
            ? Boolean(selectedVertexId)
            : false
    );
  const catanRobberTargetReady = phase === "ROBBER"
    ? Boolean(selectedHexId) && !citiesKnightsRobberLocked
    : selectedDevCard?.type === "KNIGHT"
      ? Boolean(selectedHexId)
      : false;
  const catanActionAtlasActiveKey = phase === "ROBBER" || phase === "DISCARD" || phase === "GOLD_CHOICE" || phase === "AQUEDUCT_CHOICE"
    ? "target"
    : pendingDomesticTrade || canMaritimeTrade
      ? "trade"
      : "build";
  const catanActionAtlasTitle = phase === "ACTION"
    ? `${catanBuildModeLabels[buildMode] || buildMode} 실행 판단`
    : phase === "ROBBER"
      ? `${explorersPiratesRule ? "해적" : "도적"} 이동 판단`
      : phase === "SETUP"
        ? "초기 배치 판단"
        : `${catanPhaseLabel} 처리 판단`;
  const catanActionAtlasItems = [
    {
      key: "turn",
      label: "차례 권한",
      value: myTurn ? "내가 실행" : `${playerName(activeSeatNo)} 대기`,
      ready: myTurn || mustDiscard || Boolean(myGoldChoice) || Boolean(myAqueductChoice),
      detail: myTurn ? "이 패널의 버튼을 실제로 실행할 수 있는 차례입니다." : "내 차례가 아니면 보드 선택은 확인용으로만 유지됩니다.",
    },
    {
      key: "target",
      label: "보드 대상",
      value: phase === "SETUP"
        ? selectedVertexId && selectedEdgeId ? "정점+간선 선택" : "정점과 간선 필요"
        : phase === "ROBBER"
          ? selectedHexId ? "타일 선택" : `${explorersPiratesRule ? "바다 칸" : "육지 타일"} 필요`
          : phase === "ACTION"
            ? catanBuildTargetReady ? `${catanBuildTargetKind} 선택` : `${catanBuildTargetKind} 필요`
            : hasSelectedTarget ? `${selectedTargetSummaryItems.length}곳 선택` : "선택 없음",
      ready: phase === "ROBBER" ? catanRobberTargetReady : catanBuildTargetReady || hasSelectedTarget,
      detail: phase === "ROBBER"
        ? citiesKnightsRobberLocked ? "첫 야만인 침공 전이라 도적 이동은 잠겨 있습니다." : "선택한 타일과 훔칠 대상 후보가 이동 버튼의 근거입니다."
        : phase === "ACTION"
          ? `${catanBuildModeLabels[buildMode] || buildMode} 모드는 ${catanBuildTargetKind} 선택을 먼저 봅니다.`
          : "보드에서 선택한 타일, 간선, 교차점이 실행 근거로 쓰입니다.",
    },
    {
      key: "primary",
      label: "주 액션",
      value: phase === "ROLL"
        ? "주사위"
        : phase === "DISCARD"
          ? mustDiscard ? `${discardTotal}/${discardRequired}장` : "대기"
          : phase === "ACTION"
            ? selectedBuildActionDisabled ? "조건 확인" : "실행 가능"
            : phase === "ROBBER"
              ? catanRobberTargetReady ? "이동 가능" : "대상 필요"
              : catanPhaseLabel,
      ready: phase === "ROLL"
        ? myTurn
        : phase === "DISCARD"
          ? mustDiscard && discardTotal === discardRequired
          : phase === "ACTION"
            ? myTurn && catanBuildTargetReady && !selectedBuildActionDisabled
            : phase === "ROBBER"
              ? myTurn && catanRobberTargetReady
              : myTurn,
      detail: phase === "ACTION" && buildMode === "KNIGHT" && selectedVertexKnightBuildWarning
        ? selectedVertexKnightBuildWarning
        : phase === "DISCARD"
          ? "정확한 버릴 카드 수를 맞춰야 다음 단계로 넘어갑니다."
          : "가장 큰 버튼이 실제 서버 액션을 보내기 전에 잠금 근거를 확인합니다.",
    },
    {
      key: "support",
      label: "보조 선택",
      value: phase === "ACTION"
        ? canMaritimeTrade
          ? "교환 가능"
          : canBuyDevelopmentCard
            ? "개발 카드 가능"
            : actionProgressCards.length
              ? `진행 카드 ${actionProgressCards.length}장`
              : "보조 없음"
        : phase === "ROBBER" && robberTargets.length
          ? `${robberTargets.length}명 후보`
          : pendingDomesticTrade
            ? "거래 응답"
            : catanTradeSummary,
      ready: phase === "ACTION"
        ? canMaritimeTrade || canBuyDevelopmentCard || actionProgressCards.length > 0
        : phase === "ROBBER"
          ? robberTargets.length > 0 || catanRobberTargetReady
          : Boolean(pendingDomesticTrade),
      detail: phase === "ACTION"
        ? "교환, 개발/진행 카드, 확장 규칙 액션은 같은 선택값을 보조 근거로 사용합니다."
        : phase === "ROBBER"
          ? "대상이 없으면 이동만 실행되고, 후보가 있으면 훔칠 플레이어를 고릅니다."
          : "거래나 보상 선택이 있을 때 이 영역에서 추가 결정을 확인합니다.",
    },
  ];
  const catanActionRouteItems = buildCatanActionRouteItems({
    phase,
    phaseLabel: catanPhaseLabel,
    myTurn,
    activeName: playerName(activeSeatNo),
    lastRoll,
    mustDiscard,
    discardTotal,
    discardRequired,
    myGoldChoice,
    goldRequired,
    myAqueductChoice,
    catanBuildTargetReady,
    catanRobberTargetReady,
    hasSelectedTarget,
    buildMode,
    catanBuildTargetKind,
    selectedBuildActionDisabled,
    canMaritimeTrade,
    canBuyDevelopmentCard,
    actionProgressCount: actionProgressCards.length,
    pendingDomesticTrade,
    catanTradeSummary,
    catanTurnGuidance,
    winnerSeatNo,
    winnerVictoryPoints,
    winningPoints,
  });
  const catanScoreStandings = catanPlayers
    .map((player) => ({
      seatNo: Number(get(player, "seat_no", "seatNo", 0)),
      points: Number(get(player, "victory_points", "victoryPoints", get(player, "public_victory_points", "publicVictoryPoints", 0))),
      publicPoints: Number(get(player, "public_victory_points", "publicVictoryPoints", get(player, "victory_points", "victoryPoints", 0))),
      developmentPoints: Number(get(player, "development_victory_points", "developmentVictoryPoints", 0)),
      player,
    }))
    .filter((row) => row.seatNo > 0)
    .sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      return left.seatNo - right.seatNo;
    });
  const catanRunnerUp = catanScoreStandings.find((row) => row.seatNo !== winnerSeatNo);
  const catanWinnerSignals = winnerPlayer ? [
    Boolean(get(winnerPlayer, "has_longest_road", "hasLongestRoad", false)) ? "최장 교역로" : "",
    Boolean(get(winnerPlayer, "has_largest_army", "hasLargestArmy", false)) ? "최대 기사력" : "",
    Boolean(get(winnerPlayer, "richest_settler", "richestSettler", false)) ? "부유한 정착민" : "",
    Boolean(get(winnerPlayer, "best_fisher", "bestFisher", false)) ? "최고 어부" : "",
    Boolean(get(winnerPlayer, "greatest_spice_merchant", "greatestSpiceMerchant", false)) ? "최고 향신료상" : "",
    Boolean(get(winnerPlayer, "greatest_pirate_scourge", "greatestPirateScourge", false)) ? "해적 소탕왕" : "",
    Number(get(winnerPlayer, "special_victory_points", "specialVictoryPoints", 0)) > 0 ? `특별 승점 +${get(winnerPlayer, "special_victory_points", "specialVictoryPoints", 0)}` : "",
    Number(get(winnerPlayer, "mission_victory_points", "missionVictoryPoints", 0)) > 0 ? `임무 승점 +${get(winnerPlayer, "mission_victory_points", "missionVictoryPoints", 0)}` : "",
    Number(get(winnerPlayer, "harbor_points", "harborPoints", 0)) > 0 ? `항구 점수 ${get(winnerPlayer, "harbor_points", "harborPoints", 0)}` : "",
    Number(get(winnerPlayer, "defender_points", "defenderPoints", 0)) > 0 ? `방어자 점수 ${get(winnerPlayer, "defender_points", "defenderPoints", 0)}` : "",
  ].filter(Boolean) : [];
  const catanResultDetail = winnerSeatNo > 0
    ? `${playerName(winnerSeatNo)}님이 목표 ${winningPoints}점에 도달해 최종 ${winnerVictoryPoints}점으로 승리했습니다.${catanRunnerUp ? ` 2위 ${playerName(catanRunnerUp.seatNo)}님과의 차이는 ${Math.max(0, winnerVictoryPoints - catanRunnerUp.points)}점입니다.` : ""} ${catanWinnerSignals.length ? `승리 근거: ${catanWinnerSignals.join(" · ")}.` : "서버 최종 승점에는 공개 승점, 비공개 승점, 보너스 표식이 함께 반영됩니다."}`
    : "게임 종료 상태입니다. 서버 최종 승점과 보너스 표식 기준으로 승자를 확인합니다.";
  const catanResultMetric = winnerSeatNo > 0
    ? `최종 ${winnerVictoryPoints}/${winningPoints}점`
    : `${winningPoints}점 목표`;

  const renderPairedTurnSummary = () => pairedTurnRule && (
    <div className="mb-3 grid gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_1.35fr]" role="status" aria-live="polite" aria-atomic="true">
      <div>
        <span className="font-black">카타니안 1</span> · {playerName(catanianOneSeatNo)}
        <span className={`ml-2 ${activeSeatNo === catanianOneSeatNo && phase !== "SETUP" ? "text-amber-700" : "text-amber-600"}`}>
          {pairedTurnOneStatus}
        </span>
      </div>
      <div>
        <span className="font-black">카타니안 2</span> · {playerName(catanianTwoSeatNo)}
        <span className={`ml-2 ${activeSeatNo === catanianTwoSeatNo && phase !== "SETUP" ? "text-lime-700" : "text-amber-600"}`}>
          {pairedTurnTwoStatus}
        </span>
      </div>
      <div className="leading-relaxed text-amber-700">{pairedTurnHint}</div>
      <div className="rounded-xl bg-white/70 px-3 py-2 leading-relaxed text-amber-900">
        <span className="font-black">내 역할</span> · {pairedTurnMyRole}
        <span className="mt-1 block text-amber-700">{pairedTurnActionNotice}</span>
      </div>
    </div>
  );

  const renderSelectedTargetSummary = ({ className = "", surfaceClassName = "bg-slate-50", showActionJump = false } = {}) => (
    <div className={`rounded-2xl border border-slate-200 ${surfaceClassName} p-3 ${className}`} role="status" aria-live="polite" aria-atomic="true">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black text-slate-900">선택한 보드 대상</div>
        <div className="flex flex-wrap gap-1.5">
          {showActionJump && (
            <a
              href="#catan-action-panel"
              className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black text-white shadow-sm"
            >
              액션 보기
            </a>
          )}
          {hasSelectedTarget && (
            <button
              type="button"
              className="min-h-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm"
              onClick={clearSelectedTargets}
            >
              초기화
            </button>
          )}
        </div>
      </div>
      {hasSelectedTarget ? (
        <div className="grid gap-1.5">
          {selectedTargetSummaryItems.map((item) => (
            <div key={item.key} className={`rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${item.tone}`}>
              <span className="mr-1 font-black">{item.label}</span>
              {item.value}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-500">
          보드의 타일, 간선, 정점을 선택하면 이곳에 대상 정보와 공식 규칙에 필요한 단서가 표시됩니다.
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div id="catan-board-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-500">카탄</div>
              <div className="text-xl font-black text-slate-900">
                {catanPhaseLabel}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700" role="status" aria-live="polite" aria-atomic="true">
                {phase === "FINISHED" ? `승자 ${playerName(winnerSeatNo)}` : `현재 ${playerName(activeSeatNo)}`}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">목표 {winningPoints}점</span>
              {!!lastRoll && <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">최근 {lastRoll}</span>}
            </div>
          </div>
          <div className="mb-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-amber-600 p-2 text-white shadow-sm">
                <Dices className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black text-amber-700">지금 할 일</div>
                <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{catanTurnGuidance}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {catanQuickFacts.map((item) => (
                    <div key={item.label} className="rounded-xl bg-white/80 px-2.5 py-2">
                      <div className="text-[10px] font-bold text-slate-400">{item.label}</div>
                      <div className="truncate text-[11px] font-black text-slate-700">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <CatanDiceOutcomePanel
            diceFaces={catanDiceFaces}
            lastRoll={lastRoll}
            redDie={redDie}
            eventDie={eventDie}
            phase={phase}
            myTurn={myTurn}
            pendingDiscardCount={pendingDiscardSeatNos.length}
            productionSummary={catanProductionSummary}
            resourceBank={resourceBank}
            robberLocked={citiesKnightsRobberLocked}
            explorersPiratesRule={explorersPiratesRule}
            citiesKnightsRule={citiesKnightsRule}
          />
          <details data-smoke="catan-rule-brief" className={`mb-3 rounded-2xl border px-3 py-2 shadow-sm ${catanRuleBrief.tone}`}>
            <summary className="cursor-pointer text-xs font-black">
              규칙 요약 · {catanRuleBrief.title}
            </summary>
            <div className="mt-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-2xl bg-white/75 p-2 shadow-sm">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black opacity-75">선택 규칙</div>
                    <div className="text-sm font-black leading-snug">{catanRuleBrief.title}</div>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs font-bold leading-relaxed opacity-90">{catanRuleBrief.summary}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {catanRuleBrief.chips.map((chip) => (
                  <span key={chip} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${catanRuleBrief.chipTone}`}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </details>
          {phase === "FINISHED" && (
            <GameResultSpotlight
              title={winnerSeatNo > 0 ? `${playerName(winnerSeatNo)} 승리` : "카탄 최종 결과"}
              subtitle="승리 근거"
              detail={catanResultDetail}
              metric={catanResultMetric}
              tone="amber"
              className="mb-3"
              smoke="catan-result-spotlight"
            />
          )}
          {renderPairedTurnSummary()}
          {friendlyRobberRule && (
            <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              친절한 도둑 적용 · 공개 승점 2점 이하 플레이어의 건물 옆으로 도둑을 옮길 수 없고, 이동할 곳이 없으면 사막으로 갑니다.
            </div>
          )}
          {fishermenRule && (
            <div className="mb-3 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
              카탄의 낚시꾼 · 낚시터 숫자가 나오면 물고기 토큰을 얻고, 물고기 시장에서 보너스로 사용할 수 있습니다.
            </div>
          )}
          {riversRule && (
            <div className="mb-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
              카탄의 강 · 강가에 길이나 마을을 지으면 골드를 얻고, 골드가 가장 많은 플레이어는 부유한 정착민 보너스를 받습니다.
            </div>
          )}
          {caravansRule && (
            <div className="mb-3 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
              대상단 · 마을이나 도시를 지은 턴 끝에 양털/곡물로 낙타 배치권을 입찰합니다. 낙타가 놓인 길은 최장 교역로에서 2칸으로 세고, 낙타 2개 사이의 건물은 승점 1점을 더 얻습니다.
            </div>
          )}
          {fogIslandsRule && (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
              안개 섬 · 배나 도로가 미탐험 교차점에 닿으면 안개 타일이 공개됩니다. 육지 발견 시 해당 자원 1장을 받고, 금광은 자원 선택 단계로 이어집니다. 남은 안개 {hiddenFogCount}개
            </div>
          )}
          {throughDesertRule && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              사막을 지나서 · 초기 배치는 본섬에서만 시작합니다. 사막 너머 육지대와 작은 섬은 외국 지역이며, 각 지역 첫 마을마다 특별 승점 2점을 받습니다.
            </div>
          )}
          {forgottenTribeRule && (
            <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">
              잊힌 부족 · 작은 부족 섬에는 정착할 수 없습니다. 배가 선물 표식이 있는 해안에 닿으면 승점, 개발 카드, 항구 중 하나를 받고 13점으로 끝납니다.
            </div>
          )}
          {clothForCatanRule && (
            <div className="mb-3 grid gap-2 rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-3 text-xs font-bold text-fuchsia-800 sm:grid-cols-[1.2fr_0.8fr]">
              <div>
                카탄에 천을 · 부족 마을과 배로 연결하면 직물을 받고, 해당 숫자가 나오면 연결된 플레이어에게 직물이 생산됩니다. 직물 2개마다 승점 1점입니다.
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                남은 직물 마을 {clothVillagesWithSupply}/{clothVillages.length || "-"}곳 · 공용 {clothVillageGeneralSupply}개 · 연결 {connectedClothVillageCount}곳
              </div>
            </div>
          )}
          {barbarianAttackRule && (
            <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              야만인 침공 · 마을이나 도시를 지으면 해안에 야만인이 상륙합니다. 야만인 3개가 모인 타일은 생산하지 않고, 기사 개발 카드로 방어 기사를 배치해 격퇴할 수 있습니다.
            </div>
          )}
          {citiesKnightsRule && (
            <div className="mb-3 grid gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-800 sm:grid-cols-3">
              <div>
                <span className="font-black">야만인</span> · {barbarianPosition}/{barbarianTrackLength}
              </div>
              <div>
                <span className="font-black">이벤트</span> · {eventDie ? catanEventDieLabels[eventDie] || eventDie : "-"}{redDie ? ` / 적색 ${redDie}` : ""}
              </div>
              <div>
                <span className="font-black">침공</span> · {barbarianAttacks}회
              </div>
            </div>
          )}
          <div className="relative aspect-[1.08/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 via-cyan-100 to-blue-200 p-2">
            <svg viewBox="-4 -4 108 108" className="h-full w-full drop-shadow-sm">
              <defs>
                <pattern id="catan-terrain-forest" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#2f8f5b" />
                  <path d="M1 6.6 3 1.2 5 6.6M4.8 6.9 6.7 2.3 7.8 6.9" fill="none" stroke="#14532d" strokeWidth="0.45" opacity="0.42" />
                  <circle cx="2.9" cy="3.4" r="0.75" fill="#bbf7d0" opacity="0.22" />
                </pattern>
                <pattern id="catan-terrain-pasture" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#8ccf5f" />
                  <path d="M0.4 5.4C1.7 4.5 2.4 6.3 3.6 5.3S5.6 4.7 6.8 5.6" fill="none" stroke="#166534" strokeWidth="0.35" opacity="0.32" />
                  <circle cx="5.4" cy="2" r="0.75" fill="#ecfccb" opacity="0.32" />
                </pattern>
                <pattern id="catan-terrain-field" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#f2c94c" />
                  <path d="M1 0.5v6M3.5 0.5v6M6 0.5v6" stroke="#a16207" strokeWidth="0.32" opacity="0.32" />
                  <path d="M0.6 2.2h5.9M0.6 4.7h5.9" stroke="#fef3c7" strokeWidth="0.3" opacity="0.45" />
                </pattern>
                <pattern id="catan-terrain-hill" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#c96f3d" />
                  <path d="M-1 6C1.4 3.4 3.9 7.6 6.2 4.6 7.2 3.3 8 3.4 9 4.2" fill="none" stroke="#7c2d12" strokeWidth="0.4" opacity="0.35" />
                  <path d="M0.5 2.2C2.7 0.7 4.8 3.7 7.5 1.8" fill="none" stroke="#fed7aa" strokeWidth="0.32" opacity="0.35" />
                </pattern>
                <pattern id="catan-terrain-mountain" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#7f8792" />
                  <path d="M0.5 6.8 2.8 1.3l1.6 3.1 1-1.8 2.4 4.2Z" fill="#475569" opacity="0.52" />
                  <path d="M2.8 1.3 3.7 3.1 2.4 3.1Z" fill="#e2e8f0" opacity="0.55" />
                </pattern>
                <pattern id="catan-terrain-desert" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#d8b46f" />
                  <path d="M-1 5.5C1.4 4.2 2.8 6.6 5 5.2 6.3 4.4 7.2 4.5 9 5.8" fill="none" stroke="#92400e" strokeWidth="0.35" opacity="0.32" />
                  <circle cx="5.8" cy="2.2" r="0.45" fill="#78350f" opacity="0.28" />
                </pattern>
                <pattern id="catan-terrain-gold" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#f59e0b" />
                  <path d="M3.5 0.8 4.6 2.4 3.5 4 2.4 2.4Z" fill="#fef3c7" opacity="0.5" />
                  <circle cx="1.2" cy="5.6" r="0.55" fill="#92400e" opacity="0.25" />
                </pattern>
                <pattern id="catan-terrain-sea" width="9" height="9" patternUnits="userSpaceOnUse">
                  <rect width="9" height="9" fill="#38bdf8" />
                  <path d="M-1 3.2C0.8 2.1 2.1 4.2 3.8 3.2S6.2 2.1 8.1 3.2 10.5 3.7 11 3.1M-1 6.8C0.8 5.7 2.1 7.8 3.8 6.8S6.2 5.7 8.1 6.8 10.5 7.3 11 6.7" fill="none" stroke="#075985" strokeWidth="0.4" opacity="0.28" />
                </pattern>
                <pattern id="catan-terrain-unexplored" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#475569" />
                  <path d="M-1 7 7 -1M2 8 8 2" stroke="#94a3b8" strokeWidth="0.45" opacity="0.28" />
                </pattern>
              </defs>
              {hexes.map((hex) => {
                const rawTerrainKey = String(hex.terrain || "DESERT").toUpperCase();
                const terrainKey = catanTerrain[rawTerrainKey] ? rawTerrainKey : "DESERT";
                const terrain = catanTerrain[terrainKey];
                const terrainPatternId = catanTerrainPatternIds[terrainKey];
                const selected = selectedHexId === Number(hex.id);
                const foreignIsland = Boolean(get(hex, "foreign_island", "foreignIsland", false));
                const forgottenTribeIsland = Boolean(get(hex, "forgotten_tribe_island", "forgottenTribeIsland", false));
                const islandId = Number(get(hex, "island_id", "islandId", 0));
                const fourIslandsHex = seafarersScenarioCode === "FOUR_ISLANDS" && islandId > 0;
                const missionType = get(hex, "mission_type", "missionType", "");
                const pirateLairCaptured = Boolean(get(hex, "pirate_lair_captured", "pirateLairCaptured", false));
                const pirateLairCrewCount = (get(hex, "crew_seat_nos", "crewSeatNos", []) || []).length;
                const spiceAdvantageType = get(hex, "spice_advantage_type", "spiceAdvantageType", "");
                const spiceCrewCount = (get(hex, "crew_seat_nos", "crewSeatNos", []) || []).length;
                const riverTile = Boolean(get(hex, "river_tile", "riverTile", false));
                const oasis = Boolean(get(hex, "oasis", "oasis", false)) || oasisHexId === Number(hex.id);
                const barbarianCoastal = Boolean(get(hex, "barbarian_coastal", "barbarianCoastal", false));
                const barbarianCount = Number(get(hex, "barbarian_count", "barbarianCount", 0));
                const barbarianConquered = Boolean(get(hex, "barbarian_conquered", "barbarianConquered", false));
                const numberToken = Number(get(hex, "number_token", "numberToken", 0));
                const missionFill = missionType === "FISH" ? "#0284c7" : missionType === "PIRATE_LAIR" ? "#7f1d1d" : "#a16207";
                const selectHex = () => setSelectedHexId(Number(hex.id));
                const hexLabel = `${oasis ? "오아시스" : terrain.label} 타일${numberToken ? ` ${numberToken}` : ""}`;
                return (
                  <g
                    key={hex.id}
                    className="cursor-pointer"
                    onClick={selectHex}
                    aria-label={`${hexLabel} 선택`}
                    {...keyboardActivateProps(selectHex)}
                  >
                    <polygon
                      points={hexPoints(Number(hex.x), Number(hex.y), radius)}
                      fill={terrainPatternId ? `url(#${terrainPatternId})` : terrain.fill}
                      stroke={selected ? "#0f172a" : forgottenTribeIsland ? "#5eead4" : foreignIsland ? "#fef3c7" : fourIslandsHex ? "#bae6fd" : "#ffffff"}
                      strokeWidth={selected ? 1.1 : forgottenTribeIsland || foreignIsland || fourIslandsHex ? 0.85 : 0.55}
                    />
                    {(forgottenTribeIsland || foreignIsland || fourIslandsHex) && (
                      <polygon
                        points={hexPoints(Number(hex.x), Number(hex.y), radius - 0.9)}
                        fill="none"
                        stroke={forgottenTribeIsland ? "#0f766e" : foreignIsland ? "#92400e" : "#075985"}
                        strokeWidth="0.32"
                        strokeDasharray="0.9 0.8"
                        opacity="0.75"
                      />
                    )}
                    {barbarianCoastal && (
                      <polygon
                        points={hexPoints(Number(hex.x), Number(hex.y), radius - 1.35)}
                        fill="none"
                        stroke={barbarianConquered ? "#991b1b" : "#f97316"}
                        strokeWidth={barbarianConquered ? 0.55 : 0.35}
                        strokeDasharray={barbarianConquered ? undefined : "0.9 0.85"}
                        opacity="0.9"
                      />
                    )}
                    {riverTile && (
                      <path
                        d={`M ${Number(hex.x) - 5.2} ${Number(hex.y) - 4.8} C ${Number(hex.x) - 1.8} ${Number(hex.y) - 2.2}, ${Number(hex.x) - 2.2} ${Number(hex.y) + 2.1}, ${Number(hex.x) + 5.2} ${Number(hex.y) + 4.8}`}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                    )}
                    {oasis && (
                      <g>
                        <circle cx={Number(hex.x) - 3.5} cy={Number(hex.y) + 3.9} r="2.15" fill="#fed7aa" stroke="#c2410c" strokeWidth="0.35" />
                        <text x={Number(hex.x) - 3.5} y={Number(hex.y) + 4.55} textAnchor="middle" className="select-none text-[1.55px] font-black" fill="#9a3412">오</text>
                      </g>
                    )}
                    <text x={hex.x} y={hex.y - 1.8} textAnchor="middle" className="select-none text-[2.4px] font-black" fill={terrain.text}>
                      {oasis ? "오아시스" : terrain.label}
                    </text>
                    {(forgottenTribeIsland || foreignIsland || fourIslandsHex) && (
                      <text x={hex.x} y={Number(hex.y) + 7.1} textAnchor="middle" className="select-none text-[1.6px] font-black" fill={forgottenTribeIsland ? "#0f766e" : foreignIsland ? "#78350f" : "#075985"}>
                        {forgottenTribeIsland ? "부족" : foreignIsland ? "외섬" : `섬${islandId}`}
                      </text>
                    )}
                    {missionType && (
                      <g>
                        <rect x={Number(hex.x) - 4.3} y={Number(hex.y) - 7.3} width="8.6" height="3.2" rx="1.2" fill={missionFill} opacity="0.92" />
                        <text x={hex.x} y={Number(hex.y) - 5.05} textAnchor="middle" className="select-none text-[1.55px] font-black" fill="#ffffff">
                          {catanMissionLabels[missionType] || missionType}
                        </text>
                      </g>
                    )}
                    {barbarianCount > 0 && (
                      <g>
                        <circle cx={Number(hex.x) + 4.25} cy={Number(hex.y) + 4.65} r="2.15" fill={barbarianConquered ? "#991b1b" : "#fee2e2"} stroke="#7f1d1d" strokeWidth="0.35" />
                        <text x={Number(hex.x) + 4.25} y={Number(hex.y) + 5.35} textAnchor="middle" className="select-none text-[1.75px] font-black" fill={barbarianConquered ? "#ffffff" : "#991b1b"}>
                          {barbarianCount}
                        </text>
                      </g>
                    )}
                    {missionType === "PIRATE_LAIR" && (
                      <g>
                        <rect x={Number(hex.x) - 3.4} y={Number(hex.y) + 4.05} width="6.8" height="2.8" rx="1.1" fill={pirateLairCaptured ? "#dcfce7" : "#fee2e2"} stroke={pirateLairCaptured ? "#15803d" : "#991b1b"} strokeWidth="0.28" />
                        <text x={hex.x} y={Number(hex.y) + 5.95} textAnchor="middle" className="select-none text-[1.35px] font-black" fill={pirateLairCaptured ? "#166534" : "#991b1b"}>
                          {pirateLairCaptured ? "점령" : `${pirateLairCrewCount}/3`}
                        </text>
                      </g>
                    )}
                    {missionType === "SPICE" && spiceAdvantageType && (
                      <g>
                        <rect x={Number(hex.x) - 3.9} y={Number(hex.y) + 4.05} width="7.8" height="2.8" rx="1.1" fill="#fef9c3" stroke="#854d0e" strokeWidth="0.28" />
                        <text x={hex.x} y={Number(hex.y) + 5.95} textAnchor="middle" className="select-none text-[1.25px] font-black" fill="#854d0e">
                          {catanSpiceAdvantageShortLabels[spiceAdvantageType] || spiceAdvantageType} {spiceCrewCount}
                        </text>
                      </g>
                    )}
                    {get(hex, "cargo_type", "cargoType", "") === "FISH" && (
                      <g>
                        <circle cx={Number(hex.x) - 4.2} cy={Number(hex.y) + 4.7} r="2.05" fill="#e0f2fe" stroke="#0369a1" strokeWidth="0.35" />
                        <text x={Number(hex.x) - 4.2} y={Number(hex.y) + 5.28} textAnchor="middle" className="select-none text-[1.35px] font-black" fill="#075985">어</text>
                      </g>
                    )}
                    {!!numberToken && (
                      <g>
                        <circle cx={Number(hex.x)} cy={Number(hex.y) + 2.8} r="2.7" fill="#fff7ed" stroke="#7c2d12" strokeWidth="0.35" />
                        <text x={Number(hex.x)} y={Number(hex.y) + 3.65} textAnchor="middle" className="select-none text-[2.8px] font-black" fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "#431407"}>
                          {numberToken}
                        </text>
                      </g>
                    )}
                    {robberHexId === Number(hex.id) && (
                      <g>
                        <circle cx={Number(hex.x) + 3.5} cy={Number(hex.y) - 3.8} r="2.2" fill="#111827" />
                        <text x={Number(hex.x) + 3.5} y={Number(hex.y) - 3.1} textAnchor="middle" className="select-none text-[2.1px] font-black" fill="#ffffff">도</text>
                      </g>
                    )}
                    {pirateHexId === Number(hex.id) && (
                      <g>
                        <circle cx={Number(hex.x) + 3.6} cy={Number(hex.y) - 3.8} r="2.25" fill="#7f1d1d" />
                        <text x={Number(hex.x) + 3.6} y={Number(hex.y) - 3.1} textAnchor="middle" className="select-none text-[2px] font-black" fill="#ffffff">해</text>
                      </g>
                    )}
                    {merchantHexId === Number(hex.id) && (
                      <g>
                        <circle cx={Number(hex.x) - 3.6} cy={Number(hex.y) - 3.8} r="2.25" fill="#facc15" stroke="#713f12" strokeWidth="0.35" />
                        <text x={Number(hex.x) - 3.6} y={Number(hex.y) - 3.1} textAnchor="middle" className="select-none text-[2px] font-black" fill="#713f12">상</text>
                      </g>
                    )}
                  </g>
                );
              })}
              {edges.map((edge) => {
                const a = vertexById.get(Number(get(edge, "vertex_aid", "vertexAId", 0)));
                const b = vertexById.get(Number(get(edge, "vertex_bid", "vertexBId", 0)));
                if (!a || !b) return null;
                const owner = Number(get(edge, "owner_seat_no", "ownerSeatNo", 0));
                const ownerColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === owner)?.color;
                const selected = selectedEdgeId === Number(edge.id);
                const routeType = get(edge, "route_type", "routeType", "");
                const riverEdge = Boolean(get(edge, "river_edge", "riverEdge", false));
                const bridgeSite = Boolean(get(edge, "bridge_site", "bridgeSite", false));
                const bridgeBuilt = routeType === "BRIDGE";
                const camel = Boolean(get(edge, "camel", "camel", false));
                const camelStart = camelStartEdgeIds.map(Number).includes(Number(edge.id));
                const barbarianKnightOwner = Number(get(edge, "barbarian_knight_owner_seat_no", "barbarianKnightOwnerSeatNo", 0));
                const barbarianKnightColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === barbarianKnightOwner)?.color;
                const forgottenGiftType = get(edge, "forgotten_tribe_gift_type", "forgottenTribeGiftType", "");
                const forgottenGiftPortType = get(edge, "forgotten_tribe_gift_port_type", "forgottenTribeGiftPortType", "");
                const forgottenGiftClaimedSeatNo = Number(get(edge, "forgotten_tribe_gift_claimed_seat_no", "forgottenTribeGiftClaimedSeatNo", 0));
                const forgottenGiftLabel = forgottenGiftType === "VICTORY_POINT"
                  ? "승"
                  : forgottenGiftType === "DEVELOPMENT_CARD"
                    ? "개"
                    : forgottenGiftPortType === "ANY"
                      ? "3"
                      : "항";
                const edgeMidX = Number(edge.x);
                const edgeMidY = Number(edge.y);
                const selectEdge = () => setSelectedEdgeId(Number(edge.id));
                const edgeLabel = owner
                  ? `${playerName(owner)}의 ${routeType === "SHIP" ? "배" : routeType === "BRIDGE" ? "다리" : "도로"} 경로`
                  : bridgeSite ? "다리 후보 경로" : riverEdge ? "강 경로" : camelStart ? "낙타 시작 경로" : "빈 경로";
                return (
                  <g
                    key={edge.id}
                    className="cursor-pointer"
                    onClick={selectEdge}
                    aria-label={`${edgeLabel} 선택`}
                    {...keyboardActivateProps(selectEdge)}
                  >
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={owner ? catanColorFill[ownerColor] || "#111827" : selected ? "#0f172a" : camelStart ? "#f97316" : bridgeSite ? "#0e7490" : riverEdge ? "#0284c7" : "rgba(15,23,42,0.16)"}
                      strokeWidth={owner ? 1.9 : selected ? 1.5 : camelStart ? 1.45 : bridgeSite ? 1.55 : riverEdge ? 1.35 : 0.9}
                      strokeDasharray={routeType === "SHIP" ? "1.6 1.2" : bridgeSite && !owner ? "1.8 1.1" : camelStart && !camel ? "1.7 1.1" : undefined}
                      strokeLinecap="round"
                    />
                    {forgottenGiftType && (
                      <g className="pointer-events-none">
                        <circle
                          cx={edgeMidX}
                          cy={edgeMidY}
                          r="2.15"
                          fill={forgottenGiftClaimedSeatNo ? "#e2e8f0" : "#ccfbf1"}
                          stroke={forgottenGiftClaimedSeatNo ? "#64748b" : "#0f766e"}
                          strokeWidth="0.38"
                        />
                        <text x={edgeMidX} y={edgeMidY + 0.65} textAnchor="middle" className="select-none text-[1.55px] font-black" fill={forgottenGiftClaimedSeatNo ? "#475569" : "#0f766e"}>
                          {forgottenGiftLabel}
                        </text>
                      </g>
                    )}
                    {(bridgeSite || bridgeBuilt) && (
                      <g className="pointer-events-none">
                        <rect
                          x={edgeMidX - 2.1}
                          y={edgeMidY - 1.25}
                          width="4.2"
                          height="2.5"
                          rx="0.65"
                          fill={bridgeBuilt ? catanColorFill[ownerColor] || "#111827" : "#ecfeff"}
                          stroke={bridgeBuilt ? "#0f172a" : "#0891b2"}
                          strokeWidth="0.35"
                        />
                        <text
                          x={edgeMidX}
                          y={edgeMidY + 0.65}
                          textAnchor="middle"
                          className="select-none text-[1.45px] font-black"
                          fill={bridgeBuilt && ownerColor !== "WHITE" ? "#ffffff" : "#0e7490"}
                        >
                          다
                        </text>
                      </g>
                    )}
                    {(camel || camelStart) && (
                      <g className="pointer-events-none">
                        <circle cx={edgeMidX} cy={edgeMidY} r={camel ? "2.05" : "1.65"} fill={camel ? "#fb923c" : "#ffedd5"} stroke="#9a3412" strokeWidth="0.35" />
                        <text x={edgeMidX} y={edgeMidY + 0.6} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={camel ? "#7c2d12" : "#c2410c"}>
                          낙
                        </text>
                      </g>
                    )}
                    {barbarianKnightOwner > 0 && (
                      <g className="pointer-events-none">
                        <rect x={edgeMidX - 1.75} y={edgeMidY - 1.75} width="3.5" height="3.5" rx="0.7" fill={catanColorFill[barbarianKnightColor] || "#111827"} stroke="#7f1d1d" strokeWidth="0.35" />
                        <text x={edgeMidX} y={edgeMidY + 0.62} textAnchor="middle" className="select-none text-[1.5px] font-black" fill={barbarianKnightColor === "WHITE" ? "#0f172a" : "#ffffff"}>
                          기
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              {edges.map((edge) => {
                const cargoTypes = cargoTypesOf(edge);
                if (!cargoTypes.length) return null;
                return (
                  <g key={`cargo-${edge.id}`}>
                    {cargoTypes.map((cargoType, index) => {
                      const cargoMark = cargoMarkOf(cargoType);
                      const offset = cargoTypes.length > 1 ? (index === 0 ? -1.45 : 1.45) : 0;
                      return (
                        <g key={`${edge.id}-${cargoType}-${index}`}>
                          <circle cx={Number(edge.x) + offset} cy={edge.y} r="1.78" fill={cargoMark.fill} stroke={cargoMark.stroke} strokeWidth="0.35" />
                          <text x={Number(edge.x) + offset} y={Number(edge.y) + 0.6} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={cargoMark.stroke}>{cargoMark.label}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {councilDockEdgeIds.map((edgeId) => {
                const edge = edgeById.get(Number(edgeId));
                if (!edge) return null;
                return (
                  <g key={`council-${edgeId}`}>
                    <circle cx={edge.x} cy={edge.y} r="2.35" fill="#fefce8" stroke="#854d0e" strokeWidth="0.38" />
                    <text x={edge.x} y={Number(edge.y) + 0.7} textAnchor="middle" className="select-none text-[1.65px] font-black" fill="#854d0e">의</text>
                  </g>
                );
              })}
              {fishingGrounds.map((ground) => {
                const edge = edgeById.get(Number(get(ground, "edge_id", "edgeId", 0)));
                const x = Number(get(ground, "x", "x", edge?.x || 0));
                const y = Number(get(ground, "y", "y", edge?.y || 0));
                const numberToken = Number(get(ground, "number_token", "numberToken", 0));
                return (
                  <g key={`fishing-${ground.id}`}>
                    <circle cx={x} cy={y} r="2.8" fill="#e0f2fe" stroke="#0369a1" strokeWidth="0.42" />
                    <text x={x} y={y - 0.45} textAnchor="middle" className="select-none text-[1.25px] font-black" fill="#075985">낚</text>
                    <text x={x} y={y + 1.25} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "#075985"}>
                      {numberToken}
                    </text>
                  </g>
                );
              })}
              {clothVillages.map((village) => {
                const x = Number(get(village, "x", "x", 0));
                const y = Number(get(village, "y", "y", 0));
                const numberToken = Number(get(village, "number_token", "numberToken", 0));
                const supply = Number(get(village, "supply", "supply", 0));
                const connectedSeatNos = get(village, "connected_seat_nos", "connectedSeatNos", []) || [];
                const villageVertexId = Number(get(village, "vertex_id", "vertexId", 0));
                const selectVillage = () => setSelectedVertexId(villageVertexId);
                return (
                  <g
                    key={`cloth-village-${get(village, "id", "id", get(village, "vertex_id", "vertexId", 0))}`}
                    className="cursor-pointer"
                    onClick={selectVillage}
                    aria-label={`직물 마을 ${numberToken || "-"} 선택`}
                    {...keyboardActivateProps(selectVillage)}
                  >
                    <rect x={x - 3.6} y={y - 3.25} width="7.2" height="6.5" rx="1.8" fill={supply > 0 ? "#fdf4ff" : "#e2e8f0"} stroke={connectedSeatNos.length ? "#a21caf" : "#c026d3"} strokeWidth="0.42" />
                    <text x={x} y={y - 0.55} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={supply > 0 ? "#86198f" : "#475569"}>
                      천 {supply}
                    </text>
                    <text x={x} y={y + 1.45} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "#86198f"}>
                      {numberToken || "-"} · {connectedSeatNos.length}
                    </text>
                  </g>
                );
              })}
              {ports.map((port) => {
                const edge = edgeById.get(Number(get(port, "edge_id", "edgeId", 0)));
                if (!edge) return null;
                const portType = get(port, "port_type", "portType", "ANY");
                const ratio = Number(port.ratio || 3);
                const label = portType === "ANY" ? `${ratio}:1` : `${catanResourceLabels[portType] || portType} ${ratio}:1`;
                return (
                  <g key={port.id}>
                    <circle cx={edge.x} cy={edge.y} r="2.25" fill="#0f172a" opacity="0.72" />
                    <text x={edge.x} y={Number(edge.y) + 0.65} textAnchor="middle" className="select-none text-[1.65px] font-black" fill="#ffffff">
                      {label}
                    </text>
                  </g>
                );
              })}
              {vertices.map((vertex) => {
                const owner = Number(get(vertex, "owner_seat_no", "ownerSeatNo", 0));
                const ownerColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === owner)?.color;
                const knightOwner = Number(get(vertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
                const knightOwnerColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === knightOwner)?.color;
                const knightLevel = Number(get(vertex, "knight_level", "knightLevel", 0));
                const knightActive = Boolean(get(vertex, "knight_active", "knightActive", false));
                const hasCityWall = Boolean(get(vertex, "city_wall", "cityWall", false));
                const selected = selectedVertexId === Number(vertex.id);
                const selectVertex = () => setSelectedVertexId(Number(vertex.id));
                const vertexLabel = owner
                  ? `${playerName(owner)}의 ${get(vertex, "building_type", "buildingType", "") === "CITY" ? "도시" : get(vertex, "building_type", "buildingType", "") === "HARBOR_SETTLEMENT" ? "항구 정착지" : "마을"}`
                  : knightOwner
                    ? `${playerName(knightOwner)}의 기사 위치`
                    : "빈 정점";
                return (
                  <g
                    key={vertex.id}
                    className="cursor-pointer"
                    onClick={selectVertex}
                    aria-label={`${vertexLabel} 선택`}
                    {...keyboardActivateProps(selectVertex)}
                  >
                    <circle
                      cx={vertex.x}
                      cy={vertex.y}
                      r={owner ? 1.9 : selected ? 1.65 : 1.2}
                      fill={owner ? catanColorFill[ownerColor] || "#111827" : selected ? "#0f172a" : "#ffffff"}
                      stroke={ownerColor === "WHITE" ? "#94a3b8" : "#0f172a"}
                      strokeWidth={owner ? 0.45 : 0.25}
                    />
                    {owner && (
                      <text x={vertex.x} y={Number(vertex.y) + 0.75} textAnchor="middle" className="select-none text-[1.9px] font-black" fill={ownerColor === "WHITE" ? "#0f172a" : "#ffffff"}>
                        {get(vertex, "building_type", "buildingType", "") === "CITY" ? "도" : get(vertex, "building_type", "buildingType", "") === "HARBOR_SETTLEMENT" ? "항" : "마"}
                      </text>
                    )}
                    {!!cargoTypesOf(vertex).length && (() => {
                      const cargoTypes = cargoTypesOf(vertex);
                      return (
                        <g>
                          {cargoTypes.map((cargoType, index) => {
                            const cargoMark = cargoMarkOf(cargoType);
                            return (
                              <g key={`${vertex.id}-${cargoType}-${index}`}>
                                <circle cx={Number(vertex.x) + 2.15 + index * 1.65} cy={Number(vertex.y) - 2.15} r="1.35" fill={cargoMark.fill} stroke={cargoMark.stroke} strokeWidth="0.3" />
                                <text x={Number(vertex.x) + 2.15 + index * 1.65} y={Number(vertex.y) - 1.68} textAnchor="middle" className="select-none text-[1.1px] font-black" fill={cargoMark.stroke}>{cargoMark.label}</text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                    {hasCityWall && (
                      <circle
                        cx={vertex.x}
                        cy={vertex.y}
                        r="2.65"
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="0.55"
                        strokeDasharray="0.8 0.6"
                      />
                    )}
                    {!!knightOwner && (
                      <g>
                        <rect
                          x={Number(vertex.x) - 1.6}
                          y={Number(vertex.y) - 4.4}
                          width="3.2"
                          height="2.8"
                          rx="0.65"
                          fill={catanColorFill[knightOwnerColor] || "#111827"}
                          stroke={knightActive ? "#fef08a" : "#0f172a"}
                          strokeWidth={knightActive ? 0.55 : 0.28}
                        />
                        <text x={vertex.x} y={Number(vertex.y) - 2.42} textAnchor="middle" className="select-none text-[1.75px] font-black" fill={knightOwnerColor === "WHITE" ? "#0f172a" : "#ffffff"}>
                          기{knightLevel}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {renderSelectedTargetSummary({
            className: "tabletop-mobile-action-strip sticky z-20 mt-3 shadow-xl backdrop-blur xl:hidden",
            surfaceClassName: "bg-white/95",
            showActionJump: true,
          })}
        </div>
      </div>

        <section className="scroll-mt-24 space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-900">핵심 요약</div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">보드와 액션을 본 뒤 승점, 차례, 선택 대상만 압축해서 확인합니다.</div>
            </div>
            <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
              목표 {winningPoints}점
            </div>
          </div>
          <div data-smoke="catan-flow-meter" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {catanFlowItems.map((item) => (
              <div key={item.label} data-smoke="catan-flow-summary-item" className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 truncate text-sm font-black text-slate-900">{item.value}</div>
                <div className="mt-0.5 line-clamp-1 text-[10px] font-bold text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <details className="rounded-xl border border-slate-100 bg-slate-50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-700">승점 상세</summary>
            <div className="px-3 pb-3">
              <CatanVictoryTrackPanel
                rows={catanVictoryTrackRows}
                target={winningPoints}
                phase={phase}
                mySeatNo={mySeatNo}
              />
            </div>
          </details>
        </section>

      <aside className="space-y-4">
        <div id="catan-action-panel" className="catan-action-panel scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-900">액션</div>
              <div className="text-[11px] font-bold text-slate-500">{catanPhaseLabel} · {myTurn ? "내 차례" : `${playerName(activeSeatNo)} 차례`}</div>
            </div>
            <a
              href="#catan-board-panel"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700 xl:hidden"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              보드 보기
            </a>
          </div>
          {renderSelectedTargetSummary({ className: "mb-3" })}
          {phase === "SETUP" && (
            <div className="space-y-2">
              {seafarersRule && !explorersPiratesRule && seafarersScenarioCode === "NEW_SHORES" && (
                <div className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
                  초기 배치는 본섬에서만 진행합니다. 외딴 섬에 처음 마을을 세우면 특별 승점 2점을 받습니다.
                </div>
              )}
              {seafarersScenarioCode === "FOUR_ISLANDS" && (
                <div className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
                  초기 배치한 섬이 내 홈 섬입니다. 다른 섬에 처음 마을을 세우면 섬마다 특별 승점 2점을 받습니다.
                </div>
              )}
              {fogIslandsRule && (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  초기 배치는 드러난 섬에서 시작합니다. 안개 타일은 배나 도로가 닿을 때 공개되고, 이 시나리오는 특별 승점 없이 12점으로 끝납니다.
                </div>
              )}
              {throughDesertRule && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  초기 배치는 본섬에서만 가능합니다. 해안에서는 도로 대신 배를 놓을 수 있고, 외국 지역에 새 마을을 세우면 지역마다 특별 승점 2점을 받습니다.
                </div>
              )}
              {forgottenTribeRule && (
                <div className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">
                  초기 배치는 본섬에서 시작합니다. 부족 섬은 선물만 받을 수 있는 섬이라 마을을 지을 수 없고, 배로 선물 해안에 닿아야 합니다.
                </div>
              )}
              {clothForCatanRule && (
                <div className="rounded-xl bg-fuchsia-50 px-3 py-2 text-xs font-bold text-fuchsia-800">
                  초기 배치는 두 본섬에서 시작합니다. 가운데 부족 마을에는 정착할 수 없고, 배로 부족 마을과 내 정착지를 연결해야 직물 교역이 시작됩니다.
                </div>
              )}
              {explorersPiratesRule && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  첫 배치는 해안의 항구 정착지와 배, 두 번째 배치는 일반 마을 기준으로 진행합니다.
                </div>
              )}
              <button className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => setupBuild().catch(() => notifyError("초기 배치 위치를 확인해주세요."))}>
                {explorersPiratesRule ? "항구/마을과 길 배치" : seafarersRule ? "정착지와 도로/배 배치" : "정착지와 도로 배치"}
              </button>
            </div>
          )}
          {phase === "CAMEL_BID" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold leading-relaxed text-orange-800">
                {playerName(camelBidCurrentSeatNo || activeSeatNo)}이 낙타 배치권에 입찰합니다. 양털과 곡물은 낸 만큼 모두 사용됩니다.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["WOOL", "양털"],
                  ["GRAIN", "곡물"],
                ].map(([resource, label]) => (
                  <label key={resource} className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="block text-[11px] font-bold text-slate-500">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max={resources?.[resource] ?? 0}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black"
                      value={camelBidForm[resource]}
                      onChange={(event) => setCamelBidForm((prev) => ({ ...prev, [resource]: Math.max(0, Number(event.target.value) || 0) }))}
                    />
                  </label>
                ))}
              </div>
              {!!camelBids.length && (
                <div className="flex flex-wrap gap-1">
                  {camelBids.map((bid) => (
                    <span key={get(bid, "seat_no", "seatNo", 0)} className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-black text-orange-700">
                      {playerName(get(bid, "seat_no", "seatNo", 0))} {get(bid, "total", "total", 0)}
                    </span>
                  ))}
                </div>
              )}
              <button className="w-full rounded-xl bg-orange-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => bidCamel().catch(() => notifyError("입찰할 양털/곡물 수량을 확인해주세요."))}>
                입찰 제출
              </button>
            </div>
          )}
          {phase === "PLACE_CAMEL" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold leading-relaxed text-orange-800">
                {playerName(camelPlacerSeatNo || activeSeatNo)}이 낙타를 배치합니다. 오아시스 시작 표식 또는 기존 낙타 행렬의 끝 경로를 선택하세요.
              </div>
              <button className="w-full rounded-xl bg-orange-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedEdgeId} onClick={() => placeCamel().catch(() => notifyError("낙타를 놓을 수 있는 경로를 선택해주세요."))}>
                선택 경로에 낙타 배치
              </button>
            </div>
          )}
          {phase === "ROLL" && (
            <div className="space-y-3">
              <button className="w-full rounded-xl bg-amber-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => onAction({ action_type: "ROLL_DICE" }).catch(() => notifyError("주사위 굴리기 실패"))}>
                주사위 굴리기
              </button>
              {citiesKnightsRule && !!alchemistCards.length && (
                <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <select className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={selectedAlchemistCardId} onChange={(event) => setSelectedProgressCardId(event.target.value)}>
                    {alchemistCards.map((card) => (
                      <option key={card.id} value={card.id}>연금술사</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={alchemistDice.red} onChange={(event) => setAlchemistDice((prev) => ({ ...prev, red: Number(event.target.value) }))}>
                      {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>적색 {value}</option>)}
                    </select>
                    <select className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={alchemistDice.white} onChange={(event) => setAlchemistDice((prev) => ({ ...prev, white: Number(event.target.value) }))}>
                      {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>흰색 {value}</option>)}
                    </select>
                  </div>
                  <button className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => playAlchemistCard().catch(() => notifyError("연금술사 사용 조건을 확인해주세요."))}>
                    연금술사로 주사위 확정
                  </button>
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!playableDevelopmentCards.length && (
                <div className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                  <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
                    {playableDevelopmentCards.map((card) => (
                      <option key={card.id} value={card.id}>{catanDevelopmentLabels[card.type] || card.type}</option>
                    ))}
                  </select>
                  {selectedDevCard?.type === "KNIGHT" && !!robberTargets.length && (
                    <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                      {robberTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 1장 뽑기</option>;
                      })}
                    </select>
                  )}
                  {selectedDevCard?.type === "ROAD_BUILDING" && (
                    <button type="button" className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-violet-700" onClick={addRoadCardEdge}>
                      선택 간선 추가 ({roadCardEdges.join(", ") || "없음"})
                    </button>
                  )}
                  <button className="w-full rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!canPlaySelectedDevelopmentCard} onClick={() => playDevelopmentCard().catch(() => notifyError("개발 카드 사용 조건을 확인해주세요."))}>
                    개발 카드 사용
                  </button>
                  {devCardAlreadyPlayedThisTurn && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      개발 카드는 한 턴에 1장만 사용할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!lockedDevelopmentCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  이번 턴에 구입한 개발 카드 {lockedDevelopmentCards.length}장은 다음 내 턴부터 사용할 수 있습니다.
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !playableDevelopmentCards.length && !!passiveDevelopmentVictoryCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  승점 개발 카드는 사용하지 않아도 내 점수에 자동 반영됩니다.
                </div>
              )}
            </div>
          )}
          {phase === "DISCARD" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold leading-relaxed text-rose-700">
                {sevenDiscardMessage}
              </div>
              <CatanDiscardPlannerPanel
                resources={resources}
                commodities={commodities}
                discardForm={discardForm}
                discardCommodityForm={discardCommodityForm}
                discardRequired={discardRequired}
                discardTotal={discardTotal}
                mustDiscard={mustDiscard}
                pendingNames={listOf(pendingDiscardSeatNos).map((seatNo) => playerName(Number(seatNo)))}
                citiesKnightsRule={citiesKnightsRule}
                explorersPiratesRule={explorersPiratesRule}
                robberLocked={citiesKnightsRobberLocked}
              />
              {mustDiscard ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                        <span>{label}</span>
                        <input
                          type="number"
                          min="0"
                          max={resources?.[key] ?? 0}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black text-slate-900"
                          value={discardForm[key] || 0}
                          onChange={(event) => setDiscardForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value || 0)) }))}
                        />
                      </label>
                    ))}
                  </div>
                  {citiesKnightsRule && (
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(catanCommodityLabels).map(([key, label]) => (
                        <label key={key} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                          <span>{label}</span>
                          <input
                            type="number"
                            min="0"
                            max={commodities?.[key] ?? 0}
                            className="mt-1 w-full rounded-lg border border-rose-100 px-2 py-1 text-sm font-black text-slate-900"
                            value={discardCommodityForm[key] || 0}
                            onChange={(event) => setDiscardCommodityForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value || 0)) }))}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white" onClick={() => discardResources().catch(() => notifyError("버릴 자원을 확인해주세요."))}>
                    {discardTotal}/{discardRequired}장 버리기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-500">
                  버릴 자원이 있는 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "PROGRESS_DISCARD" && (
            <div className="space-y-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-fuchsia-800">
                진행 카드는 승점 카드를 제외하고 4장까지만 보유할 수 있습니다. 초과한 플레이어가 직접 버릴 카드를 고릅니다.
              </div>
              <CatanProgressDiscardPlannerPanel
                progressCards={progressCards}
                nonVictoryCards={nonVictoryProgressCards}
                selectedCardId={selectedDiscardProgressCardId}
                discardRequired={progressDiscardRequired}
                mustDiscardProgress={mustDiscardProgress}
                pendingNames={listOf(pendingProgressDiscardSeatNos).map((seatNo) => playerName(Number(seatNo)))}
              />
              {mustDiscardProgress ? (
                <>
                  <select className="w-full rounded-xl border border-fuchsia-100 px-3 py-2 text-xs font-bold" value={selectedDiscardProgressCardId} onChange={(event) => setSelectedProgressCardId(event.target.value)}>
                    {nonVictoryProgressCards.map((card) => {
                      const cardType = get(card, "type", "type", "");
                      return <option key={card.id} value={card.id}>{catanProgressLabels[cardType] || cardType}</option>;
                    })}
                  </select>
                  <button className="w-full rounded-xl bg-fuchsia-700 px-3 py-3 text-sm font-black text-white" onClick={() => discardProgressCard().catch(() => notifyError("버릴 진행 카드를 확인해주세요."))}>
                    {progressDiscardRequired || 1}장 남음
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-fuchsia-700">
                  진행 카드를 버릴 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "DEFENDER_PROGRESS_CHOICE" && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-amber-800">
                야만인을 함께 막아 방어자 점수 대신 진행 카드를 받습니다. 순서: {pendingDefenderProgressSeatNos.map((seatNo) => playerName(seatNo)).join(" → ") || "대기"}
              </div>
              {mustChooseDefenderProgress ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select className="rounded-xl border border-amber-100 px-3 py-2 text-xs font-bold" value={selectedImprovementType} onChange={(event) => setSelectedImprovementType(event.target.value)}>
                    {Object.entries(catanImprovementLabels).map(([key, label]) => <option key={key} value={key}>{label} 진행 카드</option>)}
                  </select>
                  <button className="rounded-xl bg-amber-700 px-3 py-3 text-sm font-black text-white" onClick={() => chooseDefenderProgressCard().catch(() => notifyError("받을 진행 카드 종류를 확인해주세요."))}>
                    카드 받기
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-amber-700">
                  방어자들이 진행 카드 종류를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "DESERTER_REMOVE" && (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-blue-800">
                {playerName(pendingDeserterAttackerSeatNo)}의 탈영병 카드입니다. {playerName(pendingDeserterTargetSeatNo)}이 제거할 자기 기사를 선택합니다.
              </div>
              <button className="w-full rounded-xl bg-blue-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={pendingDeserterTargetSeatNo !== mySeatNo} onClick={() => removeDeserterKnight().catch(() => notifyError("제거할 기사를 확인해주세요."))}>
                선택 기사 제거
              </button>
            </div>
          )}
          {phase === "DESERTER_PLACE" && (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-blue-800">
                {playerName(pendingDeserterAttackerSeatNo)}이 {pendingDeserterKnightLevel}단계 탈영 기사를 배치합니다.
              </div>
              <button className="w-full rounded-xl bg-blue-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={pendingDeserterAttackerSeatNo !== mySeatNo} onClick={() => placeDeserterKnight().catch(() => notifyError("배치할 정점을 확인해주세요."))}>
                탈영 기사 배치
              </button>
            </div>
          )}
          {phase === "INTRIGUE_MOVE" && (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-indigo-800">
                {playerName(pendingIntrigueAttackerSeatNo)}의 음모 카드입니다. {playerName(pendingIntrigueTargetSeatNo)}이 {pendingIntrigueKnightLevel}단계 기사를 자기 도로망의 빈 정점으로 옮깁니다.
              </div>
              <button className="w-full rounded-xl bg-indigo-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={pendingIntrigueTargetSeatNo !== mySeatNo} onClick={() => moveIntrigueKnight().catch(() => notifyError("기사를 옮길 정점을 확인해주세요."))}>
                밀려난 기사 이동
              </button>
            </div>
          )}
          {phase === "DISPLACED_KNIGHT_MOVE" && (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-indigo-800">
                {playerName(pendingDisplacedKnightTargetSeatNo)}의 {pendingDisplacedKnightLevel}단계 기사가 밀려났습니다. 자기 도로망의 빈 교차점을 선택해 옮깁니다.
              </div>
              <button className="w-full rounded-xl bg-indigo-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!mustMoveDisplacedKnight} onClick={() => moveDisplacedKnight().catch(() => notifyError("기사를 옮길 교차점을 확인해주세요."))}>
                밀려난 기사 이동
              </button>
            </div>
          )}
          {phase === "COMMERCIAL_HARBOR" && (
            <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-emerald-800">
                {playerName(pendingCommercialHarborSeatNo)}이 {catanResourceLabels[pendingCommercialHarborResourceType] || pendingCommercialHarborResourceType} 1장을 건넵니다. 대상 플레이어는 줄 상품을 선택합니다.
              </div>
              <select className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={selectedCommodityType} onChange={(event) => setSelectedCommodityType(event.target.value)}>
                {Object.entries(catanCommodityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!pendingCommercialHarborSeatNos.map(Number).includes(mySeatNo)} onClick={() => respondCommercialHarbor().catch(() => notifyError("줄 상품을 확인해주세요."))}>
                상품 주고 자원 받기
              </button>
            </div>
          )}
          {phase === "MASTER_MERCHANT_CHOOSE" && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-amber-800">
                {playerName(pendingMasterMerchantAttackerSeatNo)}이 {playerName(pendingMasterMerchantTargetSeatNo)}의 손패에서 {pendingMasterMerchantCount}장을 고릅니다.
              </div>
              {pendingMasterMerchantAttackerSeatNo === mySeatNo ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-amber-800">
                        <span>{label} · 보유 {masterMerchantTargetResources?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={masterMerchantTargetResources?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-amber-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={masterMerchantResources[key] || 0}
                          onChange={(event) => setMasterMerchantResources((prev) => ({
                            ...prev,
                            [key]: Math.min(masterMerchantTargetResources?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                    {Object.entries(catanCommodityLabels).map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-amber-800">
                        <span>{label} · 보유 {masterMerchantTargetCommodities?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={masterMerchantTargetCommodities?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-amber-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={masterMerchantCommodities[key] || 0}
                          onChange={(event) => setMasterMerchantCommodities((prev) => ({
                            ...prev,
                            [key]: Math.min(masterMerchantTargetCommodities?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  <button className="w-full rounded-xl bg-amber-700 px-3 py-3 text-sm font-black text-white" onClick={() => chooseMasterMerchantCards().catch(() => notifyError("가져올 카드를 확인해주세요."))}>
                    {masterMerchantTotal}/{pendingMasterMerchantCount}장 가져오기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-amber-700">
                  대상인을 사용한 플레이어가 가져갈 카드를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "SPY_CHOOSE" && (
            <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-rose-800">
                {playerName(pendingSpyAttackerSeatNo)}이 {playerName(pendingSpyTargetSeatNo)}의 진행 카드를 확인 중입니다. 승점 진행 카드는 선택할 수 없습니다.
              </div>
              {pendingSpyAttackerSeatNo === mySeatNo ? (
                <>
                  <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedSpyCardId} onChange={(event) => setSelectedSpyCardId(event.target.value)}>
                    {revealedSpyCards.map((card) => {
                      const cardType = get(card, "type", "type", "");
                      return <option key={card.id} value={card.id}>{catanProgressLabels[cardType] || cardType}</option>;
                    })}
                  </select>
                  <button className="w-full rounded-xl bg-rose-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!revealedSpyCards.length} onClick={() => chooseSpyProgressCard().catch(() => notifyError("가져올 진행 카드를 확인해주세요."))}>
                    선택한 카드 가져오기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-rose-700">
                  첩자를 사용한 플레이어가 가져갈 카드를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "WEDDING_GIVE" && (
            <div className="space-y-3 rounded-2xl border border-pink-100 bg-pink-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-pink-800">
                {playerName(pendingWeddingAttackerSeatNo)}의 혼례 카드입니다. 점수가 더 높은 대상 플레이어가 줄 카드 2장을 직접 선택합니다.
              </div>
              <CatanWeddingResponsePanel
                attackerName={playerName(pendingWeddingAttackerSeatNo)}
                mustRespondWedding={mustRespondWedding}
                weddingRequired={weddingRequired}
                weddingTotal={weddingTotal}
                weddingResources={weddingResources}
                weddingCommodities={weddingCommodities}
                resources={resources}
                commodities={commodities}
                pendingNames={listOf(pendingWeddingSeatNos).map((seatNo) => playerName(Number(seatNo)))}
              />
              {mustRespondWedding ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-pink-800">
                        <span>{label} · 보유 {resources?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={resources?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-pink-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={weddingResources[key] || 0}
                          onChange={(event) => setWeddingResources((prev) => ({
                            ...prev,
                            [key]: Math.min(resources?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                    {Object.entries(catanCommodityLabels).map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-pink-800">
                        <span>{label} · 보유 {commodities?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={commodities?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-pink-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={weddingCommodities[key] || 0}
                          onChange={(event) => setWeddingCommodities((prev) => ({
                            ...prev,
                            [key]: Math.min(commodities?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  <button className="w-full rounded-xl bg-pink-700 px-3 py-3 text-sm font-black text-white" onClick={() => respondWeddingCards().catch(() => notifyError("줄 카드를 확인해주세요."))}>
                    {weddingTotal}/{weddingRequired}장 주기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-pink-700">
                  혼례 대상 플레이어가 줄 카드를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "GOLD_CHOICE" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-700">
                금광에서 받을 자원을 선택합니다. 마을은 1장, 도시는 원하는 조합 2장을 받습니다.
              </div>
              {myGoldChoice ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                        <span>{label} · 은행 {resourceBank?.[key] ?? "-"}장</span>
                        <input
                          type="number"
                          min="0"
                          max={Math.min(goldRequired, Number(resourceBank?.[key] ?? goldRequired))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black text-slate-900"
                          value={goldForm[key] || 0}
                          onChange={(event) => setGoldForm((prev) => ({
                            ...prev,
                            [key]: Math.min(Number(resourceBank?.[key] ?? goldRequired), Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  {!goldChoiceWithinBank && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-amber-700">
                      은행에 부족한 자원은 선택할 수 없습니다.
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-amber-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={goldTotal !== goldRequired || !goldChoiceWithinBank} onClick={() => chooseGoldResources().catch(() => notifyError("금광 자원 선택을 확인해주세요."))}>
                    {goldTotal}/{goldRequired}장 받기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-500">
                  금광 자원을 선택 중인 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "AQUEDUCT_CHOICE" && (
            <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-cyan-800">
                생산을 받지 못한 수로 보유 플레이어가 원하는 자원 1장을 선택합니다.
              </div>
              {myAqueductChoice ? (
                <>
                  <select className="w-full rounded-xl border border-cyan-100 px-3 py-2 text-xs font-bold" value={selectedAqueductResourceType} onChange={(event) => setSelectedAqueductResourceType(event.target.value)}>
                    {catanResourceEntries.map(([key, label]) => <option key={key} value={key} disabled={!bankAvailableFor(key, 1)}>{label} · 은행 {resourceBank?.[key] ?? "-"}장</option>)}
                  </select>
                  {!aqueductWithinBank && (
                    <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-cyan-700">
                      은행에 남은 {catanResourceLabels[selectedAqueductResourceType]} 카드가 없습니다.
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-cyan-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!aqueductWithinBank} onClick={() => chooseAqueductResource().catch(() => notifyError("수로 자원 선택을 확인해주세요."))}>
                    선택한 자원 받기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-cyan-700">
                  수로 자원을 선택 중인 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "ROBBER" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
                {explorersPiratesRule ? "발견된 바다 칸 중 시작 섬과 닿지 않는 곳으로 해적선을 이동합니다." : "선택한 육지 타일로 도적을 이동합니다."}
              </div>
              {!!robberTargets.length && (
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                  {robberTargets.map((player) => {
                    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                    return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 1장 뽑기</option>;
                  })}
                </select>
              )}
              <button className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => moveRobber().catch(() => notifyError(explorersPiratesRule ? "해적 이동 실패" : "도적 이동 실패"))}>
                {explorersPiratesRule || selectedHex?.terrain === "SEA" ? "해적 이동" : "도적 이동"}
              </button>
            </div>
          )}
          {phase === "ACTION" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["ROAD", "도로"],
                  ...(riversRule ? [["BRIDGE", "다리"]] : []),
                  ...(seafarersRule ? [["SHIP", "배"], ["MOVE_SHIP", "배 이동"]] : []),
                  ...(citiesKnightsRule ? [["KNIGHT", "기사"], ["CITY_WALL", "성벽"]] : []),
                  ["SETTLEMENT", "마을"],
                  ...(explorersPiratesRule ? [["HARBOR_SETTLEMENT", "항구 정착지"]] : [["CITY", "도시"]]),
                ].map(([mode, label]) => (
                  <button key={mode} className={`rounded-xl px-3 py-2 text-xs font-black ${buildMode === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setBuildMode(mode)}>
                    {label}
                  </button>
                ))}
              </div>
              {seafarersRule && buildMode === "MOVE_SHIP" && (
                explorersPiratesRule ? (
                  <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
                    <div className="text-xs font-black text-cyan-800">배 이동 경로 {shipMovePath.join(" -> ") || "없음"} · 최대 {shipMoveMaxSteps}칸</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-cyan-700 disabled:opacity-40"
                        disabled={!selectedEdgeId || shipMovePath.length >= shipMoveMaxEdges}
                        onClick={() => setShipMovePath((prev) => (selectedEdgeId && !prev.includes(selectedEdgeId) ? [...prev, selectedEdgeId].slice(0, shipMoveMaxEdges) : prev))}
                      >
                        선택 간선 추가
                      </button>
                      <button type="button" className="rounded-xl bg-cyan-100 px-3 py-2 text-xs font-black text-cyan-800" onClick={() => setShipMovePath([])}>
                        경로 초기화
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="w-full rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700" onClick={() => setShipMoveFromEdgeId(selectedEdgeId)}>
                    선택 간선을 이동할 배로 지정 ({shipMoveFromEdgeId || "없음"})
                  </button>
                )
              )}
              <button className="w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={selectedBuildActionDisabled} onClick={() => build().catch(() => notifyError("건설 조건이나 자원을 확인해주세요."))}>
                선택 위치에 실행
              </button>
              {citiesKnightsRule && buildMode === "KNIGHT" && selectedVertexKnightBuildWarning && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">
                  {selectedVertexKnightBuildWarning}
                </div>
              )}
              {riversRule && (
                <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-cyan-800">
                    <span className="font-black">강 골드</span>
                    <span>보유 {myGold}개 · 이번 턴 교환 {riverGoldTradesRemaining}/2회</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="rounded-xl border border-cyan-100 px-3 py-2 text-xs font-bold text-slate-700" value={tradeForm.receive} onChange={(event) => setTradeForm((prev) => ({ ...prev, receive: event.target.value }))}>
                      {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <button type="button" className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || myGold < 2 || riverGoldTradesRemaining <= 0} onClick={() => spendGoldForResource().catch(() => notifyError("골드 2개와 받을 자원을 확인해주세요."))}>
                      골드 2개 교환
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-cyan-900">
                    다리 표식이 있는 강 간선은 다리 모드로 건설합니다. 다리는 벽돌 2개와 목재 1개가 필요하며 건설 즉시 골드 2개를 얻습니다.
                  </div>
                </div>
              )}
              {caravansRule && (
                <div className="space-y-2 rounded-2xl border border-orange-100 bg-orange-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-orange-800">
                    <span className="font-black">대상단</span>
                    <span>남은 낙타 {camelSupply}개 · 대기 {pendingCamelPlacements}회</span>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-orange-900">
                    마을/도시 건설 후 턴을 종료하면 입찰 단계가 열립니다. 보드의 낙 표식이 낙타 시작 경로와 배치된 행렬입니다.
                  </div>
                </div>
              )}
              {barbarianAttackRule && (
                <div className="space-y-2 rounded-2xl border border-red-100 bg-red-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-red-800">
                    <span className="font-black">야만인 침공</span>
                    <span>남은 야만인 {barbarianAttackSupply}개</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-red-700 disabled:opacity-40" disabled={!myTurn || !selectedEdgeId || selectedDevCard?.type !== "KNIGHT"} onClick={() => recruitBarbarianKnight().catch(() => notifyError("기사 개발 카드와 빈 경로를 확인해주세요."))}>
                      기사 카드로 방어 기사 배치
                    </button>
                    <button type="button" className="rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId} onClick={() => expelBarbarians().catch(() => notifyError("격퇴 조건을 만족하는 야만인 타일을 선택해주세요."))}>
                      선택 타일 야만인 격퇴
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-red-900">
                    기 표식은 방어 기사입니다. 야만인 숫자보다 인접 기사가 많으면 격퇴할 수 있고, 포획 야만인 2개마다 승점 1점을 얻습니다.
                  </div>
                </div>
              )}
              {fishermenRule && (
                <div className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-sky-800">
                    <span className="font-black">물고기 시장</span>
                    <span>보유 {fishermenFishTotal}마리 · 토큰 {fishermenTokens.length}/7개{myHasOldBoot ? " · 낡은 장화" : ""}</span>
                  </div>
                  {!!fishermenTokens.length && (
                    <div className="flex flex-wrap gap-1">
                      {fishermenTokens.map((token, index) => (
                        <span key={`${token}-${index}`} className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-sky-700">{token}마리</span>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="rounded-xl border border-sky-100 px-3 py-2 text-xs font-bold text-slate-700" value={tradeForm.receive} onChange={(event) => setTradeForm((prev) => ({ ...prev, receive: event.target.value }))}>
                      {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <button type="button" className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 4} onClick={() => spendFish("SPEND_FISH_TAKE_RESOURCE", { resource_type: tradeForm.receive }).catch(() => notifyError("물고기 4마리 이상과 받을 자원을 확인해주세요."))}>
                      자원 받기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 2} onClick={() => spendFish("SPEND_FISH_MOVE_ROBBER").catch(() => notifyError("물고기 2마리 이상이 필요합니다."))}>
                      도둑 사막으로
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 5 || !selectedEdgeId} onClick={() => spendFish("SPEND_FISH_BUILD_ROAD", { edge_id: selectedEdgeId }).catch(() => notifyError("물고기 5마리와 건설 가능한 간선을 선택해주세요."))}>
                      무료 도로
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="rounded-xl border border-sky-100 px-3 py-2 text-xs font-bold text-slate-700" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                      <option value="">상대 선택</option>
                      {fishActionTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)} 자원 {get(player, "resource_count", "resourceCount", 0)}장</option>;
                      })}
                    </select>
                    <button type="button" className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 3 || !targetSeatNo} onClick={() => spendFish("SPEND_FISH_STEAL_RESOURCE", { target_seat_no: Number(targetSeatNo) }).catch(() => notifyError("물고기 3마리와 카드를 가진 상대가 필요합니다."))}>
                      자원 뽑기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 7} onClick={() => spendFish("SPEND_FISH_DRAW_DEVELOPMENT").catch(() => notifyError("물고기 7마리와 남은 개발 카드가 필요합니다."))}>
                      개발 카드 받기
                    </button>
                    <button type="button" className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 disabled:opacity-40" disabled={!myTurn || !myHasOldBoot || !targetSeatNo || !oldBootTargets.some((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(targetSeatNo))} onClick={() => spendFish("GIVE_OLD_BOOT", { target_seat_no: Number(targetSeatNo) }).catch(() => notifyError("나보다 승점이 같거나 높은 플레이어에게만 넘길 수 있습니다."))}>
                      장화 넘기기
                    </button>
                  </div>
                </div>
              )}
              {explorersPiratesRule && (
                <div className="space-y-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <div className="text-xs font-black text-amber-800">
                    정착민 화물 · 항구/배/상륙 교차점을 선택해 순서대로 처리합니다.
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-40" disabled={!myTurn} onClick={() => buildSettler().catch(() => notifyError("정착민을 놓을 항구나 배를 확인해주세요."))}>
                      정착민 준비
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-40" disabled={!myTurn || !selectedVertexId || !selectedEdgeId} onClick={() => loadSettler().catch(() => notifyError("항구와 배가 맞닿아 있는지 확인해주세요."))}>
                      배에 싣기
                    </button>
                    <button type="button" className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedVertexId || !selectedEdgeId} onClick={() => foundSettlementFromShip().catch(() => notifyError("상륙 위치와 거리 규칙을 확인해주세요."))}>
                      상륙 마을
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 disabled:opacity-40" disabled={!myTurn} onClick={() => buildCrew().catch(() => notifyError("승무원을 놓을 항구나 배를 확인해주세요."))}>
                      승무원 준비
                    </button>
                    <button type="button" className="rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId || !selectedEdgeId} onClick={() => unloadCrewToPirateLair().catch(() => notifyError("해적 소굴과 승무원이 탄 배가 맞닿아야 합니다."))}>
                      해적 소굴 공격
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-amber-800">
                    어획물 공급 {fishHaulsInSupply}개{fishHaulDie ? ` · 최근 어장 주사위 ${fishHaulDie}` : ""} · 선택 화물 {cargoLabelOf(selectedEdge) !== "없음" ? cargoLabelOf(selectedEdge) : cargoLabelOf(selectedVertex)}
                  </div>
                  <div className="rounded-xl bg-yellow-50 px-3 py-2 text-[11px] font-bold text-yellow-800">
                    향신료 이점 · 항해 +{mySpiceAdvantageCounts.SWIFT_VOYAGE} · 해적 {mySpiceAdvantageCounts.PIRATE_BONUS} · 빠른 금 {fastGoldRemaining}/{mySpiceAdvantageCounts.FAST_GOLD}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-40" disabled={!myTurn} onClick={() => rollFishHaul().catch(() => notifyError("이번 턴에는 어장 주사위를 굴릴 수 없습니다."))}>
                      어장 주사위
                    </button>
                    <button type="button" className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId || !selectedEdgeId} onClick={() => catchFish().catch(() => notifyError("어획물이 있는 어장과 빈 배가 맞닿아야 합니다."))}>
                      어획물 싣기
                    </button>
                    <button type="button" className="rounded-xl bg-yellow-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId || !selectedEdgeId} onClick={() => collectSpice().catch(() => notifyError("향신료 마을과 승무원 배가 맞닿아야 합니다."))}>
                      향신료 싣기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <select className="rounded-xl border border-yellow-100 px-3 py-2 text-xs font-bold text-slate-700" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                      {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <button type="button" className="rounded-xl bg-yellow-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fastGoldRemaining <= 0} onClick={() => sellResourceForGold().catch(() => notifyError("판매할 자원과 빠른 금 사용 가능 횟수를 확인해주세요."))}>
                      빠른 금
                    </button>
                    <button type="button" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-40" disabled={!myTurn || !selectedHexId || mySpiceAdvantageCounts.PIRATE_BONUS <= 0} onClick={() => chaseAwayPirate().catch(() => notifyError("내 배가 해적에 닿아 있는지, 보낼 바다 칸을 선택했는지 확인해주세요."))}>
                      해적 몰아내기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-40" disabled={!myTurn || !selectedVertexId || !selectedEdgeId} onClick={() => transferCargo().catch(() => notifyError("항구 정착지와 배의 화물 교환 조건을 확인해주세요."))}>
                      항구 화물 교환
                    </button>
                    <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedEdgeId} onClick={() => deliverCargo().catch(() => notifyError("의회 선착장에 닿은 어획물/향신료 배를 선택해주세요."))}>
                      의회에 납품
                    </button>
                  </div>
                </div>
              )}
              {citiesKnightsRule && (
                <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50 p-3">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedImprovementType} onChange={(event) => setSelectedImprovementType(event.target.value)}>
                      {Object.entries(catanImprovementLabels).map(([key, label]) => {
                        const nextLevel = Number(cityImprovements?.[key] || 0) + 1;
                        return <option key={key} value={key}>{label} {Math.min(nextLevel, 5)}단계</option>;
                      })}
                    </select>
                    <button type="button" className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => buildCityImprovement().catch(() => notifyError("도시 발전 조건을 확인해주세요."))}>
                      발전
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedOwnKnight} onClick={() => activateKnight().catch(() => notifyError("기사 활성화 조건을 확인해주세요."))}>
                      기사 활성화
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedKnightCanPromote} onClick={() => promoteKnight().catch(() => notifyError("기사 승급 조건을 확인해주세요."))}>
                      기사 승급
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedKnightCanChaseRobber} onClick={() => chaseRobberWithKnight().catch(() => notifyError("도적 추방 조건을 확인해주세요."))}>
                      도적 쫓아내기
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedOwnKnight} onClick={markKnightMoveSource}>
                      이동 출발 지정
                    </button>
                    <button type="button" className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedKnightCanMove} onClick={() => moveKnight().catch(() => notifyError("기사 이동 조건을 확인해주세요."))}>
                      기사 이동
                    </button>
                  </div>
                  {(selectedOwnKnight || knightMoveSource) && (
                    <div className="rounded-lg bg-white/70 px-3 py-2 text-[11px] font-bold text-rose-700">
                      이동 출발 {knightMoveSourceLabel} · 활성 기사는 다음 턴부터 도로망을 따라 이동하거나, 도적과 닿아 있으면 숫자 타일로 도적을 쫓아낼 수 있습니다.
                    </div>
                  )}
                  {knightMoveSource && selectedVertex && !selectedKnightDestinationReachable && (
                    <div className="rounded-lg bg-white/70 px-3 py-2 text-[11px] font-bold text-rose-700">
                      선택한 교차점은 이동 출발점과 내 도로망으로 연결되어 있지 않습니다.
                    </div>
                  )}
                  {!!actionProgressCards.length && (
                    <div className="space-y-2 rounded-xl bg-white/70 p-2">
                      <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedProgressCardId} onChange={(event) => setSelectedProgressCardId(event.target.value)}>
                        {actionProgressCards.map((card) => {
                          const cardType = get(card, "type", "type", "");
                          return <option key={card.id} value={card.id}>{catanProgressLabels[cardType] || get(card, "title", "title", cardType)}</option>;
                        })}
                      </select>
                      {selectedProgressType === "ALCHEMIST" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          연금술사는 주사위 단계에서 굴리기 전에만 사용할 수 있습니다.
                        </div>
                      )}
                      {selectedProgressType === "CRANE" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          위 도시 발전 선택값을 상품 1개 할인해 올립니다.
                        </div>
                      )}
                      {selectedProgressType === "ENGINEER" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택 정점의 내 도시에 성벽을 무료로 세웁니다.
                        </div>
                      )}
                      {selectedProgressType === "INVENTOR" && (
                        <div className="space-y-2">
                          <button type="button" className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={addProgressHex}>
                            선택 타일 추가 ({roadCardEdges.join(", ") || "없음"})
                          </button>
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                            2, 6, 8, 12가 아닌 숫자 토큰 2개를 서로 바꿉니다.
                          </div>
                        </div>
                      )}
                      {selectedProgressType === "INTRIGUE" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택 정점의 상대 기사를 밀어냅니다. 해당 기사는 소유자가 자기 도로망의 빈 정점으로 옮깁니다.
                        </div>
                      )}
                      {selectedProgressType === "MEDICINE" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택 정점의 내 마을을 곡물 1개와 광석 2개로 도시로 올립니다.
                        </div>
                      )}
                      {selectedProgressType === "BISHOP" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          {citiesKnightsRobberLocked ? "첫 야만인 침공 전에는 주교로 도적을 움직일 수 없습니다." : "선택한 육지 타일로 도적을 옮기고 인접 상대마다 1장씩 가져옵니다."}
                        </div>
                      )}
                      {selectedProgressType === "COMMERCIAL_HARBOR" && (
                        <div className="space-y-2">
                          <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                            {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label} 제공</option>)}
                          </select>
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                            상품을 가진 각 상대가 줄 상품을 직접 고릅니다.
                          </div>
                        </div>
                      )}
                      {selectedProgressType === "DESERTER" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                          <option value="">대상 선택</option>
                          {deserterTargets.map((player) => {
                            const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                            return <option key={seatNo} value={seatNo}>{playerName(seatNo)} 기사 탈영</option>;
                          })}
                        </select>
                      )}
                      {selectedProgressType === "MASTER_MERCHANT" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                          <option value="">대상 선택</option>
                          {richerPlayers.map((player) => {
                            const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                            return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 2장</option>;
                          })}
                        </select>
                      )}
                      {selectedProgressType === "MERCHANT" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택한 생산 타일에 상인을 놓고 해당 자원 2:1 교환과 1점을 받습니다.
                        </div>
                      )}
                      {selectedProgressType === "MERCHANT_FLEET" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                          {catanTradeCardEntries.map(([key, label]) => <option key={key} value={key}>{label} 2:1</option>)}
                        </select>
                      )}
                      {selectedProgressType === "SPY" && (
                        <div className="space-y-2">
                          <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                            <option value="">대상 선택</option>
                            {spyTargets.map((player) => {
                              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                              const count = Number(get(player, "progress_card_count", "progressCardCount", 0));
                              return <option key={seatNo} value={seatNo}>{playerName(seatNo)} 진행 카드 {count}장</option>;
                            })}
                          </select>
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                            승점 진행 카드는 가져올 수 없습니다.
                          </div>
                        </div>
                      )}
                      {selectedProgressType === "SABOTEUR" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          나와 같거나 점수가 높은 상대는 절반을 버리고, 모두 버린 뒤 내 액션 단계로 돌아옵니다.
                        </div>
                      )}
                      {selectedProgressType === "WEDDING" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          나보다 점수가 높은 모든 플레이어에게서 최대 2장씩 가져옵니다.
                        </div>
                      )}
                      {selectedProgressType === "ROAD_BUILDING" && (
                        <button type="button" className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={addRoadCardEdge}>
                          선택 간선 추가 ({roadCardEdges.join(", ") || "없음"})
                        </button>
                      )}
                      {selectedProgressType === "SMITH" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          내 기사 최대 2개를 무료로 한 단계씩 승급합니다. 강한 기사를 최강 기사로 올리려면 정치 3단계 요새가 필요합니다.
                        </div>
                      )}
                      {selectedProgressBlockedByFortress && (
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                          승급 가능한 기사가 없습니다.
                        </div>
                      )}
                      {selectedProgressType === "DIPLOMAT" && (
                        <button type="button" className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={addRoadCardEdge}>
                          열린 도로 추가 ({roadCardEdges.join(", ") || "없음"})
                        </button>
                      )}
                      {selectedProgressType === "RESOURCE_MONOPOLY" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                          {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      )}
                      {selectedProgressType === "TRADE_MONOPOLY" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedCommodityType} onChange={(event) => setSelectedCommodityType(event.target.value)}>
                          {Object.entries(catanCommodityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      )}
                      <button type="button" className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedProgressSupported || selectedProgressType === "ALCHEMIST" || selectedProgressBlockedByRobberLock || selectedProgressBlockedByFortress} onClick={() => playProgressCard().catch(() => notifyError("진행 카드 사용 조건을 확인해주세요."))}>
                        진행 카드 사용
                      </button>
                    </div>
                  )}
                  {!actionProgressCards.length && (alchemistCards.length > 0 || passiveProgressVictoryCards.length > 0) && (
                    <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">
                      {alchemistCards.length > 0 && "연금술사는 주사위 단계에서만 사용할 수 있습니다. "}
                      {passiveProgressVictoryCards.length > 0 && "인쇄술과 헌법은 수동으로 쓰지 않는 자동 승점 카드입니다."}
                    </div>
                  )}
                </div>
              )}
              {domesticResourceTradeRule && pendingDomesticTrade && (
                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="text-xs font-black text-emerald-900">
                    {playerName(pendingTradeProposerSeatNo)} → {playerName(pendingTradeTargetSeatNo)} 거래 제안
                  </div>
                  <div className="grid gap-2 text-[11px] font-bold text-emerald-800 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/80 px-3 py-2">제공: {resourceBundleLabel(pendingTradeOffer)}</div>
                    <div className="rounded-xl bg-white/80 px-3 py-2">요청: {resourceBundleLabel(pendingTradeRequest)}</div>
                  </div>
                  <CatanDomesticTradeReviewPanel
                    offer={pendingTradeOffer}
                    request={pendingTradeRequest}
                    proposerName={playerName(pendingTradeProposerSeatNo)}
                    targetName={playerName(pendingTradeTargetSeatNo)}
                    proposerSeatNo={pendingTradeProposerSeatNo}
                    targetSeatNo={pendingTradeTargetSeatNo}
                    mySeatNo={mySeatNo}
                    resources={resources}
                  />
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-emerald-700">
                    이 제안이 수락, 거절, 취소될 때까지 새 거래 제안은 잠시 보류됩니다.
                  </div>
                  {pendingTradeTargetSeatNo === mySeatNo && (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white" onClick={() => respondDomesticTrade("ACCEPT_TRADE").catch(() => notifyError("보유 자원을 확인해주세요."))}>
                        수락
                      </button>
                      <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800" onClick={() => respondDomesticTrade("REJECT_TRADE").catch(() => notifyError("거절 처리 실패"))}>
                        거절
                      </button>
                    </div>
                  )}
                  {pendingTradeProposerSeatNo === mySeatNo && (
                    <button type="button" className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800" onClick={() => respondDomesticTrade("CANCEL_TRADE").catch(() => notifyError("거래 취소 실패"))}>
                      제안 취소
                    </button>
                  )}
                </div>
              )}
              {domesticResourceTradeRule && !pendingDomesticTrade && (
                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-black text-emerald-900">플레이어 거래</div>
                    <select className="rounded-xl border border-emerald-100 bg-white px-2 py-1 text-xs font-bold text-emerald-900" value={domesticTradeTargetSeatNo} onChange={(event) => setDomesticTradeTargetSeatNo(event.target.value)}>
                      <option value="">상대 선택</option>
                      {domesticTradeTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)}</option>;
                      })}
                    </select>
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <div className="mb-1 text-[11px] font-black text-emerald-800">내가 줄 자원</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {catanResourceEntries.map(([key, label]) => (
                          <label key={`offer-${key}`} className="rounded-xl bg-white px-2 py-2">
                            <span className="block text-[10px] font-bold text-slate-500">{label}</span>
                            <input
                              type="number"
                              min="0"
                              max={resources?.[key] ?? 0}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black"
                              value={domesticOfferForm[key]}
                              onChange={(event) => setDomesticOfferForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-black text-emerald-800">받을 자원</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {catanResourceEntries.map(([key, label]) => (
                          <label key={`request-${key}`} className="rounded-xl bg-white px-2 py-2">
                            <span className="block text-[10px] font-bold text-slate-500">{label}</span>
                            <input
                              type="number"
                              min="0"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black"
                              value={domesticRequestForm[key]}
                              onChange={(event) => setDomesticRequestForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn || !domesticTradeTargetSeatNo || domesticOfferTotal <= 0 || domesticRequestTotal <= 0 || domesticOfferExceeded} onClick={() => proposeDomesticTrade().catch(() => notifyError("거래 제안 실패"))}>
                    거래 제안
                  </button>
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <select className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                  {catanTradeCardEntries.map(([key, label]) => <option key={key} value={key}>{label} {tradeRatioFor(key)}개</option>)}
                </select>
                <select className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold" value={tradeForm.receive} onChange={(event) => setTradeForm((prev) => ({ ...prev, receive: event.target.value }))}>
                  {catanTradeCardEntries.map(([key, label]) => <option key={key} value={key}>{label} 1개</option>)}
                </select>
              </div>
              <button className="w-full rounded-xl bg-sky-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!canMaritimeTrade} onClick={() => maritimeTrade().catch(() => notifyError("교환할 자원을 확인해주세요."))}>
                항구/해상 교환 {giveTradeRatio}:1
              </button>
              {!maritimeReceiveWithinBank && (
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-700">
                  은행에 받을 {catanResourceLabels[tradeForm.receive]} 카드가 없습니다.
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && (
                <button className="w-full rounded-xl bg-violet-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!canBuyDevelopmentCard} onClick={() => buyDevelopmentCard().catch(() => notifyError("개발 카드 비용을 확인해주세요."))}>
                  개발 카드 구입
                </button>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!playableDevelopmentCards.length && (
                <div className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                  <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
                    {playableDevelopmentCards.map((card) => (
                      <option key={card.id} value={card.id}>{catanDevelopmentLabels[card.type] || card.type}</option>
                    ))}
                  </select>
                  {selectedDevCard?.type === "KNIGHT" && !!robberTargets.length && (
                    <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                      {robberTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 1장 뽑기</option>;
                      })}
                    </select>
                  )}
                  {selectedDevCard?.type === "ROAD_BUILDING" && (
                    <div className="space-y-2">
                      <button type="button" className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-violet-700" onClick={addRoadCardEdge}>
                        선택 간선 추가 ({roadCardEdges.join(", ") || "없음"})
                      </button>
                    </div>
                  )}
                  {(selectedDevCard?.type === "YEAR_OF_PLENTY" || selectedDevCard?.type === "MONOPOLY") && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      {selectedDevCard.type === "YEAR_OF_PLENTY" ? "위의 두 자원 선택값을 1장씩 받습니다." : "왼쪽 자원 선택값을 모든 플레이어에게서 가져옵니다."}
                    </div>
                  )}
                  {selectedDevCard?.type === "YEAR_OF_PLENTY" && !yearOfPlentyWithinBank && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      은행에 선택한 자원이 부족합니다. 다른 자원 조합을 선택해주세요.
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!canPlaySelectedDevelopmentCard} onClick={() => playDevelopmentCard().catch(() => notifyError("개발 카드 사용 조건을 확인해주세요."))}>
                    개발 카드 사용
                  </button>
                  {devCardAlreadyPlayedThisTurn && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      개발 카드는 한 턴에 1장만 사용할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!lockedDevelopmentCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  이번 턴에 구입한 개발 카드 {lockedDevelopmentCards.length}장은 다음 내 턴부터 사용할 수 있습니다.
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !playableDevelopmentCards.length && !!passiveDevelopmentVictoryCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  승점 개발 카드는 사용하지 않아도 내 점수에 자동 반영됩니다.
                </div>
              )}
              {pairedTurnRule && (
                <div className={`rounded-2xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${activeSeatNo === catanianTwoSeatNo ? "border-lime-100 bg-lime-50 text-lime-700" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
                  {pairedTurnActionNotice}
                </div>
              )}
              <button className="w-full rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40" disabled={!myTurn} onClick={() => onAction({ action_type: "END_TURN" }).catch(() => notifyError("턴 종료 실패"))}>
                턴 종료
              </button>
            </div>
          )}
          {phase === "FINISHED" && (
            <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-black text-amber-800">
              {playerName(winnerSeatNo)} 승리
            </div>
          )}
        </div>

        <details className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <summary className="cursor-pointer text-sm font-black text-slate-700">자원 전략 상세 열기</summary>
          <div className="mt-3">
            <CatanResourceStrategyPanel
              resources={resources}
              resourceBank={resourceBank}
              buildSignals={catanBuildSignals}
              scoreRace={catanScoreRace}
              myCardCount={myCardCount}
              tradeSummary={catanTradeSummary}
              phase={phase}
              myTurn={myTurn}
            />
          </div>
        </details>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">내 자원</div>
          <div className="grid grid-cols-2 gap-2">
            {catanResourceEntries.map(([key, label]) => (
              <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">{label}</div>
                <div className="text-lg font-black text-slate-900">{resources?.[key] ?? 0}</div>
                <div className="text-[10px] font-bold text-slate-400">은행 {resourceBank?.[key] ?? "-"}장</div>
              </div>
            ))}
          </div>
          {citiesKnightsRule && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(catanCommodityLabels).map(([key, label]) => (
                  <div key={key} className="rounded-xl bg-rose-50 px-3 py-2">
                    <div className="text-[11px] font-bold text-rose-600">{label}</div>
                    <div className="text-lg font-black text-slate-900">{commodities?.[key] ?? 0}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2">
                <div className="text-[11px] font-bold text-rose-600">도시 발전</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(catanImprovementLabels).map(([key, label]) => (
                    <span key={key} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-rose-700">
                      {label} {cityImprovements?.[key] ?? 0}
                    </span>
                  ))}
                  {metropolisTypes.map((type) => (
                    <span key={type} className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black text-white">
                      {catanImprovementLabels[type] || type} 대도시
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-600">진행 카드</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {progressCards.map((card) => {
                    const cardType = get(card, "type", "type", "");
                    const deckType = get(card, "deck_type", "deckType", "");
                    return (
                      <span key={card.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${catanProgressTimingClass(cardType)}`}>
                        <span>{catanProgressLabels[cardType] || get(card, "title", "title", cardType)}</span>
                        {deckType ? <span className="text-[9px] opacity-70">· {catanImprovementLabels[deckType] || deckType}</span> : null}
                        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px]">{catanProgressTimingLabel(cardType)}</span>
                      </span>
                    );
                  })}
                  {!progressCards.length && <span className="text-xs font-bold text-slate-300">없음</span>}
                </div>
              </div>
            </>
          )}
          {!citiesKnightsRule && !explorersPiratesRule && (
            <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2">
              <div className="text-[11px] font-bold text-violet-600">개발 카드</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {developmentCards.map((card) => (
                  <span key={card.id} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-violet-700">
                    {catanDevelopmentLabels[card.type] || card.type}{card.type === "VICTORY_POINT" ? " · 자동 승점" : ""}
                  </span>
                ))}
                {!developmentCards.length && <span className="text-xs font-bold text-violet-300">없음</span>}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">플레이어</div>
          <div className="space-y-2">
            {catanPlayers.map((player) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              const victoryPoints = Number(get(player, "victory_points", "victoryPoints", 0));
              const publicVictoryPoints = Number(get(player, "public_victory_points", "publicVictoryPoints", victoryPoints));
              const developmentVictoryPoints = Number(get(player, "development_victory_points", "developmentVictoryPoints", 0));
              const isMe = seatNo === mySeatNo;
              return (
                <div key={seatNo} className={`rounded-xl border px-3 py-2 ${activeSeatNo === seatNo ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: catanColorFill[player.color] || "#111827" }} />
                      <div>
                        <div className="text-sm font-black text-slate-900">{playerName(seatNo)}</div>
                        <div className="text-[11px] font-bold text-slate-500">
                          {citiesKnightsRule
                            ? `자원 ${get(player, "resource_count", "resourceCount", 0)}장 · 상품 ${get(player, "commodity_count", "commodityCount", 0)}장 · 진행 ${get(player, "progress_card_count", "progressCardCount", 0)}장`
                            : `자원 ${get(player, "resource_count", "resourceCount", 0)}장 · 개발 ${get(player, "development_card_count", "developmentCardCount", 0)}장`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{isMe ? victoryPoints : publicVictoryPoints}점</div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {isMe && developmentVictoryPoints > 0 ? `공개 ${publicVictoryPoints} + 비공개 ${developmentVictoryPoints}` : "공개 승점"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-black">
                    {isMe && developmentVictoryPoints > 0 && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">비공개 승점 +{developmentVictoryPoints}</span>}
                    {get(player, "has_longest_road", "hasLongestRoad", false) && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">최장 교역로</span>}
                    {get(player, "has_largest_army", "hasLargestArmy", false) && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">최대 기사력</span>}
                    {get(player, "has_strongest_ports", "hasStrongestPorts", false) && <span className="rounded-full bg-teal-100 px-2 py-1 text-teal-700">강한 항구</span>}
                    {pairedTurnRule && seatNo === catanianOneSeatNo && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">카타니안 1</span>}
                    {pairedTurnRule && seatNo === catanianTwoSeatNo && <span className="rounded-full bg-lime-100 px-2 py-1 text-lime-700">카타니안 2</span>}
                    {friendlyRobberRule && Number(get(player, "public_victory_points", "publicVictoryPoints", get(player, "victory_points", "victoryPoints", 0))) <= 2 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">도둑 보호</span>}
                    <span className="rounded-full bg-white px-2 py-1 text-slate-500">도로 {get(player, "longest_road_length", "longestRoadLength", 0)}</span>
                    {tradersBarbariansRule && <span className="rounded-full bg-white px-2 py-1 text-teal-700">항구 {get(player, "harbor_points", "harborPoints", 0)}</span>}
                    {caravansRule && <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">대상단 {get(player, "caravan_victory_points", "caravanVictoryPoints", 0)}</span>}
                    {barbarianAttackRule && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">포획 {get(player, "captured_barbarians", "capturedBarbarians", 0)} · 기사 {get(player, "remaining_barbarian_knights", "remainingBarbarianKnights", 0)}</span>}
                    {riversRule && <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700">골드 {get(player, "gold", "gold", 0)}</span>}
                    {riversRule && <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">다리 {get(player, "remaining_bridges", "remainingBridges", 0)}</span>}
                    {riversRule && Boolean(get(player, "richest_settler", "richestSettler", false)) && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">부유한 정착민</span>}
                    {riversRule && Boolean(get(player, "poor_settler", "poorSettler", false)) && <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700">빈곤한 정착민</span>}
                    {fishermenRule && <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">물고기 {get(player, "fishermen_fish_total", "fishermenFishTotal", 0)}마리</span>}
                    {fishermenRule && Boolean(get(player, "has_old_boot", "hasOldBoot", false)) && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">낡은 장화</span>}
                    {seafarersRule && !explorersPiratesRule && Number(get(player, "special_victory_points", "specialVictoryPoints", 0)) > 0 && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">외딴 섬 +{get(player, "special_victory_points", "specialVictoryPoints", 0)}</span>}
                    {seafarersScenarioCode === "FOUR_ISLANDS" && (get(player, "home_island_ids", "homeIslandIds", []) || []).length > 0 && <span className="rounded-full bg-white px-2 py-1 text-sky-700">홈 섬 {numberedAreaList(get(player, "home_island_ids", "homeIslandIds", []))}</span>}
                    {seafarersScenarioCode === "FOUR_ISLANDS" && (get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []) || []).length > 0 && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">개척 섬 {numberedAreaList(get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []))}</span>}
                    {throughDesertRule && (get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []) || []).length > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">외국 지역 {numberedAreaList(get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []))}</span>}
                    {forgottenTribeRule && Number(get(player, "forgotten_tribe_gifts_claimed", "forgottenTribeGiftsClaimed", 0)) > 0 && <span className="rounded-full bg-teal-100 px-2 py-1 text-teal-700">선물 {get(player, "forgotten_tribe_gifts_claimed", "forgottenTribeGiftsClaimed", 0)}</span>}
                    {forgottenTribeRule && Number(get(player, "forgotten_tribe_victory_points", "forgottenTribeVictoryPoints", 0)) > 0 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">부족 승점 +{get(player, "forgotten_tribe_victory_points", "forgottenTribeVictoryPoints", 0)}</span>}
                    {forgottenTribeRule && (get(player, "pending_forgotten_tribe_port_types", "pendingForgottenTribePortTypes", []) || []).length > 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">대기 항구 {(get(player, "pending_forgotten_tribe_port_types", "pendingForgottenTribePortTypes", []) || []).length}</span>}
                    {clothForCatanRule && <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-fuchsia-700">직물 {get(player, "cloth_bolts", "clothBolts", 0)} · 승점 +{get(player, "cloth_victory_points", "clothVictoryPoints", 0)}</span>}
                    {clothForCatanRule && Number(get(player, "cloth_villages_connected", "clothVillagesConnected", 0)) > 0 && <span className="rounded-full bg-white px-2 py-1 text-fuchsia-700">연결 마을 {get(player, "cloth_villages_connected", "clothVillagesConnected", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">금 {get(player, "gold", "gold", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">항구 정착지 {get(player, "remaining_harbor_settlements", "remainingHarborSettlements", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">정착민 {get(player, "remaining_settlers", "remainingSettlers", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">승무원 {get(player, "remaining_crews", "remainingCrews", 0)}</span>}
                    {explorersPiratesRule && Number(get(player, "mission_victory_points", "missionVictoryPoints", 0)) > 0 && <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">임무 {get(player, "mission_victory_points", "missionVictoryPoints", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">어획 {get(player, "fish_delivered", "fishDelivered", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-yellow-50 px-2 py-1 text-yellow-700">향신료 {get(player, "spice_delivered", "spiceDelivered", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">소굴 {get(player, "pirate_lairs_captured", "pirateLairsCaptured", 0)}</span>}
                    {explorersPiratesRule && Boolean(get(player, "best_fisher", "bestFisher", false)) && <span className="rounded-full bg-sky-600 px-2 py-1 text-white">최고 어부</span>}
                    {explorersPiratesRule && Boolean(get(player, "greatest_spice_merchant", "greatestSpiceMerchant", false)) && <span className="rounded-full bg-yellow-600 px-2 py-1 text-white">최고 향신료상</span>}
                    {explorersPiratesRule && Boolean(get(player, "greatest_pirate_scourge", "greatestPirateScourge", false)) && <span className="rounded-full bg-red-700 px-2 py-1 text-white">해적 소탕왕</span>}
                    {!citiesKnightsRule && !explorersPiratesRule && <span className="rounded-full bg-white px-2 py-1 text-slate-500">기사 {get(player, "played_knight_count", "playedKnightCount", 0)}</span>}
                    {seafarersRule && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">남은 배 {get(player, "remaining_ships", "remainingShips", 0)}</span>}
                    {citiesKnightsRule && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">남은 기사 {get(player, "remaining_knights", "remainingKnights", 0)}</span>}
                    {citiesKnightsRule && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">성벽 {get(player, "city_wall_count", "cityWallCount", 0)}</span>}
                    {citiesKnightsRule && merchantSeatNo === seatNo && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">상인 {catanResourceLabels[merchantResourceType] || ""}</span>}
                    {citiesKnightsRule && merchantFleetSeatNo === seatNo && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">상선단 {catanTradeCardLabels[merchantFleetCardType] || ""}</span>}
                    {citiesKnightsRule && Number(get(player, "defender_points", "defenderPoints", 0)) > 0 && <span className="rounded-full bg-slate-900 px-2 py-1 text-white">방어자 {get(player, "defender_points", "defenderPoints", 0)}</span>}
                    {citiesKnightsRule && (get(player, "metropolis_types", "metropolisTypes", []) || []).map((type) => (
                      <span key={type} className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">{catanImprovementLabels[type] || type} 대도시</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">기록</div>
          <div className="space-y-2">
            {events.slice(-6).reverse().map((event) => (
              <div key={get(event, "event_no", "eventNo", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {get(event, "event_no", "eventNo", 0)} · {catanEventLabels[get(event, "event_type", "eventType", "")] || get(event, "event_type", "eventType", "")} · {playerName(get(event, "seat_no", "seatNo", 0))}
                {get(event, "target_seat_no", "targetSeatNo", 0) ? ` → ${playerName(get(event, "target_seat_no", "targetSeatNo", 0))}` : ""}
                {get(event, "resource_type", "resourceType", "") ? ` · ${catanResourceLabels[get(event, "resource_type", "resourceType", "")] || catanCommodityLabels[get(event, "resource_type", "resourceType", "")] || catanCargoLabels[get(event, "resource_type", "resourceType", "")] || catanSpiceAdvantageLabels[get(event, "resource_type", "resourceType", "")] || catanTerrain[get(event, "resource_type", "resourceType", "")]?.label || catanImprovementLabels[get(event, "resource_type", "resourceType", "")] || catanEventDieLabels[get(event, "resource_type", "resourceType", "")] || catanProgressLabels[get(event, "resource_type", "resourceType", "")] || catanDevelopmentLabels[get(event, "resource_type", "resourceType", "")] || get(event, "resource_type", "resourceType", "")}` : ""}
              </div>
            ))}
            {!events.length && (
              <TabletopHistoryEmptyState
                game="catan"
                title="아직 카탄 기록이 없습니다"
                detail="주사위, 생산, 건설, 거래가 처리되면 좌석과 자원 근거가 이 기록 영역에 쌓입니다."
                nextAction="첫 생산"
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export { CatanBoard };
export default CatanBoard;
