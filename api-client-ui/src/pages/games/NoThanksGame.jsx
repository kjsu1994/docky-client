import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import { MessageSquare, Play, TimerReset } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { confirmAction } from "../../common/confirmAction.jsx";
import { buildTalkPayload, chatAdapter, compareMessagesByChronology, getMemberId, normalizeMessage } from "../../adapters/chatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import {
  buildNoThanksActionPayload,
  getNoThanksChatRoomId,
  getNoThanksPlayerId,
  getNoThanksRoomId,
  isNoThanksReadyPlayer,
  noThanksGameAdapter,
  noThanksGameErrorMessage,
  noThanksRoomStatusLabel,
  normalizeNoThanksState,
} from "../../adapters/noThanksGameAdapter.js";
import { useGameSound } from "../../hooks/useGameSound.js";
import GameRoomPlayersPanel from "../../common/GameRoomPlayersPanel.jsx";
import GameRoomChatPanel from "../../common/GameRoomChatPanel.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { NoThanksCardFace, NoThanksChipToken } from "../../common/NoThanksVisuals.jsx";
import { clearPageGuideContext, setPageGuideContext } from "../../common/pageGuideContext.js";
import { GameActionCueBar, GameChatEmptyState, GameFlowMeter, GameResultSpotlight, GameUxGlyph } from "./GameUxAssets.jsx";
import { TabletopGameArtwork } from "./TabletopGameArtwork.jsx";

const ROOM_STORAGE_KEY = "no_thanks_last_room_id";
const ROOM_TITLE_STORAGE_KEY = "no_thanks_last_room_title";
const CHAT_ROOM_READ_EVENT = "chat-room-read";
const NO_THANKS_SOUND_VOLUME_MULTIPLIER = 16;

const roomIdOf = getNoThanksRoomId;
const chatRoomIdOf = getNoThanksChatRoomId;
const rememberResumeRoom = (room) => {
  const roomId = roomIdOf(room);
  if (!roomId) return;
  localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));
  localStorage.setItem(ROOM_TITLE_STORAGE_KEY, String(room?.title || "노 땡스 최근 방"));
};
const clearResumeRoom = (roomId) => {
  const storedId = localStorage.getItem(ROOM_STORAGE_KEY);
  if (!roomId || storedId === String(roomId)) {
    localStorage.removeItem(ROOM_STORAGE_KEY);
    localStorage.removeItem(ROOM_TITLE_STORAGE_KEY);
  }
};
const parseIntSafe = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeNumberDraft = (raw) => {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(\d)/, "$1");
};
const clampNumberText = (raw, min, max, fallback) => {
  const normalized = normalizeNumberDraft(raw);
  if (!normalized) return String(fallback);
  const clamped = Math.min(max, Math.max(min, parseIntSafe(normalized, fallback)));
  return String(clamped);
};
const isReadyPlayer = isNoThanksReadyPlayer;
const playerIdOf = (player) => Number(getNoThanksPlayerId(player) || 0);
const cardsLabel = (cards) => (Array.isArray(cards) && cards.length ? cards.join(", ") : "-");
const noThanksLobbyPlayers = (room) => (Array.isArray(room?.players) ? room.players : []);
const noThanksRoomStatusTone = (status) => {
  const normalized = String(status || "WAITING").toUpperCase();
  if (normalized === "PLAYING") return "bg-emerald-100 text-emerald-700";
  if (normalized === "FINISHED" || normalized === "CANCELLED") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-700";
};
const noThanksLobbyRoomReadiness = (room) => {
  const status = String(room?.roomStatus || "WAITING").toUpperCase();
  const players = noThanksLobbyPlayers(room);
  const hostMemberId = Number(room?.hostMemberId || 0);
  const guests = players.filter((player) => playerIdOf(player) !== hostMemberId);
  const readyGuests = guests.filter(isReadyPlayer).length;
  const minPlayers = parseIntSafe(room?.minPlayers, 2);
  const maxPlayers = parseIntSafe(room?.maxPlayers, 6);
  if (status !== "WAITING") {
    return {
      done: status === "PLAYING",
      value: noThanksRoomStatusLabel(status),
      detail: status === "PLAYING" ? "이미 카드 선택이 시작된 방입니다." : "종료된 방은 새 방을 만드는 편이 좋습니다.",
    };
  }
  if (players.length < minPlayers) {
    return {
      done: false,
      value: `인원 ${players.length}/${minPlayers}`,
      detail: `${Math.max(0, minPlayers - players.length)}명이 더 들어오면 시작 조건을 맞춥니다.`,
    };
  }
  if (!guests.length) {
    return {
      done: true,
      value: "방장 시작 가능",
      detail: maxPlayers > 1 ? "추가 인원을 기다리거나 바로 시작할 수 있습니다." : "혼자 진행 가능한 방입니다.",
    };
  }
  return {
    done: readyGuests === guests.length,
    value: `게스트 준비 ${readyGuests}/${guests.length}`,
    detail: readyGuests === guests.length ? "준비 조건을 만족했습니다." : "아직 준비하지 않은 게스트가 있습니다.",
  };
};
const noThanksLobbyRoomActionSignal = (room) => {
  const status = String(room?.roomStatus || "WAITING").toUpperCase();
  const players = noThanksLobbyPlayers(room);
  const maxPlayers = parseIntSafe(room?.maxPlayers, 6);
  const minPlayers = parseIntSafe(room?.minPlayers, 2);
  const full = maxPlayers > 0 && players.length >= maxPlayers;
  if (status !== "WAITING") {
    return { value: status === "PLAYING" ? "진행 중" : "종료됨", detail: "입장 대신 다른 대기 방을 고르거나 새 방을 만드세요." };
  }
  if (full) {
    return { value: "정원 마감", detail: "빈 좌석이 생기기 전까지 입장할 수 없습니다." };
  }
  if (players.length < minPlayers) {
    return { value: "합류 추천", detail: "입장하면 카드 게임 시작 조건에 가까워집니다." };
  }
  return { value: "입장 가능", detail: "입장 후 준비하면 방장이 게임을 시작할 수 있습니다." };
};

const noThanksLobbyRoomDecisionToneClasses = {
  access: "border-orange-200 bg-orange-50 text-orange-950",
  seat: "border-sky-200 bg-sky-50 text-sky-950",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-950",
  rule: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950",
  blocked: "border-rose-200 bg-rose-50 text-rose-950",
};

const buildNoThanksLobbyRoomDecisionItems = ({
  room,
  playersCount,
  minPlayers,
  maxPlayers,
  status,
  roomFull,
  joinable,
  readiness,
  actionSignal,
}) => {
  const safePlayers = Math.max(0, parseIntSafe(playersCount, 0));
  const safeMaxPlayers = Math.max(1, parseIntSafe(maxPlayers, 6) || 6);
  const safeMinPlayers = Math.max(1, Math.min(safeMaxPlayers, parseIntSafe(minPlayers, 2) || 2));
  const openSeats = Math.max(0, safeMaxPlayers - safePlayers);
  const normalizedStatus = String(status || "WAITING").toUpperCase();
  const startChipCount = Math.max(1, parseIntSafe(room?.startChipCount, 11) || 11);
  const turnTimeSeconds = Math.max(5, parseIntSafe(room?.turnTimeSeconds, 15) || 15);
  const accessTone = joinable ? "access" : "blocked";
  const accessValue = joinable
    ? "입장 가능"
    : roomFull
      ? "정원 마감"
      : normalizedStatus === "PLAYING"
        ? "진행 중"
        : "입장 대기";
  const accessDetail = actionSignal?.detail || (joinable
    ? "지금 들어가면 바로 준비 상태를 확인할 수 있습니다."
    : "다른 대기 방을 고르거나 새 방을 만드는 편이 빠릅니다.");

  return [
    {
      key: "access",
      label: "입장 판단",
      value: accessValue,
      detail: accessDetail,
      tone: accessTone,
      icon: "decision",
    },
    {
      key: "seat",
      label: "인원",
      value: `${safePlayers}/${safeMinPlayers}명`,
      detail: safePlayers < safeMinPlayers
        ? `시작까지 ${safeMinPlayers - safePlayers}명이 더 필요합니다.`
        : openSeats > 0
          ? `빈 좌석 ${openSeats}개가 남아 있습니다.`
          : "좌석이 모두 찼습니다.",
      tone: roomFull ? "blocked" : safePlayers >= safeMinPlayers ? "ready" : "seat",
      icon: "player",
    },
    {
      key: "ready",
      label: "준비",
      value: readiness?.value || "준비 확인",
      detail: readiness?.detail || "입장 후 참가자 준비 상태를 확인하세요.",
      tone: readiness?.done ? "ready" : "seat",
      icon: readiness?.done ? "win" : "signal",
    },
    {
      key: "rule",
      label: "규칙",
      value: `칩 ${startChipCount}개 · 턴 ${turnTimeSeconds}초`,
      detail: "시작 칩과 제한 시간을 보고 압박감을 고르세요.",
      tone: "rule",
      icon: "state",
    },
  ];
};

const NoThanksLobbyRoomDecisionRail = ({ items = [] }) => {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      data-smoke="no-thanks-lobby-room-decision-rail"
      aria-label="노땡스 방 입장 판단"
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-xl border px-3 py-2 ${noThanksLobbyRoomDecisionToneClasses[item.tone] || noThanksLobbyRoomDecisionToneClasses.access}`}
          data-smoke="no-thanks-lobby-room-decision-item"
          data-decision-key={item.key}
        >
          <div className="flex items-center gap-2 text-[10px] font-black">
            <GameUxGlyph type={item.icon || "state"} className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </div>
          <div className="mt-1 text-[12px] font-black leading-tight text-slate-950">{item.value}</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
        </div>
      ))}
    </div>
  );
};

const noThanksLobbyRoomCardStatusTone = (status, joinable) => {
  const normalized = String(status || "WAITING").toUpperCase();
  if (normalized === "PLAYING") {
    return {
      bg: "#f0f9ff",
      panel: "#bae6fd",
      ink: "#0369a1",
      accent: "#0284c7",
      soft: "#ecfeff",
      label: "진행",
    };
  }
  if (normalized === "FINISHED") {
    return {
      bg: "#f8fafc",
      panel: "#e2e8f0",
      ink: "#475569",
      accent: "#64748b",
      soft: "#f1f5f9",
      label: "종료",
    };
  }
  if (!joinable) {
    return {
      bg: "#fff1f2",
      panel: "#ffe4e6",
      ink: "#be123c",
      accent: "#e11d48",
      soft: "#fff7ed",
      label: "마감",
    };
  }
  return {
    bg: "#fff7ed",
    panel: "#fed7aa",
    ink: "#9a3412",
    accent: "#f97316",
    soft: "#fef3c7",
    label: "입장",
  };
};

const NoThanksLobbyRoomCardArt = ({
  status,
  playersCount,
  minPlayers,
  maxPlayers,
  startChipCount,
  turnTimeSeconds,
  readiness,
  joinable,
  roomFull,
  className = "",
}) => {
  const normalizedStatus = String(status || "WAITING").toUpperCase();
  const safeMaxPlayers = Math.max(1, parseIntSafe(maxPlayers, 6) || 6);
  const safePlayers = Math.max(0, parseIntSafe(playersCount, 0));
  const visibleSeats = Math.max(1, Math.min(safeMaxPlayers, 6));
  const filledSeats = Math.min(safePlayers, visibleSeats);
  const safeMinPlayers = Math.max(1, Math.min(safeMaxPlayers, parseIntSafe(minPlayers, 2) || 2));
  const tone = noThanksLobbyRoomCardStatusTone(normalizedStatus, joinable && !roomFull);
  const seatPoints = [
    [30, 34],
    [54, 25],
    [82, 25],
    [112, 35],
    [104, 83],
    [42, 84],
  ];
  const statusLabel = roomFull ? "마감" : tone.label;
  const readinessLabel = readiness?.done ? "준비" : "대기";
  const chipLabel = `칩${Math.max(1, parseIntSafe(startChipCount, 11) || 11)}`;
  const timerLabel = `${Math.max(5, parseIntSafe(turnTimeSeconds, 15) || 15)}초`;

  return (
    <svg
      viewBox="0 0 150 112"
      role="img"
      aria-label={`노땡스 방 카드 ${safePlayers}/${safeMaxPlayers}명 ${statusLabel}`}
      className={className}
      data-smoke="no-thanks-lobby-room-card-art"
      data-room-status={normalizedStatus}
      data-joinable={joinable ? "true" : "false"}
    >
      <rect x="1" y="1" width="148" height="110" rx="18" fill={tone.bg} stroke={tone.panel} strokeWidth="2" />
      <g data-smoke="no-thanks-lobby-room-card-node">
        <rect x="51" y="30" width="46" height="58" rx="9" fill="#ffffff" stroke={tone.accent} strokeWidth="2" />
        <rect x="44" y="36" width="46" height="58" rx="9" fill={tone.soft} stroke={tone.panel} strokeWidth="2" />
        <rect x="58" y="22" width="46" height="58" rx="9" fill="#ffffff" stroke={tone.accent} strokeWidth="2" />
        <text x="81" y="48" textAnchor="middle" fontSize="18" fontWeight="900" fill={tone.ink}>{safePlayers}/{safeMaxPlayers}</text>
        <text x="81" y="65" textAnchor="middle" fontSize="9" fontWeight="900" fill="#64748b">카드방</text>
      </g>
      {seatPoints.slice(0, visibleSeats).map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`} data-smoke="no-thanks-lobby-room-card-seat">
          <circle cx={cx} cy={cy} r="7" fill={index < filledSeats ? tone.accent : "#e2e8f0"} />
          <circle cx={cx} cy={cy} r="2.8" fill={index < filledSeats ? "#ffffff" : "#94a3b8"} />
        </g>
      ))}
      <g data-smoke="no-thanks-lobby-room-card-node">
        <rect x="12" y="10" width="48" height="24" rx="12" fill="#ffffff" stroke={tone.panel} />
        <text x="36" y="20" textAnchor="middle" fontSize="8" fontWeight="800" fill="#64748b">상태</text>
        <text x="36" y="30" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.ink}>{statusLabel}</text>
      </g>
      <g data-smoke="no-thanks-lobby-room-card-node">
        <rect x="98" y="10" width="38" height="24" rx="12" fill="#ffffff" stroke={tone.panel} />
        <text x="117" y="20" textAnchor="middle" fontSize="8" fontWeight="800" fill="#64748b">{readinessLabel}</text>
        <text x="117" y="30" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.ink}>{chipLabel}</text>
      </g>
      <g data-smoke="no-thanks-lobby-room-card-node">
        <rect x="17" y="82" width="39" height="20" rx="10" fill="#ffffff" stroke={tone.panel} />
        <text x="36.5" y="95" textAnchor="middle" fontSize="9" fontWeight="900" fill={tone.ink}>{timerLabel}</text>
        <rect x="95" y="82" width="41" height="20" rx="10" fill={safePlayers >= safeMinPlayers ? "#dcfce7" : "#fef3c7"} stroke={safePlayers >= safeMinPlayers ? "#86efac" : "#fcd34d"} />
        <text x="115.5" y="95" textAnchor="middle" fontSize="9" fontWeight="900" fill={safePlayers >= safeMinPlayers ? "#166534" : "#92400e"}>{safeMinPlayers}명+</text>
      </g>
    </svg>
  );
};

