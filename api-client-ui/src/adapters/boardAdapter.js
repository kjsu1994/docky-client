import api, { getApiErrorMessage, uploadFiles } from "../utils/api.js";

export const unwrapBoardData = (response) => response?.data?.data ?? response?.data;

const SORT_PARAMS = {
    latest: "createdAt,desc",
    popular: "viewCount,desc",
    likes: "likeCount,desc",
};

export const BOARD_ATTACHMENT_LIMITS = {
    maxFiles: 5,
    maxFileSizeBytes: 20 * 1024 * 1024,
};

export const validateBoardAttachmentSelection = ({ existingFiles = [], attachFiles = [], incomingFiles = [] }) => {
    const nextTotalCount = existingFiles.length + attachFiles.length + incomingFiles.length;
    if (nextTotalCount > BOARD_ATTACHMENT_LIMITS.maxFiles) {
        return {
            valid: false,
            message: `첨부파일은 게시글당 최대 ${BOARD_ATTACHMENT_LIMITS.maxFiles}개까지 업로드할 수 있습니다.`,
        };
    }

    const oversizedFile = incomingFiles.find((file) => file.size > BOARD_ATTACHMENT_LIMITS.maxFileSizeBytes);
    if (oversizedFile) {
        return {
            valid: false,
            message: "첨부파일은 파일당 20MB 이하만 업로드할 수 있습니다.",
        };
    }

    return { valid: true };
};

const getHeaderValue = (headers, name) => {
    if (!headers) return null;
    if (typeof headers.get === "function") {
        return headers.get(name);
    }
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
};

const getHeaderNumber = (headers, name) => {
    const parsed = Number(getHeaderValue(headers, name));
    return Number.isFinite(parsed) ? parsed : null;
};

const resolvePageMeta = (response, itemCount, fallbackPage, fallbackSize) => {
    const totalElements = getHeaderNumber(response?.headers, "X-Total-Count");
    const totalPages = getHeaderNumber(response?.headers, "X-Total-Pages");
    const currentPage = getHeaderNumber(response?.headers, "X-Page-Number");

    return {
        totalElements: totalElements ?? itemCount,
        totalPages: (totalPages ?? Math.ceil(itemCount / fallbackSize)) || 1,
        currentPage: currentPage ?? fallbackPage,
    };
};

const createBoardParams = ({ kind, page, size, searchType, searchValue, sortBy }) => ({
    kind,
    page,
    size,
    sort: SORT_PARAMS[sortBy] || SORT_PARAMS.latest,
    ...(searchValue ? { searchType, searchValue } : {}),
});

const normalizeBoardListItem = (item, fallbackKind) => ({
    ...item,
    kind_of_board: item?.kind_of_board || item?.kindOfBoard || fallbackKind,
});

export const normalizeBoardListResponse = (response, { fallbackKind, fallbackPage, fallbackSize }) => {
    const data = unwrapBoardData(response);

    if (data && typeof data === "object" && Array.isArray(data.content)) {
        const meta = resolvePageMeta(response, data.content.length, fallbackPage, fallbackSize);
        return {
            items: data.content.map((item) => normalizeBoardListItem(item, fallbackKind)),
            pageInfo: {
                totalElements: data.totalElements ?? meta.totalElements,
                totalPages: data.totalPages ?? meta.totalPages,
                currentPage: meta.currentPage,
            },
            recognized: true,
        };
    }

    if (Array.isArray(data)) {
        const meta = resolvePageMeta(response, data.length, fallbackPage, fallbackSize);
        return {
            items: data.map((item) => normalizeBoardListItem(item, fallbackKind)),
            pageInfo: meta,
            recognized: true,
        };
    }

    return {
        items: [],
        pageInfo: {
            totalElements: 0,
            totalPages: 1,
            currentPage: fallbackPage,
        },
        recognized: false,
    };
};

export const normalizeBoardDetail = (response) => {
    const data = unwrapBoardData(response) ?? null;
    if (!data || typeof data !== "object") return data;

    return {
        ...data,
        like_count: data.like_count ?? data.likeCount ?? 0,
        likeCount: data.like_count ?? data.likeCount ?? 0,
        view_count: data.view_count ?? data.viewCount ?? 0,
        viewCount: data.view_count ?? data.viewCount ?? 0,
    };
};

export const getBoardLikeCount = (board) => board?.like_count ?? board?.likeCount ?? 0;

export const boardErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const boardAdapter = {
    async fetchBoardPage({ kind, page, size, searchType, searchValue, sortBy }) {
        const response = await api.get("/boards", {
            params: createBoardParams({ kind, page, size, searchType, searchValue, sortBy }),
        });
        return normalizeBoardListResponse(response, {
            fallbackKind: kind,
            fallbackPage: (Number(page) || 0) + 1,
            fallbackSize: Number(size) || 10,
        });
    },

    async fetchBoardFallbackList(kind, options = {}) {
        const collected = [];
        const fetchSize = 100;
        const maxPages = 3;
        const fallbackKind = Array.isArray(kind) ? kind[0] : kind;

        for (let index = 0; index < maxPages; index += 1) {
            try {
                const result = await this.fetchBoardPage({
                    kind: fallbackKind,
                    page: index,
                    size: fetchSize,
                    ...options,
                });
                if (!result.items.length) break;
                collected.push(...result.items);
                if (result.items.length < fetchSize) break;
            } catch (error) {
                console.error("[boardAdapter] fallback list fetch failed:", error);
                break;
            }
        }

        return collected;
    },

    async fetchBoardDetail(boardId, { trackView = true } = {}) {
        const response = await api.get(`/boards/${boardId}`, {
            params: { trackView },
        });
        return normalizeBoardDetail(response);
    },

    async likeBoard(boardId) {
        const response = await api.post(`/boards/${boardId}/Like`, null, {
            meta: {
                trackNetwork: false,
            },
        });
        return normalizeBoardDetail(response);
    },

    async deleteBoard(boardId) {
        await api.delete(`/boards/${boardId}`);
    },

    async createBoard(kind, formData) {
        return uploadFiles(`/boards?kind=${encodeURIComponent(kind)}`, formData, "post");
    },

    async updateBoard(boardId, formData) {
        return uploadFiles(`/boards/${boardId}`, formData, "patch");
    },

    async deleteBoardFile(boardId, fileId) {
        await api.delete(`/boards/${boardId}/files/${fileId}`);
    },

    async fetchBoardFile(fileId) {
        const response = await api.get(`/file/${fileId}`, { responseType: "blob" });
        return response.data;
    },

    async uploadContentImage(file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post("/image/upload", formData);
        return response.data?.url || response.data;
    },

    async reportBoard(boardId, { reason, detail }) {
        await api.post("/reports", {
            target_type: "BOARD",
            target_id: Number(boardId),
            reason: String(reason || "").trim(),
            detail: String(detail || "").trim(),
        });
    },
};
