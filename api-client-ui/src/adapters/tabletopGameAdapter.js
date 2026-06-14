import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapTabletopData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

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

const assignIfPresent = (target, key, value) => {
    if (value !== undefined) target[key] = value;
};

export const getTabletopRoomId = (room) => toNullableNumber(room?.roomId);
export const getTabletopRoomCode = (room) => normalizeText(room?.roomCode);
export const getTabletopRoomStatus = (room) => normalizeText(room?.roomStatus, "WAITING").toUpperCase();
export const getTabletopMemberId = (player) => toNullableNumber(player?.memberId);
export const getTabletopSeatNo = (player) => toNumber(player?.seatNo);
export const isTabletopReadyPlayer = (player) => Boolean(player?.ready);
export const isTabletopStateAccessError = (error) => {
    const statusCode = Number(error?.response?.status || 0);
    return statusCode === 403 || statusCode === 404;
};

export const normalizeTabletopVariant = (variant = {}) => ({
    code: normalizeText(pick(variant, "code", "code", ""), "BASE"),
    displayName: normalizeText(pick(variant, "displayName", "display_name", "")),
    expansion: Boolean(pick(variant, "expansion", "expansion", false)),
    minPlayers: toNumber(pick(variant, "minPlayers", "min_players", 0)),
    maxPlayers: toNumber(pick(variant, "maxPlayers", "max_players", 0)),
    summary: normalizeText(pick(variant, "summary", "summary", "")),
    featureTags: asArray(pick(variant, "featureTags", "feature_tags", [])),
});