const NoThanksLobbyEmptyArt = ({ className = "" }) => {
  const nodes = [
    { key: "create", x: 42, y: 94, label: "생성" },
    { key: "code", x: 108, y: 35, label: "코드" },
    { key: "refresh", x: 172, y: 94, label: "새로고침" },
  ];

  return (
    <svg
      viewBox="0 0 220 132"
      role="img"
      aria-label="노땡스 빈 로비 다음 행동 안내"
      className={className}
      data-smoke="no-thanks-lobby-empty-art"
    >
      <rect x="1" y="1" width="218" height="130" rx="22" fill="#fff7ed" stroke="#fed7aa" strokeWidth="2" />
      <path d="M37 102C50 70 78 52 111 52C145 52 173 70 186 102" fill="#ffffff" stroke="#fb923c" strokeWidth="2" />
      <rect x="76" y="35" width="44" height="62" rx="9" fill="#ffffff" stroke="#fb923c" strokeWidth="2" />
      <rect x="93" y="28" width="44" height="62" rx="9" fill="#ffedd5" stroke="#f97316" strokeWidth="2" />
      <rect x="111" y="39" width="44" height="62" rx="9" fill="#ffffff" stroke="#ea580c" strokeWidth="2" />
      <text x="133" y="68" textAnchor="middle" fill="#9a3412" fontSize="20" fontWeight="900">?</text>
      <text x="133" y="86" textAnchor="middle" fill="#c2410c" fontSize="10" fontWeight="900">방 없음</text>
      {[62, 82, 103, 152, 172].map((cx, index) => (
        <g key={cx} data-smoke="no-thanks-lobby-empty-node">
          <circle cx={cx} cy={index % 2 ? 108 : 101} r="9" fill="#f97316" />
          <circle cx={cx} cy={index % 2 ? 108 : 101} r="4" fill="#fff7ed" />
        </g>
      ))}
      <g data-smoke="no-thanks-lobby-empty-node">
        <rect x="42" y="23" width="45" height="24" rx="12" fill="#111827" />
        <text x="64.5" y="39" textAnchor="middle" fill="#fed7aa" fontSize="11" fontWeight="900">대기방</text>
      </g>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="no-thanks-lobby-empty-node" data-empty-key={node.key}>
          <circle cx={node.x} cy={node.y} r="15" fill={index === 0 ? "#f97316" : index === 1 ? "#22c55e" : "#38bdf8"} />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const NoThanksLobbyEmptyState = ({ loading, onRefresh }) => {
  const items = loading
    ? [
      { key: "loading", label: "목록 확인", value: "카드방 조회 중", detail: "현재 공개 방 목록을 불러오고 있습니다." },
      { key: "create", label: "새 방 만들기", value: "칩 설정 유지", detail: "왼쪽 생성 설정은 그대로 준비되어 있습니다." },
      { key: "code", label: "방코드 입장", value: "초대 코드 대기", detail: "코드를 받았다면 바로 입력할 수 있습니다." },
    ]
    : [
      { key: "create", label: "새 방 만들기", value: "첫 카드방 열기", detail: "시작 칩과 제한 시간을 확인한 뒤 직접 대기방을 만듭니다." },
      { key: "code", label: "방코드 입장", value: "초대 합류", detail: "방장이 공유한 NT 코드가 있으면 위 입력칸으로 바로 들어갑니다." },
      { key: "refresh", label: "새로고침", value: "목록 다시 확인", detail: "방금 열린 카드방이 있는지 다시 조회합니다." },
    ];

  return (
    <div
      className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-sky-50 p-4"
      data-smoke="no-thanks-lobby-empty-state"
      data-loading={loading ? "true" : "false"}
      role={loading ? "status" : undefined}
      aria-live={loading ? "polite" : undefined}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <NoThanksLobbyEmptyArt className="h-32 w-full" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900">{loading ? "대기 카드방을 불러오는 중입니다." : "대기방 없음"}</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            {loading ? "목록이 도착하면 바로 입장 후보와 칩 설정을 보여줍니다." : "지금은 공개 노땡스 방이 없습니다. 새 방을 만들거나 초대 코드로 합류하고, 목록을 다시 확인하세요."}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2" data-smoke="no-thanks-lobby-empty-item" data-empty-key={item.key}>
                <div className="text-[11px] font-black text-orange-700">{item.label}</div>
                <div className="mt-1 text-xs font-black text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRefresh}
            disabled={loading}
            data-smoke="no-thanks-lobby-empty-refresh"
          >
            <TimerReset className="h-3.5 w-3.5" />
            목록 새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

const buildNoThanksLobbyDirectorPlan = (rooms = []) => {
  const candidates = (Array.isArray(rooms) ? rooms : []).map((room) => {
    const players = noThanksLobbyPlayers(room);
    const status = String(room?.roomStatus || "WAITING").toUpperCase();
    const maxPlayers = Math.max(1, parseIntSafe(room?.maxPlayers, 6));
    const minPlayers = Math.max(1, Math.min(maxPlayers, parseIntSafe(room?.minPlayers, 2)));
    const memberCount = Math.max(players.length, parseIntSafe(room?.memberCount, players.length));
    const hostMemberId = Number(room?.hostMemberId || 0);
    const guests = players.filter((player) => playerIdOf(player) !== hostMemberId);
    const readyGuests = guests.filter(isReadyPlayer).length;
    const readyRatio = guests.length ? readyGuests / guests.length : 1;
    const roomFull = memberCount >= maxPlayers;
    const waiting = status === "WAITING";
    const joinable = waiting && !roomFull;
    const startFloor = memberCount >= minPlayers;
    const startChipCount = parseIntSafe(room?.startChipCount, 11);
    const turnTimeSeconds = parseIntSafe(room?.turnTimeSeconds, 15);
    const score = (
      (joinable ? 40 : 0) +
      (startFloor ? 18 : 0) +
      Math.round(readyRatio * 18) +
      Math.min(memberCount, maxPlayers) * 3 +
      Math.max(0, 20 - Math.abs(startChipCount - 11)) -
      (status === "FINISHED" ? 36 : 0)
    );
    return {
      key: String(roomIdOf(room) || room?.roomCode || room?.title || score),
      room,
      title: room?.title || room?.roomCode || "노땡스 방",
      roomId: roomIdOf(room),
      status,
      statusText: noThanksRoomStatusLabel(status),
      memberCount,
      maxPlayers,
      minPlayers,
      openSeats: Math.max(0, maxPlayers - memberCount),
      readyGuests,
      guestCount: guests.length,
      readyText: guests.length ? `게스트 준비 ${readyGuests}/${guests.length}` : "방장 시작 가능",
      joinable,
      startFloor,
      startChipCount,
      turnTimeSeconds,
      score,
    };
  }).sort((a, b) => b.score - a.score || b.memberCount - a.memberCount || a.title.localeCompare(b.title));

  const recommended = candidates[0] || null;
  const items = [
    {
      key: "pick",
      icon: "decision",
      label: "바로 입장 후보",
      value: recommended ? recommended.title : "대기 후보 없음",
      detail: recommended ? `${recommended.statusText} · ${recommended.joinable ? "입장 가능" : "상태 확인 필요"}` : "새 카드방을 만들면 바로 준비 흐름으로 들어갑니다.",
    },
    {
      key: "seat",
      icon: "player",
      label: "좌석 여유",
      value: recommended ? `${recommended.memberCount}/${recommended.maxPlayers}명` : `${candidates.length}개 카드방`,
      detail: recommended ? `빈 좌석 ${recommended.openSeats}개 · 최소 ${recommended.minPlayers}명` : "대기 카드방이 생기면 우선 후보가 표시됩니다.",
    },
    {
      key: "ready",
      icon: "state",
      label: "준비 신호",
      value: recommended ? recommended.readyText : "준비 대기",
      detail: recommended ? (recommended.startFloor ? "시작 인원 조건에 가까운 카드방입니다." : "합류하면 시작 조건에 가까워집니다.") : "방 카드의 준비 상태와 함께 읽습니다.",
    },
    {
      key: "tempo",
      icon: "score",
      label: "운영 리듬",
      value: recommended ? `칩 ${recommended.startChipCount}개 · ${recommended.turnTimeSeconds}초` : "칩 설정",
      detail: "시작 칩과 턴 시간을 먼저 보면 방의 압박감을 빠르게 고를 수 있습니다.",
    },
  ];

  return {
    candidates,
    recommended,
    items,
    choices: candidates.slice(0, 3),
  };
};

const NoThanksLobbyDirectorArt = ({ items = [], recommended, className = "" }) => {
  const nodes = items.slice(0, 4);
  const titleText = recommended ? String(recommended.title || "카드방").slice(0, 12) : "새 카드방";
  const activeColor = recommended?.joinable ? "#f97316" : "#38bdf8";

  return (
    <svg
      viewBox="0 0 420 160"
      role="img"
      aria-label="노땡스 카드방 선택 브리프"
      className={className}
      data-smoke="no-thanks-lobby-director-art"
    >
      <rect width="420" height="160" rx="24" fill="#fff7ed" />
      <rect x="20" y="18" width="132" height="112" rx="20" fill="#ffffff" stroke="#fb923c" strokeWidth="2" />
      <text x="86" y="42" textAnchor="middle" fill="#c2410c" fontSize="12" fontWeight="900">추천 카드방</text>
      <text x="86" y="72" textAnchor="middle" fill="#111827" fontSize="15" fontWeight="900">{titleText}</text>
      <text x="86" y="96" textAnchor="middle" fill="#9a3412" fontSize="10" fontWeight="800">
        {recommended ? `${recommended.memberCount}/${recommended.maxPlayers}명` : "대기"}
      </text>
      <circle cx="72" cy="124" r="14" fill="#f97316" />
      <text x="72" y="129" textAnchor="middle" fill="#fff7ed" fontSize="12" fontWeight="900">칩</text>
      <rect x="94" y="109" width="26" height="34" rx="7" fill={activeColor} />
      <text x="107" y="131" textAnchor="middle" fill="#fff7ed" fontSize="14" fontWeight="900">?</text>
      <path d="M176 86 H386" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
      <path d="M176 86 H386" stroke={activeColor} strokeWidth="4" strokeLinecap="round" />
      {nodes.map((item, index) => {
        const x = 178 + index * 68;
        return (
          <g key={item.key} data-smoke="no-thanks-lobby-director-node">
            <circle cx={x} cy="86" r="22" fill="#ffffff" stroke={index === 0 ? activeColor : "#fdba74"} strokeWidth="2" />
            <text x={x} y="91" textAnchor="middle" fill="#9a3412" fontSize="13" fontWeight="900">{index + 1}</text>
            <text x={x} y="126" textAnchor="middle" fill="#c2410c" fontSize="10" fontWeight="900">{item.label}</text>
          </g>
        );
      })}
      <rect x="180" y="24" width="150" height="26" rx="13" fill="#ffedd5" stroke="#fb923c" />
      <text x="255" y="42" textAnchor="middle" fill="#9a3412" fontSize="11" fontWeight="900">
        {recommended?.joinable ? "입장 가능" : "카드방 탐색"}
      </text>
      <circle cx="366" cy="37" r="11" fill="#22c55e" />
      <path d="M361 37 h10" stroke="#fff7ed" strokeWidth="2" strokeLinecap="round" />
      <path d="M366 32 v10" stroke="#fff7ed" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const NoThanksLobbyDirectorEmptyArt = ({ className = "" }) => {
  const nodes = [
    { key: "create", label: "생성", x: 66, y: 70, fill: "#f97316" },
    { key: "code", label: "코드", x: 148, y: 44, fill: "#22c55e" },
    { key: "refresh", label: "갱신", x: 230, y: 70, fill: "#38bdf8" },
  ];

  return (
    <svg
      viewBox="0 0 300 124"
      role="img"
      aria-label="노땡스 카드방 후보가 없을 때 다음 행동 안내"
      className={className}
      data-smoke="no-thanks-lobby-director-empty-art"
      focusable="false"
    >
      <rect x="2" y="2" width="296" height="120" rx="22" fill="#fff7ed" stroke="#fed7aa" strokeWidth="2" />
      <path d="M42 92C64 48 106 32 151 42C194 52 230 48 262 26" fill="none" stroke="#fdba74" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      <rect x="120" y="38" width="44" height="58" rx="10" fill="#ffffff" stroke="#fb923c" strokeWidth="2" />
      <rect x="139" y="30" width="44" height="58" rx="10" fill="#ffedd5" stroke="#f97316" strokeWidth="2" />
      <text x="161" y="65" textAnchor="middle" fontSize="22" fontWeight="900" fill="#9a3412">?</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="no-thanks-lobby-director-empty-node" data-empty-key={node.key}>
          {index > 0 && <path d={`M${nodes[index - 1].x + 18} ${nodes[index - 1].y} C${nodes[index - 1].x + 38} ${nodes[index - 1].y - 24} ${node.x - 38} ${node.y - 24} ${node.x - 18} ${node.y}`} fill="none" stroke="#fed7aa" strokeWidth="4" strokeLinecap="round" />}
          <circle cx={node.x} cy={node.y} r="22" fill={node.fill} />
          <circle cx={node.x} cy={node.y} r="14" fill="#fff7ed" opacity="0.92" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="9" fontWeight="900" fill="#9a3412">{node.label}</text>
        </g>
      ))}
      <rect x="36" y="16" width="96" height="22" rx="11" fill="#111827" />
      <text x="84" y="31" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fed7aa">후보 없음</text>
    </svg>
  );
};

const NoThanksLobbyDirectorEmptyChoice = () => {
  const items = [
    { key: "create", label: "새 방 만들기", value: "첫 카드방 열기", detail: "원하는 시작 칩과 턴 시간을 정하고 바로 대기방을 만들 수 있습니다." },
    { key: "code", label: "방코드 입장", value: "초대 합류", detail: "친구가 공유한 NT 코드가 있으면 목록이 비어도 같은 방으로 들어갑니다." },
    { key: "refresh", label: "목록 갱신", value: "새 후보 확인", detail: "방금 열린 카드방이 생겼는지 다시 확인한 뒤 추천 후보를 갱신합니다." },
  ];

  return (
    <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/70 p-3" data-smoke="no-thanks-lobby-director-choice">
      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-center" data-smoke="no-thanks-lobby-director-empty-choice">
        <NoThanksLobbyDirectorEmptyArt className="h-28 w-full" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">추천할 카드방이 없습니다</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
            목록이 비어 있어도 다음 행동은 정해져 있습니다. 직접 방을 만들거나 초대 코드로 합류하고, 목록을 다시 확인하세요.
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-lg border border-white/80 bg-white px-3 py-2" data-smoke="no-thanks-lobby-director-empty-item" data-empty-key={item.key}>
                <div className="text-[10px] font-black text-orange-700">{item.label}</div>
                <div className="mt-1 text-xs font-black text-slate-900">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const NoThanksLobbyDirectorPanel = ({ rooms, onJoin }) => {
  const plan = buildNoThanksLobbyDirectorPlan(rooms);

  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
      data-smoke="no-thanks-lobby-director-panel"
      data-room-count={plan.candidates.length}
      data-recommended-room={plan.recommended?.key || ""}
    >
      <div className="bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-3">
        <NoThanksLobbyDirectorArt items={plan.items} recommended={plan.recommended} className="h-36 w-full" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-black text-slate-900">
              <GameUxGlyph type="decision" className="h-4 w-4 text-orange-600" />
              카드방 선택 브리프
            </div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
              바로 입장 후보, 좌석, 준비, 칩 압박을 방 목록보다 먼저 비교합니다.
            </div>
          </div>
          <span className="inline-flex w-fit rounded-full bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-700">
            {plan.candidates.length}개 후보
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {plan.items.map((item) => (
            <div key={item.key} className="min-h-[92px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="no-thanks-lobby-director-item">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-orange-600" />
                {item.label}
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {plan.choices.length ? plan.choices.map((choice, index) => (
            <div key={choice.key} className="grid gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_108px] sm:items-center" data-smoke="no-thanks-lobby-director-choice">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">{index + 1}</span>
                  <div className="truncate text-sm font-black text-slate-900">{choice.title}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{choice.statusText}</span>
                </div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                  {choice.memberCount}/{choice.maxPlayers}명 · {choice.readyText} · 칩 {choice.startChipCount}개
                </div>
              </div>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-orange-600 disabled:opacity-40"
                disabled={!choice.joinable}
                onClick={() => onJoin(choice.roomId)}
                data-smoke="no-thanks-lobby-director-join"
              >
                <Play className="h-3.5 w-3.5" />
                입장
              </button>
            </div>
          )) : (
            <NoThanksLobbyDirectorEmptyChoice />
          )}
        </div>
      </div>
    </section>
  );
};

const buildNoThanksSetupPreviewItems = ({ title, startChipCount, turnTimeSeconds, waitingRoomCount }) => {
  const hasTitle = Boolean(String(title || "").trim());
  const chipMood = startChipCount <= 8 ? "강한 압박" : startChipCount <= 13 ? "표준 압박" : "여유 칩";
  const tempoMood = turnTimeSeconds <= 10 ? "즉시 판단" : turnTimeSeconds <= 25 ? "표준 판단" : "숙고 판단";
  return [
    {
      key: "title",
      icon: "state",
      label: "카드방 간판",
      value: hasTitle ? String(title).trim() : "자동 간판",
      detail: hasTitle ? "대기 목록에서 바로 구분되는 이름으로 노출됩니다." : "비워도 기본 노땡스 방 이름으로 생성됩니다.",
      tone: hasTitle ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-orange-200 bg-orange-50 text-orange-900",
    },
    {
      key: "chip",
      icon: "coin",
      label: "시작 칩",
      value: `${startChipCount}개 · ${chipMood}`,
      detail: startChipCount <= 8 ? "넘기기 자원이 빨리 마르므로 카드 선택 압박이 큽니다." : "칩으로 위험 카드를 한두 번 더 흘릴 여지가 있습니다.",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      key: "tempo",
      icon: "turn",
      label: "턴 템포",
      value: `${turnTimeSeconds}초 · ${tempoMood}`,
      detail: turnTimeSeconds <= 10 ? "현재 카드와 보유 칩만 보고 빠르게 선택해야 합니다." : "연속 카드 묶음과 칩 손익을 비교할 시간이 있습니다.",
      tone: "border-sky-200 bg-sky-50 text-sky-900",
    },
    {
      key: "lobby",
      icon: "player",
      label: "입장 흐름",
      value: `${waitingRoomCount}개 대기 방`,
      detail: "생성 후에는 방장 시작 조건과 게스트 준비 상태를 기존 로비 흐름으로 확인합니다.",
      tone: "border-slate-200 bg-slate-50 text-slate-900",
    },
  ];
};

const NoThanksSetupPreviewArt = ({ startChipCount, turnTimeSeconds, className = "" }) => {
  const chipStacks = [0, 1, 2, 3, 4];
  const visibleChips = Math.max(2, Math.min(5, Math.ceil(startChipCount / 4)));
  const tempoWidth = Math.max(34, Math.min(142, turnTimeSeconds * 2.2));

  return (
    <svg
      viewBox="0 0 420 172"
      role="img"
      aria-label="노땡스 생성 전 카드 브리핑"
      className={className}
      data-smoke="no-thanks-setup-preview-art"
    >
      <rect width="420" height="172" rx="24" fill="#fff7ed" />
      <rect x="28" y="22" width="108" height="138" rx="18" fill="#ffffff" stroke="#fb923c" strokeWidth="3" />
      <text x="82" y="50" textAnchor="middle" fill="#c2410c" fontSize="12" fontWeight="900">공개 카드</text>
      <text x="82" y="100" textAnchor="middle" fill="#111827" fontSize="48" fontWeight="900">?</text>
      <text x="82" y="134" textAnchor="middle" fill="#9a3412" fontSize="11" fontWeight="900">선택 대기</text>
      <g transform="translate(172 34)">
        {chipStacks.map((stack) => {
          const active = stack < visibleChips;
          const x = stack * 36;
          return (
            <g key={`setup-chip-${stack}`} data-smoke="no-thanks-setup-preview-node">
              <circle cx={x} cy="28" r="21" fill={active ? "#f97316" : "#e2e8f0"} stroke={active ? "#9a3412" : "#94a3b8"} strokeWidth="2" />
              <text x={x} y="33" textAnchor="middle" fill={active ? "#fff7ed" : "#475569"} fontSize="10" fontWeight="900">칩</text>
            </g>
          );
        })}
      </g>
      <path d="M178 124 H366" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
      <path d="M178 124 H366" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2].map((index) => {
        const x = 178 + index * 94;
        return (
          <g key={`setup-card-node-${index}`} data-smoke="no-thanks-setup-preview-node">
            <circle cx={x} cy="124" r="20" fill="#ffffff" stroke="#fb923c" strokeWidth="2" />
            <text x={x} y="129" textAnchor="middle" fill="#9a3412" fontSize="12" fontWeight="900">{index + 1}</text>
            <text x={x} y="156" textAnchor="middle" fill="#c2410c" fontSize="9" fontWeight="900">{index === 0 ? "칩 확인" : index === 1 ? "카드 판단" : "점수 예측"}</text>
          </g>
        );
      })}
      <rect x="244" y="82" width="142" height="18" rx="9" fill="#ffedd5" />
      <rect x="244" y="82" width={tempoWidth} height="18" rx="9" fill="#0f172a" />
      <text x="315" y="96" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">턴 템포</text>
    </svg>
  );
};

const NoThanksSetupPreviewPanel = ({ createForm, rooms }) => {
  const title = String(createForm?.title || "").trim();
  const startChipCount = Math.min(20, Math.max(5, parseIntSafe(createForm?.startChipCount, 11)));
  const turnTimeSeconds = Math.min(60, Math.max(5, parseIntSafe(createForm?.turnTimeSeconds, 15)));
  const waitingRoomCount = Array.isArray(rooms)
    ? rooms.filter((room) => String(room?.roomStatus || "WAITING").toUpperCase() === "WAITING").length
    : 0;
  const items = buildNoThanksSetupPreviewItems({ title, startChipCount, turnTimeSeconds, waitingRoomCount });

  return (
    <section
      className="border-t border-slate-100 pt-4"
      data-smoke="no-thanks-setup-preview-panel"
      data-start-chip-count={startChipCount}
      data-turn-time={turnTimeSeconds}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(210px,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <NoThanksSetupPreviewArt startChipCount={startChipCount} turnTimeSeconds={turnTimeSeconds} className="h-40 w-full" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="build" className="h-4 w-4 text-orange-600" />
            생성 전 노땡스 브리핑
          </div>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            칩 여유, 턴 템포, 카드 선택 압박을 방 생성 전에 먼저 읽습니다.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className={`min-h-[92px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="no-thanks-setup-preview-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const noThanksActionLabels = {
  TAKE: "카드 가져가기",
  PASS: "칩 내고 넘기기",
};

const initialNoThanksActionFeedback = () => ({
  status: "idle",
  label: "행동 대기",
  message: "아직 실행한 행동이 없습니다.",
  detail: "카드를 가져가거나 칩을 내고 넘기면 전송 상태와 점수 근거가 여기에 남습니다.",
});

const noThanksActionLabel = (actionType) => {
  const normalized = String(actionType || "").toUpperCase();
  return noThanksActionLabels[normalized] || normalized.replace(/_/g, " ") || "게임 행동";
};

const noThanksFeedbackStatusLabel = (status) => {
  if (status === "pending") return "전송 중";
  if (status === "done") return "전송 완료";
  if (status === "error") return "실패";
  return "대기";
};

const scoreNoThanksCards = (cards = []) => {
  const sorted = [...new Set(cards.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  return sorted.reduce((score, card, index) => (
    index > 0 && card === sorted[index - 1] + 1 ? score : score + card
  ), 0);
};

const noThanksPlayerName = (players, memberId) => {
  const id = Number(memberId || 0);
  return players.find((player) => playerIdOf(player) === id)?.nickname || (id ? `플레이어 ${id}` : "-");
};

const buildNoThanksResultText = ({ winnerMemberId, winnerNickname, sortedPlayers }) => {
  if (!winnerMemberId) return "최종 점수는 카드 묶음 점수에서 남은 칩을 뺀 값으로 낮을수록 유리합니다.";
  const winner = sortedPlayers.find((player) => playerIdOf(player) === Number(winnerMemberId)) || sortedPlayers[0];
  const runnerUp = sortedPlayers.find((player) => playerIdOf(player) !== Number(winnerMemberId));
  const scoreText = winner?.score == null ? "가장 낮은 점수" : `${winner.score}점`;
  if (!runnerUp || runnerUp.score == null || winner?.score == null) {
    return `${winnerNickname || winner?.nickname || "우승자"}님이 ${scoreText}으로 우승했습니다.`;
  }
  return `${winnerNickname || winner?.nickname || "우승자"}님이 ${scoreText}으로 2위보다 ${Number(runnerUp.score) - Number(winner.score)}점 낮아 우승했습니다.`;
};

const summarizeNoThanksRuns = (cards = []) => {
  const sorted = [...new Set(cards.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const runs = [];
  sorted.forEach((card) => {
    const lastRun = runs[runs.length - 1];
    if (lastRun && card === lastRun[lastRun.length - 1] + 1) {
      lastRun.push(card);
      return;
    }
    runs.push([card]);
  });
  const runLabels = runs.map((run) => (run.length > 1 ? `${run[0]}-${run[run.length - 1]}` : `${run[0]}`));
  const longestRun = runs.reduce((longest, run) => Math.max(longest, run.length), 0);
  return {
    runCount: runs.length,
    longestRun,
    label: runLabels.length ? runLabels.join(" / ") : "카드 없음",
  };
};

const buildNoThanksSettlementLedger = ({ sortedPlayers = [], winnerMemberId, winnerNickname }) => {
  const rows = (Array.isArray(sortedPlayers) ? sortedPlayers : []).map((player, index) => {
    const cards = Array.isArray(player?.cards) ? player.cards.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];
    const chips = parseIntSafe(player?.chips, 0);
    const cardScore = scoreNoThanksCards(cards);
    const serverScore = Number(player?.score);
    const finalScore = Number.isFinite(serverScore) ? serverScore : cardScore - chips;
    const memberId = playerIdOf(player);
    const runs = summarizeNoThanksRuns(cards);
    return {
      key: memberId || `seat-${index}`,
      memberId,
      nickname: player?.nickname || (memberId ? `플레이어 ${memberId}` : `좌석 ${index + 1}`),
      chips,
      cards,
      cardScore,
      finalScore,
      runs,
      rank: index + 1,
      isWinner: memberId > 0 && memberId === Number(winnerMemberId || 0),
    };
  }).sort((a, b) => {
    if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore;
    if (b.chips !== a.chips) return b.chips - a.chips;
    return a.rank - b.rank;
  });
  if (!rows.length) return null;
  const winner = rows.find((row) => row.isWinner) || rows[0];
  const runnerUp = rows.find((row) => row.key !== winner.key) || null;
  const gap = runnerUp ? runnerUp.finalScore - winner.finalScore : 0;
  const chipLeader = rows.reduce((leader, row) => (row.chips > leader.chips ? row : leader), rows[0]);
  const runLeader = rows.reduce((leader, row) => (row.runs.longestRun > leader.runs.longestRun ? row : leader), rows[0]);
  const maxCardScore = Math.max(1, ...rows.map((row) => row.cardScore));
  const maxChips = Math.max(1, ...rows.map((row) => row.chips));
  const scoreRange = Math.max(1, Math.max(...rows.map((row) => row.finalScore)) - Math.min(...rows.map((row) => row.finalScore)));
  return {
    rows: rows.map((row, index) => ({ ...row, rank: index + 1 })),
    winner: { ...winner, nickname: winnerNickname || winner.nickname },
    runnerUp,
    gap,
    chipLeader,
    runLeader,
    maxCardScore,
    maxChips,
    scoreRange,
  };
};

const NoThanksSettlementLedgerArt = ({ ledger }) => {
  if (!ledger) return null;
  const rows = ledger.rows.slice(0, 6);
  const shortName = (value) => {
    const text = String(value || "플레이어");
    return text.length > 7 ? `${text.slice(0, 7)}...` : text;
  };

  return (
    <svg
      viewBox="0 0 420 248"
      className="h-full min-h-[210px] w-full"
      role="img"
      aria-label={`노땡스 정산 요약, ${ledger.winner.nickname} 승리`}
      data-smoke="no-thanks-settlement-ledger-art"
    >
      <rect width="420" height="248" rx="28" fill="#0f172a" />
      <path d="M28 206h364M44 166h332M58 126h304M74 86h272" stroke="#f8fafc" strokeWidth="2" opacity=".07" />
      <text x="28" y="31" fontSize="12" fontWeight="900" fill="#fed7aa">노땡스 정산 요약</text>
      <text x="392" y="31" textAnchor="end" fontSize="11" fontWeight="900" fill="#cbd5e1">낮은 점수 우선</text>
      <g transform="translate(28 48)">
        <rect x="0" y="0" width="130" height="38" rx="18" fill="#fffbeb" stroke="#f59e0b" strokeWidth="3" />
        <path d="M23 15 31 6 39 15 49 10 45 28H27L23 10Z" fill="#f59e0b" />
        <text x="68" y="17" fontSize="11" fontWeight="900" fill="#92400e">우승</text>
        <text x="68" y="31" fontSize="11" fontWeight="900" fill="#0f172a">{shortName(ledger.winner.nickname)}</text>
      </g>
      <g transform="translate(176 48)">
        <rect x="0" y="0" width="176" height="38" rx="18" fill="rgba(16,185,129,.12)" stroke="#10b981" strokeWidth="3" />
        <text x="18" y="17" fontSize="11" fontWeight="900" fill="#a7f3d0">승리 격차</text>
        <text x="18" y="31" fontSize="12" fontWeight="900" fill="#f8fafc">
          {ledger.runnerUp ? `${Math.max(0, ledger.gap)}점 낮음` : "단독 정산"}
        </text>
      </g>
      {rows.map((row, index) => {
        const y = 104 + index * 28;
        const cardWidth = Math.max(10, (row.cardScore / ledger.maxCardScore) * 108);
        const chipWidth = Math.max(8, (row.chips / ledger.maxChips) * 58);
        const scoreOffset = Math.max(0, Math.min(90, ((row.finalScore - ledger.winner.finalScore) / ledger.scoreRange) * 90));
        const accent = row.isWinner ? "#f59e0b" : index === 1 ? "#38bdf8" : "#94a3b8";
        return (
          <g key={row.key} transform={`translate(28 ${y})`} data-smoke="no-thanks-settlement-player-node">
            <rect x="0" y="-17" width="364" height="24" rx="12" fill={row.isWinner ? "rgba(245,158,11,.18)" : "rgba(248,250,252,.08)"} stroke={accent} strokeWidth="2" />
            <circle cx="16" cy="-5" r="10" fill={accent} />
            <text x="16" y="-1" textAnchor="middle" fontSize="9" fontWeight="900" fill={row.isWinner ? "#111827" : "#f8fafc"}>{row.rank}</text>
            <text x="34" y="-1" fontSize="10" fontWeight="900" fill="#f8fafc">{shortName(row.nickname)}</text>
            <rect x="124" y="-12" width={cardWidth} height="8" rx="4" fill="#fb923c" opacity=".92" />
            <rect x="124" y="-1" width={chipWidth} height="8" rx="4" fill="#facc15" opacity=".92" />
            <path d={`M254 -5h${scoreOffset + 16}`} stroke={accent} strokeWidth="5" strokeLinecap="round" />
            <text x="344" y="-1" textAnchor="end" fontSize="11" fontWeight="900" fill={accent}>{row.finalScore}점</text>
          </g>
        );
      })}
      <g transform="translate(42 226)">
        <rect x="0" y="-16" width="94" height="22" rx="11" fill="rgba(251,146,60,.16)" stroke="#fb923c" strokeWidth="2" />
        <text x="47" y="-1" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fed7aa">카드 묶음</text>
        <rect x="106" y="-16" width="82" height="22" rx="11" fill="rgba(250,204,21,.16)" stroke="#facc15" strokeWidth="2" />
        <text x="147" y="-1" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fef3c7">칩 차감</text>
        <rect x="200" y="-16" width="104" height="22" rx="11" fill="rgba(16,185,129,.16)" stroke="#10b981" strokeWidth="2" />
        <text x="252" y="-1" textAnchor="middle" fontSize="10" fontWeight="900" fill="#a7f3d0">최종 낮은 점수</text>
      </g>
    </svg>
  );
};

const NoThanksSettlementLedgerPanel = ({ sortedPlayers, winnerMemberId, winnerNickname }) => {
  const ledger = buildNoThanksSettlementLedger({ sortedPlayers, winnerMemberId, winnerNickname });
  if (!ledger || !winnerMemberId) return null;
  const gapText = ledger.runnerUp
    ? (ledger.gap > 0 ? `${ledger.runnerUp.nickname}보다 ${ledger.gap}점 낮음` : "동점권 정산, 서버 우승자 기준")
    : "단독 플레이 정산";
  const items = [
    {
      key: "winner",
      label: "승리 근거",
      value: `${ledger.winner.nickname} ${ledger.winner.finalScore}점`,
      detail: `카드 묶음 ${ledger.winner.cardScore}점에서 칩 ${ledger.winner.chips}개를 차감한 낮은 점수입니다.`,
      tone: "border-emerald-100 bg-emerald-50 text-emerald-900",
    },
    {
      key: "gap",
      label: "2위와 격차",
      value: gapText,
      detail: ledger.runnerUp ? `${ledger.runnerUp.nickname} 최종 ${ledger.runnerUp.finalScore}점과 비교했습니다.` : "비교 대상 없이 최종 점수를 확정했습니다.",
      tone: "border-sky-100 bg-sky-50 text-sky-900",
    },
    {
      key: "chips",
      label: "칩 차감",
      value: `${ledger.chipLeader.nickname} ${ledger.chipLeader.chips}개`,
      detail: "남은 칩은 최종 점수에서 빠지므로, 카드 부담을 낮추는 정산 쿠션입니다.",
      tone: "border-amber-100 bg-amber-50 text-amber-900",
    },
    {
      key: "runs",
      label: "카드 묶음",
      value: ledger.runLeader.runs.longestRun > 1 ? `${ledger.runLeader.nickname} ${ledger.runLeader.runs.label}` : "연속 묶음 없음",
      detail: "연속 카드는 묶음의 첫 카드만 점수에 반영되어 최종 부담을 줄입니다.",
      tone: "border-orange-100 bg-orange-50 text-orange-900",
    },
  ];

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-orange-100 bg-white p-3 shadow-sm" data-smoke="no-thanks-settlement-ledger-panel">
      <div className="grid gap-3 lg:grid-cols-[minmax(230px,.82fr)_minmax(0,1fr)]">
        <div className="min-h-[220px]">
          <NoThanksSettlementLedgerArt ledger={ledger} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-orange-700">최종 결과 해설</div>
              <h3 className="text-base font-black text-slate-900">누가 왜 이겼는지 정산합니다</h3>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                서버가 확정한 최종 점수를 카드 묶음, 남은 칩, 2위 격차로 다시 풀어 보여줍니다.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
              {ledger.winner.nickname} 우승
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className={`min-h-[108px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="no-thanks-settlement-ledger-item">
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const buildNoThanksDecision = ({ currentCard, potChips, myChips, myCards, roomStatus, isMyTurn }) => {
  const card = Number(currentCard || 0);
  if (roomStatus !== "PLAYING") {
    return {
      takeText: "게임이 시작되면 공개 카드의 순점수 효과를 계산합니다.",
      passText: "대기 중에는 준비 상태와 방 설정을 먼저 확인하세요.",
      riskText: "점수 계산은 낮은 점수가 유리하고, 칩은 최종 점수에서 차감됩니다.",
      netDelta: null,
    };
  }
  if (!card) {
    return {
      takeText: "다음 카드가 공개되면 가져가기 부담을 표시합니다.",
      passText: "카드 공개를 기다리는 중입니다.",
      riskText: "남은 덱과 칩 흐름을 보며 턴을 준비하세요.",
      netDelta: null,
    };
  }
  const oldScore = scoreNoThanksCards(myCards);
  const nextScore = scoreNoThanksCards([...(myCards || []), card]);
  const scoreDelta = nextScore - oldScore;
  const netDelta = scoreDelta - Number(potChips || 0);
  const connectsRun = (myCards || []).some((ownedCard) => Number(ownedCard) === card - 1 || Number(ownedCard) === card + 1);
  const takeText = myChips <= 0
    ? "칩이 없어 넘길 수 없으므로 카드를 가져가야 합니다."
    : netDelta <= 0
      ? `가져가면 칩 보정 후 ${Math.abs(netDelta)}점 이득입니다.`
      : connectsRun
        ? `연속 카드에 붙어 실제 부담은 ${netDelta}점입니다.`
        : `가져가면 칩 보정 후 ${netDelta}점 부담입니다.`;
  const passText = myChips <= 0
    ? "칩이 없어 패스할 수 없습니다."
    : `넘기면 칩 1개를 쓰고 다음 사람에게 ${card}번 카드와 칩 ${potChips + 1}개를 넘깁니다.`;
  const riskText = isMyTurn
    ? netDelta <= 2 || myChips <= 1 ? "강제 위험이나 점수 부담이 낮아 가져가기를 검토할 만합니다." : "칩 여유가 있으면 한 번 더 넘겨 보상을 키울 수 있습니다."
    : "다른 플레이어의 선택을 기다리며, 칩이 쌓일수록 카드 부담은 낮아집니다.";
  return { takeText, passText, riskText, netDelta };
};

const NoThanksScoreLensArt = ({
  currentCard = null,
  currentScore = 0,
  nextScore = 0,
  potChips = 0,
  netDelta = null,
  connectsRun = false,
  myChips = 0,
}) => {
  const cardValue = Number(currentCard || 0);
  const playable = cardValue > 0 && netDelta != null;
  const favorable = playable && Number(netDelta) <= 2;
  const dangerous = playable && Number(netDelta) >= 8;
  const tone = favorable ? "#16a34a" : dangerous ? "#e11d48" : playable ? "#d97706" : "#64748b";
  const wash = favorable ? "#dcfce7" : dangerous ? "#ffe4e6" : playable ? "#fef3c7" : "#f8fafc";
  const label = playable ? `순점수 ${netDelta}점` : "카드 대기";

  return (
    <svg
      viewBox="0 0 360 220"
      className="h-full min-h-[150px] w-full"
      role="img"
      aria-label={`노 땡스 점수 요약, 현재 카드 ${currentCard ?? "대기"}, ${label}`}
      data-smoke="no-thanks-score-lens-art"
    >
      <defs>
        <linearGradient id="noThanksScoreLensWash" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff7ed" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ecfdf5" />
        </linearGradient>
      </defs>
      <rect x="14" y="14" width="332" height="192" rx="28" fill="url(#noThanksScoreLensWash)" stroke="#ffffff" strokeWidth="3" />
      <path d="M62 162c44-38 89-60 135-66 43-6 80 4 111 30" fill="none" stroke="#fed7aa" strokeWidth="14" strokeLinecap="round" opacity="0.7" />
      <path d="M62 162c44-38 89-60 135-66 43-6 80 4 111 30" fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" opacity="0.72" />
      <g>
        <rect x="38" y="48" width="86" height="116" rx="18" fill="#ffffff" stroke="#fb923c" strokeWidth="4" />
        <text x="81" y="78" textAnchor="middle" fontSize="12" fontWeight="900" fill="#9a3412">공개 카드</text>
        <text x="81" y="121" textAnchor="middle" fontSize="42" fontWeight="900" fill="#0f172a">{cardValue || "-"}</text>
        <text x="81" y="145" textAnchor="middle" fontSize="11" fontWeight="900" fill="#9a3412">{connectsRun ? "연속 묶음" : "새 묶음"}</text>
      </g>
      <g>
        <circle cx="181" cy="82" r="30" fill="#fef3c7" stroke="#f59e0b" strokeWidth="4" />
        <text x="181" y="77" textAnchor="middle" fontSize="11" fontWeight="900" fill="#92400e">팟 칩</text>
        <text x="181" y="101" textAnchor="middle" fontSize="25" fontWeight="900" fill="#92400e">{potChips}</text>
        <circle cx="204" cy="58" r="12" fill="#fbbf24" stroke="#fde68a" strokeWidth="3" />
      </g>
      <g>
        <rect x="236" y="48" width="86" height="116" rx="18" fill={wash} stroke={tone} strokeWidth="4" />
        <text x="279" y="76" textAnchor="middle" fontSize="12" fontWeight="900" fill={tone}>순점수</text>
        <text x="279" y="117" textAnchor="middle" fontSize="36" fontWeight="900" fill={tone}>{playable ? netDelta : "-"}</text>
        <text x="279" y="145" textAnchor="middle" fontSize="11" fontWeight="900" fill={tone}>{favorable ? "낮음" : dangerous ? "높음" : playable ? "검토" : "대기"}</text>
      </g>
      <g>
        <rect x="52" y="178" width="86" height="24" rx="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <text x="95" y="195" textAnchor="middle" fontSize="11" fontWeight="900" fill="#475569">현재 {currentScore}</text>
        <rect x="145" y="178" width="86" height="24" rx="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <text x="188" y="195" textAnchor="middle" fontSize="11" fontWeight="900" fill="#475569">수령 후 {playable ? nextScore : "-"}</text>
        <rect x="238" y="178" width="86" height="24" rx="12" fill={wash} stroke={tone} strokeWidth="2" />
        <text x="281" y="195" textAnchor="middle" fontSize="11" fontWeight="900" fill={tone}>내 칩 {myChips}</text>
      </g>
    </svg>
  );
};

const NoThanksScoreLensPanel = ({ currentCard, potChips, myChips, myCards, roomStatus, isMyTurn, decision }) => {
  const card = Number(currentCard || 0);
  const playable = roomStatus === "PLAYING" && card > 0;
  const currentScore = scoreNoThanksCards(myCards);
  const nextScore = playable ? scoreNoThanksCards([...(myCards || []), card]) : currentScore;
  const scoreDelta = playable ? nextScore - currentScore : null;
  const netDelta = playable ? scoreDelta - Number(potChips || 0) : null;
  const connectsRun = playable && (myCards || []).some((ownedCard) => Number(ownedCard) === card - 1 || Number(ownedCard) === card + 1);
  const recommendation = !playable
    ? "카드 대기"
    : Number(myChips || 0) <= 0
      ? "강제 수령"
      : netDelta <= 0
        ? "가져가기 유리"
        : netDelta <= 2
          ? "가져가기 검토"
          : netDelta >= 8 && Number(myChips || 0) > 1
            ? "넘기기 여지"
            : "칩 보존 주의";
  const guideItems = [
    {
      label: "카드 점수",
      value: playable ? `${currentScore}점 -> ${nextScore}점` : "공개 카드 대기",
      detail: connectsRun ? "내 카드와 연속되어 새 묶음 점수 증가를 줄입니다." : playable ? "새 묶음이면 카드 숫자가 그대로 부담이 됩니다." : "게임이 시작되면 공개 카드가 여기에 반영됩니다.",
      tone: connectsRun ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      label: "칩 보정",
      value: `${potChips || 0}개 차감`,
      detail: playable ? `가져가면 팟 칩 ${potChips || 0}개가 최종 점수 부담을 낮춥니다.` : "팟 칩은 가져가는 사람이 함께 받습니다.",
      tone: "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      label: "순점수",
      value: netDelta == null ? "대기" : `${netDelta}점`,
      detail: decision?.riskText || "낮을수록 가져가기 부담이 작습니다.",
      tone: netDelta == null ? "border-slate-100 bg-white text-slate-600" : netDelta <= 2 ? "border-emerald-100 bg-emerald-50 text-emerald-800" : netDelta >= 8 ? "border-rose-100 bg-rose-50 text-rose-800" : "border-orange-100 bg-orange-50 text-orange-800",
    },
    {
      label: "핵심 선택",
      value: recommendation,
      detail: isMyTurn ? "내 차례 기준으로 수령 부담과 칩 여유를 함께 본 판단입니다." : "다른 플레이어 차례라도 다음 내 선택을 준비할 수 있습니다.",
      tone: Number(myChips || 0) <= 1 ? "border-rose-100 bg-rose-50 text-rose-800" : "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
  ];

  return (
    <section data-smoke="no-thanks-score-lens-panel" className="mt-2 rounded-xl border border-orange-100 bg-white px-3 py-2 shadow-sm sm:mt-3 sm:rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-black text-orange-700">노땡스 점수 요약</div>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-bold text-slate-500">카드 점수, 칩 보정, 가져갈 때의 순점수만 압축해서 봅니다.</p>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${netDelta != null && netDelta <= 2 ? "border-emerald-100 bg-emerald-50 text-emerald-700" : netDelta != null && netDelta >= 8 ? "border-rose-100 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {recommendation}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4">
          <NoThanksScoreLensArt
            currentCard={currentCard}
            currentScore={currentScore}
            nextScore={nextScore}
            potChips={potChips}
            netDelta={netDelta}
            connectsRun={connectsRun}
            myChips={myChips}
          />
        </div>
        {guideItems.map((item) => (
          <div key={item.label} data-smoke="no-thanks-score-lens-item" className={`min-h-[58px] rounded-xl border px-2.5 py-1.5 sm:min-h-[72px] sm:px-3 sm:py-2 ${item.tone}`}>
            <div className="truncate text-[10px] font-black opacity-70">{item.label}</div>
            <div className="mt-0.5 truncate text-xs font-black leading-snug sm:text-sm">{item.value}</div>
            <div className="mt-0.5 hidden text-[10px] font-bold leading-snug opacity-80 sm:line-clamp-1 sm:block">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const NoThanksCardStandbyArt = ({ roomStatus, isMyTurn, potChips, deckRemaining }) => {
  const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
  const active = normalizedStatus === "PLAYING";
  const nodes = [
    { key: "deck", label: "덱", x: 64, y: 110, fill: active ? "#fb923c" : "#94a3b8" },
    { key: "table", label: "공개", x: 180, y: 84, fill: isMyTurn ? "#22c55e" : "#f59e0b" },
    { key: "chip", label: "칩", x: 296, y: 110, fill: Number(potChips || 0) > 0 ? "#f59e0b" : "#64748b" },
    { key: "choice", label: "선택", x: 180, y: 162, fill: active ? "#0f172a" : "#475569" },
  ];

  return (
    <svg
      viewBox="0 0 360 212"
      className="h-full min-h-[150px] w-full"
      role="img"
      aria-label="노 땡스 공개 카드 대기 흐름"
      data-smoke="no-thanks-card-standby-art"
    >
      <rect x="14" y="14" width="332" height="184" rx="26" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <path d="M76 122 C118 68, 242 68, 284 122" fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
      <path d="M82 124 C122 86, 238 86, 278 124" fill="none" stroke={active ? "#fb923c" : "#64748b"} strokeWidth="4" strokeLinecap="round" />
      <g data-smoke="no-thanks-card-standby-node" data-standby-key="deck-stack">
        <rect x="42" y="58" width="70" height="96" rx="16" fill="#fff7ed" stroke="#fdba74" strokeWidth="4" />
        <rect x="50" y="50" width="70" height="96" rx="16" fill="#ffffff" stroke="#fb923c" strokeWidth="3" opacity="0.92" />
        <text x="85" y="98" textAnchor="middle" fill="#9a3412" fontSize="14" fontWeight="900">대기</text>
        <text x="85" y="125" textAnchor="middle" fill="#111827" fontSize="18" fontWeight="900">{deckRemaining || "-"}</text>
      </g>
      <g data-smoke="no-thanks-card-standby-node" data-standby-key="card-slot">
        <rect x="142" y="44" width="76" height="108" rx="18" fill={isMyTurn ? "#dcfce7" : "#fef3c7"} stroke={isMyTurn ? "#22c55e" : "#f59e0b"} strokeWidth="4" />
        <text x="180" y="88" textAnchor="middle" fill={isMyTurn ? "#166534" : "#92400e"} fontSize="12" fontWeight="900">공개 카드</text>
        <text x="180" y="123" textAnchor="middle" fill="#111827" fontSize="40" fontWeight="900">?</text>
      </g>
      <g data-smoke="no-thanks-card-standby-node" data-standby-key="pot-chip">
        <circle cx="292" cy="104" r="35" fill="#fef3c7" stroke="#f59e0b" strokeWidth="5" />
        <circle cx="292" cy="104" r="20" fill="#fbbf24" stroke="#fde68a" strokeWidth="3" />
        <text x="292" y="110" textAnchor="middle" fill="#78350f" fontSize="20" fontWeight="900">{potChips || 0}</text>
      </g>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="no-thanks-card-standby-node" data-standby-key={node.key}>
          <circle cx={node.x} cy={node.y} r="12" fill={node.fill} stroke="#ffffff" strokeWidth="2" />
          <text x={node.x} y={node.y + 32} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const NoThanksCardStandbyPanel = ({ roomStatus, isMyTurn, turnName, potChips, deckRemaining, myChips, myCards }) => {
  const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
  const playing = normalizedStatus === "PLAYING";
  const myScore = scoreNoThanksCards(myCards) - Number(myChips || 0);
  const headline = playing
    ? (isMyTurn ? "공개 카드가 들어오면 가져가기와 넘기기를 바로 비교하세요." : `${turnName || "상대"}님의 카드 공개 흐름을 기다리는 중입니다.`)
    : "게임이 시작되면 이 자리에 첫 공개 카드와 팟 칩이 표시됩니다.";
  const items = [
    {
      key: "state",
      icon: "state",
      label: "카드 상태",
      value: playing ? "공개 전" : "시작 대기",
      detail: playing ? "카드 숫자가 아직 없어 점수 변화와 넘기기 보상이 확정되지 않았습니다." : "대기 중에는 준비 상태와 시작 조건을 먼저 확인합니다.",
      tone: playing ? "active" : "neutral",
    },
    {
      key: "choice",
      icon: "decision",
      label: "선택 기준",
      value: isMyTurn ? "판단 준비" : "상대 관찰",
      detail: isMyTurn ? "카드가 보이면 내 칩 수와 연속 카드 여부를 기준으로 결정합니다." : "상대가 칩을 쓰는지, 카드를 가져가는지에 따라 다음 보상이 달라집니다.",
      tone: isMyTurn ? "active" : "waiting",
    },
    {
      key: "pot",
      icon: "score",
      label: "팟 칩",
      value: `${potChips || 0}개`,
      detail: "팟 칩은 카드를 가져갈 때 함께 받아 최종 점수 부담을 줄입니다.",
      tone: Number(potChips || 0) > 0 ? "done" : "neutral",
    },
    {
      key: "hand",
      icon: "recent",
      label: "내 기준",
      value: `보정 ${myScore}점`,
      detail: `내 칩 ${myChips || 0}개와 보유 카드 ${cardsLabel(myCards)}를 기준으로 다음 카드를 평가합니다.`,
      tone: "waiting",
    },
  ];
  const toneClass = {
    active: "border-emerald-200/60 bg-emerald-300/15 text-emerald-50",
    done: "border-amber-200/60 bg-amber-300/15 text-amber-50",
    waiting: "border-sky-200/60 bg-sky-300/15 text-sky-50",
    neutral: "border-white/15 bg-white/10 text-white",
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-3 shadow-inner" data-smoke="no-thanks-card-standby-panel" data-room-status={normalizedStatus} data-my-turn={isMyTurn ? "true" : "false"}>
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] lg:items-stretch">
        <div className="rounded-xl border border-white/10 bg-slate-950/35">
          <NoThanksCardStandbyArt roomStatus={roomStatus} isMyTurn={isMyTurn} potChips={potChips} deckRemaining={deckRemaining} />
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/25 p-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black text-amber-100">
            <GameUxGlyph type="decision" className="h-3.5 w-3.5" />
            공개 카드 없음
          </div>
          <h3 className="mt-3 text-lg font-black text-white">카드 공개 전 판단 준비</h3>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-200">{headline}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className={`min-h-[98px] rounded-xl border px-3 py-2 ${toneClass[item.tone] || toneClass.neutral}`} data-smoke="no-thanks-card-standby-item" data-standby-key={item.key}>
                <div className="flex items-center gap-2 text-[11px] font-black">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 text-sm font-black">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const NoThanksTurnRailArt = ({ players, selectedRoom, gameState, myMemberId, readyMemberIds, roomStatus, winnerMemberId, currentCard, potChips, deckRemaining }) => {
  const safePlayers = Array.isArray(players) ? players : [];
  const seatCount = Math.max(2, Math.min(6, Math.max(safePlayers.length, parseIntSafe(selectedRoom?.minPlayers, 2))));
  const displayPlayers = Array.from({ length: seatCount }, (_, index) => safePlayers[index] || { memberId: 0, nickname: "빈 좌석" });
  const turnMemberId = Number(gameState?.turnMemberId || 0);
  const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
  const status = String(roomStatus || "WAITING").toUpperCase();
  const trackEnd = 576;
  const step = displayPlayers.length > 1 ? trackEnd / (displayPlayers.length - 1) : trackEnd;
  const shortName = (value) => {
    const text = String(value || "좌석");
    return text.length > 7 ? `${text.slice(0, 7)}...` : text;
  };

  return (
    <svg
      viewBox="0 0 640 190"
      className="h-full min-h-[150px] w-full"
      role="img"
      aria-label="노땡스 카드 턴 레일"
      data-smoke="no-thanks-turn-rail-art"
    >
      <rect x="0" y="0" width="640" height="190" rx="28" fill="#111827" />
      <rect x="26" y="28" width="150" height="118" rx="20" fill="#f8fafc" stroke="#f59e0b" strokeWidth="3" />
      <rect x="42" y="44" width="118" height="86" rx="16" fill="#fff7ed" stroke="#fed7aa" strokeWidth="2" />
      <text x="101" y="72" textAnchor="middle" fill="#92400e" fontSize="12" fontWeight="900">공개 카드</text>
      <text x="101" y="112" textAnchor="middle" fill="#111827" fontSize="36" fontWeight="900">{currentCard ?? "-"}</text>
      <circle cx="152" cy="132" r="21" fill="#f59e0b" stroke="#fde68a" strokeWidth="4" />
      <text x="152" y="137" textAnchor="middle" fill="#7c2d12" fontSize="13" fontWeight="900">{potChips || 0}</text>
      <path d="M206 92H604" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
      <path d="M206 92H604" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <text x="206" y="30" fill="#fed7aa" fontSize="12" fontWeight="900">카드 턴 레일</text>
      <text x="604" y="30" textAnchor="end" fill="#cbd5e1" fontSize="12" fontWeight="900">덱 {deckRemaining || 0}</text>
      {displayPlayers.map((player, index) => {
        const memberId = playerIdOf(player);
        const isCurrent = memberId > 0 && memberId === turnMemberId;
        const isMe = memberId > 0 && memberId === Number(myMemberId || 0);
        const isWinner = memberId > 0 && memberId === Number(winnerMemberId || 0);
        const isHost = memberId > 0 && memberId === hostMemberId;
        const isReady = memberId > 0 && (readyMemberIds?.has(memberId) || isHost);
        const x = 206 + step * index * (398 / trackEnd);
        const fill = isWinner ? "#f59e0b" : isCurrent ? "#38bdf8" : isMe ? "#a78bfa" : memberId ? "#f8fafc" : "#334155";
        const ring = isWinner ? "#fde68a" : isCurrent ? "#bae6fd" : isMe ? "#ddd6fe" : isReady ? "#86efac" : "#64748b";
        const label = isWinner ? "우승" : isCurrent ? "현재" : isMe ? "나" : status === "WAITING" ? (isReady ? "준비" : "대기") : "좌석";
        return (
          <g key={`no-thanks-turn-node-${memberId || index}`} transform={`translate(${x} 92)`} data-smoke="no-thanks-turn-rail-node">
            <circle cx="0" cy="0" r={isCurrent || isWinner ? 27 : 22} fill={fill} stroke={ring} strokeWidth="5" />
            <rect x="-12" y="-15" width="24" height="30" rx="5" fill={memberId ? "#111827" : "#1e293b"} opacity="0.9" />
            <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="900">{index + 1}</text>
            <rect x="-36" y="40" width="72" height="22" rx="11" fill={memberId ? "rgba(17,24,39,.9)" : "rgba(51,65,85,.86)"} stroke="rgba(226,232,240,.18)" />
            <text x="0" y="55" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900">{shortName(player.nickname || `좌석 ${index + 1}`)}</text>
            <text x="0" y="-34" textAnchor="middle" fill={ring} fontSize="10" fontWeight="900">{label}</text>
          </g>
        );
      })}
      <g transform="translate(424 156)">
        <rect x="0" y="0" width="184" height="24" rx="12" fill="rgba(245,158,11,.14)" stroke="#f59e0b" strokeWidth="2" />
        <text x="92" y="16" textAnchor="middle" fill="#ffedd5" fontSize="10" fontWeight="900">
          {winnerMemberId ? "최종 낮은 점수" : turnMemberId ? "카드 선택 중" : "좌석 대기"}
        </text>
      </g>
    </svg>
  );
};

const NoThanksTurnRailPanel = ({ players, selectedRoom, gameState, myMemberId, readyMemberIds, roomStatus, winnerMemberId, winnerNickname, currentCard, potChips, deckRemaining, myPlayer }) => {
  const safePlayers = Array.isArray(players) ? players : [];
  const status = String(roomStatus || "WAITING").toUpperCase();
  const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
  const guests = safePlayers.filter((player) => playerIdOf(player) !== hostMemberId);
  const readyGuestCount = guests.filter((player) => readyMemberIds?.has(playerIdOf(player))).length;
  const turnMemberId = Number(gameState?.turnMemberId || 0);
  const currentTurnName = turnMemberId ? noThanksPlayerName(safePlayers, turnMemberId) : "-";
  const myPlayerIndex = safePlayers.findIndex((player) => playerIdOf(player) === Number(myMemberId || 0));
  const mySeatLabel = myPlayerIndex >= 0 ? `좌석 ${myPlayerIndex + 1}` : "좌석 미확인";
  const myChips = parseIntSafe(myPlayer?.chips, 0);
  const myCards = Array.isArray(myPlayer?.cards) ? myPlayer.cards : [];
  const myAdjustedScore = scoreNoThanksCards(myCards) - myChips;
  const winnerText = winnerMemberId ? `${winnerNickname || noThanksPlayerName(safePlayers, winnerMemberId)} 우승` : "정산 대기";
  const tiles = [
    {
      label: "공개 카드",
      value: currentCard ?? "대기",
      detail: currentCard ? `팟 칩 ${potChips || 0}개가 함께 쌓여 있습니다.` : "게임이 시작되면 첫 공개 카드가 표시됩니다.",
      icon: "stage",
      tone: currentCard ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-900",
    },
    {
      label: "현재 차례",
      value: status === "FINISHED" ? "게임 종료" : status === "PLAYING" ? currentTurnName : "시작 대기",
      detail: status === "PLAYING" ? "가져가기 또는 칩 내고 넘기기 선택을 기다립니다." : `게스트 준비 ${readyGuestCount}/${guests.length}`,
      icon: status === "FINISHED" ? "win" : "turn",
      tone: status === "PLAYING" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-900",
    },
    {
      label: "내 좌석",
      value: mySeatLabel,
      detail: myPlayer ? `칩 ${myChips}개 · 보정 점수 ${myAdjustedScore}점` : "참가 정보가 동기화되면 좌석과 칩을 표시합니다.",
      icon: "input",
      tone: "border-violet-200 bg-violet-50 text-violet-900",
    },
    {
      label: winnerMemberId ? "우승" : "남은 덱",
      value: winnerMemberId ? winnerText : `${deckRemaining || 0}장`,
      detail: winnerMemberId ? "카드 묶음 점수에서 남은 칩을 뺀 낮은 점수 기준입니다." : `현재 팟 칩 ${potChips || 0}개와 다음 선택 압력을 함께 봅니다.`,
      icon: winnerMemberId ? "win" : "score",
      tone: winnerMemberId ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
  ];
  const displayPlayers = safePlayers.length ? safePlayers : [{ memberId: 0, nickname: "빈 좌석" }];

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-lg" data-smoke="no-thanks-turn-rail-panel">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <div className="bg-slate-950 p-3">
          <NoThanksTurnRailArt
            players={safePlayers}
            selectedRoom={selectedRoom}
            gameState={gameState}
            myMemberId={myMemberId}
            readyMemberIds={readyMemberIds}
            roomStatus={roomStatus}
            winnerMemberId={winnerMemberId}
            currentCard={currentCard}
            potChips={potChips}
            deckRemaining={deckRemaining}
          />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="turn" className="h-4 w-4 text-amber-600" />
                카드 턴 레일
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                좌석, 현재 차례, 공개 카드, 팟 칩, 덱 압력을 보드보다 먼저 읽도록 묶었습니다.
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              참가 {safePlayers.length}/{parseIntSafe(selectedRoom?.maxPlayers, 6)}명
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {tiles.map((tile) => (
              <div key={tile.label} className={`min-h-[94px] rounded-xl border px-3 py-2 ${tile.tone}`} data-smoke="no-thanks-turn-rail-tile">
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
                  {tile.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{tile.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-75">{tile.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {displayPlayers.map((player, index) => {
              const memberId = playerIdOf(player);
              const isCurrent = memberId > 0 && memberId === turnMemberId;
              const isMe = memberId > 0 && memberId === Number(myMemberId || 0);
              const isWinner = memberId > 0 && memberId === Number(winnerMemberId || 0);
              const isHost = memberId > 0 && memberId === hostMemberId;
              const isReady = memberId > 0 && (readyMemberIds?.has(memberId) || isHost);
              const badge = isWinner ? "우승" : isCurrent ? "현재 차례" : isMe ? "내 좌석" : status === "WAITING" ? (isReady ? "준비" : "대기") : "참가";
              return (
                <div key={`no-thanks-rail-player-${memberId || index}`} className={`rounded-xl border px-3 py-2 ${isCurrent || isWinner ? "border-sky-200 bg-sky-50" : isMe ? "border-violet-200 bg-violet-50" : "border-slate-100 bg-slate-50"}`} data-smoke="no-thanks-turn-rail-player">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={player.nickname || `좌석 ${index + 1}`}
                        profileUrl={player.profileUrl}
                        level={player.level}
                        rewardTier={player.rewardTier}
                        frameCode={player.frameCode}
                        size="xs"
                      />
                      <div className="min-w-0 truncate text-xs font-black text-slate-900">{player.nickname || `좌석 ${index + 1}`}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-100">{badge}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">
                    좌석 {index + 1} · 칩 {parseIntSafe(player.chips, 0)} · 카드 {cardsLabel(player.cards)} · 점수 {player.score ?? "-"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const NoThanksDecisionPanel = ({ gameState, players, sortedPlayers, myPlayer, roomStatus, isMyTurn, winnerMemberId, winnerNickname }) => {
  const currentCard = gameState?.currentCard ?? null;
  const potChips = parseIntSafe(gameState?.potChips, 0);
  const myChips = parseIntSafe(myPlayer?.chips, 0);
  const myCards = Array.isArray(myPlayer?.cards) ? myPlayer.cards : [];
  const turnName = noThanksPlayerName(players, gameState?.turnMemberId);
  const decision = buildNoThanksDecision({ currentCard, potChips, myChips, myCards, roomStatus, isMyTurn });
  const resultText = buildNoThanksResultText({ winnerMemberId, winnerNickname, sortedPlayers });
  const isFinished = roomStatus === "FINISHED";
  const cueTone = isFinished ? "done" : isMyTurn ? "active" : "neutral";
  const currentScore = scoreNoThanksCards(myCards);
  const adjustedScore = currentScore - myChips;
  const riskValue = decision.netDelta == null ? "대기" : `${decision.netDelta}점`;
  const riskTone = decision.netDelta == null ? "neutral" : decision.netDelta <= 2 ? "active" : decision.netDelta >= 8 ? "danger" : "waiting";
  const cueItems = [
    { label: "차례", value: isFinished ? "종료" : turnName, icon: isFinished ? "win" : "turn", tone: isFinished ? "done" : isMyTurn ? "active" : "neutral" },
    { label: "카드", value: currentCard ?? "-", icon: "stage" },
    { label: "칩", value: `팟 ${potChips} · 내 ${myChips}`, icon: "score" },
    { label: "위험", value: riskValue, icon: "decision", tone: riskTone },
  ];
  const noThanksFlowItems = [
    {
      label: "공개 카드",
      value: currentCard ?? "대기",
      detail: currentCard ? `가져가면 현재 팟 칩 ${potChips}개를 함께 받습니다.` : "게임 시작 후 공개 카드가 표시됩니다.",
      icon: "stage",
      tone: currentCard ? "waiting" : "neutral",
    },
    {
      label: "순번",
      value: isFinished ? "종료" : isMyTurn ? "내 차례" : turnName,
      detail: isFinished ? "최종 점수 정산 완료" : isMyTurn ? "가져가기/넘기기 중 하나를 선택합니다." : "상대의 칩 소모와 카드 선택을 관찰하세요.",
      icon: isFinished ? "win" : "turn",
      tone: isFinished ? "done" : isMyTurn ? "active" : "neutral",
    },
    {
      label: "선택 압력",
      value: riskValue,
      detail: decision.riskText,
      icon: "decision",
      tone: riskTone,
    },
    {
      label: isFinished ? "결과" : "내 점수",
      value: isFinished ? "승자 확인" : `${adjustedScore}점`,
      detail: isFinished ? resultText : `카드 ${currentScore}점 - 칩 ${myChips}개 = ${adjustedScore}점`,
      icon: isFinished ? "win" : "score",
      tone: isFinished ? "done" : "neutral",
    },
  ];

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg" data-smoke="no-thanks-decision-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <GameUxGlyph type="decision" className="mt-0.5 h-10 w-10 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900">현재 선택 요약</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
              {roomStatus === "PLAYING" ? `${turnName}님의 차례 · 현재 카드 ${currentCard ?? "-"}` : "대기 중 · 게임 시작 후 카드 선택 판단을 표시합니다."}
            </div>
          </div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
          내 칩 {myChips}
        </div>
      </div>
      {roomStatus === "FINISHED" && (
        <>
          <GameResultSpotlight
            title={resultText}
            subtitle="최종 결과"
            detail="카드 묶음 점수에서 남은 칩을 뺀 낮은 점수 기준으로 정산되었습니다."
            metric={`내 점수 ${scoreNoThanksCards(myCards) - myChips}점`}
            smoke="no-thanks-result-spotlight"
            className="mt-3"
          />
          <NoThanksSettlementLedgerPanel
            sortedPlayers={sortedPlayers}
            winnerMemberId={winnerMemberId}
            winnerNickname={winnerNickname}
          />
        </>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {noThanksFlowItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-black text-slate-400">{item.label}</div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900">{item.value}</div>
            <div className="mt-0.5 line-clamp-1 text-[10px] font-bold text-slate-500">{item.detail}</div>
          </div>
        ))}
      </div>
      <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-black text-slate-600">상세 판단 열기</summary>
        <div className="mt-3 space-y-3">
          <GameFlowMeter
            title="노땡스 카드 흐름"
            detail="공개 카드, 현재 순번, 선택 위험, 내 점수 흐름을 한 번에 확인합니다."
            items={noThanksFlowItems}
            tone={isFinished ? "amber" : "slate"}
            smoke="no-thanks-flow-meter"
          />
          <NoThanksScoreLensPanel
            currentCard={currentCard}
            potChips={potChips}
            myChips={myChips}
            myCards={myCards}
            roomStatus={roomStatus}
            isMyTurn={isMyTurn}
            decision={decision}
          />
        </div>
      </details>
      <GameActionCueBar
        title={isFinished ? "최종 점수 확인" : isMyTurn ? "내 노땡스 선택" : "상대 선택 관찰"}
        detail={decision.riskText}
        items={cueItems}
        tone={cueTone}
        smoke="no-thanks-action-cue-bar"
        className="mt-3"
      />
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-black text-slate-500">가져가기</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{decision.takeText}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-black text-slate-500">넘기기</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{decision.passText}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-black text-slate-500">판단 기준</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{decision.riskText}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-800">
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-black text-amber-700">
            <GameUxGlyph type="state" className="h-4 w-4" />
            현재 점수 흐름
          </div>
          내 카드 기준 점수 {currentScore}점 · 칩 보정 후 {adjustedScore}점
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold leading-relaxed text-emerald-800">
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-black text-emerald-700">
            <GameUxGlyph type="recent" className="h-4 w-4" />
            결과 설명
          </div>
          {resultText}
        </div>
      </div>
    </div>
  );
};

const buildNoThanksProgressDigest = ({ gameState, players, roomStatus, currentCard, potChips, deckRemaining, turnMemberId, winnerMemberId, winnerNickname, sortedPlayers }) => {
  const safePlayers = Array.isArray(players) ? players : [];
  const normalizedStatus = String(roomStatus || gameState?.roomStatus || "WAITING").toUpperCase();
  const turnName = turnMemberId ? noThanksPlayerName(safePlayers, turnMemberId) : "-";
  const winnerText = winnerMemberId ? buildNoThanksResultText({ winnerMemberId, winnerNickname, sortedPlayers }) : "";
  const cardValue = Number(currentCard || 0);
  const items = [
    {
      key: "latest",
      icon: winnerMemberId ? "win" : cardValue ? "stage" : "recent",
      label: "최근 진행",
      value: winnerMemberId ? "정산 완료" : cardValue ? `${cardValue}번 카드` : noThanksRoomStatusLabel(normalizedStatus),
      detail: winnerMemberId ? winnerText : cardValue ? `공개 카드에 팟 칩 ${potChips || 0}개가 쌓여 다음 선택 압력을 만듭니다.` : "게임 시작 후 공개 카드와 칩 더미가 여기에 요약됩니다.",
      tone: winnerMemberId ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      key: "actor",
      icon: "turn",
      label: "행동 주체",
      value: winnerMemberId ? (winnerNickname || noThanksPlayerName(safePlayers, winnerMemberId)) : turnName,
      detail: normalizedStatus === "PLAYING" ? "현재 선택권을 가진 플레이어를 먼저 확인합니다." : "대기/종료 상태에서는 방장 또는 승자 정보를 확인합니다.",
      tone: "border-slate-200 bg-slate-50 text-slate-800",
    },
    {
      key: "pressure",
      icon: "score",
      label: "압력 변화",
      value: `팟 ${potChips || 0}개`,
      detail: cardValue ? `넘길 때마다 칩이 늘고, 가져가면 ${cardValue}번 카드 부담을 칩으로 낮춥니다.` : "공개 카드가 나오면 가져가기/넘기기 압력이 계산됩니다.",
      tone: "border-orange-200 bg-orange-50 text-orange-900",
    },
    {
      key: "phase",
      icon: "stage",
      label: "현재 단계",
      value: winnerMemberId ? "결과 상태" : normalizedStatus === "PLAYING" ? `덱 ${deckRemaining || 0}장` : noThanksRoomStatusLabel(normalizedStatus),
      detail: winnerMemberId ? "최종 낮은 점수 기준을 읽고 다음 행동을 고르면 됩니다." : normalizedStatus === "PLAYING" ? "덱이 줄수록 남은 카드 압력과 칩 보상이 달라집니다." : "시작 조건과 방 설정을 확인하는 단계입니다.",
      tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
  ];
  return { items, status: normalizedStatus, currentCard: cardValue, potChips: Number(potChips || 0), deckRemaining: Number(deckRemaining || 0), winnerMemberId };
};

const NoThanksProgressDigestArt = ({ digest }) => {
  const nodes = digest.items.slice(0, 4);
  return (
    <svg
      viewBox="0 0 420 168"
      role="img"
      aria-label="노 땡스 최근 진행 요약"
      className="h-full min-h-[156px] w-full"
      data-smoke="no-thanks-progress-digest-art"
    >
      <rect width="420" height="168" rx="24" fill="#fff7ed" />
      <rect x="24" y="22" width="100" height="124" rx="18" fill="#ffffff" stroke="#fdba74" strokeWidth="2" />
      <text x="74" y="48" textAnchor="middle" fill="#9a3412" fontSize="11" fontWeight="900">공개 카드</text>
      <text x="74" y="94" textAnchor="middle" fill="#111827" fontSize="38" fontWeight="900">{digest.currentCard || "-"}</text>
      <circle cx="102" cy="122" r="16" fill="#f59e0b" />
      <text x="102" y="127" textAnchor="middle" fill="#78350f" fontSize="11" fontWeight="900">{digest.potChips}</text>
      <path d="M150 88 H382" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" />
      <path d="M150 88 H382" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
      {nodes.map((node, index) => {
        const x = 150 + index * 76;
        return (
          <g key={node.key} data-smoke="no-thanks-progress-digest-node" data-digest-key={node.key}>
            <circle cx={x} cy="88" r="22" fill={index === 0 ? "#9a3412" : "#ffffff"} stroke={index === 0 ? "#fdba74" : "#cbd5e1"} strokeWidth="2" />
            <text x={x} y="93" textAnchor="middle" fill={index === 0 ? "#fff7ed" : "#334155"} fontSize="12" fontWeight="900">{index + 1}</text>
            <text x={x} y="124" textAnchor="middle" fill="#9a3412" fontSize="10" fontWeight="900">{node.label}</text>
          </g>
        );
      })}
      <rect x="156" y="24" width="154" height="26" rx="13" fill="#ffffff" stroke="#fed7aa" />
      <text x="233" y="42" textAnchor="middle" fill="#9a3412" fontSize="11" fontWeight="900">방금 무엇이 바뀌었나</text>
      <text x="366" y="42" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="900">덱 {digest.deckRemaining || 0}</text>
    </svg>
  );
};

const NoThanksProgressDigestPanel = ({ gameState, players, roomStatus, currentCard, potChips, deckRemaining, turnMemberId, winnerMemberId, winnerNickname, sortedPlayers }) => {
  const digest = buildNoThanksProgressDigest({ gameState, players, roomStatus, currentCard, potChips, deckRemaining, turnMemberId, winnerMemberId, winnerNickname, sortedPlayers });
  return (
    <section
      className="overflow-hidden rounded-[1.5rem] border border-orange-100 bg-white shadow-lg"
      data-smoke="no-thanks-progress-digest-panel"
      data-status={digest.status}
      data-current-card={digest.currentCard}
      data-pot-chips={digest.potChips}
      data-deck-remaining={digest.deckRemaining}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
        <div className="bg-orange-50 p-3">
          <NoThanksProgressDigestArt digest={digest} />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="recent" className="h-4 w-4 text-orange-600" />
                최근 진행 요약
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                공개 카드, 팟 칩, 현재 차례, 덱 압력을 카드 영역으로 내려가기 전에 확인합니다.
              </div>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-black text-orange-700">
              {noThanksRoomStatusLabel(digest.status)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {digest.items.map((item) => (
              <div key={item.key} className={`min-h-[104px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="no-thanks-progress-digest-item" data-digest-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const buildNoThanksSessionActionItems = ({ selectedRoom, gameState, sortedPlayers, winnerMemberId, winnerNickname, isHost }) => {
  const safePlayers = Array.isArray(sortedPlayers) ? sortedPlayers : [];
  const resultText = buildNoThanksResultText({ winnerMemberId, winnerNickname, sortedPlayers: safePlayers });
  const winner = safePlayers.find((player) => playerIdOf(player) === Number(winnerMemberId || 0)) || safePlayers[0];
  const runnerUp = safePlayers.find((player) => playerIdOf(player) !== Number(winnerMemberId || 0));
  const gap = winner?.score != null && runnerUp?.score != null ? Number(runnerUp.score) - Number(winner.score) : null;
  const playerCount = safePlayers.length || parseIntSafe(selectedRoom?.memberCount, 0);
  const removedCount = Array.isArray(gameState?.removedCards) ? gameState.removedCards.length : 0;
  return [
    {
      key: "winner",
      label: "우승 정리",
      value: winnerNickname ? `${winnerNickname} 우승` : "우승자 확인",
      detail: resultText,
      icon: "win",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      key: "score",
      label: "점수 기준",
      value: winner?.score == null ? "낮은 점수" : `${winner.score}점`,
      detail: gap == null ? "카드 묶음 점수에서 남은 칩을 차감한 낮은 점수 기준입니다." : `2위보다 ${gap}점 낮아 최종 승리했습니다.`,
      icon: "score",
      tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
    {
      key: "room",
      label: "방 상태",
      value: noThanksRoomStatusLabel(gameState?.roomStatus || selectedRoom?.roomStatus || "FINISHED"),
      detail: `${playerCount || "-"}명 참여, 제외 카드 ${removedCount}장을 포함해 결과를 보관합니다.`,
      icon: "state",
      tone: "border-slate-200 bg-slate-50 text-slate-800",
    },
    {
      key: "next",
      label: "다음 행동",
      value: isHost ? "재대결 가능" : "방장 선택 대기",
      detail: isHost ? "같은 방으로 새 판을 열거나 결과를 확인한 뒤 게임 목록으로 이동할 수 있습니다." : "방장이 재대결을 열 때까지 정산과 채팅을 확인할 수 있습니다.",
      icon: "decision",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
  ];
};

const NoThanksSessionActionArt = ({ winnerNickname, roomCode, removedCount }) => {
  const nodes = [
    { x: 58, y: 92, label: "LOW", color: "#10b981" },
    { x: 148, y: 60, label: "RUN", color: "#06b6d4" },
    { x: 252, y: 96, label: "CHIP", color: "#f59e0b" },
    { x: 354, y: 58, label: "NEXT", color: "#8b5cf6" },
  ];
  return (
    <svg
      viewBox="0 0 420 160"
      role="img"
      aria-label="노땡큐 종료 세션 액션 아트"
      className="h-full min-h-[156px] w-full"
      data-smoke="no-thanks-session-action-art"
    >
      <rect x="14" y="18" width="392" height="124" rx="24" fill="#111827" />
      <path d="M38 118 C96 40 168 142 230 74 C278 24 330 112 384 48" stroke="#34d399" strokeWidth="4" fill="none" />
      <rect x="34" y="34" width="72" height="96" rx="14" fill="#f8fafc" />
      <rect x="42" y="44" width="56" height="76" rx="10" fill="#0f172a" />
      <text x="70" y="86" textAnchor="middle" fill="#fcd34d" fontSize="22" fontWeight="900">NO</text>
      {nodes.map((node, index) => (
        <g key={node.label} data-smoke="no-thanks-session-action-node">
          <circle cx={node.x} cy={node.y} r="20" fill={node.color} />
          <circle cx={node.x} cy={node.y} r="12" fill="#ffffff" opacity="0.92" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900">{index + 1}</text>
          <text x={node.x} y={node.y + 34} textAnchor="middle" fill="#dbeafe" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
      <rect x="142" y="26" width="142" height="26" rx="13" fill="#ffffff" opacity="0.12" />
      <text x="156" y="44" fill="#d1fae5" fontSize="11" fontWeight="900">{winnerNickname || "승자 확인"}</text>
      <rect x="222" y="118" width="146" height="22" rx="11" fill="#ffffff" opacity="0.14" />
      <text x="238" y="133" fill="#fef3c7" fontSize="10" fontWeight="900">코드 {roomCode || "-"} · 제외 {removedCount || 0}장</text>
    </svg>
  );
};

const NoThanksSessionActionPanel = ({ selectedRoom, gameState, sortedPlayers, isHost, isFinished, winnerMemberId, winnerNickname, onRefresh, onRematch, onLeave }) => {
  if (!isFinished) return null;
  const actionItems = buildNoThanksSessionActionItems({
    selectedRoom,
    gameState,
    sortedPlayers,
    winnerMemberId,
    winnerNickname,
    isHost,
  });
  const removedCount = Array.isArray(gameState?.removedCards) ? gameState.removedCards.length : 0;
  return (
    <section
      className="rounded-[1.5rem] border border-emerald-200 bg-white p-4 shadow-lg"
      data-smoke="no-thanks-session-action-panel"
      data-session-status="FINISHED"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <NoThanksSessionActionArt
          winnerNickname={winnerNickname}
          roomCode={selectedRoom?.roomCode}
          removedCount={removedCount}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">종료 세션</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{selectedRoom?.title || "노땡큐 방"}</span>
          </div>
          <h2 className="mt-2 text-lg font-black text-slate-950">노땡큐 종료 세션 플랜</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            낮은 점수, 카드 묶음, 칩 차감 기준을 확인한 뒤 같은 방 재대결이나 게임 목록 이동을 선택합니다.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {actionItems.map((item) => (
              <div key={item.key} className={`min-h-[104px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="no-thanks-session-action-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-900 hover:text-white"
          onClick={onRefresh}
          data-smoke="no-thanks-session-action-refresh"
        >
          상태 새로고침
        </button>
        <button
          type="button"
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRematch}
          disabled={!isHost}
          data-smoke="no-thanks-session-action-rematch"
        >
          {isHost ? "같은 방 재대결" : "방장 재대결"}
        </button>
        <Link
          to="/app/games"
          className="rounded-xl bg-cyan-100 px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-700 hover:text-white"
          data-smoke="no-thanks-session-action-hub"
        >
          게임 목록
        </Link>
        <button
          type="button"
          className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-600 hover:text-white"
          onClick={onLeave}
          data-smoke="no-thanks-session-action-leave"
        >
          방 나가기
        </button>
      </div>
    </section>
  );
};

const noThanksSessionRoutePalette = {
  state: { fill: "#f8fafc", stroke: "#64748b", text: "#334155" },
  ready: { fill: "#fff7ed", stroke: "#f97316", text: "#9a3412" },
  primary: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857" },
  exit: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c" },
};

const buildNoThanksSessionRouteItems = ({ roomStatus, isHost, startReadiness, selectedRoom, players, readyMemberIds, rematching }) => {
  const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
  const safePlayers = Array.isArray(players) ? players : [];
  const hostId = Number(selectedRoom?.hostMemberId || 0);
  const guests = safePlayers.filter((player) => playerIdOf(player) !== hostId);
  const readyGuestCount = guests.filter((player) => readyMemberIds?.has(playerIdOf(player))).length;
  const minPlayers = parseIntSafe(selectedRoom?.minPlayers, 2);
  const maxPlayers = parseIntSafe(selectedRoom?.maxPlayers, 6);
  const canStart = Boolean(startReadiness?.canStart);
  const guestsReady = !guests.length || readyGuestCount === guests.length;
  const statusLabel = noThanksRoomStatusLabel(normalizedStatus);
  const waiting = normalizedStatus === "WAITING";
  const playing = normalizedStatus === "PLAYING";
  const finished = normalizedStatus === "FINISHED";
  const playerCount = safePlayers.length || parseIntSafe(selectedRoom?.memberCount, 0);

  return [
    {
      key: "state",
      label: "카드방 상태",
      value: statusLabel,
      detail: waiting
        ? `${playerCount}/${maxPlayers || "-"}명 입장, 최소 ${minPlayers}명 조건을 확인합니다.`
        : playing
          ? "카드 선택이 진행 중이라 준비/시작 버튼보다 현재 턴 행동이 핵심입니다."
          : "종료된 세션은 정산 확인, 한 판 더 하기, 퇴장 루트로 정리됩니다.",
      icon: "state",
      tone: waiting ? "waiting" : playing ? "active" : "done",
    },
    {
      key: "ready",
      label: "준비 버튼",
      value: waiting ? (guests.length ? `${readyGuestCount}/${guests.length}명 준비` : "게스트 없음") : "준비 단계 종료",
      detail: waiting
        ? (guestsReady ? "게스트 준비 조건이 맞아 시작 버튼 판단으로 넘어갑니다." : "준비하지 않은 게스트가 있어 시작 버튼이 아직 대기 상태입니다.")
        : "게임 시작 후에는 실제 준비 버튼을 눌러도 카드 선택 흐름 판단에 쓰이지 않습니다.",
      icon: "turn",
      tone: waiting ? (guestsReady ? "done" : "waiting") : "locked",
    },
    {
      key: "primary",
      label: finished ? "재대결 버튼" : playing ? "강제 종료" : "시작 버튼",
      value: finished
        ? (isHost ? (rematching ? "한 판 더 준비 중" : "한 판 더 가능") : "방장 선택 대기")
        : playing
          ? (isHost ? "방장 강제 종료 가능" : "카드 흐름 관전")
          : (isHost ? (canStart ? "방장 시작 가능" : "조건 대기") : "방장 시작 대기"),
      detail: finished
        ? (isHost ? "방장이 같은 방으로 재대결을 열 수 있고, 모든 플레이어는 결과를 확인한 뒤 퇴장할 수 있습니다." : "방장이 재대결을 선택하면 같은 방에서 다음 판을 이어갑니다.")
        : playing
          ? (isHost ? "강제 종료는 진행 중인 세션을 종료하는 방장 전용 루트입니다." : "진행 중에는 카드 가져가기/넘기기 버튼이 핵심 루트이고 세션 시작 버튼은 닫힙니다.")
          : (canStart ? "준비 조건이 맞아 실제 시작 버튼이 다음 행동입니다." : "인원 또는 게스트 준비가 맞아야 실제 시작 버튼을 눌러도 진행됩니다."),
      icon: finished ? "recent" : playing ? "decision" : "signal",
      tone: finished ? "done" : playing ? (isHost ? "danger" : "active") : canStart ? "done" : "waiting",
    },
    {
      key: "exit",
      label: "퇴장 버튼",
      value: "언제든 방 나가기",
      detail: finished ? "결과를 확인한 뒤 방을 나가거나 게임 목록으로 돌아갈 수 있습니다." : "퇴장은 기존 방 나가기 버튼을 그대로 사용하며 현재 카드/칩 규칙을 바꾸지 않습니다.",
      icon: "player",
      tone: "neutral",
    },
  ];
};

const NoThanksSessionRouteArt = ({ items, roomStatus, isHost, canStart }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
  const nodePositions = [
    { x: 58, y: 84 },
    { x: 154, y: 56 },
    { x: 258, y: 84 },
    { x: 354, y: 56 },
  ];
  return (
    <svg
      viewBox="0 0 420 150"
      role="img"
      aria-label="노땡스 세션 버튼 루트"
      className="h-full min-h-[148px] w-full"
      data-smoke="no-thanks-session-route-art"
      data-room-status={normalizedStatus}
      data-host={isHost ? "true" : "false"}
      data-can-start={canStart ? "true" : "false"}
    >
      <rect x="12" y="16" width="396" height="118" rx="24" fill="#fff7ed" />
      <path d="M48 100 C104 40 176 116 238 64 C286 24 332 104 382 48" stroke="#f97316" strokeWidth="4" fill="none" />
      <path d="M42 116 H374" stroke="#10b981" strokeWidth="3" strokeDasharray="9 8" />
      <rect x="28" y="36" width="48" height="70" rx="12" fill="#ffffff" stroke="#fdba74" strokeWidth="2" />
      <text x="52" y="74" textAnchor="middle" fill="#9a3412" fontSize="18" fontWeight="900">NO</text>
      {safeItems.map((item, index) => {
        const position = nodePositions[index] || { x: 58 + index * 88, y: 78 };
        const palette = noThanksSessionRoutePalette[item.key] || noThanksSessionRoutePalette.state;
        return (
          <g key={item.key} data-smoke="no-thanks-session-route-node" data-route-key={item.key}>
            <circle cx={position.x} cy={position.y} r="25" fill={palette.fill} stroke={palette.stroke} strokeWidth="3" />
            <circle cx={position.x} cy={position.y} r="12" fill="#ffffff" />
            <text x={position.x} y={position.y + 4} textAnchor="middle" fill={palette.text} fontSize="9" fontWeight="900">{index + 1}</text>
            <text x={position.x} y={position.y + 37} textAnchor="middle" fill={palette.text} fontSize="10" fontWeight="900">{item.label}</text>
          </g>
        );
      })}
      <rect x="108" y="28" width="118" height="24" rx="12" fill="#ffffff" opacity="0.92" />
      <text x="122" y="44" fill="#9a3412" fontSize="11" fontWeight="900">{normalizedStatus}</text>
      <rect x="244" y="110" width="136" height="22" rx="11" fill="#111827" opacity="0.9" />
      <text x="258" y="125" fill="#fef3c7" fontSize="10" fontWeight="900">{isHost ? "방장 루트" : "참가자 루트"} · {canStart ? "시작 가능" : "상태 확인"}</text>
    </svg>
  );
};

const NoThanksSessionRoutePanel = ({ roomStatus, isHost, startReadiness, selectedRoom, players, readyMemberIds, rematching }) => {
  if (!selectedRoom) return null;
  const routeItems = buildNoThanksSessionRouteItems({
    roomStatus,
    isHost,
    startReadiness,
    selectedRoom,
    players,
    readyMemberIds,
    rematching,
  });
  const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
  const canStart = Boolean(startReadiness?.canStart);
  const toneClass = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
    active: "border-sky-200 bg-sky-50 text-sky-900",
    waiting: "border-orange-200 bg-orange-50 text-orange-900",
    locked: "border-slate-200 bg-slate-50 text-slate-700",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    neutral: "border-slate-200 bg-white text-slate-800",
  };
  return (
    <section
      className="mt-4 overflow-hidden rounded-[1.5rem] border border-orange-100 bg-white p-4 shadow-sm"
      data-smoke="no-thanks-session-route-panel"
      data-room-status={normalizedStatus}
      data-can-start={canStart ? "true" : "false"}
      data-host={isHost ? "true" : "false"}
      data-rematching={rematching ? "true" : "false"}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <NoThanksSessionRouteArt
          items={routeItems}
          roomStatus={normalizedStatus}
          isHost={isHost}
          canStart={canStart}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-700">실제 버튼 안내</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{isHost ? "방장 기준" : "참가자 기준"}</span>
          </div>
          <h2 className="mt-2 text-lg font-black text-slate-950">노땡스 세션 버튼 루트</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            준비, 시작, 강제 종료, 한 판 더 하기, 퇴장 버튼이 현재 카드방 상태에서 어떤 의미인지 먼저 보여줍니다. 실제 클릭 동작과 권한 조건은 기존 버튼을 그대로 따릅니다.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {routeItems.map((item) => (
              <div key={item.key} className={`min-h-[108px] rounded-xl border px-3 py-2 ${toneClass[item.tone] || toneClass.neutral}`} data-smoke="no-thanks-session-route-item" data-route-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const NoThanksActionAvailabilityArt = ({
  canTake,
  canPass,
  currentCard,
  potChips,
  myChips,
  isMyTurn,
  playable,
  className = "",
}) => {
  const visibleCard = currentCard ?? "대기";
  const safePotChips = Number.isFinite(Number(potChips)) ? Number(potChips) : 0;
  const safeMyChips = Number.isFinite(Number(myChips)) ? Number(myChips) : 0;
  const turnText = !playable ? "시작 전" : isMyTurn ? "내 차례" : "관찰";
  const passText = canPass ? "가능" : safeMyChips > 0 ? "차례 대기" : "칩 없음";
  const takeText = canTake ? "가능" : playable ? "차례 대기" : "시작 대기";
  const passTone = canPass
    ? { fill: "#f59e0b", soft: "#fef3c7", stroke: "#fbbf24", text: "#92400e" }
    : { fill: "#94a3b8", soft: "#f1f5f9", stroke: "#cbd5e1", text: "#475569" };
  const takeTone = canTake
    ? { fill: "#10b981", soft: "#d1fae5", stroke: "#6ee7b7", text: "#065f46" }
    : { fill: "#94a3b8", soft: "#f1f5f9", stroke: "#cbd5e1", text: "#475569" };
  const nodes = [
    { key: "turn", label: "차례", value: turnText, x: 55, y: 42, fill: isMyTurn ? "#0f172a" : "#64748b", soft: "#ffffff", stroke: "#cbd5e1", text: "#0f172a" },
    { key: "card", label: "공개 카드", value: String(visibleCard), x: 55, y: 118, fill: "#0f172a", soft: "#ffffff", stroke: "#cbd5e1", text: "#0f172a" },
    { key: "pot", label: "팟 칩", value: `${safePotChips}개`, x: 168, y: 118, fill: "#f97316", soft: "#fff7ed", stroke: "#fed7aa", text: "#9a3412" },
    { key: "pass", label: "넘기기", value: passText, x: 314, y: 68, fill: passTone.fill, soft: passTone.soft, stroke: passTone.stroke, text: passTone.text },
    { key: "take", label: "가져가기", value: takeText, x: 314, y: 132, fill: takeTone.fill, soft: takeTone.soft, stroke: takeTone.stroke, text: takeTone.text },
  ];

  return (
    <svg
      viewBox="0 0 390 178"
      role="img"
      aria-label="노땡스 행동 가능성 지도"
      className={className}
      data-smoke="no-thanks-action-availability-art"
      data-current-card={currentCard ?? ""}
      data-pot-chips={safePotChips}
      data-can-pass={canPass ? "true" : "false"}
      data-can-take={canTake ? "true" : "false"}
    >
      <rect width="390" height="178" rx="24" fill="#ffffff" />
      <rect x="16" y="14" width="358" height="150" rx="22" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      <text x="30" y="37" fill="#0f172a" fontSize="13" fontWeight="900">카드 → 선택 → 결과</text>
      <text x="30" y="56" fill="#64748b" fontSize="10" fontWeight="800">현재 카드와 내 칩으로 가능한 행동을 먼저 확인합니다</text>
      <path d="M88 118 H128" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
      <path d="M207 118 C239 118 239 68 272 68" fill="none" stroke={canPass ? "#f59e0b" : "#cbd5e1"} strokeWidth="7" strokeLinecap="round" />
      <path d="M207 118 C239 118 239 132 272 132" fill="none" stroke={canTake ? "#10b981" : "#cbd5e1"} strokeWidth="7" strokeLinecap="round" />
      <circle cx="224" cy="118" r="18" fill="#0f172a" />
      <text x="224" y="122" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">선택</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="no-thanks-action-availability-node" data-action-key={node.key}>
          <rect x={node.x - 42} y={node.y - 22} width="84" height="44" rx="14" fill={node.soft} stroke={node.stroke} strokeWidth="2" />
          <circle cx={node.x - 26} cy={node.y - 3} r="8" fill={node.fill} />
          <text x={node.x} y={node.y - 5} textAnchor="middle" fill={node.text} fontSize="10" fontWeight="900">{node.label}</text>
          <text x={node.x} y={node.y + 13} textAnchor="middle" fill={node.text} fontSize="10" fontWeight="900">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const NoThanksActionAvailabilityPanel = ({
  roomStatus,
  isMyTurn,
  myChips,
  currentCard,
  potChips,
  myCards,
  onTake,
  onPass,
}) => {
  const playable = roomStatus === "PLAYING";
  const canTake = playable && isMyTurn;
  const canPass = playable && isMyTurn && myChips > 0;

  return (
    <div
      className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3"
      data-smoke="no-thanks-action-availability-panel"
      data-room-status={roomStatus || "UNKNOWN"}
      data-my-turn={isMyTurn ? "true" : "false"}
      data-can-take={canTake ? "true" : "false"}
      data-can-pass={canPass ? "true" : "false"}
      data-current-card={currentCard ?? ""}
      data-pot-chips={potChips ?? 0}
    >
      <div className="space-y-2">
        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canTake} onClick={onTake} data-smoke="no-thanks-take-action">카드 가져가기</button>
        <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canPass} onClick={onPass} data-smoke="no-thanks-pass-action">칩 1개 내고 넘기기</button>
      </div>
    </div>
  );
};

const NoThanksPlayerStateArt = ({ nickname, chips, cardCount, score, runLabel, isCurrent, isWinner }) => {
  const safeChips = Math.max(0, Number(chips) || 0);
  const safeCardCount = Math.max(0, Number(cardCount) || 0);
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const nodes = [
    { key: "chips", label: "칩 압력", value: `${safeChips}개`, x: 60, y: 68, fill: safeChips <= 2 ? "#fb7185" : "#f59e0b" },
    { key: "cards", label: "카드 흐름", value: safeCardCount ? `${safeCardCount}장` : "카드 없음", x: 160, y: 68, fill: "#38bdf8" },
    { key: "score", label: "점수 압력", value: `${safeScore}점`, x: 260, y: 68, fill: safeScore <= 20 ? "#22c55e" : "#f97316" },
    { key: "turn", label: "차례", value: isCurrent ? "현재" : isWinner ? "우승" : "대기", x: 360, y: 68, fill: isCurrent ? "#0f172a" : "#94a3b8" },
  ];

  return (
    <svg
      viewBox="0 0 420 142"
      role="img"
      aria-label={`${nickname || "플레이어"} 노땡스 상태 요약`}
      className="h-auto w-full"
      data-smoke="no-thanks-player-state-art"
    >
      <rect x="8" y="8" width="404" height="126" rx="24" fill="#fff7ed" stroke="#fed7aa" strokeWidth="2" />
      <path d="M40 104C92 56 136 112 190 78s93-36 150 18" fill="none" stroke="#fdba74" strokeWidth="9" strokeLinecap="round" opacity="0.32" />
      <text x="26" y="34" fill="#9a3412" fontSize="12" fontWeight="900">{nickname || "플레이어"}</text>
      <text x="394" y="34" textAnchor="end" fill="#64748b" fontSize="10" fontWeight="900">{runLabel || "카드 없음"}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="no-thanks-player-state-node" data-state-key={node.key}>
          <circle cx={node.x} cy={node.y} r="25" fill={node.fill} opacity="0.95" />
          <circle cx={node.x} cy={node.y} r="13" fill="#ffffff" opacity="0.96" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900">{node.value}</text>
          <text x={node.x} y="114" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const NoThanksPlayerStateCard = ({ player, isCurrent, isWinner, isMe }) => {
  const cards = Array.isArray(player?.cards) ? player.cards.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];
  const chips = parseIntSafe(player?.chips, 0);
  const cardScore = scoreNoThanksCards(cards);
  const serverScore = Number(player?.score);
  const finalScore = Number.isFinite(serverScore) ? serverScore : cardScore - chips;
  const runs = summarizeNoThanksRuns(cards);
  const memberId = playerIdOf(player);
  const nickname = player?.nickname || (memberId ? `플레이어 ${memberId}` : "플레이어");
  const chipPressure = chips <= 0 ? "칩 없음" : chips <= 2 ? "높음" : chips <= 5 ? "주의" : "여유";
  const scorePressure = finalScore <= 20 ? "낮음" : finalScore <= 35 ? "중간" : "높음";
  const metrics = [
    {
      label: "칩 압력",
      value: `${chipPressure} · ${chips}개`,
      detail: chips <= 0 ? "넘기기 불가, 받기 압박이 큽니다." : "남은 칩으로 패스 여지를 봅니다.",
      icon: "coin",
    },
    {
      label: "카드 흐름",
      value: runs.label,
      detail: cards.length ? `연속 묶음 ${runs.runCount}개 · 최장 ${runs.longestRun}장` : "아직 받은 카드가 없습니다.",
      icon: "stage",
    },
    {
      label: "점수 압력",
      value: `${finalScore}점 · ${scorePressure}`,
      detail: `카드 ${cardScore}점에서 칩 ${chips}개를 차감합니다.`,
      icon: "score",
    },
    {
      label: "차례 상태",
      value: isCurrent ? "현재 차례" : isWinner ? "우승 기준" : isMe ? "내 상태" : "관찰",
      detail: isCurrent ? "지금 받기/넘기기 선택 대상입니다." : "다음 공개 카드와 칩 이동을 확인합니다.",
      icon: "turn",
    },
  ];

  return (
    <section
      className={`rounded-[1.4rem] border bg-white p-3 shadow-sm ${isCurrent ? "border-sky-200 ring-2 ring-sky-100" : isWinner ? "border-emerald-200" : "border-slate-200"}`}
      data-smoke="no-thanks-player-state-card"
      data-player-current={isCurrent ? "true" : "false"}
      data-player-me={isMe ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-950">{nickname}</div>
          <div className="text-[11px] font-bold text-slate-500">{isMe ? "내 상태" : isCurrent ? "현재 차례" : isWinner ? "우승 기준" : "상태 요약"}</div>
        </div>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">점수 {finalScore}점</span>
      </div>
      <NoThanksPlayerStateArt
        nickname={nickname}
        chips={chips}
        cardCount={cards.length}
        score={finalScore}
        runLabel={runs.label}
        isCurrent={isCurrent}
        isWinner={isWinner}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2" data-smoke="no-thanks-player-state-item">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
              <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="mt-0.5 truncate text-xs font-black text-slate-900">{item.value}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const noThanksActionRouteTone = (state) => ({
  ready: "border-emerald-100 bg-emerald-50 text-emerald-900",
  active: "border-amber-100 bg-amber-50 text-amber-900",
  waiting: "border-slate-100 bg-slate-50 text-slate-800",
  danger: "border-rose-100 bg-rose-50 text-rose-900",
}[state] || "border-slate-100 bg-white text-slate-900");

const buildNoThanksActionRouteItems = ({
  roomStatus,
  isMyTurn,
  myChips,
  currentCard,
  potChips,
  myCards,
  deckRemaining,
  turnName,
}) => {
  const playable = roomStatus === "PLAYING";
  const safeMyChips = Math.max(0, Number(myChips) || 0);
  const safePotChips = Math.max(0, Number(potChips) || 0);
  const safeDeckRemaining = Math.max(0, Number(deckRemaining) || 0);
  const safeCards = Array.isArray(myCards) ? myCards : [];
  const cardValue = Number(currentCard) || 0;
  const hasCard = cardValue > 0;
  const currentNetScore = scoreNoThanksCards(safeCards) - safeMyChips;
  const takeNetScore = hasCard ? scoreNoThanksCards([...safeCards, cardValue]) - (safeMyChips + safePotChips) : currentNetScore;
  const takeDelta = takeNetScore - currentNetScore;
  const canTake = playable && isMyTurn && hasCard;
  const canPass = playable && isMyTurn && safeMyChips > 0 && hasCard;
  const passLockedReason = !playable
    ? "게임이 시작되면 넘기기 판단이 열립니다."
    : !isMyTurn
      ? `${turnName || "상대"}의 선택을 관찰하는 단계입니다.`
      : !hasCard
        ? "공개 카드가 들어와야 칩을 얹고 넘길 수 있습니다."
        : safeMyChips <= 0
          ? "칩이 없으면 넘기지 못하고 카드를 가져가야 합니다."
          : "칩 1개를 카드 위에 올리고 다음 사람에게 넘길 수 있습니다.";

  return [
    {
      key: "card",
      label: "카드 확인",
      value: hasCard ? `${cardValue} 카드` : "공개 대기",
      detail: hasCard ? "현재 카드 숫자와 내 연속 카드 묶음을 먼저 비교합니다." : "새 카드가 공개되면 받기와 넘기기 판단이 시작됩니다.",
      state: hasCard ? "active" : "waiting",
    },
    {
      key: "chip",
      label: "칩 비용",
      value: `내 칩 ${safeMyChips} · 보상 ${safePotChips}`,
      detail: canPass ? "넘기기는 칩 1개를 쓰지만 다음 보상 칩을 키웁니다." : passLockedReason,
      state: canPass ? "ready" : safeMyChips <= 0 && playable && isMyTurn ? "danger" : "waiting",
    },
    {
      key: "choice",
      label: "받기/패스",
      value: canTake ? (canPass ? "둘 다 가능" : "받기만 가능") : "대기",
      detail: canTake ? `받으면 현재 순점수 변화는 ${takeDelta > 0 ? "+" : ""}${takeDelta}점입니다.` : "실제 행동 버튼은 차례와 공개 카드 상태에 맞춰 잠깁니다.",
      state: canTake ? "ready" : "waiting",
    },
    {
      key: "next",
      label: "다음 턴",
      value: playable ? `덱 ${safeDeckRemaining}장` : "시작 전",
      detail: isMyTurn ? "선택 후 카드/칩/차례가 서버 상태로 다시 반영됩니다." : `${turnName || "상대"}의 행동 결과를 보고 다음 판단을 준비합니다.`,
      state: playable ? "active" : "waiting",
    },
  ];
};

const NoThanksActionRouteArt = ({ items = [], currentCard, potChips = 0, isMyTurn = false }) => {
  const paletteByState = {
    ready: { fill: "#dcfce7", stroke: "#16a34a", text: "#166534" },
    active: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
    waiting: { fill: "#f1f5f9", stroke: "#64748b", text: "#334155" },
    danger: { fill: "#ffe4e6", stroke: "#e11d48", text: "#9f1239" },
  };
  const nodes = items.slice(0, 4).map((item, index) => ({
    ...item,
    x: 64 + index * 104,
    y: index % 2 ? 112 : 78,
  }));
  const cardLabel = currentCard ? `${currentCard}` : "-";

  return (
    <svg
      data-smoke="no-thanks-action-route-art"
      viewBox="0 0 404 190"
      className="h-auto w-full"
      role="img"
      aria-label={`노땡스 액션 루트 현재 카드 ${cardLabel}`}
      focusable="false"
    >
      <rect x="8" y="8" width="388" height="174" rx="28" fill="#fff7ed" stroke="#fed7aa" strokeWidth="3" />
      <path d="M38 132c46-38 92-42 139-10 50 34 101 33 152-5 22-16 35-14 44 6v36H38Z" fill="#fdba74" opacity="0.26" />
      <path d="M64 78c54-30 103-20 148 30 40 45 84 49 132 12" fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" />
      {nodes.map((node, index) => {
        const palette = paletteByState[node.state] || paletteByState.waiting;
        const active = node.state === "ready";
        return (
          <g key={node.key} data-smoke="no-thanks-action-route-node">
            {index < nodes.length - 1 && (
              <path
                d={`M${node.x + 30} ${node.y}L${nodes[index + 1].x - 30} ${nodes[index + 1].y}`}
                stroke={node.state === "ready" ? "#0f172a" : "#cbd5e1"}
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
            <circle cx={node.x} cy={node.y} r={active ? 32 : 28} fill={palette.fill} stroke={active ? "#0f172a" : palette.stroke} strokeWidth={active ? 5 : 3} />
            {node.key === "card" && (
              <g>
                <rect x={node.x - 14} y={node.y - 19} width="28" height="38" rx="7" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={palette.text}>{cardLabel}</text>
              </g>
            )}
            {node.key === "chip" && (
              <g>
                <circle cx={node.x - 6} cy={node.y} r="14" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <circle cx={node.x + 10} cy={node.y + 2} r="14" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
                <text x={node.x + 10} y={node.y + 6} textAnchor="middle" fontSize="10" fontWeight="900" fill="#92400e">{Number(potChips) || 0}</text>
              </g>
            )}
            {node.key === "choice" && (
              <g>
                <path d={`M${node.x - 16} ${node.y - 8}h32v18h-12l-8 8v-8h-12Z`} fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 7} ${node.y + 1}h14`} stroke={palette.text} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {node.key === "next" && (
              <g>
                <path d={`M${node.x - 17} ${node.y - 10}h25l10 10-10 10h-25Z`} fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 3} ${node.y - 6}l8 6-8 6`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            <text x={node.x} y={node.y + 50} textAnchor="middle" fontSize="11" fontWeight="900" fill={palette.text}>{node.label}</text>
          </g>
        );
      })}
      <rect x="28" y="24" width="118" height="28" rx="14" fill="#ffffff" stroke="#fed7aa" />
      <text x="87" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#9a3412">카드 {cardLabel}</text>
      <rect x="262" y="24" width="104" height="28" rx="14" fill={isMyTurn ? "#dcfce7" : "#ffffff"} stroke={isMyTurn ? "#16a34a" : "#cbd5e1"} />
      <text x="314" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill={isMyTurn ? "#166534" : "#475569"}>{isMyTurn ? "내 차례" : "관찰"}</text>
    </svg>
  );
};

const NoThanksActionRoutePanel = ({
  roomStatus,
  isMyTurn,
  myChips,
  currentCard,
  potChips,
  myCards,
  deckRemaining,
  turnName,
}) => {
  const routeItems = buildNoThanksActionRouteItems({
    roomStatus,
    isMyTurn,
    myChips,
    currentCard,
    potChips,
    myCards,
    deckRemaining,
    turnName,
  });
  const playable = roomStatus === "PLAYING";
  const safeMyChips = Math.max(0, Number(myChips) || 0);
  const statusLabel = !playable ? "시작 대기" : isMyTurn ? "선택 가능성 확인" : "상대 선택 관찰";

  return (
    <section
      data-smoke="no-thanks-action-route-panel"
      data-room-status={roomStatus || "UNKNOWN"}
      data-my-turn={isMyTurn ? "true" : "false"}
      data-current-card={currentCard ?? ""}
      data-pot-chips={potChips ?? 0}
      data-my-chips={safeMyChips}
      data-deck-remaining={deckRemaining ?? 0}
      className="rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-black text-amber-700">노땡스 액션 루트</div>
          <div className="mt-1 text-lg font-black text-slate-950">카드 확인, 칩 비용, 받기/패스, 다음 턴</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">현재 카드와 칩 압력이 실제 행동 버튼으로 이어지는 이유를 먼저 보여줍니다.</div>
        </div>
        <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
          {statusLabel}
        </span>
      </div>
      <NoThanksActionRouteArt
        items={routeItems}
        currentCard={currentCard}
        potChips={potChips}
        isMyTurn={isMyTurn}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {routeItems.map((item) => (
          <div
            key={item.key}
            data-smoke="no-thanks-action-route-item"
            data-route-key={item.key}
            className={`min-h-[92px] rounded-xl border px-3 py-2 ${noThanksActionRouteTone(item.state)}`}
          >
            <div className="text-[10px] font-black opacity-70">{item.label}</div>
            <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
            <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const NoThanksJoinCodeArt = ({ joinCode, className = "" }) => {
  const codeText = String(joinCode || "").trim().toUpperCase();
  const visibleCode = codeText ? codeText.slice(0, 8) : "방코드";
  const nodes = [
    { key: "code", label: "코드", x: 58 },
    { key: "card", label: "카드", x: 180 },
    { key: "seat", label: "좌석", x: 302 },
  ];

  return (
    <svg
      viewBox="0 0 360 132"
      role="img"
      aria-label="노땡스 방 코드 입장 흐름"
      className={className}
      data-smoke="no-thanks-join-code-art"
    >
      <rect width="360" height="132" rx="22" fill="#fff7ed" />
      <rect x="24" y="18" width="312" height="50" rx="16" fill="#ffffff" stroke="#fdba74" strokeWidth="2" />
      <text x="42" y="38" fill="#9a3412" fontSize="11" fontWeight="900">노땡스 초대 코드</text>
      <text x="42" y="59" fill="#0f172a" fontSize="20" fontWeight="900">{visibleCode}</text>
      <g transform="translate(284 25)">
        <rect x="0" y="6" width="26" height="34" rx="6" fill={codeText ? "#f97316" : "#cbd5e1"} />
        <text x="13" y="28" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">?</text>
        <circle cx="34" cy="26" r="11" fill={codeText ? "#0f172a" : "#64748b"} />
        <text x="34" y="30" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">1</text>
      </g>
      <path d="M66 96 H294" fill="none" stroke="#fed7aa" strokeWidth="8" strokeLinecap="round" />
      <path d="M66 96 H294" fill="none" stroke={codeText ? "#f97316" : "#94a3b8"} strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="no-thanks-join-code-node">
          <circle cx={node.x} cy="96" r="18" fill={codeText ? "#9a3412" : "#e2e8f0"} stroke={codeText ? "#fed7aa" : "#94a3b8"} strokeWidth="2" />
          <text x={node.x} y="100" textAnchor="middle" fill={codeText ? "#fff7ed" : "#334155"} fontSize="11" fontWeight="900">{index + 1}</text>
          <text x={node.x} y="125" textAnchor="middle" fill="#9a3412" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const NoThanksJoinCodePanel = ({ joinCode, setJoinCode, joinByCode }) => {
  const hasCode = String(joinCode || "").trim().length > 0;

  return (
    <form
      onSubmit={joinByCode}
      aria-label="노땡스 방 코드 입장"
      className="mt-4 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
      data-smoke="no-thanks-join-code-panel"
    >
      <div className="p-3">
        <NoThanksJoinCodeArt joinCode={joinCode} className="mb-3 h-28 w-full" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="signal" className="h-4 w-4 text-orange-600" />
            카드방 코드 입장
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            초대 코드를 입력하면 같은 노땡스 방과 카드 선택 대기 흐름으로 이어집니다.
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              aria-label="방 코드"
              className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
              placeholder="방코드"
              value={joinCode}
              maxLength={8}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              data-smoke="no-thanks-join-code-input"
            />
            <button
              type="submit"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white"
              data-smoke="no-thanks-join-code-submit"
            >
              입장
            </button>
          </div>
          <div className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-bold leading-relaxed ${hasCode ? "bg-orange-50 text-orange-800" : "bg-slate-50 text-slate-500"}`} data-smoke="no-thanks-join-code-status">
            {hasCode ? "입력한 코드로 노땡스 방을 찾을 준비가 됐습니다." : "방장이 공유한 코드를 입력하면 대기 중인 카드방을 찾습니다."}
          </div>
        </div>
      </div>
    </form>
  );
};

export const NoThanksGame = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(initialNoThanksActionFeedback);
  const [chipAnimations, setChipAnimations] = useState([]);
  const [rematching, setRematching] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", startChipCount: "11", turnTimeSeconds: "15" });
  const [settingsForm, setSettingsForm] = useState({ startChipCount: "11", turnTimeSeconds: "15" });
  const [startBotCount, setStartBotCount] = useState(0);

  const stompRef = useRef(null);
  const stompInitRef = useRef(null);
  const gameSubRef = useRef(null);
  const chatSubRef = useRef(null);
  const realtimeRoomRef = useRef(null);
  const mountedRef = useRef(false);
  const chatScrollRef = useRef(null);
  const audioContextRef = useRef(null);
  const isActionSoundPlayingRef = useRef(false);
  const previousPotChipsRef = useRef(0);
  const chipAnimationIdRef = useRef(0);
  const lastReadMarkAtRef = useRef(0);

  const myMemberId = Number(getMemberId(user) || user?.id || 0);
  const roomStatus = gameState?.roomStatus || selectedRoom?.roomStatus || null;
  const statePlayers = Array.isArray(gameState?.players) ? gameState.players : [];
  const roomPlayers = Array.isArray(selectedRoom?.players) ? selectedRoom.players : [];
  const players = statePlayers.length ? statePlayers : roomPlayers;
  const startBotMax = selectedRoom && String(roomStatus || "WAITING").toUpperCase() === "WAITING"
    ? Math.max(0, parseIntSafe(selectedRoom.maxPlayers, 6) - players.length)
    : 0;
  const effectiveStartBotCount = Math.min(
    Math.max(0, parseIntSafe(startBotCount, 0)),
    startBotMax
  );
  const startBotOptions = Array.from({ length: startBotMax + 1 }, (_, index) => index);
  const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
  const isHost = Boolean(selectedRoom && hostMemberId === myMemberId);
  const turnMemberId = Number(gameState?.turnMemberId || 0);
  const turnName = turnMemberId ? noThanksPlayerName(players, turnMemberId) : null;
  const isMyTurn = Boolean(myMemberId && turnMemberId === myMemberId);
  const currentCard = gameState?.currentCard ?? null;
  const potChips = parseIntSafe(gameState?.potChips, 0);
  const deckRemaining = parseIntSafe(gameState?.deckRemainingCount, 0);
  const winnerMemberId = Number(gameState?.winnerMemberId || 0);
  const gameChatRoomId = roomIdOf(selectedRoom);
  const chatRoomId = null;
  const myPlayer = players.find((player) => playerIdOf(player) === myMemberId) || null;
  const myChips = parseIntSafe(myPlayer?.chips, 0);
  useEffect(() => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    setPageGuideContext({
      game: "no-thanks",
      context: selectedRoom ? (gameState || normalizedStatus === "PLAYING" || normalizedStatus === "FINISHED" ? "play" : "waiting-room") : "lobby",
    });
    return clearPageGuideContext;
  }, [gameState, roomStatus, selectedRoom]);
  const readyMemberIds = useMemo(() => new Set(players.filter(isReadyPlayer).map(playerIdOf)), [players]);
  const hostNickname = players.find((player) => playerIdOf(player) === hostMemberId)?.nickname || "-";
  const lobbySetup = useMemo(() => {
    const title = String(createForm.title || "").trim();
    const startChipCount = parseIntSafe(createForm.startChipCount, 11);
    const turnTimeSeconds = parseIntSafe(createForm.turnTimeSeconds, 15);
    const code = String(joinCode || "").trim().toUpperCase();
    const waitingRoomCount = Array.isArray(rooms) ? rooms.filter((room) => String(room?.roomStatus || "WAITING").toUpperCase() === "WAITING").length : 0;
    return {
      statusText: code ? "코드 입장 준비" : "호스트 설정 준비",
      items: [
        {
          label: "방 제목",
          value: title ? "제목 입력됨" : "자동 제목 가능",
          detail: title || "제목이 비어 있어도 기본 노땡스 방으로 만들 수 있습니다.",
          icon: "state",
          tone: title ? "done" : "waiting",
          progress: title ? Math.min(100, Math.max(18, (title.length / 24) * 100)) : 8,
        },
        {
          label: "시작 칩",
          value: `${startChipCount}개`,
          detail: "초기 칩이 많을수록 카드를 넘길 여지가 늘어납니다.",
          icon: "coin",
          tone: startChipCount >= 8 ? "active" : "waiting",
          progress: (startChipCount / 20) * 100,
        },
        {
          label: "턴 시간",
          value: `${turnTimeSeconds}초`,
          detail: "각 플레이어가 카드 가져가기 또는 넘기기를 판단할 시간입니다.",
          icon: "turn",
          tone: turnTimeSeconds >= 10 ? "done" : "waiting",
          progress: (turnTimeSeconds / 60) * 100,
        },
        {
          label: "코드 입장",
          value: code ? "코드 입력됨" : `${waitingRoomCount}개 대기방`,
          detail: code ? `${code} 코드로 바로 합류합니다.` : "코드가 없으면 대기방 카드에서 입장할 수 있습니다.",
          icon: "signal",
          tone: code ? "done" : waitingRoomCount ? "active" : "waiting",
          progress: code ? Math.min(100, Math.max(24, (code.length / 8) * 100)) : 8,
        },
      ],
      ruleHint: "이 셋업 패널은 입력값 설명만 담당합니다. 방 생성, 코드 입장, 카드/칩/점수 규칙은 기존 서버 로직을 그대로 따릅니다.",
    };
  }, [createForm.startChipCount, createForm.title, createForm.turnTimeSeconds, joinCode, rooms]);
  const roomStatusNormalized = String(roomStatus || "WAITING").toUpperCase();
  const startReadiness = useMemo(() => {
    if (!selectedRoom) return null;
    const roomPlayersForReadiness = Array.isArray(players) ? players : [];
    const guests = roomPlayersForReadiness.filter((player) => playerIdOf(player) !== hostMemberId);
    const readyGuestCount = guests.filter((player) => readyMemberIds.has(playerIdOf(player))).length;
    const minPlayers = parseIntSafe(selectedRoom.minPlayers, 2);
    const maxPlayers = parseIntSafe(selectedRoom.maxPlayers, 6);
    const startChipCount = parseIntSafe(selectedRoom.startChipCount, 11);
    const turnTimeSeconds = parseIntSafe(selectedRoom.turnTimeSeconds, 15);
    const startPlayerCount = roomPlayersForReadiness.length + effectiveStartBotCount;
    const startUsesBots = effectiveStartBotCount > 0;
    const enoughPlayers = startPlayerCount >= minPlayers;
    const soloAiStartAvailable = roomPlayersForReadiness.length === 1 && startUsesBots && minPlayers > 1;
    const playerRequirementMet = enoughPlayers;
    const withinMaxPlayers = maxPlayers <= 0 || startPlayerCount <= maxPlayers;
    const guestsReady = !guests.length || readyGuestCount === guests.length;
    const startSignalReady = roomStatusNormalized === "WAITING" && playerRequirementMet && withinMaxPlayers && guestsReady;
    const playerProgress = minPlayers > 0 ? (startPlayerCount / minPlayers) * 100 : 100;
    const guestProgress = guests.length > 0 ? (readyGuestCount / guests.length) * 100 : 100;
    const waitingReason = roomStatusNormalized !== "WAITING"
      ? "대기 상태에서만 시작할 수 있습니다."
      : !playerRequirementMet
        ? `${Math.max(0, minPlayers - roomPlayersForReadiness.length)}명이 더 필요합니다.`
        : !withinMaxPlayers
          ? `현재 인원이 정원 ${maxPlayers}명을 초과했습니다.`
          : !guestsReady
            ? "아직 준비하지 않은 게스트가 있습니다."
            : "시작 가능";
    return {
      canStart: Boolean(isHost && startSignalReady),
      botCount: effectiveStartBotCount,
      playerCount: startPlayerCount,
      soloAiStartAvailable,
      startUsesBots,
      statusText: isHost
        ? (startSignalReady ? (soloAiStartAvailable ? "AI와 시작 가능" : "방장 시작 가능") : waitingReason)
        : (startSignalReady ? "방장 시작 대기" : waitingReason),
      items: [
        {
          label: "인원 조건",
          value: `${roomPlayersForReadiness.length}/${maxPlayers || "-"}명`,
          detail: soloAiStartAvailable
            ? `부족한 ${Math.max(0, minPlayers - roomPlayersForReadiness.length)}자리는 AI가 채웁니다.`
            : !enoughPlayers
            ? `${Math.max(0, minPlayers - roomPlayersForReadiness.length)}명이 더 필요합니다.`
            : withinMaxPlayers
              ? `최소 ${minPlayers}명 조건을 충족했습니다.`
              : `정원 ${maxPlayers}명을 초과했습니다.`,
          icon: "player",
          tone: playerRequirementMet && withinMaxPlayers ? "done" : "waiting",
          progress: playerProgress,
        },
        {
          label: "게스트 준비",
          value: guests.length ? `${readyGuestCount}/${guests.length}명 준비` : "게스트 없음",
          detail: guests.length
            ? (guestsReady ? "게스트 준비가 완료되었습니다." : "아직 준비하지 않은 게스트가 있습니다.")
            : soloAiStartAvailable ? "방장 혼자 AI와 바로 시작할 수 있습니다." : (minPlayers <= 1 ? "1인 시작 가능한 방입니다." : "초대 또는 입장으로 최소 인원을 채웁니다."),
          icon: "turn",
          tone: guests.length ? (guestsReady ? "done" : "waiting") : "neutral",
          progress: guestProgress,
        },
        {
          label: "시작 권한",
          value: isHost ? (startSignalReady ? (soloAiStartAvailable ? "AI 시작 가능" : "시작 가능") : "방장 대기") : "방장 전용",
          detail: isHost ? "방장만 현재 방을 시작할 수 있습니다." : "모든 조건이 맞으면 방장이 시작합니다.",
          icon: "signal",
          tone: isHost && startSignalReady ? "done" : startSignalReady ? "active" : "waiting",
        },
        {
          label: "칩 설정",
          value: `시작 칩 ${startChipCount}`,
          detail: `턴 ${turnTimeSeconds}초 · 카드 선택 전 확인`,
          icon: "coin",
          tone: "active",
        },
      ],
      ruleHint: "노땡스는 최소 인원과 게스트 준비가 맞으면 방장이 시작합니다. 시작 후 카드, 칩, 점수 계산은 기존 서버 상태를 그대로 따릅니다.",
    };
  }, [effectiveStartBotCount, hostMemberId, isHost, players, readyMemberIds, roomStatusNormalized, selectedRoom]);
  const canStart = Boolean(startReadiness?.canStart);
  const startStatusText = startReadiness?.statusText || "시작 대기";
  const winnerNickname = winnerMemberId ? players.find((player) => playerIdOf(player) === winnerMemberId)?.nickname || `플레이어 ${winnerMemberId}` : null;
  const sortedPlayers = [...players].sort((a, b) => {
    const aScore = a?.score ?? Number.MAX_SAFE_INTEGER;
    const bScore = b?.score ?? Number.MAX_SAFE_INTEGER;
    if (aScore !== bScore) return aScore - bScore;
    return parseIntSafe(b?.chips, 0) - parseIntSafe(a?.chips, 0);
  });
  const visiblePotChipCount = Math.min(potChips, 30);
  const potChipStack = Array.from({ length: visiblePotChipCount }, (_, index) => ({
    id: `stack-${index}`,
    offsetX: (index % 6) * 36,
    offsetY: Math.floor(index / 6) * 36,
    rotate: 0,
  }));
  const selectedRoomId = roomIdOf(selectedRoom);
  const actionFeedbackTone = actionFeedback.status === "error"
    ? "error"
    : actionFeedback.status === "pending"
      ? "pending"
      : actionFeedback.status === "done"
        ? "done"
        : "idle";
  const actionFeedbackItems = useMemo(() => {
    const statusLabel = roomStatus ? noThanksRoomStatusLabel(roomStatus) : "대기";
    const turnText = roomStatus === "FINISHED"
      ? "게임 종료"
      : isMyTurn
        ? "내 차례"
        : turnMemberId
          ? `${noThanksPlayerName(players, turnMemberId)} 차례`
          : "차례 대기";
    const scoreBasis = currentCard
      ? `노출 카드 ${currentCard}, 칩 보상 ${potChips}개`
      : `덱 ${deckRemaining}장, 칩 보상 ${potChips}개`;
    return [
      {
        label: "전송 상태",
        value: noThanksFeedbackStatusLabel(actionFeedback.status),
        detail: actionFeedback.label,
        icon: actionFeedback.status === "error" ? "recent" : "signal",
        tone: actionFeedbackTone,
      },
      {
        label: "최근 행동",
        value: actionFeedback.message,
        detail: actionFeedback.detail,
        icon: "decision",
        tone: actionFeedback.status === "error" ? "error" : actionFeedback.status === "done" ? "done" : "neutral",
      },
      {
        label: "차례",
        value: turnText,
        detail: statusLabel,
        icon: "turn",
        tone: isMyTurn ? "done" : "neutral",
      },
      {
        label: "점수 근거",
        value: actionFeedback.status === "done" ? "실시간 갱신 대기" : actionFeedback.status === "error" ? "재시도 필요" : "상태 확인",
        detail: scoreBasis,
        icon: "score",
        tone: actionFeedback.status === "error" ? "error" : actionFeedback.status === "pending" ? "pending" : "neutral",
      },
    ];
  }, [actionFeedback, actionFeedbackTone, currentCard, deckRemaining, isMyTurn, players, potChips, roomStatus, turnMemberId]);

  useGameSound({ myTurn: roomStatus === "PLAYING" && isMyTurn });

  const normalizeCreateField = (field, min, max, fallback) => {
    setCreateForm((prev) => ({ ...prev, [field]: clampNumberText(prev[field], min, max, fallback) }));
  };

  const normalizeSettingsField = (field, min, max, fallback) => {
    setSettingsForm((prev) => ({ ...prev, [field]: clampNumberText(prev[field], min, max, fallback) }));
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  };

  const playActionSound = (actionType) => {
    const context = getAudioContext();
    if (!context || isActionSoundPlayingRef.current) return;
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const master = context.createGain();
    const primary = context.createOscillator();
    const accent = context.createOscillator();
    const gain = context.createGain();

    try {
      isActionSoundPlayingRef.current = true;
      if (actionType === "TAKE") {
        master.gain.setValueAtTime(0.20 * NO_THANKS_SOUND_VOLUME_MULTIPLIER, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.36, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        primary.type = "triangle";
        primary.frequency.setValueAtTime(880, now);
        primary.frequency.exponentialRampToValueAtTime(660, now + 0.12);

        accent.type = "sine";
        accent.frequency.setValueAtTime(1320, now);
        accent.frequency.exponentialRampToValueAtTime(990, now + 0.08);
      } else {
        master.gain.setValueAtTime(0.14 * NO_THANKS_SOUND_VOLUME_MULTIPLIER, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.24, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        primary.type = "square";
        primary.frequency.setValueAtTime(620, now);
        primary.frequency.exponentialRampToValueAtTime(420, now + 0.09);

        accent.type = "triangle";
        accent.frequency.setValueAtTime(930, now);
        accent.frequency.exponentialRampToValueAtTime(700, now + 0.06);
      }

      primary.connect(gain);
      accent.connect(gain);
      gain.connect(master);
      master.connect(context.destination);

      primary.start(now);
      accent.start(now);
      primary.stop(now + (actionType === "TAKE" ? 0.12 : 0.09));
      accent.stop(now + (actionType === "TAKE" ? 0.08 : 0.06));

      window.setTimeout(() => {
        isActionSoundPlayingRef.current = false;
      }, actionType === "TAKE" ? 140 : 110);
    } catch {
      isActionSoundPlayingRef.current = false;
    }
  };

  const ensureSocket = async () => {
    if (stompRef.current) return stompRef.current;
    if (stompInitRef.current) return stompInitRef.current;
    const connectHeaders = buildStompConnectHeaders();
    if (!connectHeaders.Authorization) return null;
    stompInitRef.current = createStompClient({
      endpoint: "/ws/chat",
      connectHeaders,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    }).then((client) => {
      if (!mountedRef.current) return null;
      client.onStompError = (frame) => {
        void notifyRealtimeError({
          scope: "no-thanks-game",
          error: frame,
          fallbackMessage: "게임 실시간 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
      };
      client.beforeConnect = () => {
        client.connectHeaders = buildStompConnectHeaders();
      };
      client.onConnect = () => {
        bindLatestRealtimeRoom(client);
      };
      client.activate();
      stompRef.current = client;
      return client;
    }).finally(() => {
      stompInitRef.current = null;
    });
    return stompInitRef.current;
  };

  const fetchRooms = async () => {
    setRooms(await noThanksGameAdapter.fetchRooms());
  };

  const fetchState = async (roomId) => {
    const snapshot = await noThanksGameAdapter.fetchRoomState(roomId);
    setGameState(snapshot);
    return snapshot;
  };

  const fetchMyRooms = async () => {
    return noThanksGameAdapter.fetchMyActiveRooms();
  };

  const refreshSelectedRoom = async (roomId) => {
    const myRooms = await fetchMyRooms();
    const matched = myRooms.find((room) => Number(roomIdOf(room)) === Number(roomId)) || null;
    if (matched) setSelectedRoom(matched);
    return matched;
  };

  const fetchChatMessages = async (roomId) => {
    try {
      setChatMessages(await chatAdapter.fetchRoomMessages(roomId));
    } catch {
      setChatMessages([]);
    }
  };

  const markChatRoomAsRead = async (roomId) => {
    if (!roomId) return;
    const now = Date.now();
    if (now - lastReadMarkAtRef.current < 1000) return;
    lastReadMarkAtRef.current = now;
    await chatAdapter.markRoomRead(roomId);
    window.dispatchEvent(new CustomEvent(CHAT_ROOM_READ_EVENT, { detail: { roomId: String(roomId) } }));
  };

  const subscribeGameRoom = (client, roomId) => {
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    gameSubRef.current = client.subscribe(`/sub/game/no-thanks/room/${roomId}`, (message) => {
      let payload;
      try {
        payload = JSON.parse(message.body || "{}");
      } catch {
        fetchState(roomId).catch(() => {});
        return;
      }
      setGameState(normalizeNoThanksState(payload));
      refreshSelectedRoom(roomId).catch(() => {});
    });
  };

  const subscribeChatRoom = () => {};

  const bindRealtimeRoom = (client, roomId, targetChatRoomId) => {
    if (!client?.connected || !roomId) return;
    subscribeGameRoom(client, roomId);
  };

  const bindLatestRealtimeRoom = (client) => {
    const target = realtimeRoomRef.current;
    if (!target) return;
    bindRealtimeRoom(client, target.roomId, target.chatRoomId);
  };

  const openRoom = async (room) => {
    setSelectedRoom(room);
    const roomId = roomIdOf(room);
    if (!roomId) return;
    rememberResumeRoom(room);

    const snapshot = await fetchState(roomId);
    const snapshotChatRoomId = null;
    setChatMessages([]);
    realtimeRoomRef.current = { roomId, chatRoomId: snapshotChatRoomId };
    const client = await ensureSocket();
    if (client?.connected) {
      bindRealtimeRoom(client, roomId, snapshotChatRoomId);
    }
  };

  useEffect(() => {
    fetchRooms().catch(() => notifyError("방 목록을 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const myRooms = await fetchMyRooms();
        const storedId = Number(localStorage.getItem(ROOM_STORAGE_KEY) || 0);
        const room = myRooms.find((item) => Number(roomIdOf(item)) === storedId) || myRooms[0];
        if (room) {
          await openRoom(room);
        } else {
          clearResumeRoom();
        }
      } catch {
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;
    setSettingsForm({
      startChipCount: String(selectedRoom.startChipCount || 11),
      turnTimeSeconds: String(selectedRoom.turnTimeSeconds || 15),
    });
  }, [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) {
      setStartBotCount(0);
      return;
    }
    const humanCount = Array.isArray(selectedRoom.players) ? selectedRoom.players.length : 0;
    const minPlayers = parseIntSafe(selectedRoom.minPlayers, 2);
    const maxPlayers = parseIntSafe(selectedRoom.maxPlayers, 6);
    const openSeats = Math.max(0, maxPlayers - humanCount);
    const defaultBots = humanCount === 1 && minPlayers > 1 ? Math.max(0, minPlayers - humanCount) : 0;
    setStartBotCount(Math.min(defaultBots, openSeats));
  }, [selectedRoom]);

  useEffect(() => {
    setActionFeedback(initialNoThanksActionFeedback());
  }, [selectedRoomId]);

  useEffect(() => {
    if (!gameState?.turnDeadlineAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const ms = new Date(gameState.turnDeadlineAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [gameState?.turnDeadlineAt]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!chatRoomId || !selectedRoom) return;
    markChatRoomAsRead(chatRoomId).catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markChatRoomAsRead(chatRoomId).catch(() => {});
      }
    };
    const onFocus = () => markChatRoomAsRead(chatRoomId).catch(() => {});

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [chatRoomId, selectedRoom]);

  useEffect(() => {
    const previous = previousPotChipsRef.current;
    if (potChips > previous) {
      const additions = Math.min(potChips - previous, 3);
      const nextAnimations = Array.from({ length: additions }, (_, index) => {
        chipAnimationIdRef.current += 1;
        const targetIndex = Math.min(previous + index, 29);
        return {
          id: chipAnimationIdRef.current,
          delay: index * 90,
          rotate: 0,
          targetX: (targetIndex % 6) * 36,
          targetY: Math.floor(targetIndex / 6) * 36,
        };
      });
      setChipAnimations(nextAnimations);
      const timer = window.setTimeout(() => setChipAnimations([]), 720);
      previousPotChipsRef.current = potChips;
      return () => window.clearTimeout(timer);
    }
    if (potChips === 0 && previous !== 0) {
      setChipAnimations([]);
    }
    previousPotChipsRef.current = potChips;
  }, [potChips]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (chatSubRef.current) chatSubRef.current.unsubscribe();
      if (stompRef.current) stompRef.current.deactivate();
      realtimeRoomRef.current = null;
      stompInitRef.current = null;
    };
  }, []);

  const createRoom = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? createForm.title ?? "");
    const startChipCount = parseIntSafe(formData.get("startChipCount") || createForm.startChipCount, 11);
    const turnTimeSeconds = parseIntSafe(formData.get("turnTimeSeconds") || createForm.turnTimeSeconds, 15);
    try {
      const room = await noThanksGameAdapter.createRoom({
        title,
        startChipCount,
        turnTimeSeconds,
      });
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 생성 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 생성 실패"));
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const room = await noThanksGameAdapter.joinRoom(roomId);
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 입장 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 입장 실패"));
    }
  };

  const joinByCode = async (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      notifyError("방 코드를 입력해주세요.");
      return;
    }
    try {
      const room = await noThanksGameAdapter.joinByCode(code);
      setJoinCode("");
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 코드로 입장했습니다.");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 코드 입장 실패"));
    }
  };

  const saveSettings = async () => {
    if (!selectedRoom) return;
    try {
      const room = await noThanksGameAdapter.updateSettings(roomIdOf(selectedRoom), {
        startChipCount: parseIntSafe(settingsForm.startChipCount, 11),
        turnTimeSeconds: parseIntSafe(settingsForm.turnTimeSeconds, 15),
      });
      setSelectedRoom(room);
      await fetchRooms();
      notifySuccess("방 설정 저장 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 설정 저장 실패"));
    }
  };

  const toggleReady = async () => {
    if (!selectedRoom) return;
    try {
      await noThanksGameAdapter.toggleReady(roomIdOf(selectedRoom));
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "준비 상태 변경 실패"));
    }
  };

  const startGame = async () => {
    if (!selectedRoom) return;
    if (!canStart) {
      notifyError(startStatusText);
      return;
    }
    try {
      const roomId = roomIdOf(selectedRoom);
      await noThanksGameAdapter.startGame(
        roomId,
        effectiveStartBotCount > 0 ? { botCount: effectiveStartBotCount } : undefined
      );
      await fetchState(roomId);
      await fetchRooms();
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "게임 시작 실패"));
    }
  };

  const refreshSelectedSession = async () => {
    if (!selectedRoom) return;
    const roomId = roomIdOf(selectedRoom);
    try {
      await fetchState(roomId);
      await refreshSelectedRoom(roomId);
      await fetchRooms();
      notifySuccess("종료 세션 상태를 새로고침했습니다.");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "종료 세션 상태를 새로고침하지 못했습니다."));
    }
  };

  const rematchGame = async () => {
    if (!selectedRoom) return;
    setRematching(true);
    try {
      const room = await noThanksGameAdapter.rematch(roomIdOf(selectedRoom));
      setSelectedRoom(room);
      await fetchRooms();
      notifySuccess("방이 다시 열렸습니다.");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 다시 열기 실패"));
    } finally {
      setRematching(false);
    }
  };

  const forceFinishGame = async () => {
    if (!selectedRoom) return;
    const confirmed = await confirmAction({
      title: "진행 중인 게임을 종료할까요?",
      description: "현재 판을 종료하고 대기방으로 돌아갑니다.",
      confirmText: "종료",
    });
    if (!confirmed) return;
    try {
      const room = await noThanksGameAdapter.forceFinish(roomIdOf(selectedRoom));
      setSelectedRoom(room);
      await fetchRooms();
      notifySuccess("게임 종료 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "게임 종료 실패"));
    }
  };

  const leaveRoom = async () => {
    if (!selectedRoom) return;
    try {
      await noThanksGameAdapter.leaveRoom(roomIdOf(selectedRoom));
      setSelectedRoom(null);
      setGameState(null);
      setChatMessages([]);
      clearResumeRoom(roomIdOf(selectedRoom));
      realtimeRoomRef.current = null;
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (chatSubRef.current) chatSubRef.current.unsubscribe();
      await fetchRooms();
      notifySuccess("방 퇴장 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 퇴장 실패"));
    }
  };

  const publishAction = async (actionType) => {
    if (!selectedRoom) return;
    const actionLabel = noThanksActionLabel(actionType);
    setActionFeedback({
      status: "pending",
      label: actionLabel,
      message: `${actionLabel} 전송 중`,
      detail: "실시간 연결을 확인하고 게임 서버로 선택을 보내는 중입니다.",
    });
    const client = await ensureSocket();
    if (!client?.connected) {
      notifyError("실시간 연결이 아직 준비되지 않았습니다.");
      setActionFeedback({
        status: "error",
        label: actionLabel,
        message: `${actionLabel} 실패`,
        detail: "실시간 연결이 준비되지 않았습니다. 잠시 후 다시 시도하세요.",
      });
      return;
    }
    playActionSound(actionType);
    try {
      client.publish({
        destination: `/pub/game/no-thanks/${roomIdOf(selectedRoom)}/action`,
        body: JSON.stringify(buildNoThanksActionPayload({ actionType })),
      });
      setActionFeedback({
        status: "done",
        label: actionLabel,
        message: `${actionLabel} 전송 완료`,
        detail: "서버가 실시간 상태를 다시 보내면 카드, 칩, 점수 패널에 반영됩니다.",
      });
    } catch {
      notifyError("행동 전송에 실패했습니다.");
      setActionFeedback({
        status: "error",
        label: actionLabel,
        message: `${actionLabel} 실패`,
        detail: "전송 중 오류가 발생했습니다. 연결 상태를 확인하고 다시 시도하세요.",
      });
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !gameChatRoomId || !myMemberId) return;
    const client = await ensureSocket();
    if (!client?.connected) {
      notifyError("채팅 연결이 아직 준비되지 않았습니다.");
      return;
    }
    const message = chatInput.trim();
    client.publish({
      destination: `/pub/game/no-thanks/room/${gameChatRoomId}/chat`,
      body: JSON.stringify({ message, type: "TALK" }),
      headers: { "content-type": "application/json" },
    });
    setChatInput("");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <style>{`
        @keyframes no-thanks-chip-drop {
          0% { transform: translate(68px, -70px) scale(0.7) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--chip-x), var(--chip-y)) scale(1) rotate(var(--chip-rotate)); opacity: 1; }
        }
      `}</style>
      {!selectedRoom && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              <Play className="h-3.5 w-3.5 text-emerald-500" />
              노땡스
            </div>
            <Link to="/app/games" className="hidden min-h-10 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
              게임 목록
            </Link>
          </div>
          <div className="mt-4" data-smoke="no-thanks-route-artwork">
            <TabletopGameArtwork type="cards" compact className="h-32 w-full" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">노땡스</h1>
          </div>
        </section>
      )}

      {!selectedRoom && (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={createRoom} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="text-lg font-black text-slate-900">방 만들기</div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="block text-[11px] font-black text-ink-muted">방 제목</span>
                <input name="title" className="w-full rounded-xl border border-line bg-control px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-subtle focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus/20" placeholder="방 제목" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">시작 칩</span>
                  <input name="startChipCount" type="text" inputMode="numeric" className="w-full rounded-xl border border-line bg-control px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-subtle focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus/20" placeholder="개수" value={createForm.startChipCount} onChange={(e) => setCreateForm((prev) => ({ ...prev, startChipCount: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeCreateField("startChipCount", 5, 20, 11)} />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">턴 제한</span>
                  <input name="turnTimeSeconds" type="text" inputMode="numeric" className="w-full rounded-xl border border-line bg-control px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-subtle focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus/20" placeholder="초 단위" value={createForm.turnTimeSeconds} onChange={(e) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeCreateField("turnTimeSeconds", 5, 60, 15)} />
                </label>
              </div>
              <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">노땡스 방 만들기</button>
            </div>
          </form>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-slate-900">대기 중인 방</div>
              <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={() => fetchRooms().catch(() => {})}>새로고침</button>
            </div>
            <NoThanksJoinCodePanel
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              joinByCode={joinByCode}
            />
            <div className="mt-4 space-y-2.5">
              {!rooms.length && (
                <NoThanksLobbyEmptyState loading={false} onRefresh={() => fetchRooms().catch(() => {})} />
              )}
              {rooms.map((room) => {
                const roomId = roomIdOf(room);
                const players = noThanksLobbyPlayers(room);
                const playersCount = parseIntSafe(room.memberCount, players.length);
                const maxPlayers = parseIntSafe(room.maxPlayers, 6);
                const minPlayers = parseIntSafe(room.minPlayers, 2);
                const status = String(room.roomStatus || "WAITING").toUpperCase();
                const roomFull = maxPlayers > 0 && playersCount >= maxPlayers;
                const joinable = status === "WAITING" && !roomFull;
                const joinDisabled = !joinable;
                const readiness = noThanksLobbyRoomReadiness(room);
                const hostPlayer = players.find((player) => playerIdOf(player) === Number(room.hostMemberId || 0));
                return (
                  <div
                    key={roomId}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    data-smoke="no-thanks-lobby-room-card"
                    data-room-status={status}
                    data-joinable={joinable ? "true" : "false"}
                    data-member-count={playersCount}
                    data-max-players={maxPlayers || ""}
                  >
                    <div className="grid gap-3 lg:grid-cols-[132px_minmax(0,1fr)_132px] lg:items-center">
                      <NoThanksLobbyRoomCardArt
                        status={status}
                        playersCount={playersCount}
                        minPlayers={minPlayers}
                        maxPlayers={maxPlayers}
                        startChipCount={room.startChipCount}
                        turnTimeSeconds={room.turnTimeSeconds}
                        readiness={readiness}
                        joinable={joinable}
                        roomFull={roomFull}
                        className="h-24 w-full"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="break-words text-sm font-black text-slate-900">{room.title}</div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${noThanksRoomStatusTone(status)}`}>
                            {noThanksRoomStatusLabel(status)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-black">
                          <span className={`rounded-full px-2 py-1 ${roomFull ? "bg-rose-50 text-rose-700" : "bg-white text-slate-600"}`}>
                            {playersCount}/{maxPlayers || "-"}명{roomFull ? " · 가득 참" : ""}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">최소 {minPlayers || "-"}명</span>
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">코드 {room.roomCode}</span>
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">시작 칩 {parseIntSafe(room.startChipCount, 11)}</span>
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">턴 {parseIntSafe(room.turnTimeSeconds, 15)}초</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                          <span>방장 {hostPlayer?.nickname || "-"}</span>
                          <span>칩 관리 카드 게임</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={joinDisabled}
                        onClick={() => joinRoom(roomId)}
                        aria-label={`${room.title} ${playersCount}/${maxPlayers || "-"}명 ${roomFull ? "가득 참" : status !== "WAITING" ? "진행 중" : "입장"}`}
                        title={`${room.title} · ${playersCount}/${maxPlayers || "-"}명 · 시작 칩 ${parseIntSafe(room.startChipCount, 11)}`}
                        data-smoke="no-thanks-lobby-room-primary"
                      >
                        {roomFull ? "가득 참" : status !== "WAITING" ? "진행 중" : "입장"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {selectedRoom && (
        <section className="space-y-4">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-black text-slate-900">{selectedRoom.title}</div>
                </div>
                <div className="text-xs text-slate-500">방 코드 {selectedRoom.roomCode}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/app/games" className="hidden rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
                  게임 목록
                </Link>
                {isHost && roomStatusNormalized === "PLAYING" && <button className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700" onClick={forceFinishGame}>강제 종료</button>}
                {roomStatusNormalized === "WAITING" && !isHost && (
                  <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={toggleReady}>
                    <span className="sr-only">준비 토글</span>
                    {readyMemberIds.has(myMemberId) ? "준비 취소" : "준비하기"}
                  </button>
                )}
                {isHost && roomStatusNormalized === "WAITING" && (
                  <button
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={startGame}
                    disabled={!canStart}
                    aria-label={canStart ? `${selectedRoom.title} ${startReadiness?.startUsesBots ? "AI와 시작" : "게임 시작"}` : `${selectedRoom.title} 시작 대기: ${startStatusText}`}
                    title={canStart ? (startReadiness?.startUsesBots ? "AI와 시작" : "게임 시작") : startStatusText}
                  >
                    {canStart ? (startReadiness?.startUsesBots ? "AI와 시작" : "시작") : "시작 대기"}
                  </button>
                )}
                <button className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600" onClick={leaveRoom}>퇴장</button>
              </div>
            </div>

            {isHost && roomStatusNormalized === "FINISHED" && (
              <div className="mt-3 flex justify-end">
                <button className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white" onClick={rematchGame}>한 판 더 하기</button>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">방장</div><div className="text-slate-500">{hostNickname}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">인원</div><div className="text-slate-500">{players.length}/{parseIntSafe(selectedRoom.maxPlayers, 6)}명</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">상태</div><div className="text-slate-500">{noThanksRoomStatusLabel(roomStatus)}</div></div>
            </div>

            {isHost && roomStatusNormalized === "WAITING" && (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-line bg-control p-3 md:grid-cols-4">
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">추가 AI</span>
                  <select
                    className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-focus/20"
                    value={effectiveStartBotCount}
                    onChange={(event) => setStartBotCount(parseIntSafe(event.target.value, 0))}
                    aria-label="추가 AI 수"
                    title="추가 AI 수"
                  >
                    {startBotOptions.map((count) => (
                      <option key={count} value={count}>AI {count}명</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">시작 칩</span>
                  <input type="text" inputMode="numeric" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-focus/20" value={settingsForm.startChipCount} onChange={(e) => setSettingsForm((prev) => ({ ...prev, startChipCount: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeSettingsField("startChipCount", 5, 20, 11)} />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">턴 제한</span>
                  <input type="text" inputMode="numeric" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-focus/20" value={settingsForm.turnTimeSeconds} onChange={(e) => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeSettingsField("turnTimeSeconds", 5, 60, 15)} />
                </label>
                <button className="min-h-11 self-end rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white" onClick={saveSettings}>설정 저장</button>
              </div>
            )}
          </div>

          {roomStatusNormalized === "WAITING" ? (
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
              <GameRoomPlayersPanel
                players={players}
                selectedRoom={selectedRoom}
                roomStatus={roomStatus}
                myMemberId={myMemberId}
                hostMemberId={hostMemberId}
                maxPlayers={parseIntSafe(selectedRoom.maxPlayers, 6)}
                getMemberId={playerIdOf}
                getReady={(player) => readyMemberIds.has(playerIdOf(player)) || isReadyPlayer(player)}
                dataSmoke="no-thanks-player-roster"
              />

              <GameRoomChatPanel
                gameCode="no-thanks"
                roomId={gameChatRoomId}
                resetKey={roomStatusNormalized}
                title="방 채팅"
              />
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <div className="space-y-4">
              <div className={`rounded-[1.8rem] border p-5 shadow-xl ${isMyTurn ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-700">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">카드 {currentCard ?? "-"}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">칩 더미 {potChips}</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">남은 덱 {deckRemaining}</span>
                  {isMyTurn && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">내 차례</span>}
                  {secondsLeft !== null && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${secondsLeft <= 5 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-700"}`}><TimerReset className="h-3.5 w-3.5" />{secondsLeft}초</span>}
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(360px,520px)_minmax(300px,360px)] lg:justify-center">
                  <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
                          현재 카드
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-300">{currentCard ? `${currentCard}점 카드 공개` : "공개 카드 대기"}</div>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-amber-100">
                        <NoThanksChipToken className="h-5 w-5" label="팟 칩" />
                        팟 {potChips}
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-[150px_228px] sm:items-center sm:justify-center">
                      <NoThanksCardFace value={currentCard} className="mx-auto h-[198px] w-[150px] max-w-full" />
                      <div className="relative mx-auto h-[196px] w-[228px] max-w-full">
                        {!potChipStack.length && (
                          <NoThanksChipToken className="absolute left-[84px] top-[72px] h-[54px] w-[54px] opacity-45" label="빈 팟 칩 자리" />
                        )}
                        {potChipStack.map((chip) => (
                          <NoThanksChipToken
                            key={chip.id}
                            className="absolute left-0 top-0 h-[48px] w-[48px] drop-shadow-[0_8px_18px_rgba(251,191,36,0.32)]"
                            style={{
                              transform: `translate(${chip.offsetX}px, ${chip.offsetY}px) rotate(${chip.rotate}deg)`,
                              zIndex: chip.offsetY + 1,
                            }}
                            label="팟에 쌓인 칩"
                          />
                        ))}
                        {chipAnimations.map((chip) => (
                          <NoThanksChipToken
                            key={chip.id}
                            className="absolute left-0 top-0 h-[48px] w-[48px] drop-shadow-[0_8px_18px_rgba(251,191,36,0.32)]"
                            style={{
                              "--chip-x": `${chip.targetX}px`,
                              "--chip-y": `${chip.targetY}px`,
                              "--chip-rotate": `${chip.rotate}deg`,
                              animation: `no-thanks-chip-drop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) ${chip.delay}ms forwards`,
                            }}
                            label="팟으로 이동하는 칩"
                          />
                        ))}
                      </div>
                    </div>
                    {!currentCard && roomStatus !== "FINISHED" && (
                      <NoThanksCardStandbyPanel
                        roomStatus={roomStatus}
                        isMyTurn={isMyTurn}
                        turnName={turnMemberId ? noThanksPlayerName(players, turnMemberId) : null}
                        potChips={potChips}
                        deckRemaining={deckRemaining}
                        myChips={myChips}
                        myCards={myPlayer?.cards}
                      />
                    )}
                  </div>
                  <div className="space-y-4 lg:self-start">
                    <NoThanksActionAvailabilityPanel
                      roomStatus={roomStatus}
                      isMyTurn={isMyTurn}
                      myChips={myChips}
                      currentCard={currentCard}
                      potChips={potChips}
                      myCards={myPlayer?.cards}
                      onTake={() => publishAction("TAKE")}
                      onPass={() => publishAction("PASS")}
                    />
                  </div>
                </div>
              </div>

              {!!sortedPlayers.length && (
                <div className="grid gap-3 md:grid-cols-2">
                  {sortedPlayers.map((player, index) => {
                    const memberId = playerIdOf(player);
                    return (
                      <NoThanksPlayerStateCard
                        key={memberId || `no-thanks-player-${index}`}
                        player={player}
                        isCurrent={memberId > 0 && memberId === Number(turnMemberId || 0)}
                        isWinner={memberId > 0 && memberId === Number(winnerMemberId || 0)}
                        isMe={memberId > 0 && memberId === Number(myMemberId || 0)}
                      />
                    );
                  })}
                </div>
              )}

              <GameRoomPlayersPanel
                players={players}
                selectedRoom={selectedRoom}
                roomStatus={roomStatus}
                myMemberId={myMemberId}
                hostMemberId={hostMemberId}
                maxPlayers={parseIntSafe(selectedRoom.maxPlayers, 6)}
                getMemberId={playerIdOf}
                getReady={(player) => readyMemberIds.has(playerIdOf(player)) || isReadyPlayer(player)}
                currentMemberId={turnMemberId}
                winnerMemberId={winnerMemberId}
                getDetail={(player, { seatNo, isHost, waiting }) => {
                  if (waiting) return `좌석 ${seatNo || "-"}${isHost ? " · 방장" : ""}`;
                  const cards = Array.isArray(player?.cards) ? player.cards : [];
                  const chips = parseIntSafe(player?.chips, 0);
                  const score = Number.isFinite(Number(player?.score)) ? Number(player.score) : scoreNoThanksCards(cards) - chips;
                  return `좌석 ${seatNo || "-"}${isHost ? " · 방장" : ""} · 점수 ${Number.isFinite(score) ? score : "-"} · 칩 ${chips} · 카드 ${cards.length}`;
                }}
                dataSmoke="no-thanks-player-roster"
              />
            </div>

            <GameRoomChatPanel
              gameCode="no-thanks"
              roomId={gameChatRoomId}
              resetKey={roomStatusNormalized}
              title="방 채팅"
            />
          </div>
          )}
        </section>
      )}
    </div>
  );
};

export default NoThanksGame;

