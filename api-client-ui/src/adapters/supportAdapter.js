import api, { getApiErrorMessage } from "../utils/api.js";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

const normalizePage = (payload, fallbackSize) => ({
    items: Array.isArray(payload?.items) ? payload.items : [],
    page: Number(payload?.page ?? 1),
    size: Number(payload?.size ?? fallbackSize),
    totalElements: Number(payload?.totalElements ?? payload?.total_elements ?? 0),
    totalPages: Number(payload?.totalPages ?? payload?.total_pages ?? 0),
});

export const supportErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const supportAdapter = {
    async fetchMyReports({ status = "ALL", page = 1, size = 10 } = {}) {
        const params = { page, size };
        if (status && status !== "ALL") {
            params.status = status;
        }
        const response = await api.get("/reports/my", { params });
        return normalizePage(unwrap(response), size);
    },
};
