import api, { getApiErrorMessage, uploadFiles } from "../utils/api.js";
import { isImageFile, normalizeChatTimestamp } from "../utils/helpers.js";
import { normalizeMemberSearchKeyword } from "./memberSearchBounds.js";
export { buildStompConnectHeaders as buildChatConnectHeaders } from "./realtimeAdapter.js";
export { MEMBER_SEARCH_KEYWORD_MAX_LENGTH } from "./memberSearchBounds.js";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

const unwrapChatData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const toArray = (value) => {
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

const toPositiveInt = (value, fallback = 1) => {
    const parsed = Math.trunc(toNumber(value, fallback));
    return parsed > 0 ? parsed : fallback;
};

const getFirst = (source, keys, fallback = undefined) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null) return value;
    }
    return fallback;
};

const toTimestampMillis = (value) => {
    const parsed = new Date(value || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const getRawMessageId = (msg) => getFirst(msg, ["messageId", "message_id", "id", "tempId", "temp_id"], null);

const hasStableValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

export const getRoomId = (room) => {
    if (typeof room === "number" || typeof room === "string") return room;
    if (!room) return null;
    return getFirst(room, ["roomId", "chatRoomId", "chat_room_id", "room_id", "id"], null);
};

export const getMemberId = (member) => getFirst(member, ["memberId", "member_id", "id"], null);

export const getMembers = (room) => {
    const members = getFirst(room, ["members", "participants", "memberList", "member_list", "memberResponses", "member_responses"], []);
    return Array.isArray(members) ? members.map(normalizeMember) : [];
};

export const getUnreadCount = (room) => {
    const value = toNumber(getFirst(room, ["unreadCount", "unread_count"]));
    return value > 0 ? value : 0;
};

export const getRoomPreviewText = (room) => {
    const direct = getFirst(room, ["lastMessage", "last_message", "recentMessage", "recent_message"], "");
    return String(direct || "").trim();
};

export const hasRoomPreview = (room) => getRoomPreviewText(room).length > 0;

export const isAiRoom = (room) => String(room?.type || "").toUpperCase() === "AI";

const compactKeyPart = (value) => String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);

export const getRoomKey = (room, index = 0) => {
    const roomId = getRoomId(room);
    if (hasStableValue(roomId)) return `room-${roomId}`;

    const type = compactKeyPart(getFirst(room, ["type", "roomType", "room_type"], "GROUP"));
    const title = compactKeyPart(getFirst(room, ["title", "name"], ""));
    const lastMessage = compactKeyPart(getRoomPreviewText(room));
    const lastMessageTime = compactKeyPart(getFirst(room, ["lastMessageTime", "last_message_time", "updatedAt", "updated_at", "createdAt", "created_at"], ""));
    return `room-fallback-${type}-${title}-${lastMessageTime}-${lastMessage}-${index}`;
};

export const getMessageKey = (msg) => {
    const time = toTimestampMillis(msg?.createdAt || msg?.created_at);
    const fuzzyTime = Math.floor(time / 2000);
    const sender = getFirst(msg, ["senderId", "sender_id"], "");
    const text = getFirst(msg, ["fileUrl", "file_url", "message", "content"], "");
    return `${sender}-${text}-${fuzzyTime}`;
};

const toIdentityString = (value) => hasStableValue(value) ? String(value) : "";

export const isOptimisticMessage = (msg) => {
    const identity = toIdentityString(getFirst(msg, ["messageId", "message_id", "id", "tempId", "temp_id"], ""));
    return identity.startsWith("temp-");
};

export const hasPersistentMessageId = (msg) => {
    const identity = toIdentityString(getFirst(msg, ["messageId", "message_id", "id"], ""));
    if (!identity || identity.startsWith("temp-")) return false;
    return identity !== toIdentityString(msg?.key);
};

export const isSamePersistentMessage = (left, right) =>
    hasPersistentMessageId(left)
    && hasPersistentMessageId(right)
    && toIdentityString(getFirst(left, ["messageId", "message_id", "id"], ""))
        === toIdentityString(getFirst(right, ["messageId", "message_id", "id"], ""));

export const isMatchingOptimisticMessage = (optimistic, incoming) => {
    if (!isOptimisticMessage(optimistic)) return false;
    if (Number(getFirst(optimistic, ["senderId", "sender_id"], NaN)) !== Number(getFirst(incoming, ["senderId", "sender_id"], NaN))) {
        return false;
    }
    if (String(getFirst(optimistic, ["type", "messageType", "message_type"], "TALK")) !== String(getFirst(incoming, ["type", "messageType", "message_type"], "TALK"))) {
        return false;
    }
    const optimisticBody = getFirst(optimistic, ["fileUrl", "file_url", "message", "content"], "");
    const incomingBody = getFirst(incoming, ["fileUrl", "file_url", "message", "content"], "");
    return String(optimisticBody || "") === String(incomingBody || "");
};

const compareMessageIdentity = (left, right) => {
    const leftValue = hasStableValue(left) ? String(left) : "";
    const rightValue = hasStableValue(right) ? String(right) : "";
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }
    return leftValue.localeCompare(rightValue, "ko-KR");
};

