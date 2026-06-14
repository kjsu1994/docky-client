import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { notify, notifyError, notifySuccess } from "../../utils/toast.js";
import { Crown, Dices, MessageSquare, Play, RefreshCw, TimerReset, Users } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { CasinoEmptyLaneArt, CasinoTableSign, DiceCountBadge, DiceFace, MoneyCard } from "../../common/LasVegasVisuals.jsx";
import { confirmAction } from "../../common/confirmAction.jsx";
import GameRoomChatPanel from "../../common/GameRoomChatPanel.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { clearPageGuideContext, setPageGuideContext } from "../../common/pageGuideContext.js";
import { buildTalkPayload, chatAdapter, compareMessagesByChronology, getMemberId, normalizeMessage } from "../../adapters/chatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import { GameActionCueBar, GameChatEmptyState, GameFlowMeter, GameResultSpotlight, GameUxGlyph } from "./GameUxAssets.jsx";
import { TabletopGameArtwork } from "./TabletopGameArtwork.jsx";
import {
    buildLasVegasActionPayload,
    getLasVegasChatRoomId,
    getLasVegasPlayerId,
    getLasVegasRoomId,
    isLasVegasReadyPlayer,
    lasVegasGameAdapter,
    normalizeLasVegasState,
} from "../../adapters/lasVegasGameAdapter.js";

const ROOM_STORAGE_KEY = "las_vegas_last_room_id";
const ROOM_TITLE_STORAGE_KEY = "las_vegas_last_room_title";
const CHAT_ROOM_READ_EVENT = "chat-room-read";
const LAS_VEGAS_SOUND_VOLUME_MULTIPLIER = 16;

const initialLasVegasActionFeedback = () => ({
    status: "idle",
    label: "전송 대기",
    message: "행동 전송 대기",
    detail: "주사위를 굴리거나 카지노를 선택하면 전송 상태가 표시됩니다.",
});
const lasVegasActionLabel = (actionType, casinoNo = null) => (
    actionType === "ROLL_DICE" ? "주사위 굴리기" : `카지노 ${casinoNo || "-"} 배팅`
);
const lasVegasFeedbackStatusLabel = (status) => ({
    idle: "대기",
    pending: "전송 중",
    done: "전송 완료",
    error: "전송 실패",
}[status] || "대기");

const normalizeRoomId = getLasVegasRoomId;
const normalizeChatRoomId = getLasVegasChatRoomId;
const rememberResumeRoom = (room) => {
    const roomId = normalizeRoomId(room);
    if (!roomId) return;
    localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));
    localStorage.setItem(ROOM_TITLE_STORAGE_KEY, String(room?.title || "라스베가스 최근 방"));
};
const clearResumeRoom = (roomId) => {
    const storedId = localStorage.getItem(ROOM_STORAGE_KEY);
    if (!roomId || storedId === String(roomId)) {
        localStorage.removeItem(ROOM_STORAGE_KEY);
        localStorage.removeItem(ROOM_TITLE_STORAGE_KEY);
    }
};
const isReadyPlayer = isLasVegasReadyPlayer;
const extractReadyMemberIds = (players) =>
    new Set(
        (Array.isArray(players) ? players : [])
            .filter((player) => isReadyPlayer(player))
            .map((player) => Number(getLasVegasPlayerId(player)))
            .filter((memberId) => Number.isFinite(memberId) && memberId > 0)
    );
const formatWon = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;
const toPlainInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeNumericText = (raw, min, max) => {
    const digitsOnly = String(raw ?? "").replace(/[^\d]/g, "");
    if (!digitsOnly) return "";
    const normalized = digitsOnly.replace(/^0+(\d)/, "$1");
    const numeric = toPlainInt(normalized, min);
    const clamped = Math.min(max, Math.max(min, numeric));
    return String(clamped);
};

const lasVegasLobbyPlayers = (room) => (Array.isArray(room?.players) ? room.players : []);
const lasVegasRoomStatusLabel = (status) => {
    const normalized = String(status || "WAITING").toUpperCase();
    if (normalized === "PLAYING") return "진행 중";
    if (normalized === "FINISHED") return "종료";
    if (normalized === "CANCELLED") return "취소";
    return "대기";
};
const lasVegasRoomStatusTone = (status) => {
    const normalized = String(status || "WAITING").toUpperCase();
    if (normalized === "PLAYING") return "bg-emerald-100 text-emerald-700";
    if (normalized === "FINISHED" || normalized === "CANCELLED") return "bg-slate-200 text-slate-600";
    return "bg-amber-100 text-amber-700";
};
const lasVegasLobbyRoomReadiness = (room) => {
    const status = String(room?.roomStatus || "WAITING").toUpperCase();
    const players = lasVegasLobbyPlayers(room);
    const hostMemberId = Number(room?.hostMemberId || 0);
    const guests = players.filter((player) => Number(getLasVegasPlayerId(player) || 0) !== hostMemberId);
    const readyGuests = guests.filter(isReadyPlayer).length;
    const minPlayers = toPlainInt(room?.minPlayers, 2);
    const maxPlayers = toPlainInt(room?.maxPlayers, 6);
    if (status !== "WAITING") {
        return {
            done: status === "PLAYING",
            value: lasVegasRoomStatusLabel(status),
            detail: status === "PLAYING" ? "이미 수익 경쟁이 시작된 테이블입니다." : "종료된 방은 새 테이블을 만드는 편이 좋습니다.",
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
            detail: maxPlayers > 1 ? "추가 인원을 기다리거나 바로 시작할 수 있습니다." : "혼자 진행 가능한 테이블입니다.",
        };
    }
    return {
        done: readyGuests === guests.length,
        value: `게스트 준비 ${readyGuests}/${guests.length}`,
        detail: readyGuests === guests.length ? "준비 조건을 만족했습니다." : "아직 준비하지 않은 게스트가 있습니다.",
    };
};
const lasVegasLobbyRoomActionSignal = (room) => {
    const status = String(room?.roomStatus || "WAITING").toUpperCase();
    const players = lasVegasLobbyPlayers(room);
    const maxPlayers = toPlainInt(room?.maxPlayers, 6);
    const minPlayers = toPlainInt(room?.minPlayers, 2);
    const full = maxPlayers > 0 && players.length >= maxPlayers;
    if (status !== "WAITING") {
        return { value: status === "PLAYING" ? "진행 중" : "종료됨", detail: "입장 대신 다른 대기 테이블을 고르거나 새 방을 만드세요." };
    }
    if (full) {
        return { value: "정원 마감", detail: "빈 좌석이 생기기 전까지 입장할 수 없습니다." };
    }
    if (players.length < minPlayers) {
        return { value: "합류 추천", detail: "입장하면 라운드 시작 조건에 가까워집니다." };
    }
    return { value: "입장 가능", detail: "입장 후 준비하면 방장이 라운드를 시작할 수 있습니다." };
};

const lasVegasLobbyRoomDecisionToneClasses = {
    access: "border-amber-200 bg-amber-50 text-amber-950",
    seat: "border-sky-200 bg-sky-50 text-sky-950",
    ready: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rule: "border-indigo-200 bg-indigo-50 text-indigo-950",
    blocked: "border-rose-200 bg-rose-50 text-rose-950",
};

const buildLasVegasLobbyRoomDecisionItems = ({
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
    const safePlayers = Math.max(0, toPlainInt(playersCount, 0));
    const safeMaxPlayers = Math.max(1, toPlainInt(maxPlayers, 6) || 6);
    const safeMinPlayers = Math.max(1, Math.min(safeMaxPlayers, toPlainInt(minPlayers, 2) || 2));
    const openSeats = Math.max(0, safeMaxPlayers - safePlayers);
    const normalizedStatus = String(status || "WAITING").toUpperCase();
    const roundCount = Math.max(1, toPlainInt(room?.roundCount, 4) || 4);
    const turnTimeSeconds = Math.max(5, toPlainInt(room?.turnTimeSeconds, 25) || 25);
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
            value: `${roundCount}라운드 · 턴 ${turnTimeSeconds}초`,
            detail: "라운드 수와 턴 시간을 보고 테이블 호흡을 고르세요.",
            tone: "rule",
            icon: "state",
        },
    ];
};

