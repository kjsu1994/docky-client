import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapNoThanksData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const pick = (source, camelKey, snakeKey, fallback = undefined) => {
    if (!source || typeof source !== "object") return fallback;
    if (Object.prototype.hasOwnProperty.call(source, camelKey) && source[camelKey] !== undefined) {
        return source[camelKey];
    }
    if (Object.prototype.hasOwnProperty.call(source, snakeKey) && source[snakeKey] !== undefined) {
        return source[snakeKey];
    }
    return fallback;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
};

const asNumberArray = (value) => asArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

const normalizeText = (value, fallback = "") => {
    const text = String(value ?? "").trim();
    return text || fallback;
};

export const NO_THANKS_ROOM_STATUS_LABELS = {
    WAITING: "대기",
    PLAYING: "진행 중",
    FINISHED: "종료",
    CANCELLED: "취소",
};

export const noThanksRoomStatusLabel = (status) => (
    NO_THANKS_ROOM_STATUS_LABELS[String(status || "").toUpperCase()] || status || "-"
);

export const getNoThanksRoomId = (room) => toNullableNumber(room?.roomId);
export const getNoThanksChatRoomId = (room) => toNullableNumber(room?.chatRoomId ?? room?.roomId);
export const getNoThanksPlayerId = (player) => toNullableNumber(player?.memberId);
export const isNoThanksReadyPlayer = (player) => Boolean(player?.ready);

export const normalizeNoThanksPlayer = (player = {}) => {
    const memberId = toNullableNumber(pick(player, "memberId", "member_id", null));
    const score = toNullableNumber(pick(player, "score", "score", null));

    return {
        memberId,
        nickname: normalizeText(pick(player, "nickname", "nickname", ""), memberId ? `플레이어 ${memberId}` : "플레이어"),
        seatNo: toNumber(pick(player, "seatNo", "seat_no", 0)),
        ready: Boolean(pick(player, "ready", "ready", false)),
        chips: toNumber(pick(player, "chips", "chips", 0)),
        cards: asNumberArray(pick(player, "cards", "cards", [])),
        score,
    };
};

export const normalizeNoThanksRoom = (room) => {
    if (!room || typeof room !== "object") return null;
    const roomId = toNullableNumber(pick(room, "roomId", "room_id", null));
    const chatRoomId = toNullableNumber(pick(room, "chatRoomId", "chat_room_id", roomId));
    const roomStatus = normalizeText(pick(room, "roomStatus", "room_status", "WAITING"), "WAITING").toUpperCase();
    const players = asArray(pick(room, "players", "players", [])).map(normalizeNoThanksPlayer);

    return {
        roomId,
        chatRoomId,
        roomCode: normalizeText(pick(room, "roomCode", "room_code", "")),
        title: normalizeText(pick(room, "title", "title", ""), "노땡스 방"),
        roomStatus,
        roomStatusLabel: noThanksRoomStatusLabel(roomStatus),
        hostMemberId: toNullableNumber(pick(room, "hostMemberId", "host_member_id", null)),
        minPlayers: toNumber(pick(room, "minPlayers", "min_players", 2), 2),
        maxPlayers: toNumber(pick(room, "maxPlayers", "max_players", 6), 6),
        startChipCount: toNumber(pick(room, "startChipCount", "start_chip_count", 11), 11),
        turnTimeSeconds: toNumber(pick(room, "turnTimeSeconds", "turn_time_seconds", 15), 15),
        players,
        memberCount: players.length,
    };
};