const messageIdentity = (msg) => {
    const rawId = getRawMessageId(msg);
    if (hasStableValue(rawId)) return rawId;
    if (hasStableValue(msg?.key)) return msg.key;
    return getMessageKey(msg);
};

export const compareMessagesByChronology = (left, right) => {
    const leftTime = toTimestampMillis(left?.createdAt || left?.created_at);
    const rightTime = toTimestampMillis(right?.createdAt || right?.created_at);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return compareMessageIdentity(messageIdentity(left), messageIdentity(right));
};

export const normalizeMember = (member = {}) => ({
    ...member,
    memberId: getMemberId(member),
    member_id: getMemberId(member),
    name: member.name || "이름 없음",
    email: member.email || "",
    profileUrl: getFirst(member, ["profileUrl", "profile_url"], ""),
});

export const normalizeRoom = (room) => {
    const roomId = getRoomId(room);
    const type = String(getFirst(room, ["type", "roomType", "room_type"], "GROUP") || "GROUP").toUpperCase();
    const unreadCount = getUnreadCount(room);
    const lastMessage = getRoomPreviewText(room);
    const lastMessageTime = normalizeChatTimestamp(getFirst(room, ["lastMessageTime", "last_message_time", "updatedAt", "updated_at", "createdAt", "created_at"], null));

    return {
        ...(typeof room === "object" && room ? room : {}),
        roomId,
        chatRoomId: roomId,
        chat_room_id: roomId,
        title: getFirst(room, ["title", "name"], type === "AI" ? "AI 도우미" : "채팅방"),
        type,
        unreadCount,
        unread_count: unreadCount,
        lastMessage,
        last_message: lastMessage,
        lastMessageTime,
        last_message_time: lastMessageTime,
        updatedAt: lastMessageTime,
        updated_at: lastMessageTime,
        members: getMembers(room),
    };
};

export const sortRooms = (rooms) => [...rooms].sort((a, b) => {
    const timeA = new Date(getFirst(a, ["lastMessageTime", "last_message_time", "updatedAt", "updated_at", "createdAt", "created_at"], 0)).getTime();
    const timeB = new Date(getFirst(b, ["lastMessageTime", "last_message_time", "updatedAt", "updated_at", "createdAt", "created_at"], 0)).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return toNumber(getRoomId(b)) - toNumber(getRoomId(a));
});