const LasVegasLobbyRoomDecisionRail = ({ items = [] }) => {
    if (!items.length) {
        return null;
    }

    return (
        <div
            className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
            data-smoke="las-vegas-lobby-room-decision-rail"
            aria-label="라스베가스 방 입장 판단"
        >
            {items.map((item) => (
                <div
                    key={item.key}
                    className={`rounded-xl border px-3 py-2 ${lasVegasLobbyRoomDecisionToneClasses[item.tone] || lasVegasLobbyRoomDecisionToneClasses.access}`}
                    data-smoke="las-vegas-lobby-room-decision-item"
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

const lasVegasLobbyRoomCardStatusTone = (status, joinable) => {
    const normalized = String(status || "WAITING").toUpperCase();
    if (normalized === "PLAYING") {
        return {
            bg: "#ecfeff",
            panel: "#cffafe",
            ink: "#0e7490",
            accent: "#0891b2",
            soft: "#f0f9ff",
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
        bg: "#fffbeb",
        panel: "#fef3c7",
        ink: "#92400e",
        accent: "#f59e0b",
        soft: "#ecfdf5",
        label: "입장",
    };
};

const LasVegasLobbyRoomCardArt = ({
    status,
    playersCount,
    minPlayers,
    maxPlayers,
    roundCount,
    turnTimeSeconds,
    readiness,
    joinable,
    roomFull,
    className = "",
}) => {
    const normalizedStatus = String(status || "WAITING").toUpperCase();
    const safeMaxPlayers = Math.max(1, toPlainInt(maxPlayers, 6) || 6);
    const safePlayers = Math.max(0, toPlainInt(playersCount, 0));
    const visibleSeats = Math.max(1, Math.min(safeMaxPlayers, 6));
    const filledSeats = Math.min(safePlayers, visibleSeats);
    const safeMinPlayers = Math.max(1, Math.min(safeMaxPlayers, toPlainInt(minPlayers, 2) || 2));
    const tone = lasVegasLobbyRoomCardStatusTone(normalizedStatus, joinable && !roomFull);
    const seatPoints = [
        [42, 40],
        [78, 30],
        [118, 40],
        [126, 78],
        [82, 92],
        [38, 78],
    ];
    const statusLabel = roomFull ? "마감" : tone.label;
    const readinessLabel = readiness?.done ? "준비" : "대기";
    const roundLabel = `${Math.max(1, toPlainInt(roundCount, 4) || 4)}R`;
    const timerLabel = `${Math.max(5, toPlainInt(turnTimeSeconds, 25) || 25)}초`;

    return (
        <svg
            viewBox="0 0 150 112"
            role="img"
            aria-label={`라스베가스 방 카드 ${safePlayers}/${safeMaxPlayers}명 ${statusLabel}`}
            className={className}
            data-smoke="las-vegas-lobby-room-card-art"
            data-room-status={normalizedStatus}
            data-joinable={joinable ? "true" : "false"}
        >
            <rect x="1" y="1" width="148" height="110" rx="18" fill={tone.bg} stroke={tone.panel} strokeWidth="2" />
            <g data-smoke="las-vegas-lobby-room-card-node">
                <path d="M28 60C28 43 44 30 70 28C98 26 124 39 127 61C130 83 109 96 76 96C45 96 28 81 28 60Z" fill="#ffffff" stroke={tone.panel} strokeWidth="2" />
                <ellipse cx="74" cy="62" rx="38" ry="25" fill={tone.soft} stroke={tone.accent} strokeWidth="2" />
                <path d="M49 61H99M73 39V86" stroke={tone.panel} strokeWidth="2" strokeLinecap="round" />
            </g>
            {seatPoints.slice(0, visibleSeats).map(([cx, cy], index) => (
                <g key={`${cx}-${cy}`} data-smoke="las-vegas-lobby-room-card-seat">
                    <circle cx={cx} cy={cy} r="8" fill={index < filledSeats ? tone.accent : "#e2e8f0"} />
                    <circle cx={cx} cy={cy} r="3" fill={index < filledSeats ? "#ffffff" : "#94a3b8"} />
                </g>
            ))}
            <g data-smoke="las-vegas-lobby-room-card-node">
                <rect x="12" y="10" width="54" height="24" rx="12" fill="#ffffff" stroke={tone.panel} />
                <text x="39" y="20" textAnchor="middle" fontSize="8" fontWeight="800" fill="#64748b">인원</text>
                <text x="39" y="30" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.ink}>{safePlayers}/{safeMaxPlayers}</text>
            </g>
            <g data-smoke="las-vegas-lobby-room-card-node">
                <rect x="85" y="10" width="42" height="24" rx="12" fill="#ffffff" stroke={tone.panel} />
                <text x="106" y="20" textAnchor="middle" fontSize="8" fontWeight="800" fill="#64748b">{readinessLabel}</text>
                <text x="106" y="30" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.ink}>{statusLabel}</text>
            </g>
            <g data-smoke="las-vegas-lobby-room-card-node">
                <rect x="15" y="82" width="33" height="20" rx="10" fill="#ffffff" stroke={tone.panel} />
                <text x="31.5" y="95" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.ink}>{roundLabel}</text>
                <rect x="102" y="82" width="35" height="20" rx="10" fill="#ffffff" stroke={tone.panel} />
                <text x="119.5" y="95" textAnchor="middle" fontSize="9" fontWeight="900" fill={tone.ink}>{timerLabel}</text>
            </g>
            <g data-smoke="las-vegas-lobby-room-card-node">
                <rect x="56" y="76" width="38" height="22" rx="11" fill={safePlayers >= safeMinPlayers ? "#dcfce7" : "#fef3c7"} stroke={safePlayers >= safeMinPlayers ? "#86efac" : "#fcd34d"} />
                <text x="75" y="90" textAnchor="middle" fontSize="9" fontWeight="900" fill={safePlayers >= safeMinPlayers ? "#166534" : "#92400e"}>{safeMinPlayers}명+</text>
            </g>
        </svg>
    );
};

const LasVegasLobbyEmptyArt = ({ className = "" }) => {
    const nodes = [
        { key: "create", x: 38, y: 94, label: "생성" },
        { key: "code", x: 86, y: 35, label: "코드" },
        { key: "refresh", x: 154, y: 94, label: "새로고침" },
    ];

    return (
        <svg
            viewBox="0 0 220 132"
            role="img"
            aria-label="라스베가스 빈 로비 다음 행동 안내"
            className={className}
            data-smoke="las-vegas-lobby-empty-art"
        >
            <rect x="1" y="1" width="218" height="130" rx="22" fill="#fffbeb" stroke="#fde68a" strokeWidth="2" />
            <path d="M28 104C36 70 68 48 109 48C151 48 183 70 191 104" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
            <ellipse cx="110" cy="80" rx="56" ry="30" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
            <path d="M64 80H156M110 52V108" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
            {[58, 82, 110, 138, 162].map((cx, index) => (
                <g key={cx} data-smoke="las-vegas-lobby-empty-node">
                    <circle cx={cx} cy={index % 2 ? 48 : 110} r="9" fill="#fbbf24" />
                    <circle cx={cx} cy={index % 2 ? 48 : 110} r="3.5" fill="#fff7ed" />
                </g>
            ))}
            <g data-smoke="las-vegas-lobby-empty-node">
                <rect x="92" y="16" width="58" height="28" rx="14" fill="#111827" />
                <text x="121" y="34" textAnchor="middle" fill="#fef3c7" fontSize="12" fontWeight="900">방 없음</text>
            </g>
            <g data-smoke="las-vegas-lobby-empty-node">
                <rect x="73" y="66" width="18" height="18" rx="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="79" cy="72" r="1.8" fill="#92400e" />
                <circle cx="86" cy="79" r="1.8" fill="#92400e" />
                <rect x="121" y="66" width="18" height="18" rx="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="126" cy="71" r="1.8" fill="#92400e" />
                <circle cx="130" cy="75" r="1.8" fill="#92400e" />
                <circle cx="134" cy="79" r="1.8" fill="#92400e" />
            </g>
            {nodes.map((node, index) => (
                <g key={node.key} data-smoke="las-vegas-lobby-empty-node" data-empty-key={node.key}>
                    <circle cx={node.x} cy={node.y} r="15" fill={index === 0 ? "#f59e0b" : index === 1 ? "#22c55e" : "#38bdf8"} />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">{node.label}</text>
                </g>
            ))}
        </svg>
    );
};

const LasVegasLobbyEmptyState = ({ loading, onRefresh }) => {
    const items = loading
        ? [
            { key: "loading", label: "목록 확인", value: "대기 테이블 조회 중", detail: "현재 공개 테이블을 불러오고 있습니다." },
            { key: "create", label: "새 방 만들기", value: "설정 유지", detail: "왼쪽 생성 설정은 그대로 준비되어 있습니다." },
            { key: "code", label: "방코드 입장", value: "초대 코드 대기", detail: "코드를 받았다면 바로 입력할 수 있습니다." },
        ]
        : [
            { key: "create", label: "새 방 만들기", value: "첫 테이블 열기", detail: "라운드와 제한 시간을 확인한 뒤 직접 대기 테이블을 만듭니다." },
            { key: "code", label: "방코드 입장", value: "초대 합류", detail: "방장이 공유한 LV 코드가 있으면 위 입력칸으로 바로 들어갑니다." },
            { key: "refresh", label: "새로고침", value: "목록 다시 확인", detail: "방금 열린 테이블이 있는지 다시 조회합니다." },
        ];

    return (
        <div
            className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-4"
            data-smoke="las-vegas-lobby-empty-state"
            data-loading={loading ? "true" : "false"}
            role={loading ? "status" : undefined}
            aria-live={loading ? "polite" : undefined}
        >
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                <LasVegasLobbyEmptyArt className="h-32 w-full" />
                <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900">{loading ? "대기 테이블을 불러오는 중입니다." : "대기방 없음"}</div>
                    <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                        {loading ? "목록이 도착하면 바로 입장 후보와 좌석 상태를 보여줍니다." : "지금은 공개 라스베가스 테이블이 없습니다. 새 방을 만들거나 초대 코드로 합류하고, 목록을 다시 확인하세요."}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {items.map((item) => (
                            <div key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2" data-smoke="las-vegas-lobby-empty-item" data-empty-key={item.key}>
                                <div className="text-[11px] font-black text-amber-700">{item.label}</div>
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
                        data-smoke="las-vegas-lobby-empty-refresh"
                    >
                        <TimerReset className="h-3.5 w-3.5" />
                        목록 새로고침
                    </button>
                </div>
            </div>
        </div>
    );
};

const buildLasVegasLobbyDirectorPlan = (rooms = []) => {
    const candidates = (Array.isArray(rooms) ? rooms : []).map((room) => {
        const players = lasVegasLobbyPlayers(room);
        const status = String(room?.roomStatus || "WAITING").toUpperCase();
        const maxPlayers = Math.max(1, toPlainInt(room?.maxPlayers, 6));
        const minPlayers = Math.max(1, Math.min(maxPlayers, toPlainInt(room?.minPlayers, 2)));
        const memberCount = Math.max(players.length, toPlainInt(room?.memberCount, players.length));
        const hostMemberId = Number(room?.hostMemberId || 0);
        const guests = players.filter((player) => Number(getLasVegasPlayerId(player) || 0) !== hostMemberId);
        const readyGuests = guests.filter(isReadyPlayer).length;
        const readyRatio = guests.length ? readyGuests / guests.length : 1;
        const roomFull = memberCount >= maxPlayers;
        const waiting = status === "WAITING";
        const joinable = waiting && !roomFull;
        const startFloor = memberCount >= minPlayers;
        const roundCount = toPlainInt(room?.roundCount, 4);
        const turnTimeSeconds = toPlainInt(room?.turnTimeSeconds, 25);
        const score = (
            (joinable ? 40 : 0) +
            (startFloor ? 18 : 0) +
            Math.round(readyRatio * 18) +
            Math.min(memberCount, maxPlayers) * 3 +
            Math.min(roundCount, 6) -
            (status === "FINISHED" ? 36 : 0)
        );
        return {
            key: String(normalizeRoomId(room) || room?.roomCode || room?.title || score),
            room,
            title: room?.title || room?.roomCode || "카지노 테이블",
            roomId: normalizeRoomId(room),
            status,
            statusText: lasVegasRoomStatusLabel(status),
            memberCount,
            maxPlayers,
            minPlayers,
            openSeats: Math.max(0, maxPlayers - memberCount),
            readyGuests,
            guestCount: guests.length,
            readyText: guests.length ? `게스트 준비 ${readyGuests}/${guests.length}` : "방장 시작 가능",
            joinable,
            startFloor,
            roundCount,
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
            detail: recommended ? `${recommended.statusText} · ${recommended.joinable ? "입장 가능" : "상태 확인 필요"}` : "새 카지노 테이블을 만들면 바로 준비 흐름으로 들어갑니다.",
        },
        {
            key: "seat",
            icon: "player",
            label: "좌석 여유",
            value: recommended ? `${recommended.memberCount}/${recommended.maxPlayers}명` : `${candidates.length}개 테이블`,
            detail: recommended ? `빈 좌석 ${recommended.openSeats}개 · 최소 ${recommended.minPlayers}명` : "대기 테이블이 생기면 우선 후보가 표시됩니다.",
        },
        {
            key: "ready",
            icon: "state",
            label: "준비 신호",
            value: recommended ? recommended.readyText : "준비 대기",
            detail: recommended ? (recommended.startFloor ? "시작 인원 조건에 가까운 테이블입니다." : "합류하면 시작 조건에 가까워집니다.") : "대기방 카드의 준비 상태와 함께 읽습니다.",
        },
        {
            key: "tempo",
            icon: "turn",
            label: "운영 리듬",
            value: recommended ? `${recommended.roundCount}라운드 · ${recommended.turnTimeSeconds}초` : "라운드 설정",
            detail: "라운드 수와 턴 시간을 먼저 보면 테이블의 호흡을 빠르게 고를 수 있습니다.",
        },
    ];

    return {
        candidates,
        recommended,
        items,
        choices: candidates.slice(0, 3),
    };
};

const LasVegasLobbyDirectorArt = ({ items = [], recommended, loading, className = "" }) => {
    const nodes = items.slice(0, 4);
    const titleText = recommended ? String(recommended.title || "테이블").slice(0, 12) : loading ? "조회 중" : "새 테이블";
    const activeColor = recommended?.joinable ? "#f59e0b" : "#38bdf8";

    return (
        <svg
            viewBox="0 0 420 160"
            role="img"
            aria-label="라스베가스 카지노 테이블 브리프"
            className={className}
            data-smoke="las-vegas-lobby-director-art"
        >
            <rect width="420" height="160" rx="24" fill="#111827" />
            <rect x="22" y="18" width="132" height="110" rx="20" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
            <text x="88" y="42" textAnchor="middle" fill="#fde68a" fontSize="12" fontWeight="900">추천 테이블</text>
            <text x="88" y="72" textAnchor="middle" fill="#fff7ed" fontSize="15" fontWeight="900">{titleText}</text>
            <text x="88" y="96" textAnchor="middle" fill="#fed7aa" fontSize="10" fontWeight="800">
                {recommended ? `${recommended.memberCount}/${recommended.maxPlayers}명` : "대기"}
            </text>
            <circle cx="88" cy="124" r="17" fill={activeColor} />
            <path d="M82 124 l5 5 l10 -12" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M178 86 H386" stroke="#78350f" strokeWidth="12" strokeLinecap="round" />
            <path d="M178 86 H386" stroke={activeColor} strokeWidth="4" strokeLinecap="round" />
            {nodes.map((item, index) => {
                const x = 180 + index * 68;
                return (
                    <g key={item.key} data-smoke="las-vegas-lobby-director-node">
                        <circle cx={x} cy="86" r="22" fill="#1f2937" stroke={index === 0 ? activeColor : "#fbbf24"} strokeWidth="2" />
                        <text x={x} y="91" textAnchor="middle" fill="#fef3c7" fontSize="13" fontWeight="900">{index + 1}</text>
                        <text x={x} y="126" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="900">{item.label}</text>
                    </g>
                );
            })}
            <rect x="180" y="24" width="150" height="26" rx="13" fill="#292524" stroke="#92400e" />
            <text x="255" y="42" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="900">
                {recommended?.joinable ? "입장 가능" : "테이블 탐색"}
            </text>
            <circle cx="366" cy="37" r="11" fill={loading ? "#fbbf24" : "#22c55e"} />
            <path d="M361 37 h10" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
            {!loading && <path d="M366 32 v10" stroke="#111827" strokeWidth="2" strokeLinecap="round" />}
        </svg>
    );
};

const LasVegasLobbyDirectorEmptyArt = ({ loading = false, className = "" }) => {
    const nodes = [
        { key: "create", label: "생성", x: 66, y: 72, fill: "#f59e0b" },
        { key: "code", label: "코드", x: 150, y: 44, fill: "#22c55e" },
        { key: "refresh", label: "갱신", x: 234, y: 72, fill: "#38bdf8" },
    ];

    return (
        <svg
            viewBox="0 0 304 124"
            role="img"
            aria-label="라스베가스 카지노 테이블 후보가 없을 때 다음 행동 안내"
            className={className}
            data-smoke="las-vegas-lobby-director-empty-art"
            focusable="false"
        >
            <rect x="2" y="2" width="300" height="120" rx="22" fill="#111827" stroke="#f59e0b" strokeWidth="2" />
            <ellipse cx="152" cy="76" rx="82" ry="34" fill="#064e3b" stroke="#34d399" strokeWidth="3" />
            <path d="M50 90C75 48 112 42 151 54C190 66 226 52 266 28" fill="none" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" opacity="0.62" />
            <rect x="128" y="56" width="22" height="22" rx="5" fill="#fff7ed" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="135" cy="63" r="2" fill="#78350f" />
            <circle cx="144" cy="72" r="2" fill="#78350f" />
            <rect x="158" y="56" width="22" height="22" rx="5" fill="#fff7ed" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="164" cy="62" r="2" fill="#78350f" />
            <circle cx="169" cy="67" r="2" fill="#78350f" />
            <circle cx="174" cy="73" r="2" fill="#78350f" />
            {nodes.map((node, index) => (
                <g key={node.key} data-smoke="las-vegas-lobby-director-empty-node" data-empty-key={node.key}>
                    {index > 0 && <path d={`M${nodes[index - 1].x + 18} ${nodes[index - 1].y} C${nodes[index - 1].x + 38} ${nodes[index - 1].y - 24} ${node.x - 38} ${node.y - 24} ${node.x - 18} ${node.y}`} fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />}
                    <circle cx={node.x} cy={node.y} r="22" fill={node.fill} />
                    <circle cx={node.x} cy={node.y} r="14" fill="#111827" opacity="0.9" />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="9" fontWeight="900" fill="#fef3c7">{node.label}</text>
                </g>
            ))}
            <rect x="34" y="16" width="104" height="22" rx="11" fill="#fef3c7" />
            <text x="86" y="31" textAnchor="middle" fontSize="10" fontWeight="900" fill="#78350f">{loading ? "조회 중" : "후보 없음"}</text>
        </svg>
    );
};

const LasVegasLobbyDirectorEmptyChoice = ({ loading = false }) => {
    const items = [
        { key: "create", label: "새 방 만들기", value: "첫 테이블 열기", detail: "라운드 수와 턴 시간을 정해 바로 카지노 대기 테이블을 열 수 있습니다." },
        { key: "code", label: "방코드 입장", value: "초대 합류", detail: "친구가 공유한 LV 코드가 있으면 목록이 비어도 같은 테이블로 이동합니다." },
        { key: "refresh", label: "목록 갱신", value: "새 후보 확인", detail: "방금 열린 카지노 테이블이 있는지 다시 확인하고 추천 후보를 갱신합니다." },
    ];

    return (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-3" data-smoke="las-vegas-lobby-director-choice">
            <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-center" data-smoke="las-vegas-lobby-director-empty-choice">
                <LasVegasLobbyDirectorEmptyArt loading={loading} className="h-28 w-full" />
                <div className="min-w-0">
                    <div className="text-sm font-black text-slate-950">{loading ? "테이블 후보를 확인하는 중입니다" : "추천할 카지노 테이블이 없습니다"}</div>
                    <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                        비어 있는 목록에서도 흐름은 끊기지 않습니다. 새 테이블을 열거나 초대 코드로 합류하고, 목록을 다시 확인하세요.
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {items.map((item) => (
                            <div key={item.key} className="rounded-lg border border-white/80 bg-white px-3 py-2" data-smoke="las-vegas-lobby-director-empty-item" data-empty-key={item.key}>
                                <div className="text-[10px] font-black text-amber-700">{item.label}</div>
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

const LasVegasLobbyDirectorPanel = ({ rooms, loading, onJoin }) => {
    const plan = buildLasVegasLobbyDirectorPlan(rooms);

    return (
        <section
            className="mb-4 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg"
            data-smoke="las-vegas-lobby-director-panel"
            data-room-count={plan.candidates.length}
            data-recommended-room={plan.recommended?.key || ""}
        >
            <div className="bg-gradient-to-br from-amber-500 via-slate-950 to-emerald-600 p-3">
                <LasVegasLobbyDirectorArt items={plan.items} recommended={plan.recommended} loading={loading} className="h-36 w-full" />
            </div>
            <div className="space-y-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-base font-black text-slate-900">
                            <GameUxGlyph type="decision" className="h-4 w-4 text-amber-600" />
                            카지노 테이블 브리프
                        </div>
                        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                            여러 대기 테이블 중 바로 입장 후보와 좌석, 준비, 라운드 호흡을 먼저 비교합니다.
                        </div>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
                        {plan.candidates.length}개 후보
                    </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    {plan.items.map((item) => (
                        <div key={item.key} className="min-h-[92px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="las-vegas-lobby-director-item">
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                                <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-amber-600" />
                                {item.label}
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                            <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
                        </div>
                    ))}
                </div>
                <div className="space-y-2">
                    {plan.choices.length ? plan.choices.map((choice, index) => (
                        <div key={choice.key} className="grid gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_108px] sm:items-center" data-smoke="las-vegas-lobby-director-choice">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">{index + 1}</span>
                                    <div className="truncate text-sm font-black text-slate-900">{choice.title}</div>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{choice.statusText}</span>
                                </div>
                                <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                                    {choice.memberCount}/{choice.maxPlayers}명 · {choice.readyText} · {choice.roundCount}라운드
                                </div>
                            </div>
                            <button
                                type="button"
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-amber-600 disabled:opacity-40"
                                disabled={loading || !choice.joinable}
                                onClick={() => onJoin(choice.roomId)}
                                data-smoke="las-vegas-lobby-director-join"
                            >
                                <Play className="h-3.5 w-3.5" />
                                입장
                            </button>
                        </div>
                    )) : (
                        <LasVegasLobbyDirectorEmptyChoice loading={loading} />
                    )}
                </div>
            </div>
        </section>
    );
};

const buildLasVegasSetupPreviewItems = ({ title, roundCount, turnTimeSeconds, waitingRoomCount }) => {
    const hasTitle = Boolean(String(title || "").trim());
    const roundMood = roundCount <= 3 ? "짧은 승부" : roundCount <= 5 ? "균형 승부" : "장기 운영";
    const tempoMood = turnTimeSeconds <= 20 ? "빠른 결단" : turnTimeSeconds <= 60 ? "표준 호흡" : "숙고 운영";
    return [
        {
            key: "title",
            icon: "state",
            label: "테이블 간판",
            value: hasTitle ? String(title).trim() : "자동 간판",
            detail: hasTitle ? "대기 목록에서 바로 구분되는 이름으로 노출됩니다." : "비워도 기본 라스베가스 테이블 이름으로 생성됩니다.",
            tone: hasTitle ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900",
        },
        {
            key: "round",
            icon: "stage",
            label: "라운드 압력",
            value: `${roundCount}라운드 · ${roundMood}`,
            detail: roundCount <= 3 ? "초반 보상 판단이 바로 승부로 이어지는 빠른 테이블입니다." : "누적 수익과 역전 타이밍을 읽는 시간이 충분합니다.",
            tone: "border-sky-200 bg-sky-50 text-sky-900",
        },
        {
            key: "tempo",
            icon: "turn",
            label: "턴 템포",
            value: `${turnTimeSeconds}초 · ${tempoMood}`,
            detail: turnTimeSeconds <= 20 ? "굴림 후 배팅 결정을 빠르게 내려야 합니다." : "카지노 보상과 동점 위험을 확인할 여유가 있습니다.",
            tone: "border-violet-200 bg-violet-50 text-violet-900",
        },
        {
            key: "lobby",
            icon: "player",
            label: "입장 흐름",
            value: `${waitingRoomCount}개 대기 테이블`,
            detail: "생성 후에는 방장 시작 조건과 게스트 준비 상태를 기존 로비 흐름으로 확인합니다.",
            tone: "border-slate-200 bg-slate-50 text-slate-900",
        },
    ];
};

const LasVegasSetupPreviewArt = ({ roundCount, turnTimeSeconds, className = "" }) => {
    const casinos = [1, 2, 3, 4, 5, 6];
    const activeCasinos = Math.max(2, Math.min(6, roundCount));
    const tempoWidth = Math.max(42, Math.min(160, turnTimeSeconds));

    return (
        <svg
            viewBox="0 0 420 172"
            role="img"
            aria-label="라스베가스 생성 전 카지노 브리핑"
            className={className}
            data-smoke="las-vegas-setup-preview-art"
        >
            <rect width="420" height="172" rx="24" fill="#0f172a" />
            <rect x="24" y="20" width="372" height="74" rx="28" fill="#064e3b" stroke="#f59e0b" strokeWidth="3" />
            <text x="42" y="47" fill="#fef3c7" fontSize="13" fontWeight="900">생성 전 카지노 브리핑</text>
            <text x="42" y="72" fill="#d1fae5" fontSize="11" fontWeight="800">{roundCount}라운드 · 턴 {turnTimeSeconds}초</text>
            <g transform="translate(250 31)">
                {[0, 1, 2].map((offset) => (
                    <rect key={`chip-${offset}`} x={offset * 27} y={offset % 2 ? 14 : 0} width="34" height="34" rx="17" fill={offset === 1 ? "#f59e0b" : "#22c55e"} />
                ))}
                <text x="60" y="29" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="900">칩</text>
            </g>
            <path d="M54 124 H366" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
            <path d="M54 124 H366" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            {casinos.map((casino, index) => {
                const x = 54 + index * 62;
                const active = casino <= activeCasinos;
                return (
                    <g key={`setup-casino-${casino}`} data-smoke="las-vegas-setup-preview-node">
                        <circle cx={x} cy="124" r="21" fill={active ? "#f59e0b" : "#1f2937"} stroke={active ? "#fef3c7" : "#64748b"} strokeWidth="2" />
                        <text x={x} y="129" textAnchor="middle" fill={active ? "#111827" : "#e2e8f0"} fontSize="13" fontWeight="900">{casino}</text>
                        <text x={x} y="160" textAnchor="middle" fill="#fde68a" fontSize="9" fontWeight="900">카지노</text>
                    </g>
                );
            })}
            <rect x="244" y="101" width="146" height="18" rx="9" fill="#1f2937" />
            <rect x="244" y="101" width={tempoWidth} height="18" rx="9" fill="#38bdf8" />
            <text x="316" y="115" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900">턴 템포</text>
        </svg>
    );
};

const LasVegasSetupPreviewPanel = ({ createForm, rooms }) => {
    const title = String(createForm?.title || "").trim();
    const roundCount = Math.min(10, Math.max(1, toPlainInt(createForm?.roundCount, 3)));
    const turnTimeSeconds = Math.min(180, Math.max(5, toPlainInt(createForm?.turnTimeSeconds, 50)));
    const waitingRoomCount = Array.isArray(rooms)
        ? rooms.filter((room) => String(room?.roomStatus || "WAITING").toUpperCase() === "WAITING").length
        : 0;
    const items = buildLasVegasSetupPreviewItems({ title, roundCount, turnTimeSeconds, waitingRoomCount });

    return (
        <section
            className="mt-4 grid gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-white md:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)] md:items-center"
            data-smoke="las-vegas-setup-preview-panel"
            data-round-count={roundCount}
            data-turn-time={turnTimeSeconds}
        >
            <LasVegasSetupPreviewArt roundCount={roundCount} turnTimeSeconds={turnTimeSeconds} className="h-40 w-full" />
            <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-amber-100">
                    <GameUxGlyph type="build" className="h-4 w-4 text-amber-300" />
                    생성 전 카지노 브리핑
                </div>
                <p className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
                    방을 만들기 전 라운드 길이, 턴 템포, 입장 흐름을 게임 화면처럼 먼저 읽습니다.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {items.map((item) => (
                        <div key={item.key} className={`min-h-[92px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="las-vegas-setup-preview-item">
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
        </section>
    );
};

const casinoName = {
    1: "벨라지오",
    2: "엠지엠",
    3: "시저스",
    4: "윈",
    5: "베네시안",
    6: "코스모",
};

const lasVegasPlayerName = (players, memberId) => {
    const id = Number(memberId || 0);
    return players.find((player) => Number(player.memberId) === id)?.nickname || (id ? `플레이어 ${id}` : "-");
};

const buildLasVegasWinnerText = (players, winnerMemberId) => {
    if (!winnerMemberId) return "모든 라운드 수익을 합산하면 최종 우승자가 표시됩니다.";
    const sorted = [...players].sort((a, b) => Number(b.totalMoney || 0) - Number(a.totalMoney || 0));
    const winner = sorted.find((player) => Number(player.memberId) === Number(winnerMemberId)) || sorted[0];
    const runnerUp = sorted.find((player) => Number(player.memberId) !== Number(winnerMemberId));
    const gap = runnerUp ? Number(winner?.totalMoney || 0) - Number(runnerUp.totalMoney || 0) : 0;
    return runnerUp
        ? `${winner?.nickname || "우승자"}님이 ${formatWon(winner?.totalMoney)}으로 2위보다 ${formatWon(gap)} 앞서 우승했습니다.`
        : `${winner?.nickname || "우승자"}님이 ${formatWon(winner?.totalMoney)}으로 우승했습니다.`;
};

const buildLasVegasSettlementLedger = ({ state, players, winnerMemberId }) => {
    const safePlayers = Array.isArray(players) ? players : [];
    const safeCasinos = Array.isArray(state?.casinos) ? state.casinos : [];
    const leaderboard = [...safePlayers]
        .map((player) => ({
            memberId: Number(player.memberId || player.member_id || 0),
            nickname: player.nickname || lasVegasPlayerName(safePlayers, player.memberId || player.member_id),
            totalMoney: Number(player.totalMoney || player.total_money || 0),
            remainingDice: Number(player.remainingDice || player.remaining_dice || 0),
        }))
        .sort((a, b) => b.totalMoney - a.totalMoney || a.remainingDice - b.remainingDice || a.nickname.localeCompare(b.nickname, "ko"));
    const winner = winnerMemberId
        ? leaderboard.find((player) => Number(player.memberId) === Number(winnerMemberId)) || leaderboard[0]
        : leaderboard[0];
    const runnerUp = leaderboard.find((player) => Number(player.memberId) !== Number(winner?.memberId || 0));
    const leaderGap = winner && runnerUp ? Math.max(0, winner.totalMoney - runnerUp.totalMoney) : 0;
    const casinoEntries = safeCasinos.map((casino) => {
        const casinoNo = Number(casino.casinoNo || casino.casino_no || 0);
        const diceByPlayer = casino.diceByPlayer || casino.dice_by_player || {};
        const diceEntries = Object.entries(diceByPlayer)
            .map(([memberId, count]) => ({
                memberId: Number(memberId),
                count: Number(count || 0),
                name: lasVegasPlayerName(safePlayers, memberId),
            }))
            .filter((entry) => entry.memberId > 0 && entry.count > 0);
        const countGroups = new Map();
        diceEntries.forEach((entry) => {
            const group = countGroups.get(entry.count) || [];
            group.push(entry);
            countGroups.set(entry.count, group);
        });
        const tiedGroups = [...countGroups.entries()]
            .filter(([, group]) => group.length > 1)
            .sort((a, b) => b[0] - a[0]);
        const eligible = diceEntries
            .filter((entry) => (countGroups.get(entry.count) || []).length === 1)
            .sort((a, b) => b.count - a.count);
        const leading = eligible[0] || null;
        const totalMoney = Number(casino.totalMoney || casino.total_money || 0);
        const moneyCards = Array.isArray(casino.moneyCards || casino.money_cards) ? casino.moneyCards || casino.money_cards : [];
        const status = !diceEntries.length
            ? "배팅 대기"
            : leading
                ? `${leading.name} 단독 ${leading.count}개`
                : "동점 제거";
        const detail = !diceEntries.length
            ? "아직 이 카지노에 놓인 주사위가 없어 보상 주인이 정해지지 않았습니다."
            : leading
                ? `${leading.name}님이 동점 제거 후 가장 높은 단독 주사위 수를 갖고 있습니다.`
                : `${tiedGroups[0]?.[0] || ""}개 동점 플레이어가 모두 보상 경쟁에서 빠집니다.`;
        return {
            casinoNo,
            title: casinoName[casinoNo] || `${casinoNo}번 카지노`,
            totalMoney,
            moneyCards,
            diceEntries,
            tiedGroups,
            leading,
            status,
            detail,
        };
    });
    const richestCasino = [...casinoEntries].sort((a, b) => b.totalMoney - a.totalMoney)[0] || null;
    const contestedCasinos = casinoEntries.filter((entry) => entry.diceEntries.length > 0).length;
    const tieCasinos = casinoEntries.filter((entry) => entry.tiedGroups.length > 0).length;
    const resultText = winnerMemberId && winner
        ? `${winner.nickname}님이 ${formatWon(winner.totalMoney)}으로 정산 선두입니다.`
        : winner
            ? `${winner.nickname}님이 현재 ${formatWon(winner.totalMoney)}으로 가장 앞서 있습니다.`
            : "플레이어 정산 정보를 기다립니다.";
    return {
        leaderboard,
        casinoEntries,
        winner,
        runnerUp,
        leaderGap,
        richestCasino,
        contestedCasinos,
        tieCasinos,
        resultText,
    };
};

const LasVegasSettlementLedgerArt = ({ ledger }) => {
    const leaderboard = ledger?.leaderboard?.slice(0, 4) || [];
    const casinoEntries = ledger?.casinoEntries || [];
    const maxMoney = Math.max(1, ...leaderboard.map((player) => player.totalMoney || 0), Number(ledger?.richestCasino?.totalMoney || 0));

    return (
        <svg
            viewBox="0 0 420 210"
            role="img"
            aria-label="라스베가스 카지노 정산과 플레이어 총 보유금 흐름"
            className="h-full min-h-[210px] w-full"
            data-smoke="las-vegas-settlement-ledger-art"
        >
            <rect x="10" y="10" width="400" height="190" rx="24" fill="#082f49" />
            <path d="M32 154H390M32 122H390M32 90H390" stroke="#e0f2fe" strokeWidth="2" opacity=".1" />
            <text x="28" y="34" fontSize="12" fontWeight="900" fill="#fef3c7">정산 요약</text>
            <text x="300" y="34" fontSize="10" fontWeight="900" fill="#bae6fd">동점 제거 후 단독 선두</text>

            {leaderboard.map((player, index) => {
                const barWidth = Math.max(14, Math.min(142, (player.totalMoney / maxMoney) * 142));
                const y = 54 + index * 28;
                const winner = Number(player.memberId) === Number(ledger?.winner?.memberId || 0);
                return (
                    <g key={`settlement-player-${player.memberId || index}`} data-smoke="las-vegas-settlement-player-node">
                        <text x="30" y={y + 14} fontSize="10" fontWeight="900" fill="#f8fafc">{index + 1}</text>
                        <rect x="52" y={y} width="154" height="18" rx="9" fill="rgba(255,255,255,.08)" />
                        <rect x="52" y={y} width={barWidth} height="18" rx="9" fill={winner ? "#fbbf24" : "#38bdf8"} />
                        <text x="216" y={y + 13} fontSize="10" fontWeight="900" fill="#f8fafc">{formatWon(player.totalMoney)}</text>
                    </g>
                );
            })}

            {casinoEntries.slice(0, 6).map((casino, index) => {
                const x = 258 + (index % 3) * 42;
                const y = 66 + Math.floor(index / 3) * 58;
                const tied = casino.tiedGroups.length > 0;
                const filled = casino.diceEntries.length > 0;
                const fill = tied ? "#fb7185" : filled ? "#22c55e" : "#475569";
                return (
                    <g key={`settlement-casino-${casino.casinoNo}`} transform={`translate(${x} ${y})`} data-smoke="las-vegas-settlement-casino-node">
                        <circle cx="0" cy="0" r="18" fill={fill} stroke="#f8fafc" strokeWidth="3" />
                        <text x="0" y="4" textAnchor="middle" fontSize="12" fontWeight="900" fill="#ffffff">{casino.casinoNo}</text>
                        <text x="0" y="33" textAnchor="middle" fontSize="9" fontWeight="900" fill="#bae6fd">{formatWon(casino.totalMoney)}</text>
                        {tied && <path d="M-12-24 12-24M-7-29 7-19" stroke="#fecdd3" strokeWidth="4" strokeLinecap="round" />}
                    </g>
                );
            })}
            <text x="28" y="186" fontSize="10" fontWeight="900" fill="#bae6fd">노란 막대는 정산 선두, 분홍 카지노는 동점 제거 위험입니다.</text>
        </svg>
    );
};

const LasVegasSettlementLedgerPanel = ({ state, players, winnerMemberId }) => {
    const ledger = buildLasVegasSettlementLedger({ state, players, winnerMemberId });
    if (!ledger.casinoEntries.length && !ledger.leaderboard.length) return null;
    const leaderName = ledger.winner?.nickname || "선두 없음";
    const richestTitle = ledger.richestCasino ? `${ledger.richestCasino.title} ${formatWon(ledger.richestCasino.totalMoney)}` : "보상 대기";
    const tieText = ledger.tieCasinos ? `${ledger.tieCasinos}곳 위험` : "동점 위험 낮음";
    const gapText = ledger.runnerUp ? `${formatWon(ledger.leaderGap)} 차이` : "단독 정산";
    const items = [
        {
            key: "leader",
            label: "총 보유금",
            value: leaderName,
            detail: ledger.resultText,
            tone: "border-amber-200 bg-amber-50 text-amber-900",
        },
        {
            key: "casino",
            label: "최대 카지노",
            value: richestTitle,
            detail: "머니카드 총액이 큰 카지노일수록 라운드 결과에 미치는 영향이 큽니다.",
            tone: "border-sky-200 bg-sky-50 text-sky-900",
        },
        {
            key: "tie",
            label: "동점 제거",
            value: tieText,
            detail: "같은 카지노에서 같은 주사위 수가 나오면 해당 플레이어들은 보상 경쟁에서 빠집니다.",
            tone: ledger.tieCasinos ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
        },
        {
            key: "gap",
            label: "승리 격차",
            value: gapText,
            detail: ledger.runnerUp ? `${ledger.runnerUp.nickname}님과의 총 보유금 차이입니다.` : "2위 정보가 없으면 단독 정산 상태로 표시합니다.",
            tone: "border-violet-200 bg-violet-50 text-violet-900",
        },
    ];

    return (
        <section className="mt-3 overflow-hidden rounded-2xl border border-sky-100 bg-white p-3 shadow-sm" data-smoke="las-vegas-settlement-ledger-panel">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,420px)_1fr]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-sky-950">
                    <LasVegasSettlementLedgerArt ledger={ledger} />
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                                <GameUxGlyph type="score" className="h-4 w-4 text-sky-600" />
                                라스베가스 정산 요약
                            </div>
                            <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                                카지노별 머니카드, 동점 제거, 플레이어 총 보유금을 같은 화면에 묶어 왜 앞서거나 뒤처지는지 확인합니다.
                            </p>
                        </div>
                        <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                            정산 카지노 {ledger.contestedCasinos}/{ledger.casinoEntries.length}
                        </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {items.map((item) => (
                            <div key={item.key} className={`min-h-[112px] rounded-xl border p-3 ${item.tone}`} data-smoke="las-vegas-settlement-ledger-item">
                                <div className="text-[11px] font-black">{item.label}</div>
                                <div className="mt-2 truncate text-sm font-black">{item.value}</div>
                                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{item.detail}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const buildLasVegasDecisionRows = ({ state, currentRollCountByFace, myMemberId }) => {
    const casinos = Array.isArray(state?.casinos) ? state.casinos : [];
    const rollFaces = Object.entries(currentRollCountByFace || {})
        .map(([face, count]) => ({ face: Number(face), count: Number(count || 0) }))
        .filter((item) => item.face > 0 && item.count > 0);

    if (rollFaces.length) {
        return rollFaces.map(({ face, count }) => {
            const casino = casinos.find((item) => Number(item.casinoNo) === face) || {};
            const diceByPlayer = casino.diceByPlayer || {};
            const currentMine = Number(diceByPlayer[String(myMemberId)] || diceByPlayer[myMemberId] || 0);
            const nextMine = currentMine + count;
            const otherCounts = Object.entries(diceByPlayer)
                .filter(([memberId]) => Number(memberId) !== Number(myMemberId))
                .map(([, value]) => Number(value || 0));
            const topOther = Math.max(0, ...otherCounts);
            const tied = otherCounts.some((value) => value === nextMine);
            const uncontested = otherCounts.length === 0;
            const status = tied ? "동점 위험" : nextMine > topOther ? "보상권" : "추격";
            const detail = uncontested
                ? "현재 단독 배팅입니다. 라운드 끝까지 유지되면 이 카지노 보상을 모두 가져갈 수 있습니다."
                : tied
                    ? "동점이면 해당 플레이어들이 모두 보상 경쟁에서 빠집니다."
                    : nextMine > topOther
                        ? "현재 가장 많은 주사위가 되어 큰 머니 카드부터 노릴 수 있습니다."
                        : "아직 선두 주사위 수보다 적습니다. 후속 굴림에서 보강이 필요합니다.";
            return {
                key: `roll-${face}`,
                title: `${casinoName[face] || `${face}번 카지노`} · ${count}개 배팅`,
                value: status,
                detail,
            };
        });
    }

    return casinos
        .slice()
        .sort((a, b) => Number(b.totalMoney || 0) - Number(a.totalMoney || 0))
        .slice(0, 3)
        .map((casino) => {
            const casinoNo = Number(casino.casinoNo || 0);
            const diceEntries = Object.values(casino.diceByPlayer || {}).map((value) => Number(value || 0));
            const contestText = diceEntries.length ? `현재 최고 ${Math.max(...diceEntries)}개` : "아직 비어 있음";
            return {
                key: `casino-${casinoNo}`,
                title: casinoName[casinoNo] || `${casinoNo}번 카지노`,
                value: formatWon(casino.totalMoney),
                detail: `${contestText}. 보상 총액이 높은 카지노라 다음 굴림에서 우선 비교할 후보입니다.`,
            };
        });
};

const buildLasVegasCasinoPressureRows = ({ state, currentRollCountByFace, myMemberId }) => {
    const casinos = Array.isArray(state?.casinos) ? state.casinos : [];
    return casinos
        .map((casino) => {
            const casinoNo = Number(casino.casinoNo || 0);
            const diceByPlayer = casino.diceByPlayer || {};
            const rollCount = Number(currentRollCountByFace?.[casinoNo] || currentRollCountByFace?.[String(casinoNo)] || 0);
            const currentMine = Number(diceByPlayer[String(myMemberId)] || diceByPlayer[myMemberId] || 0);
            const nextMine = currentMine + rollCount;
            const otherCounts = Object.entries(diceByPlayer)
                .filter(([memberId]) => Number(memberId) !== Number(myMemberId))
                .map(([, value]) => Number(value || 0))
                .filter((value) => value > 0);
            const topOther = Math.max(0, ...otherCounts);
            const tieRisk = rollCount > 0
                ? otherCounts.some((value) => value === nextMine)
                : currentMine > 0 && otherCounts.some((value) => value === currentMine);
            const leadingAfterBet = rollCount > 0 && nextMine > topOther && !tieRisk;
            const totalMoney = Number(casino.totalMoney || 0);
            const contenderCount = Object.values(diceByPlayer).filter((value) => Number(value || 0) > 0).length;
            const pressureScore = (rollCount > 0 ? 100000 : 0)
                + (leadingAfterBet ? 40000 : 0)
                - (tieRisk ? 25000 : 0)
                + (rollCount * 2500)
                + totalMoney
                - (topOther * 500);
            const status = rollCount > 0
                ? tieRisk
                    ? "동점 위험"
                    : leadingAfterBet
                        ? "보상권"
                        : "추격 필요"
                : currentMine > 0
                    ? "기존 배팅"
                    : "굴림 없음";
            const detail = rollCount > 0
                ? `${casinoName[casinoNo] || `${casinoNo}번 카지노`}에 ${rollCount}개를 놓으면 내 주사위가 ${nextMine}개가 됩니다.`
                : `${casinoName[casinoNo] || `${casinoNo}번 카지노`}에는 이번 공개 굴림으로 바로 놓을 주사위가 없습니다.`;
            return {
                casinoNo,
                title: casinoName[casinoNo] || `${casinoNo}번 카지노`,
                rollCount,
                currentMine,
                nextMine,
                topOther,
                tieRisk,
                leadingAfterBet,
                totalMoney,
                contenderCount,
                pressureScore,
                status,
                detail,
            };
        })
        .sort((a, b) => Number(a.casinoNo || 0) - Number(b.casinoNo || 0));
};

const LasVegasCasinoPressureArt = ({ rows, bestCasinoNo, maxMoney }) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeMaxMoney = Math.max(1, Number(maxMoney || 0));

    return (
        <svg
            viewBox="0 0 420 190"
            className="h-full min-h-[190px] w-full"
            role="img"
            aria-label="라스베가스 카지노 보상 요약"
            data-smoke="las-vegas-casino-pressure-art"
        >
            <rect width="420" height="190" rx="24" fill="#0f172a" />
            <path d="M28 146h364M42 112h336M60 78h300" stroke="#e2e8f0" strokeWidth="2" opacity=".09" />
            <text x="26" y="32" fill="#f8fafc" fontSize="14" fontWeight="900">카지노 압력</text>
            <text x="26" y="50" fill="#cbd5e1" fontSize="10" fontWeight="800">reward · dice · tie risk</text>
            {safeRows.map((row, index) => {
                const x = 42 + index * 62;
                const barHeight = Math.max(18, Math.min(82, (Number(row.totalMoney || 0) / safeMaxMoney) * 82));
                const y = 138 - barHeight;
                const active = row.rollCount > 0;
                const selected = Number(row.casinoNo) === Number(bestCasinoNo);
                const fill = row.tieRisk ? "#fb7185" : row.leadingAfterBet ? "#10b981" : active ? "#f59e0b" : "#475569";
                return (
                    <g key={`pressure-art-${row.casinoNo}`} transform={`translate(${x} 0)`}>
                        <rect x="-18" y="58" width="42" height="96" rx="16" fill={selected ? "rgba(251,191,36,.18)" : "rgba(255,255,255,.06)"} stroke={selected ? "#fbbf24" : "rgba(226,232,240,.18)"} strokeWidth="2" />
                        <rect x="-7" y={y} width="20" height={barHeight} rx="9" fill={fill} />
                        <circle cx="3" cy="54" r="16" fill={active ? fill : "#1e293b"} stroke="#f8fafc" strokeWidth="2" />
                        <text x="3" y="59" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="900">{row.rollCount || row.casinoNo}</text>
                        <text x="3" y="170" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="900">{row.casinoNo}</text>
                        {row.tieRisk && <path d="M-12 42 3 26l15 16" fill="none" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                    </g>
                );
            })}
            <g transform="translate(286 28)">
                <rect x="0" y="-14" width="86" height="28" rx="14" fill="rgba(16,185,129,.14)" stroke="#10b981" strokeWidth="2" />
                <text x="43" y="5" textAnchor="middle" fill="#ecfdf5" fontSize="10" fontWeight="900">우선 후보</text>
            </g>
        </svg>
    );
};

const LasVegasCasinoPressurePanel = ({ state, currentRollCountByFace, myMemberId, canBet }) => {
    const rows = buildLasVegasCasinoPressureRows({ state, currentRollCountByFace, myMemberId });
    if (!rows.length) return null;
    const playableRows = rows.filter((row) => row.rollCount > 0);
    const sortedByPressure = [...(playableRows.length ? playableRows : rows)].sort((a, b) => b.pressureScore - a.pressureScore);
    const bestRow = sortedByPressure[0] || rows[0];
    const tieRows = playableRows.filter((row) => row.tieRisk);
    const rewardRow = [...rows].sort((a, b) => b.totalMoney - a.totalMoney)[0] || rows[0];
    const rolledDiceCount = rows.reduce((sum, row) => sum + Number(row.rollCount || 0), 0);
    const myCommittedDice = rows.reduce((sum, row) => sum + Number(row.currentMine || 0), 0);
    const maxMoney = Math.max(...rows.map((row) => Number(row.totalMoney || 0)), 1);
    const tileTone = (type) => {
        if (type === "best") return bestRow?.tieRisk ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900";
        if (type === "tie") return tieRows.length ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-slate-50 text-slate-900";
        if (type === "reward") return "border-amber-200 bg-amber-50 text-amber-900";
        return "border-cyan-200 bg-cyan-50 text-cyan-900";
    };
    const items = [
        {
            key: "best",
            icon: "decision",
            label: "우선 후보",
            value: bestRow ? `${bestRow.title} · ${bestRow.status}` : "후보 없음",
            detail: bestRow ? bestRow.detail : "공개 굴림이나 카지노 보상 정보를 기다립니다.",
            tone: tileTone("best"),
        },
        {
            key: "tie",
            icon: "state",
            label: "동점 위험",
            value: tieRows.length ? tieRows.map((row) => row.casinoNo).join(", ") : "없음",
            detail: tieRows.length ? "동점이 되면 해당 카지노 보상 경쟁에서 빠질 수 있습니다." : "현재 공개 굴림 기준으로 바로 동점이 되는 후보는 없습니다.",
            tone: tileTone("tie"),
        },
        {
            key: "reward",
            icon: "score",
            label: "최대 보상",
            value: rewardRow ? `${rewardRow.title} · ${formatWon(rewardRow.totalMoney)}` : "대기",
            detail: rewardRow ? `현재 ${rewardRow.contenderCount}명이 이 카지노에 주사위를 올렸습니다.` : "머니 카드가 공개되면 보상 압력이 표시됩니다.",
            tone: tileTone("reward"),
        },
        {
            key: "dice",
            icon: "input",
            label: "내 주사위 흐름",
            value: canBet ? `이번 굴림 ${rolledDiceCount}개` : `배팅 ${myCommittedDice}개`,
            detail: canBet ? "같은 숫자는 한 번에 모두 놓아야 하므로 후보 압력을 먼저 비교하세요." : "굴림 전에는 기존 배팅 위치와 보상 규모를 먼저 읽습니다.",
            tone: tileTone("dice"),
        },
    ];

    return (
        <section className="mt-2 rounded-xl border border-amber-100 bg-white px-3 py-2 shadow-sm sm:mt-3 sm:rounded-2xl" data-smoke="las-vegas-casino-pressure-panel">
            <div className="space-y-2">
                <div className="hidden">
                    <LasVegasCasinoPressureArt rows={rows} bestCasinoNo={bestRow?.casinoNo} maxMoney={maxMoney} />
                </div>
                <div className="p-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-950 sm:text-sm">
                                <GameUxGlyph type="score" className="h-4 w-4 text-amber-600" />
                                카지노 보상 요약
                            </div>
                            <div className="mt-0.5 line-clamp-1 text-[11px] font-bold text-slate-500">
                                보상 규모, 이번 굴림, 내 주사위 추가 수, 동점 위험만 압축해서 봅니다.
                            </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${canBet ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {canBet ? "배팅 판단" : "굴림 대기"}
                        </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {items.map((item) => (
                            <div key={item.key} className={`min-h-[58px] rounded-xl border px-2.5 py-1.5 sm:min-h-[72px] sm:px-3 sm:py-2 ${item.tone}`} data-smoke="las-vegas-casino-pressure-item">
                                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                                    <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                </div>
                                <div className="mt-0.5 truncate text-xs font-black leading-snug sm:text-sm">{item.value}</div>
                                <div className="mt-0.5 hidden text-[10px] font-bold leading-snug opacity-70 sm:line-clamp-1 sm:block">{item.detail}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const LasVegasTurnRailArt = ({ players, state, selectedRoom, myMemberId, readyMemberIds, roomStatus, winnerMemberId }) => {
    const safePlayers = Array.isArray(players) ? players : [];
    const seatCount = Math.max(2, Math.min(6, Math.max(safePlayers.length, toPlainInt(selectedRoom?.minPlayers, 2))));
    const displayPlayers = Array.from({ length: seatCount }, (_, index) => safePlayers[index] || { memberId: 0, nickname: "빈 좌석" });
    const activeTurnMemberId = Number(state?.turnMemberId || 0);
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
            aria-label="라스베가스 카지노 턴 레일"
            data-smoke="las-vegas-turn-rail-art"
        >
            <rect x="0" y="0" width="640" height="190" rx="28" fill="#0f172a" />
            <rect x="28" y="30" width="584" height="118" rx="26" fill="#064e3b" stroke="#34d399" strokeWidth="2" />
            <path d="M56 92H604" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round" opacity="0.34" />
            <path d="M56 92H604" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
            <text x="40" y="30" fill="#fde68a" fontSize="12" fontWeight="900">카지노 턴 레일</text>
            <text x="600" y="30" textAnchor="end" fill="#a7f3d0" fontSize="12" fontWeight="900">{lasVegasRoomStatusLabel(roomStatus)}</text>
            {displayPlayers.map((player, index) => {
                const memberId = Number(getLasVegasPlayerId(player) || 0);
                const isCurrent = memberId > 0 && memberId === activeTurnMemberId;
                const isMe = memberId > 0 && memberId === Number(myMemberId || 0);
                const isWinner = memberId > 0 && memberId === Number(winnerMemberId || 0);
                const isHost = memberId > 0 && memberId === hostMemberId;
                const isReady = memberId > 0 && (readyMemberIds?.has(memberId) || isHost);
                const x = 56 + step * index;
                const fill = isWinner ? "#f59e0b" : isCurrent ? "#38bdf8" : isMe ? "#a78bfa" : memberId ? "#e2e8f0" : "#334155";
                const ring = isWinner ? "#fde68a" : isCurrent ? "#bae6fd" : isMe ? "#ddd6fe" : isReady ? "#86efac" : "#64748b";
                const label = isWinner ? "우승" : isCurrent ? "현재" : isMe ? "나" : status === "WAITING" ? (isReady ? "준비" : "대기") : "좌석";
                return (
                    <g key={`las-vegas-turn-node-${memberId || index}`} transform={`translate(${x} 92)`} data-smoke="las-vegas-turn-rail-node">
                        <circle cx="0" cy="0" r={isCurrent || isWinner ? 28 : 23} fill={fill} stroke={ring} strokeWidth="5" />
                        <circle cx="0" cy="0" r="12" fill={memberId ? "#0f172a" : "#1e293b"} opacity="0.88" />
                        <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="900">{index + 1}</text>
                        <rect x="-36" y="40" width="72" height="22" rx="11" fill={memberId ? "rgba(15,23,42,.88)" : "rgba(51,65,85,.86)"} stroke="rgba(226,232,240,.18)" />
                        <text x="0" y="55" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900">{shortName(player.nickname || `좌석 ${index + 1}`)}</text>
                        <text x="0" y="-34" textAnchor="middle" fill={ring} fontSize="10" fontWeight="900">{label}</text>
                    </g>
                );
            })}
            <g transform="translate(422 156)">
                <rect x="0" y="0" width="184" height="24" rx="12" fill="rgba(251,191,36,.14)" stroke="#fbbf24" strokeWidth="2" />
                <text x="92" y="16" textAnchor="middle" fill="#fef3c7" fontSize="10" fontWeight="900">
                    {winnerMemberId ? "최종 결과" : activeTurnMemberId ? "배팅 흐름" : "좌석 대기"}
                </text>
            </g>
        </svg>
    );
};

const LasVegasTurnRailPanel = ({ players, selectedRoom, state, myMemberId, readyMemberIds, roomStatus, winnerMemberId, winnerNickname, lastPlacedText }) => {
    const safePlayers = Array.isArray(players) ? players : [];
    const status = String(roomStatus || "WAITING").toUpperCase();
    const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
    const guestPlayers = safePlayers.filter((player) => Number(getLasVegasPlayerId(player) || 0) !== hostMemberId);
    const readyGuestCount = guestPlayers.filter((player) => readyMemberIds?.has(Number(getLasVegasPlayerId(player) || 0))).length;
    const turnMemberId = Number(state?.turnMemberId || 0);
    const currentTurnName = turnMemberId ? lasVegasPlayerName(safePlayers, turnMemberId) : "-";
    const myPlayerIndex = safePlayers.findIndex((player) => Number(getLasVegasPlayerId(player) || 0) === Number(myMemberId || 0));
    const myPlayer = myPlayerIndex >= 0 ? safePlayers[myPlayerIndex] : null;
    const mySeatLabel = myPlayer ? `좌석 ${myPlayerIndex + 1}` : "좌석 미확인";
    const roundLabel = state ? `${state.roundNo || 0}/${state.roundCount || selectedRoom?.roundCount || 0}` : `${toPlainInt(selectedRoom?.roundCount, 0)}라운드 예정`;
    const statusLabel = lasVegasRoomStatusLabel(roomStatus);
    const winnerText = winnerMemberId ? `${winnerNickname || lasVegasPlayerName(safePlayers, winnerMemberId)} 우승` : "정산 대기";
    const tiles = [
        {
            label: "상태",
            value: statusLabel,
            detail: status === "WAITING" ? `게스트 준비 ${readyGuestCount}/${guestPlayers.length}` : `라운드 ${roundLabel}`,
            icon: "state",
            tone: status === "PLAYING" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : status === "FINISHED" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-900",
        },
        {
            label: "현재 차례",
            value: status === "FINISHED" ? "게임 종료" : status === "PLAYING" ? currentTurnName : "시작 대기",
            detail: status === "PLAYING" ? "이번 순서의 굴림 또는 배팅 선택을 추적합니다." : "준비가 끝나면 방장이 시작할 수 있습니다.",
            icon: status === "FINISHED" ? "win" : "turn",
            tone: status === "PLAYING" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-900",
        },
        {
            label: "내 좌석",
            value: mySeatLabel,
            detail: myPlayer ? `${myPlayer.nickname || "나"} · 보유금 ${formatWon(myPlayer.totalMoney || 0)}` : "참가 정보가 동기화되면 좌석을 표시합니다.",
            icon: "input",
            tone: "border-violet-200 bg-violet-50 text-violet-900",
        },
        {
            label: winnerMemberId ? "우승" : "최근 행동",
            value: winnerMemberId ? winnerText : lastPlacedText || "배팅 기록 없음",
            detail: winnerMemberId ? "최종 수익 합산 기준 우승자입니다." : "직전 배팅 위치를 확인하고 다음 보상 압력을 읽습니다.",
            icon: winnerMemberId ? "win" : "recent",
            tone: winnerMemberId ? "border-amber-200 bg-amber-50 text-amber-900" : "border-cyan-200 bg-cyan-50 text-cyan-900",
        },
    ];
    const displayPlayers = safePlayers.length ? safePlayers : [{ memberId: 0, nickname: "빈 좌석" }];

    return (
        <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-lg" data-smoke="las-vegas-turn-rail-panel">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
                <div className="bg-slate-950 p-3">
                    <LasVegasTurnRailArt
                        players={safePlayers}
                        selectedRoom={selectedRoom}
                        state={state}
                        myMemberId={myMemberId}
                        readyMemberIds={readyMemberIds}
                        roomStatus={roomStatus}
                        winnerMemberId={winnerMemberId}
                    />
                </div>
                <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                                <GameUxGlyph type="turn" className="h-4 w-4 text-emerald-600" />
                                카지노 턴 레일
                            </div>
                            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                                좌석, 현재 차례, 준비 상태, 승자, 최근 배팅을 보드보다 먼저 읽도록 묶었습니다.
                            </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                            참가 {safePlayers.length}/{toPlainInt(selectedRoom?.maxPlayers, 6)}명
                        </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {tiles.map((tile) => (
                            <div key={tile.label} className={`min-h-[94px] rounded-xl border px-3 py-2 ${tile.tone}`} data-smoke="las-vegas-turn-rail-tile">
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
                            const memberId = Number(getLasVegasPlayerId(player) || 0);
                            const isCurrent = memberId > 0 && memberId === turnMemberId;
                            const isMe = memberId > 0 && memberId === Number(myMemberId || 0);
                            const isWinner = memberId > 0 && memberId === Number(winnerMemberId || 0);
                            const isHost = memberId > 0 && memberId === hostMemberId;
                            const isReady = memberId > 0 && (readyMemberIds?.has(memberId) || isHost);
                            const badge = isWinner ? "우승" : isCurrent ? "현재 차례" : isMe ? "내 좌석" : status === "WAITING" ? (isReady ? "준비" : "대기") : "참가";
                            return (
                                <div key={`las-vegas-rail-player-${memberId || index}`} className={`rounded-xl border px-3 py-2 ${isCurrent || isWinner ? "border-sky-200 bg-sky-50" : isMe ? "border-violet-200 bg-violet-50" : "border-slate-100 bg-slate-50"}`} data-smoke="las-vegas-turn-rail-player">
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
                                        좌석 {index + 1} · 보유금 {formatWon(player.totalMoney || 0)} · 남은 주사위 {player.remainingDice || 8}
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

const LasVegasPlayerRosterPanel = ({
    players = [],
    selectedRoom = null,
    roomStatus = "WAITING",
    myMemberId = null,
    winnerMemberId = null,
}) => {
    const safePlayers = Array.isArray(players) ? players : [];
    const normalizedStatus = String(roomStatus || selectedRoom?.roomStatus || "WAITING").toUpperCase();
    const waiting = normalizedStatus === "WAITING";
    const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
    const maxPlayers = toPlainInt(selectedRoom?.maxPlayers, 6);
    const sortedBySeat = [...safePlayers].sort((left, right) => {
        const leftSeat = toPlainInt(left?.seatNo || left?.seat_no, 999);
        const rightSeat = toPlainInt(right?.seatNo || right?.seat_no, 999);
        return leftSeat - rightSeat;
    });
    const guests = sortedBySeat.filter((player) => Number(getLasVegasPlayerId(player) || 0) !== hostMemberId);
    const readyGuestCount = guests.filter(isReadyPlayer).length;
    const rosterSummary = waiting
        ? (guests.length ? `게스트 준비 ${readyGuestCount}/${guests.length}` : "방장 대기")
        : `${sortedBySeat.length}/${maxPlayers || "-"}명`;

    const badgeTone = (key) => {
        if (key === "host") return "bg-amber-100 text-amber-700";
        if (key === "ready") return "bg-emerald-100 text-emerald-700";
        if (key === "waiting") return "bg-slate-100 text-slate-600";
        if (key === "me") return "bg-sky-100 text-sky-700";
        if (key === "winner") return "bg-amber-500 text-white";
        return "bg-primary-100 text-primary-700";
    };

    return (
        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-lg" data-smoke="las-vegas-player-roster" data-room-status={normalizedStatus}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Crown className="h-4 w-4 text-amber-500" />
                    플레이어
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{sortedBySeat.length}/{maxPlayers || "-"}명</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{rosterSummary}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {sortedBySeat.map((player, index) => {
                    const memberId = Number(getLasVegasPlayerId(player) || 0);
                    const seatNo = toPlainInt(player?.seatNo || player?.seat_no, index + 1);
                    const isHostPlayer = memberId > 0 && memberId === hostMemberId;
                    const isMe = memberId > 0 && Number(memberId) === Number(myMemberId || 0);
                    const isWinner = memberId > 0 && Number(memberId) === Number(winnerMemberId || 0);
                    const ready = isReadyPlayer(player);
                    const cardTone = isWinner
                        ? "border-amber-200 bg-amber-50"
                        : isMe
                            ? "border-sky-200 bg-sky-50"
                            : ready && waiting
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-slate-100 bg-slate-50";
                    const detail = waiting
                        ? `좌석 ${seatNo}${isHostPlayer ? " · 방장" : ""}`
                        : `좌석 ${seatNo} · 보유금 ${formatWon(player.totalMoney || 0)} · 주사위 ${player.remainingDice || 8}`;

                    return (
                        <div key={`player-${memberId || seatNo}`} className={`rounded-xl border p-3 ${cardTone}`} data-smoke="las-vegas-player-roster-item" data-ready={ready ? "true" : "false"} data-host={isHostPlayer ? "true" : "false"}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <UserAvatar
                                        name={player.nickname || `좌석 ${seatNo}`}
                                        profileUrl={player.profileUrl}
                                        level={player.level}
                                        rewardTier={player.rewardTier}
                                        frameCode={player.frameCode}
                                        size="sm"
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-black text-slate-900">{player.nickname || `좌석 ${seatNo}`}</div>
                                        <div className="mt-1 truncate text-xs font-bold text-slate-600">{detail}</div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                    {isWinner && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeTone("winner")}`}>우승</span>}
                                    {isHostPlayer && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeTone("host")}`}>방장</span>}
                                    {waiting && !isHostPlayer && (
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeTone(ready ? "ready" : "waiting")}`}>
                                            {ready ? "준비 완료" : "준비 대기"}
                                        </span>
                                    )}
                                    {isMe && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeTone("me")}`}>내 좌석</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!sortedBySeat.length && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-bold text-slate-500">
                    참가자 정보가 도착하면 프로필과 준비 상태가 표시됩니다.
                </div>
            )}
        </section>
    );
};

const LasVegasDecisionPanel = ({ state, players, myMemberId, currentRollCountByFace, canRoll, canBet, isFinished, lastPlacedText, winnerMemberId }) => {
    if (!state) return null;
    const decisionRows = buildLasVegasDecisionRows({ state, currentRollCountByFace, myMemberId });
    const turnName = lasVegasPlayerName(players, state.turnMemberId);
    const statusText = isFinished
        ? "게임 종료"
        : canRoll
            ? "주사위를 굴려 선택지를 만드세요."
            : canBet
                ? "굴린 눈 중 하나를 골라 같은 눈 주사위를 모두 배팅하세요."
                : `${turnName}님의 차례를 관전 중입니다.`;
    const winnerText = buildLasVegasWinnerText(players, winnerMemberId);
    const cueTone = isFinished ? "done" : canRoll || canBet ? "active" : "neutral";
    const cueItems = [
        { label: "차례", value: isFinished ? "종료" : turnName, icon: isFinished ? "win" : "turn", tone: isFinished ? "done" : canRoll || canBet ? "active" : "neutral" },
        { label: "행동", value: canRoll ? "굴리기" : canBet ? "배팅 선택" : "관전", icon: "decision", tone: canRoll || canBet ? "active" : "neutral" },
        { label: "라운드", value: `${state.roundNo || 0}/${state.roundCount || 0}`, icon: "stage" },
        { label: "최근", value: lastPlacedText || "기록 없음", icon: "recent" },
    ];
    const rolledDiceCount = Object.values(currentRollCountByFace || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    const leadingDecision = decisionRows[0];
    const leadingTone = String(leadingDecision?.value || "").includes("동점") ? "danger" : canBet ? "active" : "neutral";
    const lasVegasFlowItems = [
        {
            label: "라운드",
            value: `${state.roundNo || 0}/${state.roundCount || 0}`,
            detail: isFinished ? "모든 수익을 합산했습니다." : canRoll ? "굴림으로 배팅 후보를 만듭니다." : canBet ? `${rolledDiceCount}개 주사위 배팅 선택` : "상대 차례 진행 중",
            icon: "stage",
            tone: isFinished ? "done" : canRoll || canBet ? "active" : "neutral",
        },
        {
            label: "순번",
            value: isFinished ? "종료" : turnName,
            detail: canRoll || canBet ? "지금 선택이 라운드 수익을 좌우합니다." : "상대가 어느 카지노에 들어가는지 확인하세요.",
            icon: isFinished ? "win" : "turn",
            tone: isFinished ? "done" : canRoll || canBet ? "active" : "neutral",
        },
        {
            label: "카지노 압력",
            value: leadingDecision?.value || "후보 없음",
            detail: leadingDecision ? `${leadingDecision.title} · ${leadingDecision.detail}` : "굴림 또는 카지노 보상 정보를 기다립니다.",
            icon: "score",
            tone: leadingTone,
        },
        {
            label: isFinished ? "결과" : "최근 행동",
            value: isFinished ? "우승 확인" : lastPlacedText || "기록 없음",
            detail: isFinished ? winnerText : lastPlacedText || "배팅이 발생하면 직전 위치를 표시합니다.",
            icon: isFinished ? "win" : "recent",
            tone: isFinished ? "done" : "neutral",
        },
    ];

    return (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg" data-smoke="las-vegas-decision-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <GameUxGlyph type="decision" className="mt-0.5 h-10 w-10 shrink-0 text-amber-500" />
                    <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900">현재 라운드 요약</div>
                        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{statusText}</div>
                    </div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                    라운드 {state.roundNo || 0}/{state.roundCount || 0}
                </div>
            </div>
            {isFinished && (
                <GameResultSpotlight
                    title={winnerText}
                    subtitle="최종 정산"
                    detail="카지노별 머니 카드와 라운드 수익을 합산한 최종 결과입니다."
                    metric={`라운드 ${state.roundNo || state.roundCount || 0}/${state.roundCount || 0}`}
                    smoke="las-vegas-result-spotlight"
                    className="mt-3"
                />
            )}
            <LasVegasSettlementLedgerPanel
                state={state}
                players={players}
                winnerMemberId={winnerMemberId}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {lasVegasFlowItems.map((item) => (
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
                        title="라스베가스 라운드 흐름"
                        detail="라운드, 현재 차례, 카지노 보상 압력, 최근 배팅 근거를 순서대로 읽습니다."
                        items={lasVegasFlowItems}
                        tone={isFinished ? "amber" : "slate"}
                        smoke="las-vegas-flow-meter"
                    />
                    <LasVegasCasinoPressurePanel
                        state={state}
                        currentRollCountByFace={currentRollCountByFace}
                        myMemberId={myMemberId}
                        canBet={canBet}
                    />
                </div>
            </details>
            <GameActionCueBar
                title={isFinished ? "정산 결과 확인" : canRoll || canBet ? "내 라스베가스 행동" : "상대 배팅 관찰"}
                detail={statusText}
                items={cueItems}
                tone={cueTone}
                smoke="las-vegas-action-cue-bar"
                className="mt-3"
            />
            <div className="mt-3 grid gap-2 md:grid-cols-3">
                {decisionRows.map((row) => (
                    <div key={row.key} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-black text-slate-500">{row.title}</div>
                        <div className="mt-0.5 text-sm font-black text-slate-900">{row.value}</div>
                        <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{row.detail}</div>
                    </div>
                ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-800">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-black text-amber-700">
                        <GameUxGlyph type="recent" className="h-4 w-4" />
                        최근 행동
                    </div>
                    {lastPlacedText || "아직 배팅 기록이 없습니다."}
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold leading-relaxed text-emerald-800">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-black text-emerald-700">
                        <GameUxGlyph type="state" className="h-4 w-4" />
                        승리 흐름
                    </div>
                    {winnerText}
                </div>
            </div>
        </div>
    );
};

const buildLasVegasProgressDigest = ({ state, players, roomStatus, lastPlacedText, winnerMemberId, winnerNickname, currentRollCountByFace }) => {
    const safePlayers = Array.isArray(players) ? players : [];
    const normalizedStatus = String(roomStatus || state?.roomStatus || "WAITING").toUpperCase();
    const turnName = state?.turnMemberId ? lasVegasPlayerName(safePlayers, state.turnMemberId) : "-";
    const rollCount = Object.values(currentRollCountByFace || {}).reduce((sum, count) => sum + toPlainInt(count, 0), 0);
    const placedDiceCount = toPlainInt(state?.lastPlacedDiceCount, 0);
    const roundNo = toPlainInt(state?.roundNo, 0);
    const roundCount = toPlainInt(state?.roundCount, 0);
    const casinoCount = Array.isArray(state?.casinos) ? state.casinos.length : 6;
    const latestText = winnerMemberId
        ? `${winnerNickname || lasVegasPlayerName(safePlayers, winnerMemberId)} 우승으로 정산이 끝났습니다.`
        : lastPlacedText
            ? lastPlacedText
            : rollCount
                ? `${turnName}님이 공개 주사위 ${rollCount}개를 굴렸습니다.`
                : normalizedStatus === "PLAYING"
                    ? `${turnName}님의 선택을 기다립니다.`
                    : "방 상태와 참가자 준비를 확인하는 중입니다.";
    const items = [
        {
            key: "latest",
            icon: winnerMemberId ? "win" : lastPlacedText ? "recent" : "signal",
            label: "최근 진행",
            value: winnerMemberId ? "정산 완료" : lastPlacedText ? "배팅 반영" : rollCount ? "공개 굴림" : lasVegasRoomStatusLabel(normalizedStatus),
            detail: latestText,
            tone: winnerMemberId ? "border-amber-200 bg-amber-50 text-amber-900" : "border-cyan-200 bg-cyan-50 text-cyan-900",
        },
        {
            key: "actor",
            icon: "turn",
            label: "행동 주체",
            value: winnerMemberId ? (winnerNickname || lasVegasPlayerName(safePlayers, winnerMemberId)) : turnName,
            detail: normalizedStatus === "PLAYING" ? "현재 차례와 직전 배팅 주체를 함께 확인합니다." : "대기/종료 상태에서는 다음 행동 권한을 확인합니다.",
            tone: "border-slate-200 bg-slate-50 text-slate-800",
        },
        {
            key: "density",
            icon: "score",
            label: "기록 밀도",
            value: placedDiceCount ? `주사위 ${placedDiceCount}개` : rollCount ? `굴림 ${rollCount}개` : `${casinoCount}개 카지노`,
            detail: placedDiceCount ? "직전 배팅 수량이 어느 카지노 압력을 바꿨는지 추적합니다." : "카지노 보상과 공개 굴림이 아직 배팅으로 고정되지 않았습니다.",
            tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
        },
        {
            key: "phase",
            icon: "stage",
            label: "현재 단계",
            value: roundCount ? `${roundNo}/${roundCount}라운드` : lasVegasRoomStatusLabel(normalizedStatus),
            detail: normalizedStatus === "FINISHED" ? "최종 보상 정산 후 다음 행동을 고르면 됩니다." : normalizedStatus === "PLAYING" ? "라운드 안에서 굴림과 배팅이 번갈아 진행됩니다." : "시작 조건과 방 설정을 확인하는 단계입니다.",
            tone: "border-violet-200 bg-violet-50 text-violet-900",
        },
    ];
    return { items, winnerMemberId, status: normalizedStatus, roundNo, roundCount, rollCount, placedDiceCount };
};

const LasVegasProgressDigestArt = ({ digest }) => {
    const nodes = digest.items.slice(0, 4);
    return (
        <svg
            viewBox="0 0 420 168"
            role="img"
            aria-label="라스베가스 최근 진행 요약"
            className="h-full min-h-[156px] w-full"
            data-smoke="las-vegas-progress-digest-art"
        >
            <rect width="420" height="168" rx="24" fill="#020617" />
            <rect x="22" y="22" width="116" height="116" rx="22" fill="#111827" stroke="#334155" />
            <text x="80" y="50" textAnchor="middle" fill="#fef3c7" fontSize="12" fontWeight="900">최근 진행</text>
            <text x="80" y="78" textAnchor="middle" fill="#facc15" fontSize="24" fontWeight="900">{digest.roundCount ? `${digest.roundNo}/${digest.roundCount}` : digest.status}</text>
            <text x="80" y="101" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="800">라운드</text>
            <circle cx="80" cy="122" r="15" fill={digest.winnerMemberId ? "#f59e0b" : "#22d3ee"} />
            <path d="M74 122 h12 M80 116 v12" stroke="#082f49" strokeWidth="2" strokeLinecap="round" />
            <path d="M164 86 H382" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
            <path d="M164 86 H382" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            {nodes.map((node, index) => {
                const x = 164 + index * 72;
                return (
                    <g key={node.key} data-smoke="las-vegas-progress-digest-node" data-digest-key={node.key}>
                        <circle cx={x} cy="86" r="22" fill={index === 0 ? "#92400e" : "#1e293b"} stroke={index === 0 ? "#fde68a" : "#64748b"} strokeWidth="2" />
                        <text x={x} y="91" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="900">{index + 1}</text>
                        <text x={x} y="124" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{node.label}</text>
                    </g>
                );
            })}
            <rect x="166" y="24" width="154" height="26" rx="13" fill="#111827" stroke="#334155" />
            <text x="243" y="42" textAnchor="middle" fill="#bae6fd" fontSize="11" fontWeight="900">방금 무엇이 바뀌었나</text>
        </svg>
    );
};

const LasVegasProgressDigestPanel = ({ state, players, roomStatus, lastPlacedText, winnerMemberId, winnerNickname, currentRollCountByFace }) => {
    const digest = buildLasVegasProgressDigest({ state, players, roomStatus, lastPlacedText, winnerMemberId, winnerNickname, currentRollCountByFace });
    return (
        <section
            className="overflow-hidden rounded-[1.5rem] border border-amber-100 bg-white shadow-lg"
            data-smoke="las-vegas-progress-digest-panel"
            data-status={digest.status}
            data-round-no={digest.roundNo}
            data-roll-count={digest.rollCount}
            data-placed-count={digest.placedDiceCount}
        >
            <div className="grid gap-0 lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
                <div className="bg-slate-950 p-3">
                    <LasVegasProgressDigestArt digest={digest} />
                </div>
                <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                                <GameUxGlyph type="recent" className="h-4 w-4 text-amber-600" />
                                최근 진행 요약
                            </div>
                            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                                직전 굴림과 배팅, 현재 라운드, 정산 상태를 보드 아래로 내려가기 전에 확인합니다.
                            </div>
                        </div>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700">
                            {lasVegasRoomStatusLabel(digest.status)}
                        </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {digest.items.map((item) => (
                            <div key={item.key} className={`min-h-[104px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="las-vegas-progress-digest-item" data-digest-key={item.key}>
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

const buildLasVegasSessionActionItems = ({ selectedRoom, state, players, winnerMemberId, winnerNickname, isHost, rematching }) => {
    const safePlayers = Array.isArray(players) ? players : [];
    const winnerText = buildLasVegasWinnerText(safePlayers, winnerMemberId);
    const roundNo = state?.roundNo || state?.roundCount || selectedRoom?.roundCount || 0;
    const roundCount = state?.roundCount || selectedRoom?.roundCount || 0;
    const playerCount = safePlayers.length || toPlainInt(selectedRoom?.memberCount, 0);
    const totalMoney = safePlayers.reduce((sum, player) => sum + Number(player.totalMoney || player.total_money || 0), 0);
    const casinoCount = Array.isArray(state?.casinos) ? state.casinos.length : 6;
    return [
        {
            key: "winner",
            label: "우승 정리",
            value: winnerNickname ? `${winnerNickname} 우승` : "우승자 확인",
            detail: winnerText,
            icon: "win",
            tone: "border-amber-200 bg-amber-50 text-amber-900",
        },
        {
            key: "ledger",
            label: "정산 기준",
            value: `${casinoCount}개 카지노`,
            detail: `동점 제거 후 카지노별 보상을 더해 총 ${formatWon(totalMoney)} 흐름으로 판정했습니다.`,
            icon: "score",
            tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
        },
        {
            key: "room",
            label: "방 상태",
            value: lasVegasRoomStatusLabel(state?.roomStatus || selectedRoom?.roomStatus || "FINISHED"),
            detail: `${playerCount || "-"}명 참여, 라운드 ${roundNo}/${roundCount} 기록을 보관합니다.`,
            icon: "state",
            tone: "border-slate-200 bg-slate-50 text-slate-800",
        },
        {
            key: "next",
            label: "다음 행동",
            value: isHost ? (rematching ? "재대결 준비 중" : "재대결 가능") : "방장 선택 대기",
            detail: isHost ? "같은 방으로 새 판을 열거나, 결과를 확인한 뒤 게임 목록으로 돌아갈 수 있습니다." : "방장이 재대결을 열 때까지 결과와 채팅을 확인할 수 있습니다.",
            icon: "decision",
            tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
        },
    ];
};

const LasVegasSessionActionArt = ({ winnerNickname, roomCode, casinoCount }) => {
    const nodes = [
        { x: 62, y: 98, label: "승리", color: "#f59e0b" },
        { x: 158, y: 64, label: "정산", color: "#06b6d4" },
        { x: 260, y: 92, label: "방", color: "#10b981" },
        { x: 350, y: 58, label: "다음", color: "#8b5cf6" },
    ];
    return (
        <svg
            viewBox="0 0 420 160"
            role="img"
            aria-label="라스베가스 종료 세션 액션 아트"
            className="h-full min-h-[156px] w-full"
            data-smoke="las-vegas-session-action-art"
        >
            <rect x="14" y="18" width="392" height="124" rx="24" fill="#0f172a" />
            <path d="M38 120 C105 42 156 138 224 70 C282 18 326 96 386 40" stroke="#38bdf8" strokeWidth="4" fill="none" />
            <path d="M48 132 H372" stroke="#fbbf24" strokeWidth="3" strokeDasharray="10 8" />
            {nodes.map((node, index) => (
                <g key={node.label} data-smoke="las-vegas-session-action-node">
                    <circle cx={node.x} cy={node.y} r="22" fill={node.color} />
                    <circle cx={node.x} cy={node.y} r="14" fill="#ffffff" opacity="0.92" />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900">{index + 1}</text>
                    <text x={node.x} y={node.y + 36} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{node.label}</text>
                </g>
            ))}
            <rect x="42" y="28" width="132" height="28" rx="14" fill="#ffffff" opacity="0.12" />
            <text x="56" y="47" fill="#fef3c7" fontSize="12" fontWeight="900">{winnerNickname || "승자 확인"}</text>
            <rect x="238" y="116" width="132" height="22" rx="11" fill="#ffffff" opacity="0.14" />
            <text x="254" y="131" fill="#d1fae5" fontSize="10" fontWeight="900">코드 {roomCode || "-"} · 카지노 {casinoCount || 6}</text>
        </svg>
    );
};

const LasVegasSessionActionPanel = ({ selectedRoom, state, players, isHost, isFinished, winnerMemberId, winnerNickname, rematching, onRefresh, onRematch, onLeave }) => {
    if (!isFinished) return null;
    const actionItems = buildLasVegasSessionActionItems({
        selectedRoom,
        state,
        players,
        winnerMemberId,
        winnerNickname,
        isHost,
        rematching,
    });
    const casinoCount = Array.isArray(state?.casinos) ? state.casinos.length : 6;
    return (
        <section
            className="rounded-[1.5rem] border border-amber-200 bg-white p-4 shadow-lg"
            data-smoke="las-vegas-session-action-panel"
            data-session-status="FINISHED"
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)] lg:items-center">
                <LasVegasSessionActionArt
                    winnerNickname={winnerNickname}
                    roomCode={selectedRoom?.roomCode}
                    casinoCount={casinoCount}
                />
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">종료 세션</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{selectedRoom?.title || "라스베가스 방"}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-black text-slate-950">라스베가스 종료 세션 플랜</h2>
                    <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                        정산 요약에서 누가 왜 이겼는지 확인한 뒤, 같은 방 재대결이나 게임 목록 이동까지 한 번에 결정합니다.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {actionItems.map((item) => (
                            <div key={item.key} className={`min-h-[104px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="las-vegas-session-action-item">
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
                    data-smoke="las-vegas-session-action-refresh"
                >
                    상태 새로고침
                </button>
                <button
                    type="button"
                    className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={onRematch}
                    disabled={!isHost || rematching}
                    data-smoke="las-vegas-session-action-rematch"
                >
                    {rematching ? "재대결 준비 중" : isHost ? "같은 방 재대결" : "방장 재대결"}
                </button>
                <Link
                    to="/app/games"
                    className="rounded-xl bg-cyan-100 px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-700 hover:text-white"
                    data-smoke="las-vegas-session-action-hub"
                >
                    게임 목록
                </Link>
                <button
                    type="button"
                    className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-600 hover:text-white"
                    onClick={onLeave}
                    data-smoke="las-vegas-session-action-leave"
                >
                    방 나가기
                </button>
            </div>
        </section>
    );
};

const lasVegasSessionRoutePalette = {
    state: { fill: "#f8fafc", stroke: "#64748b", text: "#334155" },
    ready: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
    primary: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857" },
    exit: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c" },
};

const buildLasVegasSessionRouteItems = ({ roomStatus, isHost, startReadiness, selectedRoom, players, readyMemberIds, forceFinishing, rematching }) => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const safePlayers = Array.isArray(players) ? players : [];
    const hostId = Number(selectedRoom?.hostMemberId || 0);
    const guests = safePlayers.filter((player) => Number(getLasVegasPlayerId(player) || 0) !== hostId);
    const readyGuestCount = guests.filter((player) => readyMemberIds?.has(Number(getLasVegasPlayerId(player) || 0))).length;
    const minPlayers = toPlainInt(selectedRoom?.minPlayers, 2);
    const maxPlayers = toPlainInt(selectedRoom?.maxPlayers, 6);
    const canStart = Boolean(startReadiness?.canStart);
    const guestsReady = !guests.length || readyGuestCount === guests.length;
    const statusLabel = lasVegasRoomStatusLabel(normalizedStatus);
    const waiting = normalizedStatus === "WAITING";
    const playing = normalizedStatus === "PLAYING";
    const finished = normalizedStatus === "FINISHED";
    const playerCount = safePlayers.length || toPlainInt(selectedRoom?.memberCount, 0);

    return [
        {
            key: "state",
            label: "방 상태",
            value: statusLabel,
            detail: waiting
                ? `${playerCount}/${maxPlayers || "-"}명 입장, 최소 ${minPlayers}명 조건을 확인합니다.`
                : playing
                    ? "게임이 진행 중이라 준비/시작 버튼보다 현재 턴과 강제 종료 권한이 중요합니다."
                    : "종료된 세션은 결과 확인, 한 판 더 하기, 퇴장 루트로 정리됩니다.",
            icon: "state",
            tone: waiting ? "waiting" : playing ? "active" : "done",
        },
        {
            key: "ready",
            label: "준비 버튼",
            value: waiting ? (guests.length ? `${readyGuestCount}/${guests.length}명 준비` : "게스트 없음") : "준비 단계 종료",
            detail: waiting
                ? (guestsReady ? "게스트 준비 조건이 맞아 시작 버튼 판단으로 넘어갑니다." : "준비하지 않은 게스트가 있어 시작 버튼이 아직 대기 상태입니다.")
                : "게임 시작 후에는 실제 준비 버튼을 눌러도 진행 흐름 판단에 쓰이지 않습니다.",
            icon: "turn",
            tone: waiting ? (guestsReady ? "done" : "waiting") : "locked",
        },
        {
            key: "primary",
            label: finished ? "재대결 버튼" : playing ? "강제 종료" : "시작 버튼",
            value: finished
                ? (isHost ? (rematching ? "한 판 더 준비 중" : "한 판 더 가능") : "방장 선택 대기")
                : playing
                    ? (isHost ? (forceFinishing ? "강제 종료 중" : "방장 강제 종료 가능") : "플레이 흐름 관전")
                    : (isHost ? (canStart ? "방장 시작 가능" : "조건 대기") : "방장 시작 대기"),
            detail: finished
                ? (isHost ? "방장이 같은 방으로 재대결을 열 수 있고, 모든 플레이어는 결과를 확인한 뒤 퇴장할 수 있습니다." : "방장이 재대결을 선택하면 같은 방에서 다음 판을 이어갑니다.")
                : playing
                    ? (isHost ? "강제 종료는 진행 중인 세션을 종료하는 방장 전용 루트입니다." : "진행 중에는 턴/배팅 버튼이 핵심 루트이고 세션 시작 버튼은 닫힙니다.")
                    : (canStart ? "준비 조건이 맞아 실제 시작 버튼이 다음 행동입니다." : "인원 또는 게스트 준비가 맞아야 실제 시작 버튼을 눌러도 진행됩니다."),
            icon: finished ? "recent" : playing ? "decision" : "signal",
            tone: finished ? "done" : playing ? (isHost ? "danger" : "active") : canStart ? "done" : "waiting",
        },
        {
            key: "exit",
            label: "퇴장 버튼",
            value: "언제든 방 나가기",
            detail: finished ? "결과를 확인한 뒤 방을 나가거나 게임 목록으로 돌아갈 수 있습니다." : "퇴장은 기존 방 나가기 버튼을 그대로 사용하며 현재 방 상태를 바꾸는 별도 규칙을 추가하지 않습니다.",
            icon: "player",
            tone: "neutral",
        },
    ];
};

const LasVegasSessionRouteArt = ({ items, roomStatus, isHost, canStart }) => {
    const safeItems = Array.isArray(items) ? items : [];
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const nodePositions = [
        { x: 58, y: 86 },
        { x: 154, y: 54 },
        { x: 258, y: 86 },
        { x: 354, y: 54 },
    ];
    return (
        <svg
            viewBox="0 0 420 150"
            role="img"
            aria-label="라스베가스 세션 버튼 루트"
            className="h-full min-h-[148px] w-full"
            data-smoke="las-vegas-session-route-art"
            data-room-status={normalizedStatus}
            data-host={isHost ? "true" : "false"}
            data-can-start={canStart ? "true" : "false"}
        >
            <rect x="12" y="16" width="396" height="118" rx="24" fill="#fff7ed" />
            <path d="M52 96 C112 30 180 112 244 62 C292 24 334 96 382 48" stroke="#0f766e" strokeWidth="4" fill="none" />
            <path d="M48 114 H374" stroke="#f59e0b" strokeWidth="3" strokeDasharray="9 8" />
            {safeItems.map((item, index) => {
                const position = nodePositions[index] || { x: 58 + index * 88, y: 78 };
                const palette = lasVegasSessionRoutePalette[item.key] || lasVegasSessionRoutePalette.state;
                return (
                    <g key={item.key} data-smoke="las-vegas-session-route-node" data-route-key={item.key}>
                        <circle cx={position.x} cy={position.y} r="25" fill={palette.fill} stroke={palette.stroke} strokeWidth="3" />
                        <circle cx={position.x} cy={position.y} r="12" fill="#ffffff" />
                        <text x={position.x} y={position.y + 4} textAnchor="middle" fill={palette.text} fontSize="9" fontWeight="900">{index + 1}</text>
                        <text x={position.x} y={position.y + 37} textAnchor="middle" fill={palette.text} fontSize="10" fontWeight="900">{item.label}</text>
                    </g>
                );
            })}
            <rect x="34" y="28" width="118" height="24" rx="12" fill="#ffffff" opacity="0.9" />
            <text x="48" y="44" fill="#92400e" fontSize="11" fontWeight="900">{normalizedStatus}</text>
            <rect x="244" y="110" width="136" height="22" rx="11" fill="#0f172a" opacity="0.9" />
            <text x="258" y="125" fill="#fef3c7" fontSize="10" fontWeight="900">{isHost ? "방장 루트" : "참가자 루트"} · {canStart ? "시작 가능" : "상태 확인"}</text>
        </svg>
    );
};

const LasVegasSessionRoutePanel = ({ roomStatus, isHost, startReadiness, selectedRoom, players, readyMemberIds, forceFinishing, rematching }) => {
    if (!selectedRoom) return null;
    const routeItems = buildLasVegasSessionRouteItems({
        roomStatus,
        isHost,
        startReadiness,
        selectedRoom,
        players,
        readyMemberIds,
        forceFinishing,
        rematching,
    });
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const canStart = Boolean(startReadiness?.canStart);
    const toneClass = {
        done: "border-emerald-200 bg-emerald-50 text-emerald-900",
        active: "border-sky-200 bg-sky-50 text-sky-900",
        waiting: "border-amber-200 bg-amber-50 text-amber-900",
        locked: "border-slate-200 bg-slate-50 text-slate-700",
        danger: "border-rose-200 bg-rose-50 text-rose-900",
        neutral: "border-slate-200 bg-white text-slate-800",
    };
    return (
        <section
            className="mt-4 overflow-hidden rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-sm"
            data-smoke="las-vegas-session-route-panel"
            data-room-status={normalizedStatus}
            data-can-start={canStart ? "true" : "false"}
            data-host={isHost ? "true" : "false"}
            data-force-finishing={forceFinishing ? "true" : "false"}
            data-rematching={rematching ? "true" : "false"}
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.1fr)] lg:items-center">
                <LasVegasSessionRouteArt
                    items={routeItems}
                    roomStatus={normalizedStatus}
                    isHost={isHost}
                    canStart={canStart}
                />
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">실제 버튼 안내</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{isHost ? "방장 기준" : "참가자 기준"}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-black text-slate-950">라스베가스 세션 버튼 루트</h2>
                    <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                        준비, 시작, 강제 종료, 한 판 더 하기, 퇴장 버튼이 현재 방 상태에서 어떤 의미인지 먼저 보여줍니다. 실제 클릭 동작과 권한 조건은 기존 버튼을 그대로 따릅니다.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {routeItems.map((item) => (
                            <div key={item.key} className={`min-h-[108px] rounded-xl border px-3 py-2 ${toneClass[item.tone] || toneClass.neutral}`} data-smoke="las-vegas-session-route-item" data-route-key={item.key}>
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

const CasinoPanel = ({ casino, statePlayers, isHot, isLastPlaced }) => {
    const casinoNo = toPlainInt(casino.casinoNo, 0);
    const total = casino.totalMoney || casino.total_money || 0;
    const moneyCards = Array.isArray(casino.moneyCards)
        ? casino.moneyCards
        : Array.isArray(casino.money_cards)
            ? casino.money_cards
            : [];
    const diceByPlayer = casino.diceByPlayer && typeof casino.diceByPlayer === "object" && !Array.isArray(casino.diceByPlayer)
        ? casino.diceByPlayer
        : casino.dice_by_player && typeof casino.dice_by_player === "object" && !Array.isArray(casino.dice_by_player)
            ? casino.dice_by_player
            : {};
    const diceEntries = Object.entries(diceByPlayer).sort((a, b) => Number(b[1]) - Number(a[1]));
    const playerMap = useMemo(() => {
        const map = new Map();
        (statePlayers || []).forEach((player) => {
            map.set(Number(player.memberId), player);
        });
        return map;
    }, [statePlayers]);

    return (
        <article data-smoke="las-vegas-casino-panel" className={`rounded-2xl border p-2.5 shadow-xl backdrop-blur-md transition-all duration-500 sm:rounded-[1.6rem] sm:p-4 ${
            isHot || isLastPlaced
                ? "border-amber-300 bg-gradient-to-br from-amber-500/35 via-orange-500/30 to-slate-900/85 shadow-amber-400/30 scale-[1.01] ring-2 ring-amber-300/70"
                : "border-white/20 bg-gradient-to-br from-slate-900/80 to-slate-800/85 shadow-slate-900/30"
        }`}>
            <header className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <CasinoTableSign value={casinoNo} hot={isHot || isLastPlaced} className="h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                        <div className="text-[10px] font-black text-cyan-200">{casinoNo}번 카지노</div>
                        <div className="truncate text-sm font-black text-white">{casinoName[casinoNo] || `${casinoNo}번 카지노`}</div>
                    </div>
                </div>
                <div className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-black text-emerald-300 sm:text-xs">{formatWon(total)}</div>
            </header>
            {isLastPlaced && (
                <div className="mb-2 rounded-xl border border-amber-200/40 bg-amber-200/20 px-2 py-1 text-[10px] font-black text-amber-100">
                    직전 배팅 위치
                </div>
            )}

            <div className="mb-3 flex min-h-[2.5rem] flex-wrap gap-1.5 sm:mb-4 sm:min-h-[3.5rem] sm:gap-2">
                {!moneyCards.length && <CasinoEmptyLaneArt lane="money" casinoNo={casinoNo} />}
                {moneyCards.map((amount, idx) => (
                    <MoneyCard key={`${casinoNo}-money-${idx}-${amount}`} amount={amount} className="w-14 scale-90 sm:w-20" />
                ))}
            </div>

            <div className="space-y-1.5">
                {!diceEntries.length && <CasinoEmptyLaneArt lane="dice" casinoNo={casinoNo} />}
                {diceEntries.map(([memberId, count]) => {
                    const player = playerMap.get(Number(memberId));
                    const name = player?.nickname || `P${toPlainInt(memberId, 0)}`;
                    return (
                    <div key={`${casinoNo}-dice-${memberId}`} className="flex items-center justify-between rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-100">
                        <span className="flex min-w-0 items-center gap-1.5">
                            <UserAvatar
                                name={name}
                                profileUrl={player?.profileUrl}
                                level={player?.level}
                                rewardTier={player?.rewardTier}
                                frameCode={player?.frameCode}
                                size="xs"
                                className="border-white/20 bg-white/15 text-white"
                            />
                            <span className="line-clamp-1">{name}</span>
                        </span>
                        <DiceCountBadge value={casinoNo} count={toPlainInt(count, 0)} />
                    </div>
                    );
                })}
            </div>
        </article>
    );
};

const LasVegasActionAvailabilityArt = ({
    roomStatus,
    myTurn,
    canRoll,
    canBet,
    currentRollCountByFace,
    rolledDiceCount,
    className = "",
}) => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const rollFaces = Object.entries(currentRollCountByFace || {})
        .map(([face, count]) => ({ face: toPlainInt(face, 0), count: toPlainInt(count, 0) }))
        .filter((entry) => entry.face > 0 && entry.count > 0)
        .sort((left, right) => left.face - right.face);
    const topFace = rollFaces[0] || null;
    const statusText = normalizedStatus === "PLAYING" ? (myTurn ? "내 차례" : "관찰") : normalizedStatus === "FINISHED" ? "정산" : "대기";
    const nodes = [
        { key: "turn", label: "차례", value: statusText, x: 54, y: 90, fill: myTurn ? "#10b981" : "#64748b", active: myTurn },
        { key: "roll", label: "굴림", value: canRoll ? "가능" : `${rolledDiceCount || 0}개`, x: 144, y: 56, fill: canRoll ? "#38bdf8" : "#94a3b8", active: canRoll },
        { key: "candidate", label: "후보", value: canBet ? `${rollFaces.length}개` : "대기", x: 244, y: 90, fill: canBet ? "#f59e0b" : "#64748b", active: canBet },
        { key: "casino", label: "카지노", value: topFace ? `${topFace.face}번` : "선택", x: 338, y: 56, fill: canBet ? "#8b5cf6" : "#94a3b8", active: canBet },
    ];

    return (
        <svg
            viewBox="0 0 390 160"
            role="img"
            aria-label="라스베가스 행동 가능성 지도"
            className={className}
            data-smoke="las-vegas-action-availability-art"
            data-room-status={normalizedStatus}
            data-my-turn={myTurn ? "true" : "false"}
            data-can-roll={canRoll ? "true" : "false"}
            data-can-bet={canBet ? "true" : "false"}
            data-rolled-dice={rolledDiceCount || 0}
        >
            <rect width="390" height="160" rx="24" fill="#064e3b" />
            <rect x="18" y="18" width="354" height="124" rx="22" fill="#0f172a" stroke="#34d399" strokeWidth="2" opacity="0.94" />
            <text x="34" y="42" fill="#d1fae5" fontSize="12" fontWeight="900">굴림 → 후보 → 카지노</text>
            <text x="34" y="60" fill="#a7f3d0" fontSize="10" fontWeight="800">현재 차례와 공개 주사위로 가능한 행동을 먼저 확인합니다</text>
            <path d="M78 90 C104 64 116 56 144 56 S214 64 244 90 S310 82 338 56" fill="none" stroke={canRoll || canBet ? "#fbbf24" : "#475569"} strokeWidth="8" strokeLinecap="round" />
            <path d="M78 90 C104 64 116 56 144 56 S214 64 244 90 S310 82 338 56" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" opacity="0.58" />
            {nodes.map((node) => (
                <g key={node.key} data-smoke="las-vegas-action-availability-node" data-action-key={node.key}>
                    <circle cx={node.x} cy={node.y} r={node.active ? 25 : 22} fill={node.fill} stroke={node.active ? "#fef3c7" : "#cbd5e1"} strokeWidth={node.active ? "4" : "2"} />
                    <text x={node.x} y={node.y - 5} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{node.label}</text>
                    <text x={node.x} y={node.y + 12} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{node.value}</text>
                </g>
            ))}
            <g transform="translate(32 106)">
                {rollFaces.slice(0, 6).map((entry, index) => (
                    <g key={entry.face} transform={`translate(${index * 34} 0)`} data-smoke="las-vegas-action-availability-die" data-roll-face={entry.face}>
                        <rect x="0" y="0" width="26" height="26" rx="7" fill={canBet ? "#fef3c7" : "#334155"} stroke={canBet ? "#f59e0b" : "#64748b"} strokeWidth="2" />
                        <text x="13" y="17" textAnchor="middle" fill={canBet ? "#92400e" : "#cbd5e1"} fontSize="10" fontWeight="900">{entry.face}</text>
                        <text x="13" y="39" textAnchor="middle" fill="#d1fae5" fontSize="8" fontWeight="900">{entry.count}개</text>
                    </g>
                ))}
            </g>
            <text x="348" y="126" textAnchor="end" fill="#fde68a" fontSize="10" fontWeight="900">
                {canBet ? "같은 눈 모두 배팅" : canRoll ? "먼저 굴리기" : "행동 대기"}
            </text>
        </svg>
    );
};

const LasVegasActionAvailabilityPanel = ({
    roomStatus,
    myTurn,
    canRoll,
    canBet,
    currentRollCountByFace,
    onRoll,
    onBet,
}) => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const rolledDiceCount = Object.values(currentRollCountByFace || {}).reduce((sum, count) => sum + toPlainInt(count, 0), 0);

    return (
        <div
            className="mb-3 flex flex-wrap gap-2"
            data-smoke="las-vegas-action-availability-panel"
            data-room-status={normalizedStatus}
            data-my-turn={myTurn ? "true" : "false"}
            data-can-roll={canRoll ? "true" : "false"}
            data-can-bet={canBet ? "true" : "false"}
            data-rolled-dice={rolledDiceCount}
        >
            <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canRoll}
                onClick={onRoll}
                data-smoke="las-vegas-roll-action"
            >
                <Dices className="h-4 w-4" />
                주사위 굴리기
            </button>
            {canBet && Object.keys(currentRollCountByFace).map((face) => (
                <button
                    key={face}
                    className="min-h-10 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"
                    onClick={() => onBet(toPlainInt(face, 0))}
                    data-smoke="las-vegas-bet-action"
                >
                    {toPlainInt(face, 0)}번 배팅 ({toPlainInt(currentRollCountByFace[face], 0)}개)
                </button>
            ))}
        </div>
    );
};

const lasVegasActionRouteTone = (state) => ({
    ready: "border-emerald-200/40 bg-emerald-300/15 text-emerald-50",
    active: "border-cyan-200/40 bg-cyan-300/15 text-cyan-50",
    waiting: "border-white/15 bg-white/10 text-white/75",
    danger: "border-rose-200/40 bg-rose-300/15 text-rose-50",
}[state] || "border-white/15 bg-white/10 text-white/75");

const buildLasVegasActionRouteItems = ({
    roomStatus,
    myTurn,
    canRoll,
    canBet,
    currentRollCountByFace,
    roundNo,
    roundCount,
    casinoCount,
    lastPlacedText,
    turnName,
}) => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const rollFaces = Object.entries(currentRollCountByFace || {})
        .map(([face, count]) => ({ face: toPlainInt(face, 0), count: toPlainInt(count, 0) }))
        .filter((entry) => entry.face > 0 && entry.count > 0)
        .sort((left, right) => left.face - right.face);
    const rolledDiceCount = rollFaces.reduce((sum, entry) => sum + entry.count, 0);
    const playable = normalizedStatus === "PLAYING";
    const finished = normalizedStatus === "FINISHED";
    const topFace = rollFaces[0] || null;
    const roundLabel = playable || finished ? `${toPlainInt(roundNo, 0)}/${toPlainInt(roundCount, 0) || "-"}` : "대기";
    const rollDetail = !playable
        ? "게임이 시작되면 현재 차례 플레이어가 먼저 주사위를 굴립니다."
        : canRoll
            ? "아직 공개 주사위가 없으므로 굴림 버튼이 다음 실제 행동입니다."
            : rolledDiceCount
                ? `${rolledDiceCount}개 주사위 결과를 같은 눈별 카지노 후보로 읽습니다.`
                : "공개 주사위가 들어오면 배치 후보가 열립니다.";
    const betDetail = canBet
        ? "같은 눈의 주사위는 모두 해당 번호 카지노에 한 번에 배치됩니다."
        : canRoll
            ? "굴림 뒤에 나온 눈이 카지노 선택 후보가 됩니다."
            : playable
                ? `${turnName || "상대"}의 배치 선택을 관찰하는 단계입니다.`
                : "대기 상태에서는 카지노 배치를 제출하지 않습니다.";

    return [
        {
            key: "turn",
            label: "차례 확인",
            value: finished ? "정산" : myTurn ? "내 차례" : turnName || "관찰",
            detail: finished ? "최종 수익 합계를 확인합니다." : myTurn ? "내 행동 버튼이 열릴 수 있는 차례입니다." : "상대가 굴림이나 카지노 배치를 고르는 중입니다.",
            state: finished ? "waiting" : myTurn ? "ready" : "waiting",
        },
        {
            key: "roll",
            label: "주사위 굴림",
            value: canRoll ? "굴림 가능" : rolledDiceCount ? `${rolledDiceCount}개 공개` : "대기",
            detail: rollDetail,
            state: canRoll ? "ready" : rolledDiceCount ? "active" : "waiting",
        },
        {
            key: "casino",
            label: "카지노 선택",
            value: canBet ? `${rollFaces.length}개 후보` : topFace ? `${topFace.face}번 후보` : `${casinoCount || 0}개 테이블`,
            detail: betDetail,
            state: canBet ? "ready" : topFace ? "active" : "waiting",
        },
        {
            key: "result",
            label: "다음 정산",
            value: finished ? "결과" : `라운드 ${roundLabel}`,
            detail: lastPlacedText || (finished ? "동점 제거 뒤 가장 많은 주사위가 수익을 가져갑니다." : "배치가 끝나면 다음 차례 또는 라운드 정산으로 넘어갑니다."),
            state: finished ? "ready" : lastPlacedText ? "active" : "waiting",
        },
    ];
};

const LasVegasActionRouteArt = ({ items = [], currentRollCountByFace, canRoll = false, canBet = false }) => {
    const paletteByState = {
        ready: { fill: "#bbf7d0", stroke: "#22c55e", text: "#166534" },
        active: { fill: "#cffafe", stroke: "#06b6d4", text: "#155e75" },
        waiting: { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155" },
        danger: { fill: "#ffe4e6", stroke: "#e11d48", text: "#9f1239" },
    };
    const rollFaces = Object.entries(currentRollCountByFace || {})
        .map(([face, count]) => ({ face: toPlainInt(face, 0), count: toPlainInt(count, 0) }))
        .filter((entry) => entry.face > 0 && entry.count > 0)
        .sort((left, right) => left.face - right.face);
    const nodes = items.slice(0, 4).map((item, index) => ({
        ...item,
        x: 64 + index * 104,
        y: index % 2 ? 110 : 76,
    }));
    const statusLabel = canBet ? "배치 후보" : canRoll ? "굴림 준비" : "흐름 확인";

    return (
        <svg
            data-smoke="las-vegas-action-route-art"
            viewBox="0 0 404 190"
            className="h-auto w-full"
            role="img"
            aria-label={`라스베가스 액션 루트 ${statusLabel}`}
            focusable="false"
        >
            <rect x="8" y="8" width="388" height="174" rx="28" fill="#064e3b" stroke="#34d399" strokeWidth="3" />
            <path d="M34 132c48-44 93-48 136-12 48 40 99 38 153-6 26-21 43-18 53 10v37H34Z" fill="#0f172a" opacity="0.38" />
            <path d="M64 76c52-28 104-18 154 32 42 42 87 47 135 12" fill="none" stroke="#99f6e4" strokeWidth="9" strokeLinecap="round" opacity="0.62" />
            {nodes.map((node, index) => {
                const palette = paletteByState[node.state] || paletteByState.waiting;
                const active = node.state === "ready";
                return (
                    <g key={node.key} data-smoke="las-vegas-action-route-node">
                        {index < nodes.length - 1 && (
                            <path
                                d={`M${node.x + 30} ${node.y}L${nodes[index + 1].x - 30} ${nodes[index + 1].y}`}
                                stroke={node.state === "ready" ? "#fef3c7" : "#5eead4"}
                                strokeWidth="4"
                                strokeLinecap="round"
                                opacity={node.state === "waiting" ? 0.42 : 0.92}
                            />
                        )}
                        <circle cx={node.x} cy={node.y} r={active ? 32 : 28} fill={palette.fill} stroke={active ? "#fef3c7" : palette.stroke} strokeWidth={active ? 5 : 3} />
                        {node.key === "turn" && (
                            <g>
                                <circle cx={node.x} cy={node.y - 6} r="10" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                                <path d={`M${node.x - 14} ${node.y + 17}c5-14 11-21 14-21s9 7 14 21`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" />
                            </g>
                        )}
                        {node.key === "roll" && (
                            <g>
                                <rect x={node.x - 17} y={node.y - 17} width="34" height="34" rx="9" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                                <circle cx={node.x - 7} cy={node.y - 7} r="3" fill={palette.text} />
                                <circle cx={node.x} cy={node.y} r="3" fill={palette.text} />
                                <circle cx={node.x + 7} cy={node.y + 7} r="3" fill={palette.text} />
                            </g>
                        )}
                        {node.key === "casino" && (
                            <g>
                                <rect x={node.x - 19} y={node.y - 15} width="38" height="30" rx="8" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                                <path d={`M${node.x - 12} ${node.y + 6}h24M${node.x - 10} ${node.y - 4}h20`} stroke={palette.text} strokeWidth="4" strokeLinecap="round" />
                            </g>
                        )}
                        {node.key === "result" && (
                            <g>
                                <circle cx={node.x - 7} cy={node.y} r="13" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                                <circle cx={node.x + 10} cy={node.y + 2} r="13" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
                                <text x={node.x + 10} y={node.y + 6} textAnchor="middle" fontSize="10" fontWeight="900" fill="#92400e">₩</text>
                            </g>
                        )}
                        <text x={node.x} y={node.y + 50} textAnchor="middle" fontSize="11" fontWeight="900" fill="#d1fae5">{node.label}</text>
                    </g>
                );
            })}
            <rect x="28" y="24" width="122" height="28" rx="14" fill="#ecfeff" stroke="#67e8f9" />
            <text x="89" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#155e75">{statusLabel}</text>
            <g transform="translate(260 25)">
                {rollFaces.slice(0, 4).map((entry, index) => (
                    <g key={entry.face} transform={`translate(${index * 28} 0)`} data-smoke="las-vegas-action-route-die" data-roll-face={entry.face}>
                        <rect x="0" y="0" width="22" height="22" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
                        <text x="11" y="15" textAnchor="middle" fontSize="9" fontWeight="900" fill="#92400e">{entry.face}</text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

const LasVegasActionRoutePanel = ({
    roomStatus,
    myTurn,
    canRoll,
    canBet,
    currentRollCountByFace,
    roundNo,
    roundCount,
    casinoCount,
    lastPlacedText,
    turnName,
}) => {
    const items = buildLasVegasActionRouteItems({
        roomStatus,
        myTurn,
        canRoll,
        canBet,
        currentRollCountByFace,
        roundNo,
        roundCount,
        casinoCount,
        lastPlacedText,
        turnName,
    });
    const rolledDiceCount = Object.values(currentRollCountByFace || {}).reduce((sum, count) => sum + toPlainInt(count, 0), 0);
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const statusLabel = normalizedStatus === "PLAYING" ? (myTurn ? "내 행동 흐름" : "상대 행동 관찰") : normalizedStatus === "FINISHED" ? "정산 흐름" : "시작 대기";

    return (
        <section
            data-smoke="las-vegas-action-route-panel"
            data-room-status={normalizedStatus}
            data-my-turn={myTurn ? "true" : "false"}
            data-can-roll={canRoll ? "true" : "false"}
            data-can-bet={canBet ? "true" : "false"}
            data-rolled-dice={rolledDiceCount}
            data-round={`${toPlainInt(roundNo, 0)}/${toPlainInt(roundCount, 0) || 0}`}
            className="mt-3 overflow-hidden rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="text-xs font-black text-emerald-100">라스베가스 액션 루트</div>
                    <div className="mt-1 text-lg font-black text-white">차례 확인, 주사위 굴림, 카지노 선택, 다음 정산</div>
                    <div className="mt-1 text-xs font-bold leading-relaxed text-white/65">굴림 결과가 어떤 카지노 배치 버튼으로 이어지는지 먼저 확인합니다.</div>
                </div>
                <span className="rounded-full bg-emerald-300 px-3 py-1 text-[11px] font-black text-slate-950">
                    {statusLabel}
                </span>
            </div>
            <LasVegasActionRouteArt
                items={items}
                currentRollCountByFace={currentRollCountByFace}
                canRoll={canRoll}
                canBet={canBet}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                    <div
                        key={item.key}
                        data-smoke="las-vegas-action-route-item"
                        data-route-key={item.key}
                        className={`min-h-[92px] rounded-xl border px-3 py-2 ${lasVegasActionRouteTone(item.state)}`}
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

const LasVegasRollStandbyArt = ({
    roomStatus,
    myTurn = false,
    canRoll = false,
    roundNo = 0,
    roundCount = 0,
    casinoCount = 6,
}) => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const nodes = [
        { key: "round", label: `라운드 ${roundNo}/${roundCount || "-"}`, x: 58, active: normalizedStatus === "PLAYING", fill: "#38bdf8" },
        { key: "roll", label: canRoll ? "굴리기" : "대기", x: 136, active: canRoll, fill: "#22c55e" },
        { key: "table", label: `${casinoCount}개 카지노`, x: 214, active: casinoCount > 0, fill: "#f59e0b" },
        { key: "turn", label: myTurn ? "내 차례" : "관찰", x: 292, active: myTurn, fill: "#a78bfa" },
    ];

    return (
        <svg
            viewBox="0 0 340 170"
            role="img"
            aria-label="라스베가스 공개 주사위가 아직 없을 때 다음 행동을 안내하는 테이블"
            className="h-full min-h-[170px] w-full"
            data-smoke="las-vegas-roll-standby-art"
        >
            <rect x="0" y="0" width="340" height="170" rx="24" fill="#082f49" />
            <rect x="20" y="20" width="300" height="108" rx="18" fill="#0f766e" stroke="#99f6e4" strokeWidth="3" opacity="0.92" />
            <ellipse cx="170" cy="84" rx="118" ry="38" fill="#0f172a" opacity="0.16" />
            {[0, 1, 2].map((index) => {
                const x = 112 + index * 34;
                const y = index === 1 ? 60 : 76;
                return (
                    <g key={`die-${index}`} data-smoke="las-vegas-roll-standby-node" data-standby-key={`die-${index}`}>
                        <rect x={x} y={y} width="30" height="30" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
                        <circle cx={x + 10} cy={y + 10} r="3" fill="#0f172a" />
                        <circle cx={x + 20} cy={y + 20} r="3" fill="#0f172a" />
                        {index === 1 && <circle cx={x + 15} cy={y + 15} r="3" fill="#0f172a" />}
                    </g>
                );
            })}
            <path d="M48 126H292" fill="none" stroke="#bae6fd" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
            {nodes.map((node, index) => (
                <g key={node.key} data-smoke="las-vegas-roll-standby-node" data-standby-key={node.key}>
                    {index > 0 && <path d={`M${nodes[index - 1].x + 15} 126H${node.x - 15}`} stroke={node.active ? node.fill : "#64748b"} strokeWidth="4" strokeLinecap="round" />}
                    <circle cx={node.x} cy="126" r="16" fill={node.active ? node.fill : "#164e63"} stroke={node.fill} strokeWidth="3" />
                    <circle cx={node.x} cy="126" r="5" fill={node.active ? "#ffffff" : node.fill} />
                    <text x={node.x} y="154" textAnchor="middle" fill="#ecfeff" fontSize="10" fontWeight="900">{node.label}</text>
                </g>
            ))}
            <text x="28" y="44" fill="#ecfeff" fontSize="13" fontWeight="900">공개 굴림 대기</text>
            <text x="28" y="62" fill="#ccfbf1" fontSize="10" fontWeight="800">굴림이 나오면 같은 눈을 모두 한 카지노에 배팅합니다</text>
        </svg>
    );
};

const LasVegasRollStandbyPanel = ({
    roomStatus,
    myTurn,
    canRoll,
    canBet,
    roundNo,
    roundCount,
    turnName,
    casinoCount,
    lastPlacedText,
}) => {
    const normalizedStatus = String(roomStatus || "WAITING").toUpperCase();
    const playing = normalizedStatus === "PLAYING";
    const headline = playing
        ? (myTurn ? "아직 공개 주사위가 없습니다. 먼저 굴림으로 배팅 후보를 만드세요." : `${turnName || "상대"}님의 굴림을 기다리는 중입니다.`)
        : "게임이 시작되면 이 자리에 공개 주사위가 먼저 나타납니다.";
    const items = [
        {
            key: "state",
            icon: "state",
            label: "보드 상태",
            value: playing ? "굴림 전" : "시작 대기",
            detail: playing ? "공개 주사위가 없어서 카지노 배팅 숫자도 아직 열리지 않았습니다." : "대기방에서는 준비 상태와 방장 시작 조건을 먼저 확인합니다.",
            tone: playing ? "active" : "neutral",
        },
        {
            key: "roll",
            icon: "input",
            label: "다음 행동",
            value: canRoll ? "주사위 굴리기" : canBet ? "배팅 선택" : "행동 대기",
            detail: canRoll ? "굴리면 나온 눈 중 하나를 골라 같은 눈 주사위를 모두 배치합니다." : "내 차례가 아니면 상대가 어떤 카지노 후보를 만드는지 관찰하세요.",
            tone: canRoll || canBet ? "active" : "neutral",
        },
        {
            key: "round",
            icon: "stage",
            label: "라운드",
            value: `${roundNo || 0}/${roundCount || "-"}`,
            detail: `${casinoCount || 0}개 카지노의 보상과 동점 위험은 굴림 이후 다시 비교합니다.`,
            tone: "waiting",
        },
        {
            key: "recent",
            icon: "recent",
            label: "최근 흐름",
            value: lastPlacedText ? "배팅 기록 있음" : "기록 없음",
            detail: lastPlacedText || "이번 라운드의 첫 굴림 또는 다음 배팅을 기다리고 있습니다.",
            tone: lastPlacedText ? "done" : "neutral",
        },
    ];
    const toneClass = {
        active: "border-emerald-200/60 bg-emerald-300/15 text-emerald-50",
        done: "border-amber-200/60 bg-amber-300/15 text-amber-50",
        waiting: "border-sky-200/60 bg-sky-300/15 text-sky-50",
        neutral: "border-white/15 bg-white/10 text-white",
    };

    return (
        <section className="mb-3 overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-3 shadow-inner" data-smoke="las-vegas-roll-standby-panel" data-roll-ready={canRoll ? "true" : "false"} data-room-status={normalizedStatus}>
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,340px)_minmax(0,1fr)] lg:items-stretch">
                <div className="rounded-xl border border-white/10 bg-slate-950/40">
                    <LasVegasRollStandbyArt roomStatus={roomStatus} myTurn={myTurn} canRoll={canRoll} roundNo={roundNo} roundCount={roundCount} casinoCount={casinoCount} />
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/20 p-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black text-cyan-100">
                        <GameUxGlyph type="decision" className="h-3.5 w-3.5" />
                        공개 주사위 없음
                    </div>
                    <h3 className="mt-3 text-lg font-black text-white">굴림 전 보드 상태</h3>
                    <p className="mt-2 text-sm font-bold leading-relaxed text-cyan-50/80">{headline}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {items.map((item) => (
                            <div key={item.key} className={`min-h-[98px] rounded-xl border px-3 py-2 ${toneClass[item.tone] || toneClass.neutral}`} data-smoke="las-vegas-roll-standby-item" data-standby-key={item.key}>
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

const LasVegasJoinCodeArt = ({ joinCode, className = "" }) => {
    const codeText = String(joinCode || "").trim().toUpperCase();
    const visibleCode = codeText ? codeText.slice(0, 8) : "방코드";
    const nodes = [
        { key: "code", label: "코드", x: 58 },
        { key: "table", label: "테이블", x: 180 },
        { key: "seat", label: "좌석", x: 302 },
    ];

    return (
        <svg
            viewBox="0 0 360 132"
            role="img"
            aria-label="라스베가스 방 코드 입장 흐름"
            className={className}
            data-smoke="las-vegas-join-code-art"
        >
            <rect width="360" height="132" rx="22" fill="#0f172a" />
            <rect x="24" y="18" width="312" height="50" rx="16" fill="#111827" stroke="#f59e0b" strokeWidth="2" />
            <text x="42" y="38" fill="#fde68a" fontSize="11" fontWeight="900">카지노 초대 코드</text>
            <text x="42" y="59" fill="#fff7ed" fontSize="20" fontWeight="900">{visibleCode}</text>
            <g transform="translate(286 28)">
                <rect x="0" y="0" width="28" height="28" rx="7" fill={codeText ? "#fbbf24" : "#334155"} />
                {[7, 14, 21].map((x, index) => (
                    <circle key={x} cx={x} cy={index === 1 ? 14 : 8} r="2.2" fill={codeText ? "#78350f" : "#94a3b8"} />
                ))}
                <circle cx="7" cy="21" r="2.2" fill={codeText ? "#78350f" : "#94a3b8"} />
                <circle cx="21" cy="21" r="2.2" fill={codeText ? "#78350f" : "#94a3b8"} />
            </g>
            <path d="M66 96 H294" fill="none" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
            <path d="M66 96 H294" fill="none" stroke={codeText ? "#f59e0b" : "#94a3b8"} strokeWidth="3" strokeLinecap="round" />
            {nodes.map((node, index) => (
                <g key={node.key} data-smoke="las-vegas-join-code-node">
                    <circle cx={node.x} cy="96" r="18" fill={codeText ? "#78350f" : "#1f2937"} stroke={codeText ? "#fef3c7" : "#64748b"} strokeWidth="2" />
                    <text x={node.x} y="100" textAnchor="middle" fill="#fff7ed" fontSize="11" fontWeight="900">{index + 1}</text>
                    <text x={node.x} y="125" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="900">{node.label}</text>
                </g>
            ))}
        </svg>
    );
};

const LasVegasJoinCodePanel = ({ joinCode, setJoinCode, loading, joinRoomByCode }) => {
    const hasCode = String(joinCode || "").trim().length > 0;

    return (
        <form
            className="mb-4 overflow-hidden rounded-2xl border border-amber-100 bg-slate-950 text-white shadow-lg"
            onSubmit={joinRoomByCode}
            aria-label="라스베가스 방 코드 입장"
            data-smoke="las-vegas-join-code-panel"
        >
            <div className="p-3">
                <LasVegasJoinCodeArt joinCode={joinCode} className="mb-3 h-28 w-full" />
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-black text-amber-100">
                        <GameUxGlyph type="signal" className="h-4 w-4 text-amber-300" />
                        카지노 코드 입장
                    </div>
                    <div className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
                        초대 코드를 입력하면 같은 카지노 테이블과 좌석 합류 흐름으로 이어집니다.
                    </div>
                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <input
                            aria-label="방 코드"
                            className="min-h-11 min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm uppercase text-white placeholder:text-slate-400"
                            placeholder="방코드"
                            value={joinCode}
                            maxLength={8}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                            data-smoke="las-vegas-join-code-input"
                        />
                        <button
                            type="submit"
                            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                            disabled={loading}
                            data-smoke="las-vegas-join-code-submit"
                        >
                            코드 입장
                        </button>
                    </div>
                    <div className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-bold leading-relaxed ${hasCode ? "bg-amber-400/15 text-amber-100" : "bg-white/10 text-slate-300"}`} data-smoke="las-vegas-join-code-status">
                        {hasCode ? "입력한 코드로 라스베가스 테이블을 찾을 준비가 됐습니다." : "방장이 공유한 코드를 입력하면 대기 중인 테이블을 찾습니다."}
                    </div>
                </div>
            </div>
        </form>
    );
};

export const LasVegasGame = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [state, setState] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [rematching, setRematching] = useState(false);
    const [forceFinishing, setForceFinishing] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(null);
    const [createForm, setCreateForm] = useState({
        title: "",
        roundCount: "3",
        turnTimeSeconds: "50",
    });
    const [joinCode, setJoinCode] = useState("");
    const [settingsForm, setSettingsForm] = useState({
        roundCount: "3",
        turnTimeSeconds: "50",
    });
    const [startBotCount, setStartBotCount] = useState(0);
    const [hotCasinoNo, setHotCasinoNo] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(initialLasVegasActionFeedback);

    const stompRef = useRef(null);
    const stompInitRef = useRef(null);
    const gameSubRef = useRef(null);
    const chatSubRef = useRef(null);
    const realtimeRoomRef = useRef(null);
    const mountedRef = useRef(false);
    const chatScrollRef = useRef(null);
    const prevCasinoSignatureRef = useRef("");
    const lastReadMarkAtRef = useRef(0);
    const audioContextRef = useRef(null);
    const isBetSoundPlayingRef = useRef(false);

    const myMemberId = getMemberId(user) || user?.id || null;
    const gameChatRoomId = normalizeRoomId(selectedRoom);
    const chatRoomId = null;
    const roomStatus = state?.roomStatus || selectedRoom?.roomStatus || null;
    const normalizedRoomStatus = String(roomStatus || "WAITING").toUpperCase();
    const isWaiting = normalizedRoomStatus === "WAITING";
    const isPlaying = normalizedRoomStatus === "PLAYING";
    const isFinished = normalizedRoomStatus === "FINISHED";

    useEffect(() => {
        setPageGuideContext({
            game: "las-vegas",
            context: selectedRoom ? (state || isPlaying || isFinished ? "play" : "waiting-room") : "lobby",
        });
        return clearPageGuideContext;
    }, [isFinished, isPlaying, selectedRoom, state]);

    const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
    const isHost = Boolean(selectedRoom && myMemberId &&
        hostMemberId === Number(myMemberId));
    const myTurn = state && myMemberId &&
        Number(state.turnMemberId) === Number(myMemberId);
    const canRoll = !isFinished && myTurn && (!state?.currentRoll || state.currentRoll.length === 0);
    const canBet = !isFinished && myTurn && (state?.currentRoll?.length || 0) > 0;

    const currentRoll = state?.currentRoll || [];
    const casinoRows = Array.isArray(state?.casinos) ? state.casinos : [];
    const showGameBoard = casinoRows.length > 0 || isPlaying || isFinished;
    const currentRollCountByFace = useMemo(() => {
        const count = {};
        currentRoll.forEach((value) => {
            count[value] = (count[value] || 0) + 1;
        });
        return count;
    }, [currentRoll]);

    const livePlayers = Array.isArray(state?.players) ? state.players : [];
    const roomPlayers = Array.isArray(selectedRoom?.players) ? selectedRoom.players : [];
    const players = livePlayers.length > 0 ? livePlayers : roomPlayers;
    const readyMemberIds = useMemo(() => extractReadyMemberIds(players), [players]);
    const startBotMax = selectedRoom && isWaiting
        ? Math.max(0, toPlainInt(selectedRoom.maxPlayers, 6) - players.length)
        : 0;
    const effectiveStartBotCount = Math.min(
        Math.max(0, toPlainInt(startBotCount, 0)),
        startBotMax
    );
    const startBotOptions = Array.from({ length: startBotMax + 1 }, (_, index) => index);
    const lobbySetup = useMemo(() => {
        const title = String(createForm.title || "").trim();
        const roundCount = toPlainInt(createForm.roundCount, 4);
        const turnTimeSeconds = toPlainInt(createForm.turnTimeSeconds, 50);
        const code = String(joinCode || "").trim().toUpperCase();
        const waitingRoomCount = Array.isArray(rooms) ? rooms.filter((room) => String(room?.roomStatus || "WAITING").toUpperCase() === "WAITING").length : 0;
        return {
            statusText: code ? "코드 입장 준비" : "호스트 설정 준비",
            items: [
                {
                    label: "테이블 간판",
                    value: title ? "제목 입력됨" : "자동 제목 가능",
                    detail: title || "제목이 비어 있어도 기본 라스베가스 테이블 이름으로 만들 수 있습니다.",
                    icon: "state",
                    tone: title ? "done" : "waiting",
                    progress: title ? Math.min(100, Math.max(18, (title.length / 24) * 100)) : 8,
                },
                {
                    label: "라운드",
                    value: `${roundCount}회`,
                    detail: "라운드가 많을수록 누적 수익과 역전 타이밍을 더 오래 봅니다.",
                    icon: "stage",
                    tone: roundCount >= 3 ? "active" : "waiting",
                    progress: (roundCount / 10) * 100,
                },
                {
                    label: "턴 시간",
                    value: `${turnTimeSeconds}초`,
                    detail: "각 차례의 주사위 굴림과 카지노 배팅 판단 시간입니다.",
                    icon: "turn",
                    tone: turnTimeSeconds >= 20 ? "done" : "waiting",
                    progress: (turnTimeSeconds / 180) * 100,
                },
                {
                    label: "코드 입장",
                    value: code ? "코드 입력됨" : `${waitingRoomCount}개 대기방`,
                    detail: code ? `${code} 코드로 바로 테이블을 찾습니다.` : "코드가 없으면 대기방 카드에서 입장할 수 있습니다.",
                    icon: "signal",
                    tone: code ? "done" : waitingRoomCount ? "active" : "waiting",
                    progress: code ? Math.min(100, Math.max(24, (code.length / 8) * 100)) : 8,
                },
            ],
            ruleHint: "이 셋업 패널은 입력값 설명만 담당합니다. 방 생성, 코드 입장, 주사위/카지노/정산 규칙은 기존 서버 로직을 그대로 따릅니다.",
        };
    }, [createForm.roundCount, createForm.title, createForm.turnTimeSeconds, joinCode, rooms]);
    const startReadiness = useMemo(() => {
        if (!selectedRoom) return null;
        const roomPlayersForReadiness = Array.isArray(players) ? players : [];
        const guests = roomPlayersForReadiness.filter((player) => Number(getLasVegasPlayerId(player) || 0) !== hostMemberId);
        const readyGuestCount = guests.filter((player) => readyMemberIds.has(Number(getLasVegasPlayerId(player) || 0))).length;
        const minPlayers = toPlainInt(selectedRoom.minPlayers, 2);
        const maxPlayers = toPlainInt(selectedRoom.maxPlayers, 6);
        const roundCount = toPlainInt(selectedRoom.roundCount, 4);
        const turnTimeSeconds = toPlainInt(selectedRoom.turnTimeSeconds, 30);
        const startPlayerCount = roomPlayersForReadiness.length + effectiveStartBotCount;
        const startUsesBots = effectiveStartBotCount > 0;
        const enoughPlayers = startPlayerCount >= minPlayers;
        const soloAiStartAvailable = roomPlayersForReadiness.length === 1 && startUsesBots && minPlayers > 1;
        const playerRequirementMet = enoughPlayers;
        const withinMaxPlayers = maxPlayers <= 0 || startPlayerCount <= maxPlayers;
        const guestsReady = !guests.length || readyGuestCount === guests.length;
        const startSignalReady = isWaiting && playerRequirementMet && withinMaxPlayers && guestsReady;
        const playerProgress = minPlayers > 0 ? (startPlayerCount / minPlayers) * 100 : 100;
        const guestProgress = guests.length > 0 ? (readyGuestCount / guests.length) * 100 : 100;
        const waitingReason = !isWaiting
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
                        : soloAiStartAvailable ? "방장 혼자 AI와 바로 시작할 수 있습니다." : "초대 또는 코드 입장으로 최소 인원을 채웁니다.",
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
                    label: "규칙 설정",
                    value: `라운드 ${roundCount}회`,
                    detail: `턴 ${turnTimeSeconds}초 · 카지노 선택 전 주사위 결과 확인`,
                    icon: "stage",
                    tone: "active",
                },
            ],
            ruleHint: "라스베가스는 인원 조건과 게스트 준비가 맞으면 방장이 시작합니다. 시작 후에는 주사위 굴림, 카지노 배팅, 라운드 정산이 서버 규칙대로 진행됩니다.",
        };
    }, [effectiveStartBotCount, hostMemberId, isHost, isWaiting, players, readyMemberIds, selectedRoom]);
    const canStart = Boolean(startReadiness?.canStart);
    const startStatusText = startReadiness?.statusText || "시작 대기";
    const winnerMemberId = state?.winnerMemberId || null;
    const winnerNickname = winnerMemberId
        ? players.find((player) => Number(player.memberId) === Number(winnerMemberId))?.nickname || `플레이어 ${winnerMemberId}`
        : null;
    const currentTurnMemberId = state?.turnMemberId || null;
    const currentRollPlayer = currentTurnMemberId
        ? players.find((player) => Number(player.memberId) === Number(currentTurnMemberId))
        : null;
    const currentRollPlayerName = currentRollPlayer?.nickname || (currentTurnMemberId ? `플레이어 ${currentTurnMemberId}` : "-");
    const lastPlacedMemberId = state?.lastPlacedMemberId || null;
    const lastPlacedCasinoNo = toPlainInt(state?.lastPlacedCasinoNo, 0);
    const lastPlacedDiceCount = toPlainInt(state?.lastPlacedDiceCount, 0);
    const lastPlacedPlayer = lastPlacedMemberId
        ? players.find((player) => Number(player.memberId) === Number(lastPlacedMemberId))
        : null;
    const lastPlacedText = lastPlacedCasinoNo
        ? `${lastPlacedPlayer?.nickname || `플레이어 ${lastPlacedMemberId}`}님이 ${casinoName[lastPlacedCasinoNo] || `${lastPlacedCasinoNo}번`}에 주사위 ${lastPlacedDiceCount}개를 배팅했습니다.`
        : "";
    const actionFeedbackTone = actionFeedback.status === "error"
        ? "error"
        : actionFeedback.status === "pending"
            ? "pending"
            : actionFeedback.status === "done"
                ? "done"
                : "idle";
    const actionFeedbackItems = useMemo(() => {
        const turnText = isFinished
            ? "게임 종료"
            : myTurn
                ? "내 차례"
                : currentTurnMemberId
                    ? `${currentRollPlayerName} 차례`
                    : "차례 대기";
        const roundText = `${state?.roundNo || 0}/${state?.roundCount || selectedRoom?.roundCount || 0}`;
        const rollText = currentRoll.length ? `공개 주사위 ${currentRoll.length}개` : "굴림 대기";
        return [
            {
                key: "send",
                label: "전송 상태",
                value: lasVegasFeedbackStatusLabel(actionFeedback.status),
                detail: actionFeedback.label,
                icon: actionFeedback.status === "error" ? "recent" : "signal",
                tone: actionFeedbackTone,
            },
            {
                key: "recent",
                label: "최근 행동",
                value: actionFeedback.message,
                detail: actionFeedback.detail,
                icon: "decision",
                tone: actionFeedback.status === "error" ? "error" : actionFeedback.status === "done" ? "done" : "neutral",
            },
            {
                key: "turn",
                label: "차례",
                value: turnText,
                detail: lasVegasRoomStatusLabel(roomStatus),
                icon: "turn",
                tone: myTurn ? "pending" : isFinished ? "done" : "neutral",
            },
            {
                key: "round",
                label: "라운드",
                value: roundText,
                detail: lastPlacedText || rollText,
                icon: "stage",
                tone: isFinished ? "done" : currentRoll.length ? "pending" : "neutral",
            },
        ];
    }, [
        actionFeedback.detail,
        actionFeedback.label,
        actionFeedback.message,
        actionFeedback.status,
        actionFeedbackTone,
        currentRoll.length,
        currentRollPlayerName,
        currentTurnMemberId,
        isFinished,
        lastPlacedText,
        myTurn,
        roomStatus,
        selectedRoom?.roundCount,
        state?.roundCount,
        state?.roundNo,
    ]);

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
                    scope: "las-vegas-game",
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

    const subscribeGameRoom = (client, roomId) => {
        if (gameSubRef.current) gameSubRef.current.unsubscribe();
        gameSubRef.current = client.subscribe(`/sub/game/las-vegas/room/${roomId}`, (msg) => {
            let payload;
            try {
                payload = normalizeLasVegasState(JSON.parse(msg.body || "{}"));
            } catch {
                fetchState(roomId).catch(() => {});
                return;
            }
            setState(payload);
            refreshSelectedRoom(roomId).catch(() => {});
            if (payload.message) notify(payload.message);
        });
    };

    const refreshSelectedRoom = async (roomId) => {
        const myRooms = await lasVegasGameAdapter.fetchMyActiveRooms();
        const matchedRoom = myRooms.find((room) => Number(normalizeRoomId(room)) === Number(roomId));
        if (matchedRoom) setSelectedRoom(matchedRoom);
        return matchedRoom || null;
    };

    const subscribeChatRoom = () => {};

    const fetchRooms = async () => {
        setRooms(await lasVegasGameAdapter.fetchRooms());
    };

    const fetchState = async (roomId) => {
        const snapshot = await lasVegasGameAdapter.fetchRoomState(roomId);
        setState(snapshot);
        return snapshot;
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

    const bindRealtimeRoom = (client, roomId, targetChatRoomId) => {
        if (!client?.connected || !roomId) return;
        subscribeGameRoom(client, roomId);
    };

    const bindLatestRealtimeRoom = (client) => {
        const target = realtimeRoomRef.current;
        if (!target) return;
        bindRealtimeRoom(client, target.roomId, target.chatRoomId);
    };

    const hydrateRoomContext = async (room) => {
        setSelectedRoom(room);
        const roomId = normalizeRoomId(room);
        if (!roomId) return;
        rememberResumeRoom(room);

        const loadSnapshot = async () => {
            const snapshot = await fetchState(roomId);
            setChatMessages([]);
            return null;
        };
        const snapshotChatRoomId = await loadSnapshot();

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
        const restore = async () => {
            try {
                const myRooms = await lasVegasGameAdapter.fetchMyActiveRooms();
                const storedId = Number(localStorage.getItem(ROOM_STORAGE_KEY) || 0);
                const preferred = myRooms.find((room) => Number(normalizeRoomId(room)) === storedId) || myRooms[0];
                if (preferred) {
                    await hydrateRoomContext(preferred);
                } else {
                    clearResumeRoom();
                }
            } catch {
                // keep lobby mode
            }
        };
        restore();
    }, []);

    useEffect(() => {
        if (!selectedRoom) return;
        setSettingsForm({
            roundCount: String(selectedRoom.roundCount || 4),
            turnTimeSeconds: String(selectedRoom.turnTimeSeconds || 25),
        });
    }, [selectedRoom]);

    useEffect(() => {
        if (!selectedRoom) {
            setStartBotCount(0);
            return;
        }
        const humanCount = Array.isArray(selectedRoom.players) ? selectedRoom.players.length : 0;
        const minPlayers = toPlainInt(selectedRoom.minPlayers, 2);
        const maxPlayers = toPlainInt(selectedRoom.maxPlayers, 6);
        const openSeats = Math.max(0, maxPlayers - humanCount);
        const defaultBots = humanCount === 1 && minPlayers > 1 ? Math.max(0, minPlayers - humanCount) : 0;
        setStartBotCount(Math.min(defaultBots, openSeats));
    }, [selectedRoom]);

    useEffect(() => {
        if (!state?.turnDeadlineAt) {
            setSecondsLeft(null);
            return;
        }
        const tick = () => {
            const ms = new Date(state.turnDeadlineAt).getTime() - Date.now();
            setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
        };
        tick();
        const timer = setInterval(tick, 500);
        return () => clearInterval(timer);
    }, [state?.turnDeadlineAt]);

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
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
        const casinos = state?.casinos || [];
        if (!casinos.length) return;
        const signatureParts = casinos.map((casino) => {
            const casinoNo = casino.casinoNo;
            const diceByPlayer = casino.diceByPlayer || {};
            const totalDice = Object.values(diceByPlayer).reduce((sum, value) => sum + Number(value || 0), 0);
            return `${casinoNo}:${totalDice}`;
        });
        const signature = signatureParts.join("|");
        if (!prevCasinoSignatureRef.current) {
            prevCasinoSignatureRef.current = signature;
            return;
        }
        if (prevCasinoSignatureRef.current !== signature) {
            let changedCasino = null;
            const prevMap = new Map(prevCasinoSignatureRef.current.split("|").map((row) => row.split(":")));
            for (const part of signatureParts) {
                const [casinoNo, totalDice] = part.split(":");
                if ((prevMap.get(casinoNo) || "0") !== totalDice) {
                    changedCasino = Number(casinoNo);
                    break;
                }
            }
            prevCasinoSignatureRef.current = signature;
            if (changedCasino) {
                setHotCasinoNo(changedCasino);
                setTimeout(() => setHotCasinoNo(null), 6000);
            }
        }
    }, [state?.casinos]);

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

    const createRoom = async (e) => {
        e.preventDefault();
        try {
            setCreating(true);
            const room = await lasVegasGameAdapter.createRoom({
                title: createForm.title,
                roundCount: toPlainInt(createForm.roundCount, 4),
                turnTimeSeconds: toPlainInt(createForm.turnTimeSeconds, 25),
            });
            await hydrateRoomContext(room);
            await fetchRooms();
            notifySuccess("방 생성 완료");
        } catch {
            notifyError("방 생성 실패");
        } finally {
            setCreating(false);
        }
    };

    const joinRoom = async (roomId) => {
        try {
            setLoading(true);
            const room = await lasVegasGameAdapter.joinRoom(roomId);
            await hydrateRoomContext(room);
            await fetchRooms();
            notifySuccess("입장 완료");
        } catch {
            notifyError("입장 실패");
        } finally {
            setLoading(false);
        }
    };

    const joinRoomByCode = async (e) => {
        e.preventDefault();
        const normalizedCode = joinCode.trim().toUpperCase();
        if (!normalizedCode) {
            notifyError("방코드를 입력해 주세요.");
            return;
        }
        try {
            setLoading(true);
            const room = await lasVegasGameAdapter.joinByCode(normalizedCode);
            setJoinCode("");
            await hydrateRoomContext(room);
            await fetchRooms();
            notifySuccess("방코드로 입장했습니다.");
        } catch {
            notifyError("방코드 입장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const playActionSound = (type) => {
        if (type === "ROLL_DICE") {
            playDiceRollSound();
            return;
        }
        const context = getAudioContext();
        if (!context || isBetSoundPlayingRef.current) return;
        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        const now = context.currentTime;
        const master = context.createGain();
        const oscillator = context.createOscillator();
        const accent = context.createOscillator();
        const gain = context.createGain();

        try {
            isBetSoundPlayingRef.current = true;
            master.gain.setValueAtTime(0.20 * LAS_VEGAS_SOUND_VOLUME_MULTIPLIER, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.36, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(880, now);
            oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12);

            accent.type = "sine";
            accent.frequency.setValueAtTime(1320, now);
            accent.frequency.exponentialRampToValueAtTime(990, now + 0.08);

            oscillator.connect(gain);
            accent.connect(gain);
            gain.connect(master);
            master.connect(context.destination);

            oscillator.start(now);
            accent.start(now);
            oscillator.stop(now + 0.12);
            accent.stop(now + 0.08);

            window.setTimeout(() => {
                isBetSoundPlayingRef.current = false;
            }, 140);
        } catch {
            isBetSoundPlayingRef.current = false;
            // Ignore browser autoplay or decode failures for optional SFX.
        }
    };

    const getAudioContext = () => {
        if (typeof window === "undefined") return null;
        if (audioContextRef.current) return audioContextRef.current;
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;
        audioContextRef.current = new AudioContextCtor();
        return audioContextRef.current;
    };

    const playDiceRollSound = () => {
        const context = getAudioContext();
        if (!context) return;
        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.40 * LAS_VEGAS_SOUND_VOLUME_MULTIPLIER, now);
        master.connect(context.destination);

        // Layer short filtered-noise bursts to mimic dice clatter across a hard table.
        // 딱딱한 테이블 위를 구르는 주사위 느낌을 내기 위해 짧은 노이즈 버스트를 겹친다.
        for (let i = 0; i < 8; i += 1) {
            const start = now + (i * 0.045);
            const duration = 0.028 + (Math.random() * 0.03);
            const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
            const buffer = context.createBuffer(1, frameCount, context.sampleRate);
            const channel = buffer.getChannelData(0);
            for (let j = 0; j < channel.length; j += 1) {
                channel[j] = (Math.random() * 2 - 1) * (1 - (j / channel.length));
            }

            const source = context.createBufferSource();
            source.buffer = buffer;

            const filter = context.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(1500 + Math.random() * 1800, start);
            filter.Q.setValueAtTime(1.2 + Math.random() * 2, start);

            const burstGain = context.createGain();
            burstGain.gain.setValueAtTime(0.0001, start);
            burstGain.gain.exponentialRampToValueAtTime(0.44 + Math.random() * 0.36, start + 0.006);
            burstGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            source.connect(filter);
            filter.connect(burstGain);
            burstGain.connect(master);
            source.start(start);
            source.stop(start + duration);
        }

        const tail = context.createOscillator();
        const tailGain = context.createGain();
        tail.type = "triangle";
        tail.frequency.setValueAtTime(190, now);
        tail.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        tailGain.gain.setValueAtTime(0.0001, now);
        tailGain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        tail.connect(tailGain);
        tailGain.connect(master);
        tail.start(now);
        tail.stop(now + 0.36);
    };

    const publishGameAction = async (actionType, casinoNo = null) => {
        if (!selectedRoom || !myMemberId) return;
        const roomId = normalizeRoomId(selectedRoom);
        if (!roomId) return;
        const actionLabel = lasVegasActionLabel(actionType, casinoNo);
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
                detail: "실시간 연결이 준비되지 않았습니다. 잠시 뒤 다시 시도하세요.",
            });
            return;
        }
        playActionSound(actionType);
        try {
            client.publish({
                destination: `/pub/game/las-vegas/${roomId}/action`,
                body: JSON.stringify(buildLasVegasActionPayload({ actionType, casinoNo })),
                headers: { "content-type": "application/json" },
            });
            setActionFeedback({
                status: "done",
                label: actionLabel,
                message: `${actionLabel} 전송 완료`,
                detail: "서버가 실시간 상태를 다시 보내면 주사위와 카지노 보드에 반영됩니다.",
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

    const sendChatMessage = async () => {
        if (!chatInput.trim() || !gameChatRoomId || !myMemberId) return;
        const client = await ensureSocket();
        if (!client?.connected) {
            notifyError("채팅 연결이 아직 준비되지 않았습니다.");
            return;
        }
        const message = chatInput.trim();
        client.publish({
            destination: `/pub/game/las-vegas/room/${gameChatRoomId}/chat`,
            body: JSON.stringify({ message, type: "TALK" }),
            headers: { "content-type": "application/json" },
        });
        setChatInput("");
    };

    const updateSettings = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            const room = await lasVegasGameAdapter.updateSettings(roomId, {
                roundCount: toPlainInt(settingsForm.roundCount, 4),
                turnTimeSeconds: toPlainInt(settingsForm.turnTimeSeconds, 25),
            });
            setSelectedRoom(room);
            notifySuccess("설정 저장 완료");
        } catch {
            notifyError("설정 저장 실패");
        }
    };

    const toggleReady = async () => {
        if (!selectedRoom) return;
        if (!isWaiting) {
            notifyError("대기 상태에서만 준비를 변경할 수 있습니다.");
            return;
        }
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await lasVegasGameAdapter.toggleReady(roomId);
            notifySuccess("준비 상태 반영");
        } catch {
            notifyError("준비 상태 변경 실패");
        }
    };

    const startGame = async () => {
        if (!selectedRoom) return;
        if (!isWaiting) {
            notifyError("한 판 더 하기로 대기 상태를 만든 뒤 시작할 수 있습니다.");
            return;
        }
        if (!canStart) {
            notifyError(startStatusText);
            return;
        }
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await lasVegasGameAdapter.startGame(
                roomId,
                effectiveStartBotCount > 0 ? { botCount: effectiveStartBotCount } : undefined
            );
            await fetchState(roomId);
            await fetchRooms();
            notifySuccess("게임 시작");
        } catch {
            notifyError("게임 시작 실패");
        }
    };

    const refreshSelectedSession = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await fetchState(roomId);
            await fetchRooms();
            notifySuccess("종료 세션 상태를 새로고침했습니다.");
        } catch {
            notifyError("종료 세션 상태를 새로고침하지 못했습니다.");
        }
    };

    const rematchGame = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            setRematching(true);
            const room = await lasVegasGameAdapter.rematch(roomId);
            setSelectedRoom(room);
            await fetchState(roomId);
            await fetchRooms();
            notifySuccess("같은 방에서 새 판 준비를 시작했습니다.");
        } catch {
            notifyError("한 판 더 하기 준비에 실패했습니다.");
        } finally {
            setRematching(false);
        }
    };

    const forceFinishGame = async () => {
        if (!selectedRoom) return;
        const confirmed = await confirmAction({
            title: "진행 중인 판을 종료할까요?",
            description: "현재 판은 취소되고 같은 방의 대기 상태로 돌아갑니다.",
            confirmText: "종료",
        });
        if (!confirmed) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            setForceFinishing(true);
            const room = await lasVegasGameAdapter.forceFinish(roomId);
            setSelectedRoom(room);
            await fetchState(roomId);
            await fetchRooms();
            notifySuccess("현재 게임을 종료하고 대기 상태로 돌아갔습니다.");
        } catch {
            notifyError("강제 종료에 실패했습니다.");
        } finally {
            setForceFinishing(false);
        }
    };

    const leaveRoom = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await lasVegasGameAdapter.leaveRoom(roomId);
            setSelectedRoom(null);
            setState(null);
            setChatMessages([]);
            clearResumeRoom(roomId);
            realtimeRoomRef.current = null;
            if (gameSubRef.current) gameSubRef.current.unsubscribe();
            if (chatSubRef.current) chatSubRef.current.unsubscribe();
            await fetchRooms();
            notifySuccess("방 퇴장");
        } catch {
            notifyError("퇴장 실패");
        }
    };

    return (
        <div className="space-y-6">
            <style>{`
                @keyframes chip-float {
                    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    100% { transform: translateY(-160px) rotate(220deg); opacity: 0; }
                }
                .chip-burst { position: absolute; width: 14px; height: 14px; border-radius: 9999px; animation: chip-float 1.8s ease-out forwards; }
            `}</style>
            {!selectedRoom && (
                <section className="rounded-[2rem] border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-slate-100 shadow-2xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white/10 p-2.5"><Dices className="h-5 w-5" /></div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight">라스베가스 라이브 테이블</h1>
                            <p className="text-xs text-slate-300">방장 설정 + 실시간 턴 + 자동 타임아웃 액션</p>
                        </div>
                    </div>
                    <Link to="/app/games" className="hidden min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white hover:text-slate-900 sm:inline-flex">
                        게임 목록
                    </Link>
                </div>
                <div className="mb-4" data-smoke="las-vegas-route-artwork">
                    <TabletopGameArtwork type="dice" compact className="h-32 w-full" />
                </div>
                <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={createRoom}>
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300"
                        placeholder="새 방 제목"
                        value={createForm.title}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                        type="text"
                        inputMode="numeric"
                        value={createForm.roundCount}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, roundCount: normalizeNumericText(e.target.value, 1, 10) }))}
                    />
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                        type="text"
                        inputMode="numeric"
                        value={createForm.turnTimeSeconds}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumericText(e.target.value, 5, 180) }))}
                    />
                    <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={creating}>
                        {creating ? "생성 중..." : "방 만들기"}
                    </button>
                </form>
                </section>
            )}

            {!selectedRoom && (
                <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                        <Users className="h-5 w-5" />
                        대기 중인 방
                    </h2>
                    <LasVegasJoinCodePanel
                        joinCode={joinCode}
                        setJoinCode={setJoinCode}
                        loading={loading}
                        joinRoomByCode={joinRoomByCode}
                    />
                    <div className="space-y-2.5">
                        {!rooms.length && (
                            <LasVegasLobbyEmptyState loading={loading} onRefresh={() => fetchRooms().catch(() => {})} />
                        )}
                        {rooms.map((room) => {
                            const roomId = normalizeRoomId(room);
                            const players = lasVegasLobbyPlayers(room);
                            const playersCount = toPlainInt(room.memberCount, players.length);
                            const maxPlayers = toPlainInt(room.maxPlayers, 6);
                            const minPlayers = toPlainInt(room.minPlayers, 2);
                            const status = String(room.roomStatus || "WAITING").toUpperCase();
                            const roomFull = maxPlayers > 0 && playersCount >= maxPlayers;
                            const joinable = status === "WAITING" && !roomFull;
                            const joinDisabled = loading || !joinable;
                            const readiness = lasVegasLobbyRoomReadiness(room);
                            return (
                                <div
                                    key={roomId}
                                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                    data-smoke="las-vegas-lobby-room-card"
                                    data-room-status={status}
                                    data-joinable={joinable ? "true" : "false"}
                                    data-member-count={playersCount}
                                    data-max-players={maxPlayers || ""}
                                >
                                    <div className="grid gap-3 lg:grid-cols-[132px_minmax(0,1fr)_132px] lg:items-center">
                                        <LasVegasLobbyRoomCardArt
                                            status={status}
                                            playersCount={playersCount}
                                            minPlayers={minPlayers}
                                            maxPlayers={maxPlayers}
                                            roundCount={room.roundCount}
                                            turnTimeSeconds={room.turnTimeSeconds}
                                            readiness={readiness}
                                            joinable={joinable}
                                            roomFull={roomFull}
                                            className="h-24 w-full"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="break-words text-sm font-black text-slate-900">{room.title}</div>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${lasVegasRoomStatusTone(status)}`}>
                                                    {lasVegasRoomStatusLabel(status)}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-black">
                                                <span className={`rounded-full px-2 py-1 ${roomFull ? "bg-rose-50 text-rose-700" : "bg-white text-slate-600"}`}>
                                                    {playersCount}/{maxPlayers || "-"}명{roomFull ? " · 가득 참" : ""}
                                                </span>
                                                <span className="rounded-full bg-white px-2 py-1 text-slate-600">코드 {room.roomCode}</span>
                                                <span className="rounded-full bg-white px-2 py-1 text-slate-600">{toPlainInt(room.roundCount, 4)}라운드</span>
                                                <span className="rounded-full bg-white px-2 py-1 text-slate-600">턴 {toPlainInt(room.turnTimeSeconds, 25)}초</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={joinDisabled}
                                            onClick={() => joinRoom(roomId)}
                                            aria-label={`${room.title} ${playersCount}/${maxPlayers || "-"}명 ${roomFull ? "가득 참" : status !== "WAITING" ? "진행 중" : "입장"}`}
                                            title={`${room.title} · ${playersCount}/${maxPlayers || "-"}명 · ${toPlainInt(room.roundCount, 4)}라운드`}
                                            data-smoke="las-vegas-lobby-room-primary"
                                        >
                                            {roomFull ? "가득 참" : status !== "WAITING" ? "진행 중" : "입장"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {selectedRoom && (
                <section className="space-y-4">
                    <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-lg font-black text-slate-900">{selectedRoom.title}</div>
                                <div className="text-xs text-slate-500">방 코드 {selectedRoom.roomCode}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link to="/app/games" className="hidden rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
                                    게임 목록
                                </Link>
                                {isWaiting && (
                                    <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={toggleReady}>
                                        준비하기
                                    </button>
                                )}
                                {isHost && isWaiting && (
                                    <button
                                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={startGame}
                                        disabled={!canStart || loading}
                                        aria-label={canStart ? `${selectedRoom.title} ${startReadiness?.startUsesBots ? "AI와 시작" : "게임 시작"}` : `${selectedRoom.title} 시작 대기: ${startStatusText}`}
                                        title={canStart ? (startReadiness?.startUsesBots ? "AI와 시작" : "게임 시작") : startStatusText}
                                    >
                                        {canStart ? (startReadiness?.startUsesBots ? "AI와 시작" : "시작") : "시작 대기"}
                                    </button>
                                )}
                                {isHost && isPlaying && (
                                    <button
                                        className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700 disabled:opacity-50"
                                        onClick={forceFinishGame}
                                        disabled={forceFinishing}
                                    >
                                        {forceFinishing ? "종료 중..." : "강제 종료"}
                                    </button>
                                )}
                                <button className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600" onClick={leaveRoom}>퇴장</button>
                            </div>
                        </div>
                        {isHost && isFinished && (
                            <div className="mt-3 flex justify-end">
                                <button
                                    className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                                    onClick={rematchGame}
                                    disabled={rematching}
                                >
                                    {rematching ? "준비 중..." : "한 판 더 하기"}
                                </button>
                            </div>
                        )}
                        {isHost && isWaiting && (
                            <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-4">
                                <select
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
                                    value={effectiveStartBotCount}
                                    onChange={(event) => setStartBotCount(toPlainInt(event.target.value, 0))}
                                    aria-label="추가 AI 수"
                                    title="추가 AI 수"
                                >
                                    {startBotOptions.map((count) => (
                                        <option key={count} value={count}>AI {count}명</option>
                                    ))}
                                </select>
                                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.roundCount} onChange={(e) => setSettingsForm((prev) => ({ ...prev, roundCount: normalizeNumericText(e.target.value, 1, 10) }))} />
                                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.turnTimeSeconds} onChange={(e) => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumericText(e.target.value, 5, 180) }))} />
                                <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white" onClick={updateSettings}>방 설정 저장</button>
                            </div>
                        )}
                    </div>

                    <div className={`grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] ${myTurn ? "rounded-[1.8rem] bg-sky-100/70 p-3 ring-2 ring-sky-300/70" : ""}`}>
                        <div className="space-y-4">
                            {showGameBoard ? (
                                <div className={`rounded-[1.8rem] border p-4 shadow-2xl transition-all ${
                                    myTurn
                                        ? "border-sky-200 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600"
                                        : "border-white/20 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800"
                                }`}>
                                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black text-emerald-50">
                                        <span className="rounded-full bg-white/20 px-2.5 py-1">라운드 {state?.roundNo || 0} / {state?.roundCount || selectedRoom?.roundCount || 0}</span>
                                        <span className="rounded-full bg-white/20 px-2.5 py-1">
                                            차례 {state?.players?.find((p) => Number(p.memberId) === Number(state?.turnMemberId))?.nickname || "-"}
                                        </span>
                                        {myTurn && (
                                            <span className="animate-pulse rounded-full bg-sky-100 px-2.5 py-1 text-sky-700 ring-2 ring-sky-200">
                                                내 차례
                                            </span>
                                        )}
                                        {secondsLeft !== null && (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                                                secondsLeft <= 5
                                                    ? "animate-pulse bg-rose-500/30 text-rose-100 ring-2 ring-rose-300/50"
                                                    : "bg-amber-300/20 text-amber-100"
                                            }`}>
                                                <TimerReset className="h-3.5 w-3.5" />
                                                {secondsLeft}s
                                            </span>
                                        )}
                                    </div>

                                    {lastPlacedText && (
                                        <div className="mb-3 rounded-2xl border border-amber-200/50 bg-amber-300/20 px-3 py-2 text-xs font-black leading-relaxed text-amber-50">
                                            {lastPlacedText}
                                        </div>
                                    )}

                                    {!isFinished && (
                                        <LasVegasActionAvailabilityPanel
                                            roomStatus={roomStatus}
                                            myTurn={myTurn}
                                            canRoll={canRoll}
                                            canBet={canBet}
                                            currentRollCountByFace={currentRollCountByFace}
                                            onRoll={() => publishGameAction("ROLL_DICE")}
                                            onBet={(face) => publishGameAction("PLACE_DICE", face)}
                                        />
                                    )}
                                    <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3">
                                        {casinoRows.map((casino) => (
                                            <CasinoPanel
                                                key={casino.casinoNo}
                                                casino={casino}
                                                statePlayers={state?.players}
                                                isHot={Number(casino.casinoNo) === Number(hotCasinoNo)}
                                                isLastPlaced={Number(casino.casinoNo) === Number(lastPlacedCasinoNo)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-lg">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-sm font-black text-slate-900">대기방</div>
                                            <div className="mt-1 text-xs font-bold text-slate-500">참가자 준비 후 방장이 시작합니다.</div>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                                            {players.length}/{toPlainInt(selectedRoom?.maxPlayers, 6)}명
                                        </span>
                                    </div>
                                </div>
                            )}

                            <LasVegasPlayerRosterPanel
                                players={players}
                                selectedRoom={selectedRoom}
                                roomStatus={roomStatus}
                                myMemberId={myMemberId}
                                winnerMemberId={winnerMemberId}
                            />
                        </div>

                        <GameRoomChatPanel
                            gameCode="las-vegas"
                            roomId={gameChatRoomId}
                            resetKey={normalizedRoomStatus}
                            title="방 채팅"
                        />
                    </div>
                </section>
            )}

            <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 text-xs text-slate-500">
                <div className="mb-1.5 flex items-center gap-1.5 font-black text-slate-700">
                    <Play className="h-3.5 w-3.5" />
                    게임규칙
                </div>
                <div>각 라운드마다 1번부터 6번 카지노에 머니 카드가 배치되고, 모든 카지노는 최소 7만원 이상이되도록 카드가 깔립니다.</div>
                <div>내 차례에는 주사위를 굴린 뒤 같은 숫자 주사위를 한 카지노에 모두 배치해야 하며, 시간 초과시에는 자동으로 굴림 또는 배치가 진행됩니다.</div>
                <div>라운드 종료 후 같은 카지노에서 주사위 수가 동점인 플레이어는 모두 탈락하고, 남은 플레이어가 많은 주사위 순서대로 큰 금액 카드부터 가져갑니다.</div>
                <div>한 카지노에 배팅한 플레이어가 정확히 1명뿐이면 그 플레이어가 해당 카지노의 머니 카드를 모두 가져가며, 모든 라운드 수익 합계가 가장 큰 플레이어가 최종 우승합니다.</div>
            </section>
        </div>
    );
};

export default LasVegasGame;
