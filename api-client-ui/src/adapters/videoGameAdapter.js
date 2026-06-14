import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapVideoGameData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

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

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value, fallback = "") => {
    const text = String(value ?? "").trim();
    return text || fallback;
};

const snakeToCamel = (key) => key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());

const normalizeCompatObject = (value) => {
    if (Array.isArray(value)) return value.map(normalizeCompatObject);
    if (!value || typeof value !== "object") return value;

    return Object.entries(value).reduce((next, [key, rawValue]) => {
        const normalizedValue = normalizeCompatObject(rawValue);
        next[key] = normalizedValue;
        if (key.includes("_")) {
            const camelKey = snakeToCamel(key);
            if (!Object.prototype.hasOwnProperty.call(next, camelKey)) {
                next[camelKey] = normalizedValue;
            }
        }
        return next;
    }, {});
};

export const getVideoGameRoomId = (room) => toNullableNumber(room?.roomId);
export const getVideoGameRoomCode = (room) => normalizeText(room?.roomCode);
export const getVideoGameRoomStatus = (room) => normalizeText(room?.roomStatus, "WAITING").toUpperCase();
export const getVideoGameMemberId = (player) => toNullableNumber(player?.memberId);
export const getVideoGameSeatNo = (player) => toNumber(player?.seatNo);
export const isVideoGameReadyPlayer = (player) => Boolean(player?.ready);

export const normalizeVideoGamePlayer = (player = {}) => {
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
    };
};

export const normalizeVideoGameRoom = (room) => {
    if (!room || typeof room !== "object") return null;
    const roomId = toNullableNumber(pick(room, "roomId", "room_id", null));
    const players = asArray(pick(room, "players", "players", [])).map(normalizeVideoGamePlayer);
    return {
        roomId,
        gameCode: normalizeText(pick(room, "gameCode", "game_code", "")),
        gameName: normalizeText(pick(room, "gameName", "game_name", "")),
        roomCode: normalizeText(pick(room, "roomCode", "room_code", "")),
        title: normalizeText(pick(room, "title", "title", "")),
        roomStatus: normalizeText(pick(room, "roomStatus", "room_status", "WAITING"), "WAITING").toUpperCase(),
        hostMemberId: toNullableNumber(pick(room, "hostMemberId", "host_member_id", null)),
        chatRoomId: toNullableNumber(pick(room, "chatRoomId", "chat_room_id", roomId)),
        minPlayers: toNumber(pick(room, "minPlayers", "min_players", 1), 1),
        maxPlayers: toNumber(pick(room, "maxPlayers", "max_players", 1), 1),
        turnTimeSeconds: toNumber(pick(room, "turnTimeSeconds", "turn_time_seconds", 30), 30),
        players,
        memberCount: players.length,
    };
};

export const normalizeVideoGameSummary = (game = {}) => ({
    code: normalizeText(pick(game, "code", "code", "")),
    displayName: normalizeText(pick(game, "displayName", "display_name", "")),
    minPlayers: toNumber(pick(game, "minPlayers", "min_players", 1), 1),
    maxPlayers: toNumber(pick(game, "maxPlayers", "max_players", 1), 1),
    summary: normalizeText(pick(game, "summary", "summary", "")),
    soloOnly: Boolean(pick(game, "soloOnly", "solo_only", false)),
    storagePolicy: normalizeText(pick(game, "storagePolicy", "storage_policy", "")),
});

export const normalizeVideoGameStatePayload = (payload) => {
    if (!payload || typeof payload !== "object") {
        return {
            eventType: "",
            message: "",
            room: null,
            game: null,
            gameState: null,
        };
    }
    return {
        eventId: normalizeText(pick(payload, "eventId", "event_id", "")),
        serverSentAt: pick(payload, "serverSentAt", "server_sent_at", null),
        eventType: normalizeText(pick(payload, "eventType", "event_type", "")),
        message: normalizeText(pick(payload, "message", "message", "")),
        room: normalizeVideoGameRoom(pick(payload, "room", "room", null)),
        game: normalizeVideoGameSummary(pick(payload, "game", "game", null)),
        gameState: normalizeCompatObject(pick(payload, "gameState", "game_state", null)),
    };
};

const buildRoomPayload = ({ title, maxPlayers, turnTimeSeconds } = {}) => ({
    ...(title !== undefined ? { title: normalizeText(title) } : {}),
    max_players: toNumber(maxPlayers, 1),
    turn_time_seconds: toNumber(turnTimeSeconds, 30),
});

export const videoGameErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const videoGameAdapter = {
    async fetchGames() {
        const response = await api.get("/game/video/games");
        return asArray(unwrapVideoGameData(response)).map(normalizeVideoGameSummary);
    },

    async fetchRooms(gameCode) {
        const response = await api.get(`/game/video/${gameCode}/rooms`);
        return asArray(unwrapVideoGameData(response)).map(normalizeVideoGameRoom).filter(Boolean);
    },

    async fetchMyRooms(gameCode) {
        const response = await api.get(`/game/video/${gameCode}/rooms/me`);
        return asArray(unwrapVideoGameData(response)).map(normalizeVideoGameRoom).filter(Boolean);
    },

    async fetchState(gameCode, roomId) {
        const response = await api.get(`/game/video/${gameCode}/rooms/${roomId}/state`);
        return normalizeVideoGameStatePayload(unwrapVideoGameData(response));
    },

    async createRoom(gameCode, form) {
        const response = await api.post(`/game/video/${gameCode}/rooms`, buildRoomPayload(form));
        return normalizeVideoGameRoom(unwrapVideoGameData(response));
    },

    async joinRoom(gameCode, roomId) {
        const response = await api.post(`/game/video/${gameCode}/rooms/${roomId}/join`);
        return normalizeVideoGameRoom(unwrapVideoGameData(response));
    },

    async joinByCode(gameCode, roomCode) {
        const response = await api.post(`/game/video/${gameCode}/rooms/join-by-code`, { room_code: normalizeText(roomCode).toUpperCase() });
        return normalizeVideoGameRoom(unwrapVideoGameData(response));
    },

    async updateSettings(gameCode, roomId, form) {
        const response = await api.patch(`/game/video/${gameCode}/rooms/${roomId}/settings`, buildRoomPayload(form));
        return normalizeVideoGameRoom(unwrapVideoGameData(response));
    },

    async toggleReady(gameCode, roomId) {
        await api.post(`/game/video/${gameCode}/rooms/${roomId}/ready`);
    },

    async startGame(gameCode, roomId) {
        await api.post(`/game/video/${gameCode}/rooms/${roomId}/start`);
    },

    async forceFinish(gameCode, roomId) {
        const response = await api.post(`/game/video/${gameCode}/rooms/${roomId}/force-finish`);
        return normalizeVideoGameRoom(unwrapVideoGameData(response));
    },

    async leaveRoom(gameCode, roomId) {
        await api.post(`/game/video/${gameCode}/rooms/${roomId}/leave`);
    },
};