export const normalizeMessage = (msg = {}) => {
    if (!msg) return null;

    const type = getFirst(msg, ["type", "messageType", "message_type"], "TALK");
    const message = getFirst(msg, ["message", "content"], "");
    const fileName = getFirst(msg, ["fileName", "file_name"], "");
    const fileUrl = getFirst(msg, ["fileUrl", "file_url"], type === "FILE" ? message : "");
    const fileContentType = getFirst(msg, ["fileContentType", "file_content_type"], "");
    const fileSize = toNumber(getFirst(msg, ["fileSize", "file_size"], 0));
    const createdAt = normalizeChatTimestamp(getFirst(msg, ["createdAt", "created_at"], null));
    const rawId = getRawMessageId(msg);

    const normalized = {
        ...msg,
        id: rawId,
        messageId: getFirst(msg, ["messageId", "message_id"], rawId),
        roomId: getFirst(msg, ["roomId", "chatRoomId", "room_id", "chat_room_id"], null),
        senderId: getFirst(msg, ["senderId", "sender_id"], null),
        senderProfileUrl: getFirst(msg, ["senderProfileUrl", "sender_profile_url"], ""),
        senderName: getFirst(msg, ["senderName", "sender_name"], "익명"),
        message,
        type,
        fileUrl,
        fileName,
        fileContentType,
        fileSize,
        fileImage: getFirst(msg, ["fileImage", "file_image"], isImageFile(fileName || fileContentType || fileUrl)),
        createdAt,
    };
    normalized.key = getMessageKey({ ...normalized, message: normalized.fileUrl || normalized.message });
    if (!hasStableValue(normalized.id)) {
        normalized.id = normalized.key;
    }
    if (!hasStableValue(normalized.messageId)) {
        normalized.messageId = normalized.id;
    }
    return normalized;
};

export const normalizeMessages = (response) => toArray(unwrapChatData(response))
    .map(normalizeMessage)
    .filter(Boolean)
    .sort(compareMessagesByChronology);

const normalizePageInfo = (rawPageInfo, fallbackPage, fallbackSize, itemCount) => {
    const pageInfo = rawPageInfo || {};
    const size = toPositiveInt(getFirst(pageInfo, ["size", "pageSize", "page_size"], fallbackSize), fallbackSize);
    const currentPage = toPositiveInt(getFirst(pageInfo, ["page", "currentPage", "current_page"], fallbackPage), fallbackPage);
    const totalElements = Math.max(0, toNumber(getFirst(pageInfo, ["totalElements", "total_elements", "totalCount", "total_count"], itemCount), itemCount));
    const fallbackTotalPages = totalElements > 0 ? Math.max(1, Math.ceil(totalElements / size)) : 0;
    const totalPages = Math.max(0, toNumber(getFirst(pageInfo, ["totalPage", "total_page", "totalPages", "total_pages"], fallbackTotalPages), fallbackTotalPages));

    return {
        currentPage,
        size,
        totalElements,
        totalPages,
        hasMore: totalPages > currentPage,
    };
};

export const normalizeMessagePage = (response, { fallbackPage = 1, fallbackSize = 20 } = {}) => {
    const body = response?.data || response || {};
    const data = unwrapChatData(response);
    const messages = toArray(data)
        .map(normalizeMessage)
        .filter(Boolean)
        .sort(compareMessagesByChronology);
    const rawPageInfo = body.page_info || body.pageInfo || data?.page_info || data?.pageInfo;

    return {
        items: messages,
        pageInfo: normalizePageInfo(rawPageInfo, fallbackPage, fallbackSize, messages.length),
    };
};

export const normalizeAttachment = (response, fallbackFile = {}) => {
    const payload = unwrapChatData(response) || {};
    const fileName = getFirst(payload, ["fileName", "file_name"], fallbackFile.name || "");
    const fileContentType = getFirst(payload, ["fileContentType", "file_content_type"], fallbackFile.type || "application/octet-stream");
    const fileUrl = getFirst(payload, ["url", "fileUrl", "file_url", "viewUrl", "view_url", "downloadUrl", "download_url"], "");
    const fileSize = toNumber(getFirst(payload, ["fileSize", "file_size"], fallbackFile.size || 0));

    return {
        fileUrl,
        fileName,
        fileContentType,
        fileSize,
        fileImage: getFirst(payload, ["fileImage", "file_image"], isImageFile(fileName || fileContentType || fileUrl)),
    };
};

