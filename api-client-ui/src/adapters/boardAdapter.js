export const normalizeBoardDetail = (response) => {
    const data = response?.data?.data ?? response?.data ?? null;
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
