import api, { getApiErrorMessage } from "../utils/api.js";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

export const notificationErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const notificationAdapter = {
    async fetchUnreadCount() {
        const response = await api.get("/members/notifications/unread-count", { meta: { trackNetwork: false } });
        const data = unwrap(response);
        if (typeof data === "number") return data;
        return Number(data?.unreadCount ?? data?.unread_count ?? 0);
    },

    async fetchNotifications({ readYn = null, page = 1, size = 12 } = {}) {
        const params = { page, size };
        if (readYn !== null && readYn !== undefined) params.readYn = readYn;
        const response = await api.get("/members/notifications", { params });
        return unwrap(response) || { items: [], unreadCount: 0 };
    },

    async markRead(notificationId, readYn = true) {
        const response = await api.patch(`/members/notifications/${notificationId}/read`, { read_yn: readYn });
        return unwrap(response);
    },

    async markAllRead() {
        await api.post("/members/notifications/read-all");
    },
};
