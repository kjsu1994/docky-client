import api from "../utils/api.js";

const unwrapReplayData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
};

const normalizeText = (value) => {
    const text = String(value ?? "").trim();
    return text || null;
};

const normalizeOptionalBoolean = (value) => {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
};

export const getRealtimeReplayPayload = (event) => (
    event && typeof event === "object" ? event.payload : null
);

export const getRealtimeReplayMessageId = (event) => normalizeText(
    event?.messageId ?? event?.message_id ?? getRealtimeReplayPayload(event)?.eventId ?? getRealtimeReplayPayload(event)?.event_id
);

export const normalizeRealtimeReplayResponse = (response) => {
    const data = unwrapReplayData(response);
    const events = toArray(data?.events)
        .map((event) => ({
            messageId: getRealtimeReplayMessageId(event),
            publishedAt: event?.publishedAt ?? event?.published_at ?? null,
            payload: getRealtimeReplayPayload(event),
        }))
        .filter((event) => event.messageId && event.payload && typeof event.payload === "object");
    return {
        destination: normalizeText(data?.destination),
        afterMessageId: normalizeText(data?.afterMessageId ?? data?.after_message_id),
        afterMessageIdFound: normalizeOptionalBoolean(data?.afterMessageIdFound ?? data?.after_message_id_found),
        fullSyncRequired: normalizeOptionalBoolean(data?.fullSyncRequired ?? data?.full_sync_required) === true,
        events,
    };
};

const paramsFor = ({ limit = 50, afterMessageId = null } = {}) => ({
    params: {
        limit,
        ...(afterMessageId ? { after_message_id: afterMessageId } : {}),
    },
});

export const realtimeReplayAdapter = {
    async fetchChatRoom(roomId, options = {}) {
        const response = await api.get(`/realtime/replay/chat/rooms/${roomId}`, paramsFor(options));
        return normalizeRealtimeReplayResponse(response);
    },

    async fetchGameRoom(gameCode, roomId, options = {}) {
        const response = await api.get(`/realtime/replay/game/${gameCode}/rooms/${roomId}`, paramsFor(options));
        return normalizeRealtimeReplayResponse(response);
    },

    async fetchGameRoomChat(gameCode, roomId, options = {}) {
        const response = await api.get(`/realtime/replay/game/${gameCode}/rooms/${roomId}/chat`, paramsFor(options));
        return normalizeRealtimeReplayResponse(response);
    },

    async fetchVideoGameRoom(gameCode, roomId, options = {}) {
        const response = await api.get(`/realtime/replay/game/video/${gameCode}/rooms/${roomId}`, paramsFor(options));
        return normalizeRealtimeReplayResponse(response);
    },

    async fetchVideoGameSignal(gameCode, roomId, options = {}) {
        const response = await api.get(`/realtime/replay/game/video/${gameCode}/rooms/${roomId}/signal`, paramsFor(options));
        return normalizeRealtimeReplayResponse(response);
    },
};
