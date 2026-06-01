import api, { getApiErrorMessage } from "../utils/api.js";

export const COMMENT_CONTENT_MAX_LENGTH = 2000;

const getBodyData = (response) => response?.data?.data ?? response?.data;
const normalizeCommentContents = (contents) => String(contents ?? "").trim();

const normalizePageInfo = (rawPageInfo, fallbackPage, fallbackSize, itemCount) => {
    const pageInfo = rawPageInfo || {};
    const totalElements = pageInfo.total_elements ?? pageInfo.totalElements ?? itemCount;
    const totalPages = pageInfo.total_page ?? pageInfo.totalPage ?? pageInfo.total_pages ?? pageInfo.totalPages;

    return {
        currentPage: pageInfo.page ?? pageInfo.currentPage ?? fallbackPage,
        size: pageInfo.size ?? fallbackSize,
        totalElements,
        totalPages: totalPages ?? Math.max(1, Math.ceil(totalElements / fallbackSize)),
    };
};

export const commentErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const commentAdapter = {
    async fetchComments(boardId, { page = 1, size = 20 } = {}) {
        const response = await api.get("/comments", {
            params: { boardId, page, size },
        });

        const body = response?.data || {};
        const data = getBodyData(response);
        const comments = Array.isArray(data)
            ? data
            : Array.isArray(data?.content)
                ? data.content
                : [];
        const rawPageInfo = body.page_info || body.pageInfo || data?.page_info || data?.pageInfo;

        return {
            comments,
            pageInfo: normalizePageInfo(rawPageInfo, page, size, comments.length),
        };
    },

    async createComment(boardId, contents) {
        const response = await api.post("/comments", {
            board_id: Number(boardId),
            contents: normalizeCommentContents(contents),
        });
        return getBodyData(response);
    },

    async updateComment(commentId, contents) {
        const response = await api.patch(`/comments/${commentId}`, {
            contents: normalizeCommentContents(contents),
        });
        return getBodyData(response);
    },

    async deleteComment(commentId) {
        await api.delete(`/comments/${commentId}`);
    },

    async likeComment(commentId) {
        const response = await api.post(`/comments/${commentId}/Like`);
        return getBodyData(response) || {};
    },

    async reportComment(commentId, { reason, detail }) {
        await api.post("/reports", {
            target_type: "COMMENT",
            target_id: Number(commentId),
            reason: String(reason || "").trim(),
            detail: String(detail || "").trim(),
        });
    },
};
