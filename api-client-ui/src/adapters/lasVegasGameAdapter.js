import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapLasVegasData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

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

const normalizeDiceByPlayer = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
        Object.entries(value)
            .map(([memberId, count]) => [String(toNumber(memberId)), toNumber(count)])
            .filter(([memberId, count]) => Number.isFinite(Number(memberId)) && count > 0)
    );
};

export const getLasVegasRoomId = (room) => toNullableNumber(room?.roomId);
export const getLasVegasChatRoomId = (roomOrState) => toNullableNumber(roomOrState?.chatRoomId ?? roomOrState?.roomId);
export const getLasVegasPlayerId = (player) => toNullableNumber(player?.memberId);
export const isLasVegasReadyPlayer = (player) => Boolean(player?.ready);

export const normalizeLasVegasPlayer = (player = {}) => {
    const memberId = toNullableNumber(pick(player, "memberId", "member_id", null));

    return {
        memberId,
        profileUrl: normalizeText(pick(player, "profileUrl", "profile_url", "")),
        nickname: normalizeText(pick(player, "nickname", "nickname", ""), memberId ? `플레이어 ${memberId}` : "플레이어"),
        level: toNullableNumber(pick(player, "level", "level", null)),
        rewardTier: normalizeText(pick(player, "rewardTier", "reward_tier", "")),
        frameCode: normalizeText(pick(player, "frameCode", "frame_code", "")),
        seatNo: toNumber(pick(player, "seatNo", "seat_no", 0)),
        ready: Boolean(pick(player, "ready", "ready", false)),
        totalMoney: toNumber(pick(player, "totalMoney", "total_money", 0)),
        remainingDice: toNumber(pick(player, "remainingDice", "remaining_dice", 8), 8),
    };
};

export const normalizeLasVegasCasino = (casino = {}) => ({
    casinoNo: toNumber(pick(casino, "casinoNo", "casino_no", 0)),
    moneyCards: asNumberArray(pick(casino, "moneyCards", "money_cards", [])),
    totalMoney: toNumber(pick(casino, "totalMoney", "total_money", 0)),
    diceByPlayer: normalizeDiceByPlayer(pick(casino, "diceByPlayer", "dice_by_player", {})),
});

export const normalizeLasVegasRoom = (room) => {
    if (!room || typeof room !== "object") return null;
    const roomId = toNullableNumber(pick(room, "roomId", "room_id", null));
    const players = asArray(pick(room, "players", "players", [])).map(normalizeLasVegasPlayer);

    return {
        roomId,
        chatRoomId: toNullableNumber(pick(room, "chatRoomId", "chat_room_id", roomId)),
        roomCode: normalizeText(pick(room, "roomCode", "room_code", "")),
        title: normalizeText(pick(room, "title", "title", ""), "라스베거스 방"),
        roomStatus: normalizeText(pick(room, "roomStatus", "room_status", "WAITING"), "WAITING").toUpperCase(),
        hostMemberId: toNullableNumber(pick(room, "hostMemberId", "host_member_id", null)),
        minPlayers: toNumber(pick(room, "minPlayers", "min_players", 2), 2),
        maxPlayers: toNumber(pick(room, "maxPlayers", "max_players", 6), 6),
        roundCount: toNumber(pick(room, "roundCount", "round_count", 4), 4),
        turnTimeSeconds: toNumber(pick(room, "turnTimeSeconds", "turn_time_seconds", 25), 25),
        currentRoundNo: toNumber(pick(room, "currentRoundNo", "current_round_no", 0)),
        players,
        memberCount: players.length,
    };
};