export const normalizeNoThanksState = (state) => {
    if (!state || typeof state !== "object") return null;
    const roomStatus = normalizeText(pick(state, "roomStatus", "room_status", ""), "").toUpperCase();

    return {
        eventType: pick(state, "eventType", "event_type", ""),
        roomId: toNullableNumber(pick(state, "roomId", "room_id", null)),
        roomCode: normalizeText(pick(state, "roomCode", "room_code", "")),
        roomStatus,
        roomStatusLabel: noThanksRoomStatusLabel(roomStatus),
        phase: normalizeText(pick(state, "phase", "phase", roomStatus), roomStatus),
        turnMemberId: toNullableNumber(pick(state, "turnMemberId", "turn_member_id", null)),
        turnDeadlineAt: pick(state, "turnDeadlineAt", "turn_deadline_at", null),
        chatRoomId: toNullableNumber(pick(state, "chatRoomId", "chat_room_id", null)),
        currentCard: toNullableNumber(pick(state, "currentCard", "current_card", null)),
        potChips: toNumber(pick(state, "potChips", "pot_chips", 0)),
        deckRemainingCount: toNumber(pick(state, "deckRemainingCount", "deck_remaining_count", 0)),
        removedCards: asNumberArray(pick(state, "removedCards", "removed_cards", [])),
        winnerMemberId: toNullableNumber(pick(state, "winnerMemberId", "winner_member_id", null)),
        message: normalizeText(pick(state, "message", "message", "")),
        players: asArray(pick(state, "players", "players", [])).map(normalizeNoThanksPlayer),
    };
};

export const noThanksGameErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const buildNoThanksActionPayload = ({ actionType }) => ({
    action_type: actionType,
});

const toSettingsPayload = ({ title, startChipCount, turnTimeSeconds } = {}) => ({
    ...(title !== undefined ? { title: normalizeText(title) } : {}),
    start_chip_count: toNumber(startChipCount, 11),
    turn_time_seconds: toNumber(turnTimeSeconds, 15),
});

export const noThanksGameAdapter = {
    async fetchRooms() {
        const response = await api.get("/game/no-thanks/rooms");
        return asArray(unwrapNoThanksData(response)).map(normalizeNoThanksRoom).filter(Boolean);
    },

    async fetchRoomState(roomId) {
        const response = await api.get(`/game/no-thanks/rooms/${roomId}/state`);
        return normalizeNoThanksState(unwrapNoThanksData(response));
    },

    async fetchMyActiveRooms() {
        const response = await api.get("/game/no-thanks/rooms/me");
        return asArray(unwrapNoThanksData(response)).map(normalizeNoThanksRoom).filter(Boolean);
    },

    async createRoom({ title, startChipCount, turnTimeSeconds }) {
        const response = await api.post("/game/no-thanks/rooms", toSettingsPayload({ title, startChipCount, turnTimeSeconds }));
        return normalizeNoThanksRoom(unwrapNoThanksData(response));
    },

    async joinRoom(roomId) {
        const response = await api.post(`/game/no-thanks/rooms/${roomId}/join`);
        return normalizeNoThanksRoom(unwrapNoThanksData(response));
    },

    async joinByCode(roomCode) {
        const response = await api.post("/game/no-thanks/rooms/join-by-code", { room_code: normalizeText(roomCode).toUpperCase() });
        return normalizeNoThanksRoom(unwrapNoThanksData(response));
    },

    async updateSettings(roomId, { startChipCount, turnTimeSeconds }) {
        const response = await api.patch(`/game/no-thanks/rooms/${roomId}/settings`, toSettingsPayload({ startChipCount, turnTimeSeconds }));
        return normalizeNoThanksRoom(unwrapNoThanksData(response));
    },

    async toggleReady(roomId) {
        await api.post(`/game/no-thanks/rooms/${roomId}/ready`);
    },

    async startGame(roomId) {
        await api.post(`/game/no-thanks/rooms/${roomId}/start`);
    },

    async rematch(roomId) {
        const response = await api.post(`/game/no-thanks/rooms/${roomId}/rematch`);
        return normalizeNoThanksRoom(unwrapNoThanksData(response));
    },

    async forceFinish(roomId) {
        const response = await api.post(`/game/no-thanks/rooms/${roomId}/force-finish`);
        return normalizeNoThanksRoom(unwrapNoThanksData(response));
    },

    async leaveRoom(roomId) {
        await api.post(`/game/no-thanks/rooms/${roomId}/leave`);
    },
};
