import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Crown, FlipHorizontal, RotateCw, Shield } from "lucide-react";
import { notifyError } from "../../utils/toast.js";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const playersOf = (room) => (Array.isArray(room?.players) ? room.players : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const colorClasses = {
  BLUE: "bg-blue-500 border-blue-700",
  YELLOW: "bg-yellow-300 border-yellow-500",
  RED: "bg-rose-500 border-rose-700",
  GREEN: "bg-emerald-500 border-emerald-700",
};

const colorText = {
  BLUE: "text-blue-700",
  YELLOW: "text-yellow-700",
  RED: "text-rose-700",
  GREEN: "text-emerald-700",
};

const colorBgSoft = {
  BLUE: "bg-blue-50 border-blue-100",
  YELLOW: "bg-yellow-50 border-yellow-100",
  RED: "bg-rose-50 border-rose-100",
  GREEN: "bg-emerald-50 border-emerald-100",
};

const blokusColorLabels = {
  BLUE: "파랑",
  YELLOW: "노랑",
  RED: "빨강",
  GREEN: "초록",
};

const blokusPiecePalette = {
  BLUE: { fill: "#3b82f6", stroke: "#1d4ed8", shine: "#bfdbfe" },
  YELLOW: { fill: "#fde047", stroke: "#ca8a04", shine: "#fef9c3" },
  RED: { fill: "#f43f5e", stroke: "#be123c", shine: "#fecdd3" },
  GREEN: { fill: "#10b981", stroke: "#047857", shine: "#bbf7d0" },
};

const gameConfigs = { blokus: { title: "블로커스" } };

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
  const config = gameConfigs[game] || {};
  const gameLabel = config.title || title;
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
const normalizeCells = (cells) => {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

const transformCells = (piece, rotation, flipped, anchorX = 0, anchorY = 0) => {
  const baseCells = (piece?.cells || []).map((cell) => ({ x: Number(cell.x), y: Number(cell.y) }));
  const normalizedRotation = ((Number(rotation) % 360) + 360) % 360;
  const transformed = baseCells.map((cell) => {
    const x = flipped ? -cell.x : cell.x;
    const y = cell.y;
    if (normalizedRotation === 90) return { x: y, y: -x };
    if (normalizedRotation === 180) return { x: -x, y: -y };
    if (normalizedRotation === 270) return { x: -y, y: x };
    return { x, y };
  });
  return normalizeCells(transformed).map((cell) => ({ x: cell.x + anchorX, y: cell.y + anchorY }));
};

const BlokusPieceArt = ({ piece, color = "BLUE", className = "h-8 max-w-full" }) => {
  const cells = normalizeCells((piece?.cells || []).map((cell) => ({ x: Number(cell.x), y: Number(cell.y) })));
  if (!cells.length) {
    return (
      <svg viewBox="0 0 36 36" className={className} data-smoke="blokus-piece-art" role="img" aria-label="빈 블로커스 조각">
        <rect x="5" y="5" width="26" height="26" rx="7" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" />
      </svg>
    );
  }
  const width = Math.max(...cells.map((cell) => cell.x), 0) + 1;
  const height = Math.max(...cells.map((cell) => cell.y), 0) + 1;
  const palette = blokusPiecePalette[color] || blokusPiecePalette.BLUE;
  const cellSize = 18;
  const padding = 3;
  const viewWidth = width * cellSize + padding * 2;
  const viewHeight = height * cellSize + padding * 2;
  return (
    <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className={className} data-smoke="blokus-piece-art" role="img" aria-label={`${piece?.name || piece?.code || "블로커스 조각"} 미리보기`}>
      {cells.map((cell) => {
        const x = padding + cell.x * cellSize;
        const y = padding + cell.y * cellSize;
        return (
          <g key={`${cell.x}:${cell.y}`}>
            <rect x={x} y={y} width={cellSize - 2} height={cellSize - 2} rx="3" fill={palette.fill} stroke={palette.stroke} strokeWidth="2" />
            <path d={`M${x + 4} ${y + 5}h${cellSize - 10}`} stroke={palette.shine} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          </g>
        );
      })}
    </svg>
  );
};

const blokusStartCorners = {
  BLUE: { x: 0, y: 0 },
  YELLOW: { x: 19, y: 0 },
  RED: { x: 19, y: 19 },
  GREEN: { x: 0, y: 19 },
};

const blokusPlacementStatus = ({ cells, boardSize, occupied, colorByCell, colorsOnBoard, color, startPoints }) => {
  if (!cells.length) return { legal: false, reason: "" };
  if (cells.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= boardSize || cell.y >= boardSize)) {
    return { legal: false, reason: "보드 밖" };
  }
  if (cells.some((cell) => occupied.has(`${cell.x}:${cell.y}`))) {
    return { legal: false, reason: "겹침" };
  }
  const firstPiece = !colorsOnBoard.has(color);
  if (firstPiece) {
    const validStartPoints = (startPoints || []).filter((point) => !get(point, "color", "color", null) || get(point, "color", "color", null) === color);
    if (validStartPoints.length) {
      const coversStart = validStartPoints.some((point) => cells.some((cell) => cell.x === Number(point.x) && cell.y === Number(point.y)));
      return coversStart ? { legal: true, reason: "시작점" } : { legal: false, reason: "시작점을 덮어야 함" };
    }
    const corner = blokusStartCorners[color];
    const coversCorner = corner && cells.some((cell) => cell.x === corner.x && cell.y === corner.y);
    return coversCorner ? { legal: true, reason: "시작 모서리" } : { legal: false, reason: "시작 모서리를 덮어야 함" };
  }
  const orthogonal = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const hasSideContact = cells.some((cell) => orthogonal.some(([dx, dy]) => colorByCell.get(`${cell.x + dx}:${cell.y + dy}`) === color));
  if (hasSideContact) {
    return { legal: false, reason: "같은 색 변 접촉" };
  }
  const hasCornerContact = cells.some((cell) => diagonal.some(([dx, dy]) => colorByCell.get(`${cell.x + dx}:${cell.y + dy}`) === color));
  return hasCornerContact ? { legal: true, reason: "모서리 접촉" } : { legal: false, reason: "같은 색 모서리 접촉 필요" };
};

const blokusPieceOrientations = (piece) => {
  if (!piece?.cells?.length) return [];
  const seen = new Set();
  const orientations = [];
  [false, true].forEach((nextFlipped) => {
    [0, 90, 180, 270].forEach((nextRotation) => {
      const cells = transformCells(piece, nextRotation, nextFlipped, 0, 0);
      const key = cells.map((cell) => `${cell.x}:${cell.y}`).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        orientations.push({ cells, flipped: nextFlipped, rotation: nextRotation });
      }
    });
  });
  return orientations;
};

const blokusLegalPlacementCountForPiece = ({ piece, boardSize, occupied, colorByCell, colorsOnBoard, color, startPoints }) => {
  if (!piece?.cells?.length || !color) return 0;
  let count = 0;
  blokusPieceOrientations(piece).forEach((orientation) => {
    const maxX = Math.max(...orientation.cells.map((cell) => cell.x), 0);
    const maxY = Math.max(...orientation.cells.map((cell) => cell.y), 0);
    for (let y = 0; y < boardSize - maxY; y += 1) {
      for (let x = 0; x < boardSize - maxX; x += 1) {
        const cells = orientation.cells.map((cell) => ({ x: cell.x + x, y: cell.y + y }));
        if (blokusPlacementStatus({ cells, boardSize, occupied, colorByCell, colorsOnBoard, color, startPoints }).legal) {
          count += 1;
        }
      }
    }
  });
  return count;
};

const blokusBoardCellSizes = [16, 20, 24, 30];
const blokusBoardCellSizeStorageKey = "blokus_board_cell_size";

const defaultBlokusBoardCellSize = () => {
  if (typeof window === "undefined") return 24;
  const stored = Number(window.localStorage?.getItem(blokusBoardCellSizeStorageKey) || 0);
  if (blokusBoardCellSizes.includes(stored)) return stored;
  return window.innerWidth < 480 ? 16 : 24;
};