export const normalizeLasVegasState = (state) => {
    if (!state || typeof state !== "object") return null;
    const roomStatus = normalizeText(pick(state, "roomStatus", "room_status", ""), "").toUpperCase();

    return {
        eventType: pick(state, "eventType", "event_type", ""),
        roomId: toNullableNumber(pick(state, "roomId", "room_id", null)),
        roomCode: normalizeText(pick(state, "roomCode", "room_code", "")),
        roomStatus,
        phase: normalizeText(pick(state, "phase", "phase", roomStatus), roomStatus),
        roundNo: toNumber(pick(state, "roundNo", "round_no", 0)),
        roundCount: toNumber(pick(state, "roundCount", "round_count", 0)),
        turnMemberId: toNullableNumber(pick(state, "turnMemberId", "turn_member_id", null)),
        turnDeadlineAt: pick(state, "turnDeadlineAt", "turn_deadline_at", null),
        chatRoomId: toNullableNumber(pick(state, "chatRoomId", "chat_room_id", null)),
        winnerMemberId: toNullableNumber(pick(state, "winnerMemberId", "winner_member_id", null)),
        message: normalizeText(pick(state, "message", "message", "")),
        currentRoll: asNumberArray(pick(state, "currentRoll", "current_roll", [])),
        lastPlacedMemberId: toNullableNumber(pick(state, "lastPlacedMemberId", "last_placed_member_id", null)),
        lastPlacedCasinoNo: toNullableNumber(pick(state, "lastPlacedCasinoNo", "last_placed_casino_no", null)),
        lastPlacedDiceCount: toNumber(pick(state, "lastPlacedDiceCount", "last_placed_dice_count", 0)),
        lastPlacedAt: pick(state, "lastPlacedAt", "last_placed_at", null),
        players: asArray(pick(state, "players", "players", [])).map(normalizeLasVegasPlayer),
        casinos: asArray(pick(state, "casinos", "casinos", [])).map(normalizeLasVegasCasino),
    };
};

export const lasVegasGameErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const buildLasVegasActionPayload = ({ actionType, casinoNo = null }) => ({
    action_type: actionType,
    casino_no: casinoNo === null || casinoNo === undefined ? null : toNumber(casinoNo),
});

const toSettingsPayload = ({ title, roundCount, turnTimeSeconds } = {}) => ({
    ...(title !== undefined ? { title: normalizeText(title) } : {}),
    round_count: toNumber(roundCount, 4),
    turn_time_seconds: toNumber(turnTimeSeconds, 25),
});

export const lasVegasGameAdapter = {
    async fetchRooms() {
        const response = await api.get("/game/las-vegas/rooms");
        return asArray(unwrapLasVegasData(response)).map(normalizeLasVegasRoom).filter(Boolean);
    },

    async fetchMyActiveRooms() {
        const response = await api.get("/game/las-vegas/rooms/me");
        return asArray(unwrapLasVegasData(response)).map(normalizeLasVegasRoom).filter(Boolean);
    },

    async fetchRoomState(roomId) {
        const response = await api.get(`/game/las-vegas/rooms/${roomId}/state`);
        return normalizeLasVegasState(unwrapLasVegasData(response));
    },

    async createRoom({ title, roundCount, turnTimeSeconds }) {
        const response = await api.post("/game/las-vegas/rooms", toSettingsPayload({ title, roundCount, turnTimeSeconds }));
        return normalizeLasVegasRoom(unwrapLasVegasData(response));
    },

    async joinRoom(roomId) {
        const response = await api.post(`/game/las-vegas/rooms/${roomId}/join`);
        return normalizeLasVegasRoom(unwrapLasVegasData(response));
    },

    async joinByCode(roomCode) {
        const response = await api.post("/game/las-vegas/rooms/join-by-code", { room_code: normalizeText(roomCode).toUpperCase() });
        return normalizeLasVegasRoom(unwrapLasVegasData(response));
    },

    async updateSettings(roomId, { roundCount, turnTimeSeconds }) {
        const response = await api.patch(`/game/las-vegas/rooms/${roomId}/settings`, toSettingsPayload({ roundCount, turnTimeSeconds }));
        return normalizeLasVegasRoom(unwrapLasVegasData(response));
    },

    async toggleReady(roomId) {
        await api.post(`/game/las-vegas/rooms/${roomId}/ready`);
    },

    async startGame(roomId) {
        await api.post(`/game/las-vegas/rooms/${roomId}/start`);
    },

    async rematch(roomId) {
        const response = await api.post(`/game/las-vegas/rooms/${roomId}/rematch`);
        return normalizeLasVegasRoom(unwrapLasVegasData(response));
    },

    async forceFinish(roomId) {
        const response = await api.post(`/game/las-vegas/rooms/${roomId}/force-finish`);
        return normalizeLasVegasRoom(unwrapLasVegasData(response));
    },

    async leaveRoom(roomId) {
        await api.post(`/game/las-vegas/rooms/${roomId}/leave`);
    },
};
