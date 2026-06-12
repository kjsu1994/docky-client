import api, { getApiErrorMessage } from "../utils/api.js";

export const BOARD_RANK_TYPES = [
    { value: "FREE_BOARD", label: "사용자게시판" },
    { value: "ADMIN_NOTICE", label: "공지사항" },
    { value: "QUESTION_ANSWER", label: "Q&A 게시판" },
];

const unwrapRankData = (response) => response?.data?.data ?? response?.data ?? null;

const normalizeList = (response) => {
    const data = unwrapRankData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.content)) return data.content;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.ranks)) return data.ranks;
    return [];
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeBoardRanks = (response) => normalizeList(response)
    .map((board) => ({
        id: board.boardId ?? board.board_id ?? null,
        kind: board.kindOfBoard ?? board.kind_of_board ?? board.kind ?? "FREE_BOARD",
        title: board.title || "제목 없음",
        likeCount: toNumber(board.likeCount ?? board.like_count),
        viewCount: toNumber(board.viewCount ?? board.view_count),
    }))
    .filter((board) => board.id);

export const normalizeLevelRanks = (response) => normalizeList(response)
    .map((member, index) => ({
        id: member.levelId ?? member.level_id ?? member.memberId ?? member.member_id ?? `level-${index}`,
        name: member.userName ?? member.user_name ?? member.name ?? member.nickname ?? "익명",
        level: toNumber(member.level, 1),
        totalExp: toNumber(member.totalExp ?? member.total_exp),
        progressPercent: toNumber(member.progressPercent ?? member.progress_percent),
        rewardTier: member.rewardTier ?? member.reward_tier ?? "",
        tierName: member.tierName ?? member.tier_name ?? "",
        frameCode: member.frameCode ?? member.frame_code ?? "",
        frameLabel: member.frameLabel ?? member.frame_label ?? "",
        badgeCode: member.badgeCode ?? member.badge_code ?? "",
        profileUrl: member.profileUrl ?? member.profile_url ?? "",
    }));

export const ranksAdapter = {
    async fetchBoardRanks(kind) {
        const response = await api.get("/boards/rankBoards", {
            params: { kind, page: 0, size: 10 },
        });
        return normalizeBoardRanks(response);
    },

    async fetchLevelRanks() {
        const response = await api.get("/members/levelRanks", {
            params: { page: 0, size: 10 },
        });
        return normalizeLevelRanks(response);
    },
};

export const rankErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);