const blokusActionRouteTone = {
  ready: { fill: "#ecfdf5", stroke: "#059669", text: "#047857", soft: "#bbf7d0" },
  active: { fill: "#eff6ff", stroke: "#2563eb", text: "#1d4ed8", soft: "#bfdbfe" },
  caution: { fill: "#fffbeb", stroke: "#f59e0b", text: "#b45309", soft: "#fde68a" },
  blocked: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c", soft: "#fecdd3" },
  idle: { fill: "#f8fafc", stroke: "#94a3b8", text: "#475569", soft: "#e2e8f0" },
};

const buildBlokusActionRouteItems = ({
  phase = "PLAYING",
  myTurn = false,
  canPass = false,
  selectedPiece = null,
  selectedPieceCode = "",
  selectedPieceLegalCount = 0,
  totalLegalPlacementCount = 0,
  anchorCell = null,
  placementStatus = { legal: false, reason: "" },
  placeButtonEnabled = false,
  firstPlayablePieceCode = "",
  bestPieceEntry = null,
  remainingSquares = 0,
  remainingPieceCount = 0,
  rotation = 0,
  flipped = false,
  firstPiece = false,
}) => {
  const selectedPieceSize = Number(selectedPiece?.size || selectedPiece?.cells?.length || 0);
  const selectedName = selectedPiece?.name || selectedPieceCode || "미선택";
  const bestName = bestPieceEntry?.piece?.name || bestPieceEntry?.pieceCode || firstPlayablePieceCode || "";
  const legalCountText = Number(selectedPieceLegalCount).toLocaleString("ko-KR");
  const totalLegalText = Number(totalLegalPlacementCount).toLocaleString("ko-KR");
  const anchorText = anchorCell ? `${anchorCell.x + 1}, ${anchorCell.y + 1}` : "보드 선택";
  const isFinished = phase === "FINISHED";
  const routeLockedDetail = isFinished
    ? "게임이 끝나 배치 버튼은 결과 확인 상태입니다."
    : !myTurn
      ? "내 차례가 아니므로 조각과 보드를 관찰하는 단계입니다."
      : canPass
        ? "모든 조각의 가능 위치가 0곳이라 패스로 턴을 넘길 수 있습니다."
        : "선택 조각, 방향, 보드 칸이 모두 맞아야 배치 버튼이 열립니다.";

  return [
    {
      key: "piece",
      label: "조각 선택",
      value: selectedPiece ? selectedName : canPass ? "모두 막힘" : "미선택",
      artValue: selectedPiece ? `${selectedPieceSize || "-"}칸` : canPass ? "패스" : "선택",
      detail: selectedPiece
        ? `${selectedName}은 현재 ${legalCountText}곳에 둘 수 있습니다.`
        : bestName
          ? `먼저 둘 수 있는 후보 ${bestName}을 선택하면 배치 루트가 열립니다.`
          : routeLockedDetail,
      toneKey: selectedPieceLegalCount > 0 ? "ready" : canPass ? "caution" : selectedPiece ? "blocked" : "idle",
      tone: selectedPieceLegalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800" : canPass ? "border-amber-100 bg-amber-50 text-amber-800" : selectedPiece ? "border-rose-100 bg-rose-50 text-rose-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "shape",
      label: "방향 조정",
      value: selectedPiece ? `${rotation}도 · ${flipped ? "뒤집힘" : "기본"}` : "대기",
      artValue: selectedPiece ? `${rotation}도` : "-",
      detail: selectedPiece
        ? "회전과 뒤집기는 같은 조각의 후보 칸을 바꾸며, 서버 배치 규칙은 그대로 유지됩니다."
        : "조각을 고른 뒤 방향 버튼으로 맞출 수 있습니다.",
      toneKey: selectedPiece ? "active" : "idle",
      tone: selectedPiece ? "border-sky-100 bg-sky-50 text-sky-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "anchor",
      label: "칸 지정",
      value: anchorText,
      artValue: anchorCell ? `${anchorCell.x + 1}/${anchorCell.y + 1}` : "칸",
      detail: anchorCell
        ? placementStatus.legal
          ? firstPiece
            ? "첫 조각 기준 시작점 조건을 만족해 배치할 수 있습니다."
            : "같은 색 변 접촉 없이 모서리 접촉 조건을 만족했습니다."
          : `${placementStatus.reason || "규칙 불일치"} 때문에 다른 칸을 골라야 합니다.`
        : "보드 칸을 누르면 배치 가능 여부와 차단 이유가 고정됩니다.",
      toneKey: placementStatus.legal ? "ready" : anchorCell ? "blocked" : "idle",
      tone: placementStatus.legal ? "border-emerald-100 bg-emerald-50 text-emerald-800" : anchorCell ? "border-rose-100 bg-rose-50 text-rose-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "submit",
      label: "배치/패스",
      value: placeButtonEnabled ? "배치 가능" : canPass ? "패스 가능" : "잠김",
      artValue: placeButtonEnabled ? "배치" : canPass ? "패스" : "잠김",
      detail: placeButtonEnabled
        ? "같은 칸을 다시 누르거나 배치 버튼으로 기존 PLACE payload를 보냅니다."
        : canPass
          ? `남은 ${Number(remainingPieceCount).toLocaleString("ko-KR")}개 조각, ${Number(remainingSquares).toLocaleString("ko-KR")}칸이 모두 막혔습니다.`
          : `${totalLegalText}곳 중 선택 조각과 칸이 맞아야 배치 버튼이 열립니다.`,
      toneKey: placeButtonEnabled ? "ready" : canPass ? "caution" : "idle",
      tone: placeButtonEnabled ? "border-emerald-100 bg-emerald-50 text-emerald-800" : canPass ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
  ];
};

const BlokusActionRouteArt = ({
  currentColor = "BLUE",
  items = [],
  myTurn = false,
  canPass = false,
  placeButtonEnabled = false,
}) => {
  const palette = blokusPiecePalette[currentColor] || blokusPiecePalette.BLUE;
  const routeItems = items.length ? items : [
    { key: "piece", label: "조각", artValue: "선택", toneKey: "idle" },
    { key: "shape", label: "방향", artValue: "-", toneKey: "idle" },
    { key: "anchor", label: "칸", artValue: "-", toneKey: "idle" },
    { key: "submit", label: "배치", artValue: "-", toneKey: "idle" },
  ];
  const activeIndex = placeButtonEnabled || canPass ? 3 : routeItems.findIndex((item) => item.toneKey === "idle" || item.toneKey === "blocked");
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : myTurn ? 2 : 0;

  return (
    <svg
      data-smoke="blokus-action-route-art"
      viewBox="0 0 400 150"
      className="h-full min-h-[124px] w-full"
      role="img"
      aria-label="블로커스 액션 루트"
      focusable="false"
    >
      <rect x="10" y="10" width="380" height="130" rx="24" fill="#f8fafc" stroke={palette.shine || "#bfdbfe"} strokeWidth="3" />
      <path d="M58 75h284" stroke={palette.shine || "#bfdbfe"} strokeWidth="14" strokeLinecap="round" />
      <path d="M58 75h284" stroke={myTurn ? palette.stroke : "#94a3b8"} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
      {routeItems.map((item, index) => {
        const x = 58 + index * 94.6;
        const tone = blokusActionRouteTone[item.toneKey] || blokusActionRouteTone.idle;
        const active = index === safeActiveIndex;
        return (
          <g key={item.key} data-smoke="blokus-action-route-node" data-route-key={item.key}>
            <circle cx={x} cy="75" r={active ? 34 : 31} fill="#ffffff" stroke={tone.stroke} strokeWidth={active ? "5" : "4"} />
            <circle cx={x} cy="75" r="22" fill={tone.fill} stroke="#ffffff" strokeWidth="3" />
            <text x={x} y="70" textAnchor="middle" fontSize="9" fontWeight="900" fill={tone.text}>{item.label}</text>
            <text x={x} y="89" textAnchor="middle" fontSize="13" fontWeight="900" fill={tone.text}>{item.artValue}</text>
          </g>
        );
      })}
      <rect x="60" y="116" width="280" height="18" rx="9" fill="#ffffff" stroke={palette.shine || "#bfdbfe"} />
      <text x="200" y="129" textAnchor="middle" fontSize="10" fontWeight="900" fill={palette.stroke || "#1d4ed8"}>
        조각 선택 → 방향 조정 → 칸 지정 → 배치/패스
      </text>
      <text x="30" y="28" fontSize="10" fontWeight="900" fill={palette.stroke || "#1d4ed8"}>{myTurn ? "내 차례" : "관찰"}</text>
    </svg>
  );
};

const BlokusActionRoutePanel = ({
  phase = "PLAYING",
  currentColor = "",
  currentColorLabel = "",
  myTurn = false,
  canPass = false,
  selectedPiece = null,
  selectedPieceCode = "",
  selectedPieceLegalCount = 0,
  totalLegalPlacementCount = 0,
  anchorCell = null,
  placementStatus = { legal: false, reason: "" },
  placeButtonEnabled = false,
  firstPlayablePieceCode = "",
  bestPieceEntry = null,
  remainingSquares = 0,
  remainingPieceCount = 0,
  rotation = 0,
  flipped = false,
  firstPiece = false,
}) => {
  const items = buildBlokusActionRouteItems({
    phase,
    myTurn,
    canPass,
    selectedPiece,
    selectedPieceCode,
    selectedPieceLegalCount,
    totalLegalPlacementCount,
    anchorCell,
    placementStatus,
    placeButtonEnabled,
    firstPlayablePieceCode,
    bestPieceEntry,
    remainingSquares,
    remainingPieceCount,
    rotation,
    flipped,
    firstPiece,
  });

  return (
    <section
      data-smoke="blokus-action-route-panel"
      data-phase={phase || ""}
      data-my-turn={myTurn ? "true" : "false"}
      data-can-pass={canPass ? "true" : "false"}
      data-selected-piece={selectedPieceCode || ""}
      data-anchor-cell={anchorCell ? `${anchorCell.x}:${anchorCell.y}` : ""}
      data-total-legal={Number(totalLegalPlacementCount || 0)}
      className="mb-3 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-emerald-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.82fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-h-[132px]">
          <BlokusActionRouteArt
            currentColor={currentColor || "BLUE"}
            items={items}
            myTurn={myTurn}
            canPass={canPass}
            placeButtonEnabled={placeButtonEnabled}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-blue-700">블로커스 액션 루트</div>
              <h3 className="text-base font-black text-slate-900">조각, 방향, 칸, 제출 순서</h3>
            </div>
            <div className={`rounded-full border px-3 py-1 text-[11px] font-black ${colorText[currentColor] || "text-slate-600"} ${colorBgSoft[currentColor] || "bg-white"}`}>
              {currentColorLabel || currentColor || "색상 대기"}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} data-smoke="blokus-action-route-item" data-route-key={item.key} className={`min-h-[102px] rounded-xl border px-3 py-2.5 ${item.tone}`}>
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const BlokusRemainingPiecesEmptyArt = ({ currentColor = "BLUE", colorLabel = "", compact = false, canPass = false }) => {
  const palette = blokusPiecePalette[currentColor] || blokusPiecePalette.BLUE;
  const nodes = [
    { key: "empty", x: 62, y: 86, label: "소진" },
    { key: "board", x: 132, y: 122, label: "보드" },
    { key: "pass", x: 220, y: 86, label: canPass ? "패스" : "관찰" },
    { key: "score", x: 298, y: 122, label: "점수" },
  ];

  return (
    <svg
      data-smoke="blokus-remaining-empty-art"
      viewBox="0 0 360 190"
      className={compact ? "mx-auto h-auto w-full max-w-[250px]" : "h-auto w-full"}
      role="img"
      aria-label={`블로커스 ${colorLabel || currentColor || "현재 색"} 남은 조각 없음`}
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="174" rx="26" fill="#f8fafc" stroke={palette.stroke} strokeWidth="3" opacity="0.96" />
      <path d="M28 144c40-30 82-35 126-16 50 22 88 14 121-23 22-24 42-28 60-12v50H28Z" fill={palette.soft} opacity="0.78" />
      <g transform="translate(35 32)">
        {Array.from({ length: 16 }, (_, index) => {
          const x = (index % 4) * 18;
          const y = Math.floor(index / 4) * 18;
          const filled = [0, 1, 4, 5, 10, 14].includes(index);
          return <rect key={index} x={x} y={y} width="14" height="14" rx="3" fill={filled ? palette.fill : "#ffffff"} stroke={filled ? palette.stroke : "#cbd5e1"} strokeWidth="1.5" />;
        })}
      </g>
      <path d="M64 108c52-36 96-36 134 0s78 36 132 0" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="blokus-remaining-empty-node" data-empty-node={node.key}>
          <circle cx={node.x} cy={node.y} r={index === 0 ? 24 : 20} fill="#ffffff" stroke={index === 0 ? palette.stroke : "#0f172a"} strokeWidth={index === 0 ? 4 : 3} />
          {node.key === "empty" && (
            <g>
              <rect x={node.x - 12} y={node.y - 12} width="24" height="24" rx="6" fill={palette.soft} />
              <path d={`M${node.x - 7} ${node.y - 7}h14v14h-14Z`} fill="none" stroke={palette.stroke} strokeWidth="3" />
              <path d={`M${node.x - 11} ${node.y + 13}h22`} stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
          {node.key === "board" && (
            <g>
              <rect x={node.x - 13} y={node.y - 13} width="10" height="10" rx="2" fill={palette.fill} />
              <rect x={node.x + 3} y={node.y - 13} width="10" height="10" rx="2" fill="#e2e8f0" />
              <rect x={node.x - 13} y={node.y + 3} width="10" height="10" rx="2" fill="#e2e8f0" />
              <rect x={node.x + 3} y={node.y + 3} width="10" height="10" rx="2" fill={palette.fill} />
            </g>
          )}
          {node.key === "pass" && (
            <g>
              <path d={`M${node.x - 12} ${node.y}h24`} stroke={canPass ? "#f59e0b" : "#64748b"} strokeWidth="5" strokeLinecap="round" />
              <path d={`M${node.x + 4} ${node.y - 8}l10 8-10 8`} fill="none" stroke={canPass ? "#f59e0b" : "#64748b"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
          {node.key === "score" && (
            <g>
              <path d={`M${node.x} ${node.y - 14}l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z`} fill="#fef3c7" stroke="#d97706" strokeWidth="2.5" />
            </g>
          )}
          <text x={node.x} y={node.y + 38} textAnchor="middle" fontSize="10" fontWeight="900" fill="#475569">{node.label}</text>
        </g>
      ))}
      <rect x="130" y="24" width="190" height="28" rx="14" fill="#ffffff" stroke={palette.stroke} />
      <text x="225" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill={palette.stroke}>{colorLabel || currentColor || "현재 색"} 조각 소진</text>
      <text x="180" y="170" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{canPass ? "패스로 다음 색 흐름 확인" : "보드와 점수 압력 관찰"}</text>
    </svg>
  );
};

const BlokusRemainingPiecesEmptyPanel = ({
  currentColor = "BLUE",
  colorLabel = "",
  currentTurnLabel = "",
  canPass = false,
  myTurn = false,
  currentScoreDetail = null,
  totalLegalPlacementCount = 0,
  compact = false,
}) => {
  const remainingSquares = Number(currentScoreDetail?.remainingSquares || 0);
  const completed = Boolean(currentScoreDetail?.completed) || remainingSquares === 0;
  const score = Number(currentScoreDetail?.score || 0);
  const completionBonus = Number(currentScoreDetail?.completionBonus || 0);
  const monominoBonus = Number(currentScoreDetail?.monominoBonus || 0);
  const stateText = completed ? "모든 조각 소진" : "배치 후보 없음";
  const nextAction = myTurn
    ? canPass ? "패스로 턴 넘기기" : "서버 가능 위치 확인"
    : "다른 색 차례 관찰";
  const emptyItems = [
    {
      key: "empty",
      label: "현재 상태",
      value: stateText,
      detail: completed ? "이 색은 남은 조각이 없어 더 이상 조각 선택 목록이 표시되지 않습니다." : "남은 조각 후보를 불러오지 못했거나 현재 색이 배치할 조각이 없습니다.",
    },
    {
      key: "turn",
      label: "턴 해석",
      value: myTurn ? "내 조작 흐름" : "관전 흐름",
      detail: currentTurnLabel || "현재 색과 담당 좌석을 확인하세요.",
    },
    {
      key: "pass",
      label: "다음 행동",
      value: nextAction,
      detail: canPass ? "가능 위치가 0곳이므로 기존 패스 버튼으로 다음 색에 넘길 수 있습니다." : `가능 위치 ${Number(totalLegalPlacementCount).toLocaleString("ko-KR")}곳 기준으로 보드 흐름을 봅니다.`,
    },
    {
      key: "score",
      label: "점수 근거",
      value: completionBonus || monominoBonus ? `보너스 +${completionBonus + monominoBonus}` : `${score}점`,
      detail: completed ? "완주 보너스와 마지막 1칸 보너스 여부는 서버 점수표가 최종 기준입니다." : "남은 칸 수와 남은 조각 손실이 최종 점수 압력입니다.",
    },
  ];

  return (
    <section
      data-smoke="blokus-remaining-empty-panel"
      data-empty-color={currentColor || ""}
      data-can-pass={canPass ? "true" : "false"}
      data-completed={completed ? "true" : "false"}
      className={`overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 shadow-sm ${compact ? "p-3" : "p-4"}`}
    >
      <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}>
        <BlokusRemainingPiecesEmptyArt currentColor={currentColor} colorLabel={colorLabel} compact={compact} canPass={canPass} />
        <div>
          <div className="inline-flex rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-black text-sky-700">남은 조각 브리핑</div>
          <div className="mt-2 text-sm font-black text-slate-950">남은 조각이 없습니다</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
            {completed ? "현재 색은 모든 조각을 사용했습니다. 이제 배치 선택보다 패스 가능 여부, 다음 색 흐름, 최종 점수 보너스 근거를 확인해야 합니다." : "선택 목록이 비어 있어 보드 배치보다 상태 해석이 우선입니다. 서버가 내려준 현재 색과 가능 위치를 기준으로 다음 행동을 판단합니다."}
          </div>
          <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
            {emptyItems.map((item) => (
              <div key={item.key} data-smoke="blokus-remaining-empty-item" data-empty-key={item.key} className="rounded-lg border border-white/80 bg-white/85 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-xs font-black leading-snug text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const BlokusBoard = ({ room, gameState, mySeatNo, onAction }) => {
  const [selectedPieceCode, setSelectedPieceCode] = useState("");
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const [anchorCell, setAnchorCell] = useState(null);
  const [boardCellSize, setBoardCellSize] = useState(defaultBlokusBoardCellSize);
  const boardSize = Number(get(gameState, "board_size", "boardSize", 20));
  const duoRule = Boolean(get(gameState, "duo_rule", "duoRule", false));
  const variantCode = get(gameState, "variant_code", "variantCode", "BASE");
  const currentColor = get(gameState, "current_color", "currentColor", null);
  const currentSeatNo = Number(get(gameState, "current_seat_no", "currentSeatNo", 0));
  const phase = gameState?.phase || "PLAYING";
  const colors = get(gameState, "colors", "colors", []);
  const pieces = get(gameState, "pieces", "pieces", []);
  const scores = get(gameState, "scores", "scores", []);
  const board = get(gameState, "board", "board", []);
  const startPoints = get(gameState, "start_points", "startPoints", []);
  const moveHistory = get(gameState, "move_history", "moveHistory", []);
  const currentColorState = colors.find((item) => item.color === currentColor);
  const currentColorShared = Boolean(get(currentColorState, "shared", "shared", false));
  const currentColorControllers = get(currentColorState, "controller_seat_nos", "controllerSeatNos", []);
  const roomPlayers = playersOf(room);
  const playerName = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const currentTurnLabel = phase === "FINISHED"
    ? "게임 종료"
    : currentColorShared
      ? `${currentColorState?.label || "-"} 공유 색 · 이번 담당 ${playerName(currentSeatNo)}`
      : `${currentColorState?.label || "-"} 차례 · ${mySeatNo === currentSeatNo ? "내 차례" : playerName(currentSeatNo)}`;
  const variantNotice = variantCode === "THREE_PLAYER"
    ? "3인 변형 · 초록은 세 플레이어가 돌아가며 두는 공유 색이며, 최종 점수에는 각자의 파랑/노랑/빨강만 반영됩니다."
    : variantCode === "TWO_PLAYER"
      ? "2인 변형 · 1번은 파랑+빨강, 2번은 노랑+초록을 번갈아 조종하고 두 색 점수를 합산합니다."
      : variantCode === "TEAM"
        ? "2대2 팀전 · 마주 보는 파랑+빨강, 노랑+초록의 점수를 합산합니다."
        : duoRule
          ? "듀오 · 14x14 보드의 두 중앙 시작점에서 시작하고 파랑/노랑만 사용합니다."
          : "";
  const remainingPieceCodes = get(currentColorState, "remaining_piece_codes", "remainingPieceCodes", []);
  const pieceByCode = useMemo(() => {
    const next = new Map();
    pieces.forEach((piece) => next.set(piece.code, piece));
    return next;
  }, [pieces]);
  const selectedPiece = pieceByCode.get(selectedPieceCode);
  const occupied = useMemo(() => {
    const next = new Map();
    board.forEach((cell) => next.set(`${cell.x}:${cell.y}`, cell));
    return next;
  }, [board]);
  const colorByCell = useMemo(() => {
    const next = new Map();
    board.forEach((cell) => next.set(`${cell.x}:${cell.y}`, cell.color));
    return next;
  }, [board]);
  const colorsOnBoard = useMemo(() => new Set(board.map((cell) => cell.color)), [board]);
  const startPointByCell = useMemo(() => {
    const next = new Map();
    startPoints.forEach((point) => next.set(`${Number(point.x)}:${Number(point.y)}`, point));
    return next;
  }, [startPoints]);
  const placementAnchor = anchorCell || hoverCell;
  const hoverCells = useMemo(() => {
    if (!placementAnchor || !selectedPiece || phase !== "PLAYING") return [];
    return transformCells(selectedPiece, rotation, flipped, placementAnchor.x, placementAnchor.y);
  }, [placementAnchor, selectedPiece, rotation, flipped, phase]);
  const placementStatus = useMemo(() => {
    if (!hoverCells.length || !currentColor) return { legal: false, reason: "" };
    return blokusPlacementStatus({ cells: hoverCells, boardSize, occupied, colorByCell, colorsOnBoard, color: currentColor, startPoints });
  }, [hoverCells, boardSize, occupied, colorByCell, colorsOnBoard, currentColor, startPoints]);
  const currentColorFirstPiece = Boolean(currentColor) && !colorsOnBoard.has(currentColor);
  const placementSignals = useMemo(() => {
    if (!hoverCells.length || !currentColor) {
      return {
        outOfBounds: false,
        overlap: false,
        sideContact: false,
        cornerContact: false,
        coversStart: false,
      };
    }
    const orthogonal = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const validStartPoints = (startPoints || []).filter((point) => !get(point, "color", "color", null) || get(point, "color", "color", null) === currentColor);
    const fallbackCorner = blokusStartCorners[currentColor];
    return {
      outOfBounds: hoverCells.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= boardSize || cell.y >= boardSize),
      overlap: hoverCells.some((cell) => occupied.has(`${cell.x}:${cell.y}`)),
      sideContact: hoverCells.some((cell) => orthogonal.some(([dx, dy]) => colorByCell.get(`${cell.x + dx}:${cell.y + dy}`) === currentColor)),
      cornerContact: hoverCells.some((cell) => diagonal.some(([dx, dy]) => colorByCell.get(`${cell.x + dx}:${cell.y + dy}`) === currentColor)),
      coversStart: validStartPoints.length
        ? validStartPoints.some((point) => hoverCells.some((cell) => cell.x === Number(point.x) && cell.y === Number(point.y)))
        : Boolean(fallbackCorner && hoverCells.some((cell) => cell.x === fallbackCorner.x && cell.y === fallbackCorner.y)),
    };
  }, [hoverCells, currentColor, startPoints, boardSize, occupied, colorByCell]);
  const legalPlacementCountsByPieceCode = useMemo(() => {
    const next = new Map();
    remainingPieceCodes.forEach((pieceCode) => {
      next.set(pieceCode, blokusLegalPlacementCountForPiece({
        piece: pieceByCode.get(pieceCode),
        boardSize,
        occupied,
        colorByCell,
        colorsOnBoard,
        color: currentColor,
        startPoints,
      }));
    });
    return next;
  }, [remainingPieceCodes, pieceByCode, boardSize, occupied, colorByCell, colorsOnBoard, currentColor, startPoints]);
  const selectedPieceLegalCount = Number(legalPlacementCountsByPieceCode.get(selectedPieceCode) || 0);
  const totalLegalPlacementCount = useMemo(
    () => Array.from(legalPlacementCountsByPieceCode.values()).reduce((sum, count) => sum + count, 0),
    [legalPlacementCountsByPieceCode],
  );
  const firstPlayablePieceCode = useMemo(
    () => remainingPieceCodes.find((pieceCode) => Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0) > 0) || "",
    [remainingPieceCodes, legalPlacementCountsByPieceCode],
  );
  const quickPieceCodes = useMemo(() => {
    const selectedCodes = remainingPieceCodes.includes(selectedPieceCode) ? [selectedPieceCode] : [];
    const otherCodes = remainingPieceCodes
      .filter((pieceCode) => pieceCode !== selectedPieceCode)
      .sort((left, right) => {
        const leftCount = Number(legalPlacementCountsByPieceCode.get(left) || 0);
        const rightCount = Number(legalPlacementCountsByPieceCode.get(right) || 0);
        const playableDelta = Number(rightCount > 0) - Number(leftCount > 0);
        if (playableDelta) return playableDelta;
        if (rightCount !== leftCount) return rightCount - leftCount;
        const leftPiece = pieceByCode.get(left);
        const rightPiece = pieceByCode.get(right);
        return Number(rightPiece?.size || rightPiece?.cells?.length || 0) - Number(leftPiece?.size || leftPiece?.cells?.length || 0);
      });
    return [...selectedCodes, ...otherCodes].slice(0, 8);
  }, [remainingPieceCodes, selectedPieceCode, legalPlacementCountsByPieceCode, pieceByCode]);
  const selectedPieceSize = Number(selectedPiece?.size || selectedPiece?.cells?.length || 0);
  const remainingSquares = useMemo(() => remainingPieceCodes.reduce((sum, pieceCode) => {
    const piece = pieceByCode.get(pieceCode);
    return sum + Number(piece?.size || piece?.cells?.length || 0);
  }, 0), [remainingPieceCodes, pieceByCode]);
  const blokusPiecePressureEntries = useMemo(() => remainingPieceCodes.map((pieceCode) => {
    const piece = pieceByCode.get(pieceCode);
    const legalCount = Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0);
    return {
      pieceCode,
      piece,
      legalCount,
      size: Number(piece?.size || piece?.cells?.length || 0),
    };
  }), [remainingPieceCodes, pieceByCode, legalPlacementCountsByPieceCode]);
  const blokusBlockedPieceCount = blokusPiecePressureEntries.filter((entry) => entry.legalCount <= 0).length;
  const blokusBestPieceEntry = [...blokusPiecePressureEntries]
    .filter((entry) => entry.legalCount > 0)
    .sort((left, right) => {
      if (right.legalCount !== left.legalCount) return right.legalCount - left.legalCount;
      return right.size - left.size;
    })[0] || null;
  const blokusScoreDetailsByColor = useMemo(() => {
    const next = new Map();
    colors.forEach((colorState) => {
      const color = colorState.color;
      const colorRemainingPieceCodes = get(colorState, "remaining_piece_codes", "remainingPieceCodes", []);
      const colorRemainingSquares = colorRemainingPieceCodes.reduce((sum, pieceCode) => {
        const piece = pieceByCode.get(pieceCode);
        return sum + Number(piece?.size || piece?.cells?.length || 0);
      }, 0);
      const completed = colorRemainingPieceCodes.length === 0;
      const lastPieceCode = get(colorState, "last_piece_code", "lastPieceCode", "");
      const shared = Boolean(get(colorState, "shared", "shared", false));
      const controllerSeatNos = get(colorState, "controller_seat_nos", "controllerSeatNos", []);
      const completionBonus = completed ? 15 : 0;
      const monominoBonus = completed && lastPieceCode === "I1" ? 5 : 0;
      const score = Number(get(
        colorState,
        "score",
        "score",
        completed ? completionBonus + monominoBonus : -colorRemainingSquares,
      ));

      next.set(color, {
        color,
        label: get(colorState, "label", "label", blokusColorLabels[color] || color),
        ownerSeatNo: Number(get(colorState, "owner_seat_no", "ownerSeatNo", 0)),
        remainingSquares: colorRemainingSquares,
        completed,
        lastPieceCode,
        completionBonus,
        monominoBonus,
        shared,
        controllerSeatNos,
        score,
      });
    });
    return next;
  }, [colors, pieceByCode]);
  const currentBlokusScoreDetail = currentColor ? blokusScoreDetailsByColor.get(currentColor) : null;
  const previewCells = useMemo(() => {
    if (!hoverCells.length) return new Set();
    return new Set(hoverCells.map((cell) => `${cell.x}:${cell.y}`));
  }, [hoverCells]);
  const myTurn = phase === "PLAYING" && currentSeatNo === mySeatNo;
  const canPass = myTurn && totalLegalPlacementCount === 0;
  const selectedPieceBlocked = myTurn && Boolean(selectedPieceCode) && selectedPieceLegalCount <= 0 && totalLegalPlacementCount > 0;
  const scoreDisplayLabel = (score) => {
    const scoreKey = String(get(score, "score_key", "scoreKey", ""));
    const scoreColors = get(score, "colors", "colors", []);
    const colorText = scoreColors.map((color) => blokusColorLabels[color] || color).join("+");
    if (scoreKey.startsWith("TEAM_")) {
      const seatNos = scoreColors
        .map((color) => blokusScoreDetailsByColor.get(color)?.ownerSeatNo)
        .filter(Boolean);
      const names = [...new Set(seatNos)].map(playerName).join("+");
      return names ? `${names} 팀 (${colorText})` : `${score.label || "팀"} (${colorText})`;
    }
    const seatMatch = scoreKey.match(/^SEAT_(\d+)$/);
    if (seatMatch) {
      const name = playerName(Number(seatMatch[1]));
      return colorText ? `${name} (${colorText})` : name;
    }
    return score.label || scoreKey || "점수";
  };
  const winners = scores.filter((score) => Boolean(get(score, "winner", "winner", false)));
  const winnerText = winners.map(scoreDisplayLabel).join(", ");
  const winningScore = winners.length ? Number(get(winners[0], "score", "score", 0)) : 0;
  const blokusTurnGuidance = (() => {
    if (phase === "FINISHED") {
      return winners.length ? `${winnerText} 승리, 최종 ${winningScore}점입니다.` : "게임이 종료되었습니다.";
    }
    if (!myTurn) {
      return `${playerName(currentSeatNo)}님의 ${currentColorState?.label || currentColor || "색"} 차례를 기다리는 중입니다.`;
    }
    if (canPass) {
      return "남은 모든 조각이 막혔습니다. 패스를 눌러 다음 색으로 넘길 수 있습니다.";
    }
    if (selectedPieceBlocked) {
      return "선택한 조각은 둘 수 없습니다. 자동 선택으로 가능한 조각을 고르거나 다른 조각을 확인하세요.";
    }
    if (anchorCell && placementStatus.legal) {
      return `${anchorCell.x + 1}열 ${anchorCell.y + 1}행 기준으로 놓을 수 있습니다. 다시 누르거나 놓기 버튼으로 확정하세요.`;
    }
    if (anchorCell && !placementStatus.legal) {
      return placementStatus.reason ? `선택 위치는 ${placementStatus.reason} 때문에 둘 수 없습니다.` : "선택 위치에는 둘 수 없습니다. 다른 칸을 골라주세요.";
    }
    return selectedPiece ? "조각을 회전/뒤집은 뒤 보드 칸을 선택하세요." : "먼저 둘 조각을 선택하세요.";
  })();
  const blokusQuickFacts = [
    { label: "색", value: currentColorState?.label || currentColor || "-" },
    { label: "조각", value: selectedPiece?.name || "미선택" },
    { label: "가능", value: `${totalLegalPlacementCount.toLocaleString("ko-KR")}곳` },
    { label: "선택", value: anchorCell ? `${anchorCell.x + 1}, ${anchorCell.y + 1}` : "없음" },
  ];
  const blokusBestPieceName = blokusBestPieceEntry?.piece?.name || blokusBestPieceEntry?.pieceCode || "후보 없음";
  const blokusBestLegalCount = Number(blokusBestPieceEntry?.legalCount || 0);
  const blokusPlacementRuleText = currentColorFirstPiece
    ? placementSignals.coversStart ? "시작점 충족" : "첫 조각은 시작점 필요"
    : placementSignals.cornerContact ? "모서리 접촉" : "모서리 필요";
  const blokusBlockedReason = placementSignals.overlap
    ? "겹침"
    : placementSignals.sideContact
      ? "변 접촉"
      : placementSignals.outOfBounds
        ? "보드 밖"
        : canPass
          ? "모두 막힘"
          : "차단 없음";
  const blokusBottomSummaryItems = [
    {
      key: "turn",
      label: "차례",
      value: phase === "FINISHED" ? "게임 종료" : currentColorState?.label || currentColor || "-",
      detail: currentTurnLabel,
      tone: myTurn ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "piece",
      label: "선택 조각",
      value: selectedPiece?.name || "미선택",
      detail: selectedPiece ? `${selectedPieceSize}칸 · 가능 ${selectedPieceLegalCount.toLocaleString("ko-KR")}곳` : "조각 목록에서 선택",
      tone: selectedPiece ? "border-sky-100 bg-sky-50 text-sky-800" : "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      key: "placement",
      label: "배치 판정",
      value: placementStatus.legal ? "배치 가능" : anchorCell ? placementStatus.reason || "배치 불가" : "위치 미선택",
      detail: anchorCell ? blokusBlockedReason : blokusPlacementRuleText,
      tone: placementStatus.legal ? "border-emerald-100 bg-emerald-50 text-emerald-800" : anchorCell ? "border-rose-100 bg-rose-50 text-rose-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "pressure",
      label: "남은 압박",
      value: `${remainingSquares.toLocaleString("ko-KR")}칸`,
      detail: `전체 ${totalLegalPlacementCount.toLocaleString("ko-KR")}곳 · 막힌 조각 ${blokusBlockedPieceCount}개 · 최고 ${blokusBestPieceName} ${blokusBestLegalCount.toLocaleString("ko-KR")}곳`,
      tone: canPass ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
  ];
  const placeButtonEnabled = myTurn && Boolean(anchorCell) && Boolean(placementStatus.legal);
  const placeButtonHint = !myTurn
    ? "내 차례가 되면 놓을 수 있습니다."
    : !selectedPiece
      ? "먼저 오른쪽 조각 목록에서 도형을 고르세요."
      : !anchorCell
        ? "보드 칸을 누르면 도형이 덮을 칸이 색으로 표시됩니다."
        : placementStatus.legal
          ? "초록/현재 색 미리보기 칸에 확정 배치할 수 있습니다."
          : placementStatus.reason || "현재 위치에는 놓을 수 없습니다.";

  useEffect(() => {
    if (!remainingPieceCodes.includes(selectedPieceCode)) {
      setSelectedPieceCode(remainingPieceCodes[0] || "");
      setRotation(0);
      setFlipped(false);
      setAnchorCell(null);
    }
  }, [remainingPieceCodes, selectedPieceCode]);

  useEffect(() => {
    setAnchorCell(null);
  }, [selectedPieceCode, rotation, flipped, currentColor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!blokusBoardCellSizes.includes(boardCellSize)) return;
    window.localStorage?.setItem(blokusBoardCellSizeStorageKey, String(boardCellSize));
  }, [boardCellSize]);

  const selectFirstPlayablePiece = () => {
    if (!firstPlayablePieceCode) return;
    setSelectedPieceCode(firstPlayablePieceCode);
    setRotation(0);
    setFlipped(false);
    setAnchorCell(null);
    setHoverCell(null);
  };

  const place = async (x, y) => {
    if (!myTurn || !selectedPieceCode) return;
    await onAction({
      action_type: "PLACE",
      piece_code: selectedPieceCode,
      anchor_x: x,
      anchor_y: y,
      rotation,
      flipped,
    });
    setAnchorCell(null);
    setHoverCell(null);
  };

  const selectCell = async (x, y) => {
    if (!myTurn || !selectedPieceCode) return;
    const sameAnchor = anchorCell?.x === x && anchorCell?.y === y;
    if (sameAnchor && placementStatus.legal) {
      await place(x, y);
      return;
    }
    setAnchorCell({ x, y });
    setHoverCell(null);
  };

  const pass = async () => {
    if (!myTurn) return;
    await onAction({ action_type: "PASS" });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
      <div id="blokus-board-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Shield className="h-4 w-4 text-primary-600" />
            블로커스 보드
          </div>
          {duoRule && (
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
              듀오 · 14x14 중앙 시작점
            </div>
          )}
          <div
            className={`rounded-full border px-3 py-1 text-xs font-black ${colorBgSoft[currentColor] || "bg-slate-50"} ${colorText[currentColor] || "text-slate-600"}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentTurnLabel}
          </div>
          {myTurn && placementAnchor && (
            <div className={`rounded-full px-3 py-1 text-xs font-black ${placementStatus.legal ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {placementStatus.legal ? "배치 가능" : placementStatus.reason || "배치 불가"}
            </div>
          )}
          {myTurn && selectedPiece && !placementAnchor && (
            <div className={`rounded-full px-3 py-1 text-xs font-black ${selectedPieceLegalCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              선택 조각 가능 위치 {selectedPieceLegalCount.toLocaleString("ko-KR")}곳
            </div>
          )}
          {myTurn && (
            <div className={`rounded-full px-3 py-1 text-xs font-black ${canPass ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
              전체 가능 위치 {totalLegalPlacementCount.toLocaleString("ko-KR")}곳
            </div>
          )}
        </div>
        <div className="mb-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-fuchsia-50 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-2xl p-2 text-white shadow-sm ${colorClasses[currentColor] || "bg-slate-700"}`}>
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-blue-700">지금 할 일</div>
              <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{blokusTurnGuidance}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {blokusQuickFacts.map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/80 px-2.5 py-2">
                    <div className="text-[10px] font-bold text-slate-400">{item.label}</div>
                    <div className="truncate text-[11px] font-black text-slate-700">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {phase === "FINISHED" && winners.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-black text-amber-900">
              <Crown className="h-4 w-4 text-amber-500" />
              최종 승자 · {winnerText}
            </div>
            <div className="text-xs font-black text-amber-700">최종 점수 {winningScore}</div>
          </div>
        )}
        {variantNotice && phase !== "FINISHED" && (
          <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold leading-relaxed text-sky-800">
            {variantNotice}
            {currentColorShared && currentColorControllers.length > 0 ? ` 현재 공유 색 담당 순서: ${currentColorControllers.map((seatNo) => playerName(seatNo)).join(" → ")}.` : ""}
          </div>
        )}
        <div className="mb-3 flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {blokusBoardCellSizes.map((size) => (
              <button
                key={size}
                type="button"
                className={`min-h-11 rounded-lg px-3 text-xs font-black ${boardCellSize === size ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                onClick={() => setBoardCellSize(size)}
              >
                {size === 16 ? "모바일" : size === 20 ? "촘촘" : size === 24 ? "표준" : "확대"}
              </button>
            ))}
          </div>
          <div className="text-xs font-bold text-slate-500">
            {anchorCell ? `선택 ${anchorCell.x + 1}, ${anchorCell.y + 1}` : "위치 미선택"}
          </div>
        </div>
        <div className="tabletop-board-scroll overflow-auto rounded-xl border border-slate-300 bg-slate-200">
          <div
            className="grid"
            aria-label="블로커스 보드"
            style={{
              gridTemplateColumns: `repeat(${boardSize}, ${boardCellSize}px)`,
              width: boardSize * boardCellSize,
              height: boardSize * boardCellSize,
            }}
            onMouseLeave={() => {
              if (!anchorCell) setHoverCell(null);
            }}
          >
            {Array.from({ length: boardSize * boardSize }, (_, index) => {
              const x = index % boardSize;
              const y = Math.floor(index / boardSize);
              const cell = occupied.get(`${x}:${y}`);
              const color = cell?.color;
              const preview = previewCells.has(`${x}:${y}`);
              const anchored = anchorCell?.x === x && anchorCell?.y === y;
              const startPoint = startPointByCell.get(`${x}:${y}`);
              const cellLabelParts = [`${x + 1}열 ${y + 1}행`];
              if (cell) {
                cellLabelParts.push(`${blokusColorLabels[color] || color} 조각`);
              } else if (startPoint) {
                cellLabelParts.push("시작점");
              } else {
                cellLabelParts.push("빈 칸");
              }
              if (anchored) cellLabelParts.push("현재 선택 위치");
              if (preview && !cell) cellLabelParts.push(placementStatus.legal ? "배치 미리보기 가능" : placementStatus.reason || "배치 미리보기 불가");
              if (preview && cell) cellLabelParts.push("이미 차지한 칸과 겹침");
              if (myTurn && selectedPiece) cellLabelParts.push(`${selectedPiece.name || selectedPieceCode} 배치 기준`);
              const cellLabel = cellLabelParts.join(" · ");
              return (
                <button
                  key={`${x}:${y}`}
                  type="button"
                  className={[
                    "relative border border-white/60 transition-all",
                    color ? `${colorClasses[color] || "bg-slate-500"} shadow-inner` : startPoint ? "bg-amber-100 hover:bg-amber-200" : "bg-slate-50 hover:bg-slate-100",
                    preview && !cell && placementStatus.legal ? `${colorClasses[currentColor] || "bg-slate-400"} z-10 scale-105 opacity-95 ring-2 ring-slate-950 ring-offset-1 ring-offset-white shadow-[0_0_0_2px_rgba(255,255,255,0.9)_inset]` : "",
                    preview && !cell && !placementStatus.legal ? "z-10 scale-105 bg-rose-300 ring-2 ring-rose-700 ring-offset-1 ring-offset-white" : "",
                    preview && cell ? "z-10 ring-2 ring-rose-700 ring-offset-1 ring-offset-white" : "",
                    anchored ? "z-20 ring-2 ring-slate-950 ring-offset-2 ring-offset-amber-200" : "",
                  ].join(" ")}
                  style={{ width: boardCellSize, height: boardCellSize }}
                  onMouseEnter={() => {
                    if (!anchorCell) setHoverCell({ x, y });
                  }}
                  onFocus={() => {
                    if (!anchorCell) setHoverCell({ x, y });
                  }}
                  onClick={() => selectCell(x, y).catch(() => notifyError("둘 수 없는 위치입니다."))}
                  aria-label={cellLabel}
                  aria-pressed={anchored}
                  title={cellLabel}
                >
                  {startPoint && !cell && (
                    <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 shadow-sm" />
                  )}
                  {preview && !cell && (
                    <span className={`absolute inset-[22%] rounded-[3px] border ${placementStatus.legal ? "border-white/90 bg-white/25" : "border-rose-900/70 bg-white/20"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div id="blokus-action-strip" className="tabletop-mobile-action-strip sticky z-20 mt-3 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur xl:hidden">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
            <span className="font-black text-slate-800">{selectedPiece?.name || "조각 선택"}</span>
            <span>{anchorCell ? `선택 ${anchorCell.x + 1}, ${anchorCell.y + 1}` : "보드에서 위치 선택"}</span>
            <span className={selectedPieceLegalCount > 0 ? "text-emerald-600" : "text-rose-600"}>
              가능 위치 {selectedPieceLegalCount.toLocaleString("ko-KR")}
            </span>
          </div>
          <div className="mb-2 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
              onClick={() => setRotation((value) => (value + 90) % 360)}
              disabled={!myTurn}
              aria-label={`선택 조각을 90도 회전합니다. 현재 ${rotation}도`}
              title="회전"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
              onClick={() => setFlipped((value) => !value)}
              disabled={!myTurn}
              aria-label={`선택 조각을 뒤집습니다. 현재 ${flipped ? "뒤집힌 상태" : "기본 방향"}`}
              title="뒤집기"
            >
              <FlipHorizontal className="h-4 w-4" />
            </button>
            <div className="tabletop-scroll-rail flex min-w-0 gap-2 overflow-x-auto pb-1">
              {quickPieceCodes.map((pieceCode) => {
                const piece = pieceByCode.get(pieceCode);
                const selected = pieceCode === selectedPieceCode;
                const legalCount = Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0);
                return (
                  <button
                    key={`quick-${pieceCode}`}
                    type="button"
                    className={`flex h-16 min-w-[78px] flex-col items-center justify-between rounded-xl border px-2 py-1.5 text-[10px] font-black transition ${selected ? "border-slate-900 bg-slate-900 text-white" : legalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}
                    onClick={() => setSelectedPieceCode(pieceCode)}
                    disabled={!myTurn}
                    aria-pressed={selected}
                    aria-label={`${piece?.name || pieceCode} 조각 선택 · ${piece?.size || piece?.cells?.length || 0}칸 · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳${selected ? " · 현재 선택됨" : ""}`}
                    title={`${piece?.name || pieceCode} · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳`}
                  >
                    <span className="max-w-full truncate">{piece?.name || pieceCode}</span>
                    <BlokusPieceArt piece={piece} color={currentColor || "BLUE"} className="h-7 max-w-full" />
                  </button>
                );
              })}
              {!quickPieceCodes.length && (
                <div className="min-w-[220px]">
                  <BlokusRemainingPiecesEmptyPanel
                    currentColor={currentColor || "BLUE"}
                    colorLabel={currentColorState?.label || currentColor || "현재 색"}
                    currentTurnLabel={currentTurnLabel}
                    canPass={canPass}
                    myTurn={myTurn}
                    currentScoreDetail={currentBlokusScoreDetail}
                    totalLegalPlacementCount={totalLegalPlacementCount}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-white ${placeButtonEnabled ? "bg-emerald-600 shadow-lg shadow-emerald-200" : "bg-slate-400 opacity-70"}`}
              disabled={!placeButtonEnabled}
              onClick={() => anchorCell && place(anchorCell.x, anchorCell.y).catch(() => notifyError("놓을 수 없는 위치입니다."))}
            >
              <CheckCircle2 className="h-4 w-4" />
              놓기
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-700 disabled:opacity-40"
              onClick={() => pass().catch(() => notifyError("아직 놓을 수 있는 조각이 있습니다."))}
              disabled={!canPass}
            >
              패스
            </button>
          </div>
          <div className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-bold ${canPass ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
            {canPass ? "남은 모든 조각이 막혀 패스할 수 있습니다." : placeButtonHint}
          </div>
          {selectedPieceBlocked && (
            <button
              type="button"
              className="mt-2 inline-flex w-full min-h-11 items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
              onClick={selectFirstPlayablePiece}
            >
              둘 수 있는 조각 자동 선택
            </button>
          )}
        </div>
      </div>

        <section className="scroll-mt-24 space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-900">핵심 요약</div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">보드와 조각을 본 뒤 필요한 판단만 압축해서 확인합니다.</div>
            </div>
            <div className={`rounded-full px-3 py-1 text-[11px] font-black ${colorBgSoft[currentColor] || "bg-slate-50"} ${colorText[currentColor] || "text-slate-600"}`}>
              {currentTurnLabel}
            </div>
          </div>
          <div data-smoke="blokus-bottom-summary" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {blokusBottomSummaryItems.map((item) => (
              <div key={item.key} data-smoke="blokus-bottom-summary-item" data-summary-key={item.key} className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 truncate text-sm font-black">{item.value}</div>
                <div className="mt-0.5 line-clamp-1 text-[10px] font-bold opacity-70">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-black text-slate-900">조각 선택</div>
            <div className="flex gap-1">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
                onClick={() => setRotation((value) => (value + 90) % 360)}
                disabled={!myTurn}
                aria-label={`선택 조각을 90도 회전합니다. 현재 ${rotation}도`}
                title="회전"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
                onClick={() => setFlipped((value) => !value)}
                disabled={!myTurn}
                aria-label={`선택 조각을 뒤집습니다. 현재 ${flipped ? "뒤집힌 상태" : "기본 방향"}`}
                title="뒤집기"
              >
                <FlipHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
            <span>회전 {rotation}도</span>
            <span>{flipped ? "뒤집힘" : "기본 방향"}</span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-700">{selectedPiece?.name || "조각"}</span>
              <span className="text-[11px] font-bold text-slate-500">{selectedPiece ? `${selectedPieceSize}칸` : "-"}</span>
            </div>
            <div className="flex min-h-[54px] items-center justify-center rounded-lg bg-white">
              {selectedPiece ? <BlokusPieceArt piece={{ ...selectedPiece, cells: transformCells(selectedPiece, rotation, flipped, 0, 0) }} color={currentColor || "BLUE"} className="h-12 max-w-full" /> : null}
            </div>
          </div>
          <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold leading-relaxed ${selectedPieceLegalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
            {selectedPiece
              ? selectedPieceLegalCount > 0
                ? `현재 보드에서 이 조각을 둘 수 있는 위치가 ${selectedPieceLegalCount.toLocaleString("ko-KR")}곳 있습니다.`
                : "이 조각은 현재 둘 수 없습니다. 다른 조각을 고르거나 모든 조각이 막혔을 때 패스하세요."
              : "놓을 조각을 선택하세요."}
          </div>
          {selectedPieceBlocked && (
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
              onClick={selectFirstPlayablePiece}
            >
              둘 수 있는 조각 자동 선택
            </button>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-black">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">남은 조각 {remainingPieceCodes.length}개</div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">남은 칸 {remainingSquares}칸</div>
            <div className={`col-span-2 rounded-xl px-3 py-2 ${canPass ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"}`}>
              전체 가능 위치 {totalLegalPlacementCount.toLocaleString("ko-KR")}곳
            </div>
          </div>
          <button
            type="button"
            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-white ${placeButtonEnabled ? "bg-emerald-600 shadow-lg shadow-emerald-200" : "bg-slate-400 opacity-70"}`}
            disabled={!placeButtonEnabled}
            onClick={() => anchorCell && place(anchorCell.x, anchorCell.y).catch(() => notifyError("둘 수 없는 위치입니다."))}
          >
            <CheckCircle2 className="h-4 w-4" />
            선택 위치에 놓기
          </button>
          <div className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${placeButtonEnabled ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-500"}`}>
            {placeButtonHint}
          </div>
          <div className="mt-3 grid max-h-[360px] grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3 xl:grid-cols-2">
            {remainingPieceCodes.map((pieceCode) => {
              const piece = pieceByCode.get(pieceCode);
              const selected = pieceCode === selectedPieceCode;
              const legalCount = Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0);
              return (
                <button
                  key={pieceCode}
                  type="button"
                  className={`flex min-h-[82px] flex-col justify-between rounded-xl border p-2 text-left transition ${selected ? "border-slate-900 bg-slate-900 text-white" : legalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800 hover:border-emerald-300" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"}`}
                  onClick={() => setSelectedPieceCode(pieceCode)}
                  disabled={!myTurn}
                  aria-label={`${piece?.name || pieceCode} 조각 선택 · ${piece?.size || piece?.cells?.length || 0}칸 · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳${selected ? " · 현재 선택됨" : ""}`}
                  aria-pressed={selected}
                  title={`${piece?.name || pieceCode} · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳`}
                >
                  <span className="flex items-center justify-between gap-1 text-[11px] font-black">
                    <span className="min-w-0 truncate">{piece?.name || pieceCode}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${selected ? "bg-white/15 text-white" : legalCount > 0 ? "bg-white text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      {legalCount > 0 ? `${legalCount.toLocaleString("ko-KR")}곳` : "막힘"}
                    </span>
                  </span>
                  <BlokusPieceArt piece={piece} color={currentColor || "BLUE"} className="mt-2 h-8 max-w-full" />
                </button>
              );
            })}
            {!remainingPieceCodes.length && (
              <div className="col-span-2 sm:col-span-3 xl:col-span-2">
                <BlokusRemainingPiecesEmptyPanel
                  currentColor={currentColor || "BLUE"}
                  colorLabel={currentColorState?.label || currentColor || "현재 색"}
                  currentTurnLabel={currentTurnLabel}
                  canPass={canPass}
                  myTurn={myTurn}
                  currentScoreDetail={currentBlokusScoreDetail}
                  totalLegalPlacementCount={totalLegalPlacementCount}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
            onClick={() => pass().catch(() => notifyError("아직 둘 수 있는 조각이 있습니다."))}
            disabled={!canPass}
          >
            <Ban className="h-4 w-4" />
            {canPass ? "둘 수 없음 · 패스" : "패스 불가"}
          </button>
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-500">
            {canPass
              ? "남은 모든 조각이 막혔습니다. 서버 규칙상 패스가 승인됩니다."
              : "패스는 남은 모든 조각이 막혔을 때만 가능합니다. 선택 조각이 막혔다면 다른 조각도 확인하세요."}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-black text-slate-900">점수</div>
            <div className="text-[11px] font-bold text-slate-500">남은 칸은 감점 · 완주 +15 · 마지막 1칸 +5</div>
          </div>
          <div className="space-y-2">
            {scores.map((score) => {
              const scoreColors = get(score, "colors", "colors", []);
              return (
                <div key={get(score, "score_key", "scoreKey", score.label)} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-black text-slate-700">{scoreDisplayLabel(score)}</div>
                    <div className="mt-2 space-y-1">
                      {scoreColors.map((color) => {
                        const detail = blokusScoreDetailsByColor.get(color);
                        return (
                          <div key={color} className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <span className={`h-2.5 w-2.5 rounded-full ${colorClasses[color] || "bg-slate-300"}`} />
                            <span className={`${colorText[color] || "text-slate-600"} font-black`}>{blokusColorLabels[color] || color}</span>
                            {detail?.shared && <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-sky-700">공유 색</span>}
                            {detail?.completed ? (
                              <>
                                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700">완주 +15</span>
                                {detail.monominoBonus > 0 && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">마지막 1칸 +5</span>}
                              </>
                            ) : (
                              <span>남은 {detail?.remainingSquares ?? 0}칸</span>
                            )}
                            <span className="text-slate-400">점수 {detail?.score ?? 0}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-sm font-black text-slate-900">
                    {score.winner && <Crown className="h-4 w-4 text-amber-500" />}
                    {score.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 수</div>
          <div className="space-y-2">
            {moveHistory.slice(-5).reverse().map((move) => (
              <div key={get(move, "turn_number", "turnNumber", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {get(move, "turn_number", "turnNumber", 0)}수 · {move.pass ? "패스" : get(move, "piece_code", "pieceCode", "")} · {move.color}
              </div>
            ))}
            {!moveHistory.length && (
              <TabletopHistoryEmptyState
                game="blokus"
                title="아직 배치 기록이 없습니다"
                detail="첫 조각을 놓거나 패스가 처리되면 색상, 조각, 순서가 이 기록 영역에 쌓입니다."
                nextAction="첫 배치"
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export { BlokusBoard };
export default BlokusBoard;