export const getLastMessagePreview = (msg) => {
    if (!msg) return "";
    if (msg.type === "FILE") return "첨부파일";
    return String(msg.message || "").trim();
};

export const getAttachmentTypeLabel = (fileName = "", contentType = "") => {
    const lowerName = String(fileName).toLowerCase();
    const lowerType = String(contentType).toLowerCase();

    if (lowerType.includes("pdf") || lowerName.endsWith(".pdf")) return "PDF";
    if (lowerType.includes("zip") || lowerName.endsWith(".zip") || lowerName.endsWith(".rar") || lowerName.endsWith(".7z")) return "압축";
    if (lowerType.includes("word") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) return "문서";
    if (lowerType.includes("sheet") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv")) return "시트";
    return "파일";
};

export const extractChatErrorMessage = (error, fallback) => {
    return getApiErrorMessage(error, fallback);
};

export const buildTalkPayload = ({ roomId, senderId, message, tempId }) => ({
    roomId: Number(roomId),
    chatRoomId: Number(roomId),
    senderId: Number(senderId),
    message,
    type: "TALK",
    tempId,
});

export const buildFilePayload = ({ roomId, senderId, attachment }) => ({
    roomId: Number(roomId),
    chatRoomId: Number(roomId),
    senderId: Number(senderId),
    message: attachment.fileName,
    type: "FILE",
    ...attachment,
});

export const chatAdapter = {
    async fetchRooms() {
        const response = await api.get("/chat/rooms");
        return sortRooms(toArray(unwrapChatData(response)).map(normalizeRoom));
    },

    async fetchRoomMembers(roomId) {
        const response = await api.get(`/chat/room/${roomId}/members`);
        return toArray(unwrapChatData(response)).map(normalizeMember);
    },

    async fetchRoomMessagesPage(roomId, { page = 1, size = 20 } = {}) {
        const safePage = toPositiveInt(page, 1);
        const safeSize = toPositiveInt(size, 20);
        const response = await api.get(`/chat/room/${roomId}/messages`, {
            params: { page: safePage - 1, size: safeSize },
        });
        return normalizeMessagePage(response, { fallbackPage: safePage, fallbackSize: safeSize });
    },

    async fetchRoomMessages(roomId) {
        const response = await api.get(`/chat/room/${roomId}/messages`, {
            params: { page: 0, size: 20 },
        });
        return normalizeMessagePage(response, { fallbackPage: 1, fallbackSize: 20 }).items;
    },

    async fetchMembers({ keyword = "", page = 0, size = 20, excludeMemberId } = {}) {
        const normalizedKeyword = normalizeMemberSearchKeyword(keyword);
        const response = await api.get("/members/list", {
            params: { keyword: normalizedKeyword || undefined, page, size },
        });
        return toArray(unwrapChatData(response))
            .map(normalizeMember)
            .filter((member) => String(getMemberId(member)) !== String(excludeMemberId));
    },

    async markRoomRead(roomId) {
        await api.patch(`/chat/room/${roomId}/read`);
    },

    async createRoom({ title, type = "GROUP", memberIds = [] }) {
        const response = await api.post("/chat/room", { title, type, member_ids: memberIds });
        const data = unwrapChatData(response);
        if (typeof data === "number" || typeof data === "string") {
            return normalizeRoom({ chatRoomId: Number(data), title, type });
        }
        return normalizeRoom(data);
    },

    async openAiRoom() {
        const response = await api.post("/chat/ai/room");
        return Number(unwrapChatData(response));
    },

    async inviteMembers(roomId, memberIds) {
        await api.post(`/chat/room/${roomId}/invite`, memberIds);
    },

    async leaveRoom(roomId) {
        await api.delete(`/chat/room/${roomId}/leave`);
    },

    async uploadRoomFile(roomId, formData, options = {}) {
        const response = await uploadFiles(`/chat/room/${roomId}/file`, formData, "post", options);
        return normalizeAttachment(response, formData.get?.("file"));
    },
};
