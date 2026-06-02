export const MEMBER_SEARCH_KEYWORD_MAX_LENGTH = 80;

export const normalizeMemberSearchKeyword = (value) => {
    const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
    return normalized ? normalized.slice(0, MEMBER_SEARCH_KEYWORD_MAX_LENGTH) : "";
};