export const normalizeTabletopPlayer = (player = {}) => {
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

export const normalizeTabletopRoom = (room) => {
    if (!room || typeof room !== "object") return null;
    const roomId = toNullableNumber(pick(room, "roomId", "room_id", null));
    const variantFeatureTags = asArray(pick(room, "variantFeatureTags", "variant_feature_tags", []));
    const players = asArray(pick(room, "players", "players", [])).map(normalizeTabletopPlayer);

    return {
        roomId,
        gameCode: normalizeText(pick(room, "gameCode", "game_code", "")),
        gameName: normalizeText(pick(room, "gameName", "game_name", "")),
        variantCode: normalizeText(pick(room, "variantCode", "variant_code", "BASE"), "BASE"),
        variantName: normalizeText(pick(room, "variantName", "variant_name", "")),
        variantSummary: normalizeText(pick(room, "variantSummary", "variant_summary", "")),
        variantFeatureTags,
        variantSummaryObject: {
            code: normalizeText(pick(room, "variantCode", "variant_code", "BASE"), "BASE"),
            displayName: normalizeText(pick(room, "variantName", "variant_name", "")),
            summary: normalizeText(pick(room, "variantSummary", "variant_summary", "")),
            featureTags: variantFeatureTags,
        },
        roomCode: normalizeText(pick(room, "roomCode", "room_code", "")),
        title: normalizeText(pick(room, "title", "title", "")),
        roomStatus: normalizeText(pick(room, "roomStatus", "room_status", "WAITING"), "WAITING").toUpperCase(),
        hostMemberId: toNullableNumber(pick(room, "hostMemberId", "host_member_id", null)),
        chatRoomId: toNullableNumber(pick(room, "chatRoomId", "chat_room_id", roomId)),
        minPlayers: toNumber(pick(room, "minPlayers", "min_players", 0)),
        maxPlayers: toNumber(pick(room, "maxPlayers", "max_players", 0)),
        turnTimeSeconds: toNumber(pick(room, "turnTimeSeconds", "turn_time_seconds", 30), 30),
        players,
        memberCount: players.length,
    };
};

export const normalizeTabletopStatePayload = (payload) => {
    if (!payload || typeof payload !== "object") {
        return {
            eventType: "",
            message: "",
            room: null,
            variants: [],
            gameState: null,
        };
    }

    return {
        eventId: normalizeText(pick(payload, "eventId", "event_id", "")),
        serverSentAt: pick(payload, "serverSentAt", "server_sent_at", null),
        eventType: normalizeText(pick(payload, "eventType", "event_type", "")),
        message: normalizeText(pick(payload, "message", "message", "")),
        room: normalizeTabletopRoom(pick(payload, "room", "room", null)),
        variants: asArray(pick(payload, "variants", "variants", [])).map(normalizeTabletopVariant),
        gameState: normalizeCompatObject(pick(payload, "gameState", "game_state", null)),
    };
};

export const tabletopGameErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const buildTabletopRoomPayload = ({ title, variantCode, turnTimeSeconds } = {}) => ({
    ...(title !== undefined ? { title: normalizeText(title) } : {}),
    variant_code: normalizeText(variantCode, "BASE"),
    turn_time_seconds: toNumber(turnTimeSeconds, 30),
});

export const buildTabletopStartPayload = (options = {}) => {
    if (!options || typeof options !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(options, "botCount")
        && !Object.prototype.hasOwnProperty.call(options, "bot_count")) {
        return undefined;
    }
    const botCount = Math.max(0, Math.floor(toNumber(pick(options, "botCount", "bot_count", 0))));
    return { bot_count: botCount };
};

export const buildTabletopActionPayload = (payload = {}) => {
    const next = {};
    assignIfPresent(next, "action_type", pick(payload, "actionType", "action_type"));
    assignIfPresent(next, "piece_code", pick(payload, "pieceCode", "piece_code"));
    assignIfPresent(next, "anchor_x", pick(payload, "anchorX", "anchor_x"));
    assignIfPresent(next, "anchor_y", pick(payload, "anchorY", "anchor_y"));
    assignIfPresent(next, "rotation", pick(payload, "rotation", "rotation"));
    assignIfPresent(next, "flipped", pick(payload, "flipped", "flipped"));
    assignIfPresent(next, "dice_count", pick(payload, "diceCount", "dice_count"));
    assignIfPresent(next, "card_ids", pick(payload, "cardIds", "card_ids"));
    assignIfPresent(next, "vertex_id", pick(payload, "vertexId", "vertex_id"));
    assignIfPresent(next, "target_vertex_id", pick(payload, "targetVertexId", "target_vertex_id"));
    assignIfPresent(next, "edge_id", pick(payload, "edgeId", "edge_id"));
    assignIfPresent(next, "edge_ids", pick(payload, "edgeIds", "edge_ids"));
    assignIfPresent(next, "hex_id", pick(payload, "hexId", "hex_id"));
    assignIfPresent(next, "target_seat_no", pick(payload, "targetSeatNo", "target_seat_no"));
    assignIfPresent(next, "resource_type", pick(payload, "resourceType", "resource_type"));
    assignIfPresent(next, "target_resource_type", pick(payload, "targetResourceType", "target_resource_type"));
    assignIfPresent(next, "improvement_type", pick(payload, "improvementType", "improvement_type"));
    assignIfPresent(next, "text", pick(payload, "text", "text"));
    assignIfPresent(next, "image_data", pick(payload, "imageData", "image_data"));
    assignIfPresent(next, "resources", pick(payload, "resources", "resources"));
    assignIfPresent(next, "commodities", pick(payload, "commodities", "commodities"));
    assignIfPresent(next, "target_resources", pick(payload, "targetResources", "target_resources"));
    assignIfPresent(next, "target_commodities", pick(payload, "targetCommodities", "target_commodities"));
    return next;
};

export const tabletopGameAdapter = {
    async fetchVariants(gameCode) {
        const response = await api.get(`/game/${gameCode}/variants`);
        return asArray(unwrapTabletopData(response)).map(normalizeTabletopVariant);
    },

    async fetchRooms(gameCode) {
        const response = await api.get(`/game/${gameCode}/rooms`);
        return asArray(unwrapTabletopData(response)).map(normalizeTabletopRoom).filter(Boolean);
    },

    async fetchMyRooms(gameCode) {
        const response = await api.get(`/game/${gameCode}/rooms/me`);
        return asArray(unwrapTabletopData(response)).map(normalizeTabletopRoom).filter(Boolean);
    },

    async fetchState(gameCode, roomId) {
        const response = await api.get(`/game/${gameCode}/rooms/${roomId}/state`);
        return normalizeTabletopStatePayload(unwrapTabletopData(response));
    },

    async createRoom(gameCode, form) {
        const response = await api.post(`/game/${gameCode}/rooms`, buildTabletopRoomPayload(form));
        return normalizeTabletopRoom(unwrapTabletopData(response));
    },

    async joinRoom(gameCode, roomId) {
        const response = await api.post(`/game/${gameCode}/rooms/${roomId}/join`);
        return normalizeTabletopRoom(unwrapTabletopData(response));
    },

    async joinByCode(gameCode, roomCode) {
        const response = await api.post(`/game/${gameCode}/rooms/join-by-code`, { room_code: normalizeText(roomCode).toUpperCase() });
        return normalizeTabletopRoom(unwrapTabletopData(response));
    },

    async updateSettings(gameCode, roomId, form) {
        const response = await api.patch(`/game/${gameCode}/rooms/${roomId}/settings`, buildTabletopRoomPayload(form));
        return normalizeTabletopRoom(unwrapTabletopData(response));
    },

    async toggleReady(gameCode, roomId) {
        await api.post(`/game/${gameCode}/rooms/${roomId}/ready`);
    },

    async startGame(gameCode, roomId, options) {
        const payload = buildTabletopStartPayload(options);
        if (payload) {
            await api.post(`/game/${gameCode}/rooms/${roomId}/start`, payload);
            return;
        }
        await api.post(`/game/${gameCode}/rooms/${roomId}/start`);
    },

    async sendAction(gameCode, roomId, payload) {
        const response = await api.post(`/game/${gameCode}/rooms/${roomId}/actions`, buildTabletopActionPayload(payload));
        return normalizeTabletopStatePayload(unwrapTabletopData(response));
    },

    async forceFinish(gameCode, roomId) {
        const response = await api.post(`/game/${gameCode}/rooms/${roomId}/force-finish`);
        return normalizeTabletopRoom(unwrapTabletopData(response));
    },

    async rematch(gameCode, roomId) {
        const response = await api.post(`/game/${gameCode}/rooms/${roomId}/rematch`);
        return normalizeTabletopRoom(unwrapTabletopData(response));
    },

    async leaveRoom(gameCode, roomId) {
        await api.post(`/game/${gameCode}/rooms/${roomId}/leave`);
    },
};
