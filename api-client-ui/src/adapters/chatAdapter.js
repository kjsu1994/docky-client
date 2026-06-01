import api, { uploadFiles } from "../utils/api.js";
import { isImageFile, normalizeChatTimestamp } from "../utils/helpers.js";
export { buildStompConnectHeaders as buildChatConnectHeaders } from "./realtimeAdapter.js";

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

export const getMessageKey = (msg) => {
    const time = new Date(msg?.createdAt || msg?.created_at || Date.now()).getTime();
    const fuzzyTime = Math.floor(time / 2000);
    const sender = getFirst(msg, ["senderId", "sender_id"], "");
    const text = getFirst(msg, ["fileUrl", "file_url", "message", "content"], "");
    return `${sender}-${text}-${fuzzyTime}`;
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
    const fileName = getFirst(msg, ["fileName", "file_name"], "");
    const fileUrl = getFirst(msg, ["fileUrl", "file_url"], type === "FILE" ? getFirst(msg, ["message", "content"], "") : "");
    const fileContentType = getFirst(msg, ["fileContentType", "file_content_type"], "");
    const fileSize = toNumber(getFirst(msg, ["fileSize", "file_size"], 0));
    const id = getFirst(msg, ["messageId", "message_id", "id", "tempId", "temp_id"], `temp-${Math.random().toString(36).slice(2, 9)}`);

    const normalized = {
        ...msg,
        id,
        messageId: getFirst(msg, ["messageId", "message_id"], id),
        roomId: getFirst(msg, ["roomId", "chatRoomId", "room_id", "chat_room_id"], null),
        senderId: getFirst(msg, ["senderId", "sender_id"], null),
        senderName: getFirst(msg, ["senderName", "sender_name"], "익명"),
        message: getFirst(msg, ["message", "content"], ""),
        type,
        fileUrl,
        fileName,
        fileContentType,
        fileSize,
        fileImage: getFirst(msg, ["fileImage", "file_image"], isImageFile(fileName || fileContentType || fileUrl)),
        createdAt: normalizeChatTimestamp(getFirst(msg, ["createdAt", "created_at"], null)),
    };
    normalized.key = getMessageKey({ ...normalized, message: normalized.fileUrl || normalized.message });
    return normalized;
};

export const normalizeMessages = (response) => toArray(unwrapChatData(response))
    .map(normalizeMessage)
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
    const data = error?.response?.data;
    if (!data) return fallback;
    if (Array.isArray(data.fieldErrors) && data.fieldErrors.length > 0) {
        return data.fieldErrors.map((item) => item.reason || item.message).filter(Boolean).join(", ") || fallback;
    }
    return data.message || fallback;
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
        const response = await api.get("/members/list", {
            params: { keyword: keyword || undefined, page, size },
        });
        return toArray(unwrapChatData(response))
            .map(normalizeMember)
            .filter((member) => String(getMemberId(member)) !== String(excludeMemberId));
    },

    async markRoomRead(roomId) {
        await api.patch(`/chat/room/${roomId}/read`);
    },

    async createRoom({ title, type = "GROUP", memberIds = [] }) {
        const response = await api.post("/chat/room", { title, type, memberIds });
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
