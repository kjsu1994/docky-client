import api, { getApiErrorMessage } from "../utils/api.js";
import { stripHtmlTags } from "../utils/helpers.js";

const unwrapMypageData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getFirst = (source, keys, fallback = undefined) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null) return value;
    }
    return fallback;
};

const normalizeStatus = (value) => String(value || "MEMBER_ACTIVE").toUpperCase();

export const isGoogleMember = (member) => String(member?.authProvider || "LOCAL").toUpperCase() === "GOOGLE";

export const formatPhoneNumber = (rawValue = "") => {
    const digits = String(rawValue).replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const normalizeLevel = (raw = {}) => {
    const level = toNumber(raw.level, 1);
    const totalExp = toNumber(getFirst(raw, ["totalExp", "total_exp"]));
    const currentExp = toNumber(getFirst(raw, ["currentExp", "current_exp", "levelExp", "level_exp"]));
    const nextLevelExp = toNumber(getFirst(raw, ["nextLevelExp", "next_level_exp", "requiredExp", "required_exp"]), Math.max(currentExp, 1));
    const remainingExp = toNumber(getFirst(raw, ["remainingExp", "remaining_exp"]), Math.max(nextLevelExp - currentExp, 0));
    const progressRaw = toNumber(getFirst(raw, ["progressPercent", "progress_percent", "levelExp", "level_exp"]));

    return {
        level,
        totalExp,
        currentExp,
        nextLevelExp: Math.max(nextLevelExp, 1),
        remainingExp,
        progressPercent: Math.max(0, Math.min(100, progressRaw)),
        rewardTier: getFirst(raw, ["rewardTier", "reward_tier"], ""),
        tierName: getFirst(raw, ["tierName", "tier_name"], ""),
        tierMinLevel: toNumber(getFirst(raw, ["tierMinLevel", "tier_min_level"])),
        tierMaxLevel: toNumber(getFirst(raw, ["tierMaxLevel", "tier_max_level"])),
        frameCode: getFirst(raw, ["frameCode", "frame_code"], ""),
        frameLabel: getFirst(raw, ["frameLabel", "frame_label"], ""),
        badgeCode: getFirst(raw, ["badgeCode", "badge_code"], ""),
    };
};

export const normalizeMember = (response) => {
    const data = unwrapMypageData(response) || {};
    const status = normalizeStatus(getFirst(data, ["memberStatus", "member_status"]));
    const authProvider = String(getFirst(data, ["authProvider", "auth_provider"], "LOCAL")).toUpperCase();
    const level = normalizeLevel(getFirst(data, ["levelDto", "level_dto"], {}));
    const memberId = getFirst(data, ["memberId", "member_id"]);

    return {
        raw: data,
        memberId,
        email: data.email || "",
        name: data.name || "사용자",
        phone: data.phone || "",
        address: data.address || "",
        point: toNumber(data.point),
        boardCount: toNumber(getFirst(data, ["boardCount", "board_count"])),
        commentCount: toNumber(getFirst(data, ["commentCount", "comment_count"])),
        profileUrl: getFirst(data, ["profileUrl", "profile_url"], ""),
        status,
        statusLabel: status === "ACTIVE" || status === "MEMBER_ACTIVE" ? "활성" : "비활성",
        isActive: status === "ACTIVE" || status === "MEMBER_ACTIVE",
        authProvider,
        authProviderLabel: authProvider === "GOOGLE" ? "Google 계정" : "이메일 계정",
        level,
    };
};

export const normalizeMyBoards = (response) => {
    const data = unwrapMypageData(response);
    const items = Array.isArray(data) ? data
        : Array.isArray(data?.content) ? data.content
            : Array.isArray(data?.items) ? data.items
                : Array.isArray(data?.boards) ? data.boards
                    : [];

    return items.map((board) => ({
        id: getFirst(board, ["boardId", "board_id"]),
        kind: getFirst(board, ["kindOfBoard", "kind_of_board", "kind"], "FREE_BOARD"),
        title: board.title || "제목 없는 게시글",
        preview: stripHtmlTags(board.contents || board.content || ""),
        likeCount: toNumber(getFirst(board, ["likeCount", "like_count"])),
        viewCount: toNumber(getFirst(board, ["viewCount", "view_count"])),
        createdAt: getFirst(board, ["createdAt", "created_at"], ""),
    })).filter((board) => board.id);
};

const historyLabels = {
    BOARD_CREATE: "게시글 작성 보상",
    COMMENT_CREATE: "댓글 작성 보상",
    BOARD_LIKE_RECEIVED: "게시글 좋아요 보상",
    COMMENT_LIKE_RECEIVED: "댓글 좋아요 보상",
    GAME_WIN: "게임 승리 보상",
    GAME_LOSS: "게임 완료 보상",
    GAME_DRAW: "게임 무승부 보상",
    GAME_COMPLETE: "게임 참여 완료 보상",
    MANUAL_ADJUST: "운영자 조정",
};

export const normalizeLevelHistory = (response) => {
    const data = unwrapMypageData(response);
    const items = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
            : Array.isArray(data?.items) ? data.items
                : Array.isArray(data?.content) ? data.content
                    : [];

    return items.map((item, index) => {
        const eventType = getFirst(item, ["eventType", "event_type"], "");
        return {
            id: getFirst(item, ["ledgerId", "ledger_id"], `history-${index}`),
            eventType,
            label: historyLabels[eventType] || item.reason || "경험치 변경",
            baseExp: toNumber(getFirst(item, ["baseExp", "base_exp"])),
            penaltyExp: toNumber(getFirst(item, ["penaltyExp", "penalty_exp"])),
            grantedExp: toNumber(getFirst(item, ["grantedExp", "granted_exp"])),
            createdAt: getFirst(item, ["createdAt", "created_at"], ""),
        };
    });
};

const normalizeConsent = (raw = {}) => ({
    consentType: getFirst(raw, ["consentType", "consent_type"], ""),
    label: raw.label || "",
    required: Boolean(raw.required),
    granted: Boolean(raw.granted),
    source: raw.source || "",
    updatedAt: getFirst(raw, ["updatedAt", "updated_at"], ""),
});

const normalizeRetentionPolicyItem = (raw = {}) => ({
    title: raw.title || "",
    period: raw.period || "",
    description: raw.description || "",
});

export const normalizePrivacySummary = (response) => {
    const data = unwrapMypageData(response) || {};
    const consents = Array.isArray(data.consents) ? data.consents : [];
    const retentionPolicy = Array.isArray(getFirst(data, ["retentionPolicy", "retention_policy"], []))
        ? getFirst(data, ["retentionPolicy", "retention_policy"], [])
        : [];
    const exportIncludes = Array.isArray(getFirst(data, ["exportIncludes", "export_includes"], []))
        ? getFirst(data, ["exportIncludes", "export_includes"], [])
        : [];

    return {
        generatedAt: getFirst(data, ["generatedAt", "generated_at"], ""),
        consents: consents.map(normalizeConsent).filter((consent) => consent.consentType),
        retentionPolicy: retentionPolicy.map(normalizeRetentionPolicyItem),
        exportIncludes,
    };
};

export const normalizeConsentUpdate = (response) => {
    const data = unwrapMypageData(response) || {};
    return {
        consent: normalizeConsent(data.consent || {}),
    };
};

const extractContentDispositionFilename = (contentDisposition = "") => {
    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
        } catch {
            return utf8Match[1].replace(/"/g, "");
        }
    }

    const plainMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return plainMatch?.[1] || "";
};

const downloadBlob = (blob, filename) => {
    if (typeof document === "undefined" || typeof window === "undefined") {
        return;
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export const extractMypageErrorMessage = (error, fallback) => getApiErrorMessage(error, fallback);

export const isAccountReauthRequiredError = (error) => (
    error?.response?.data?.code === "ACCOUNT_REAUTH_REQUIRED"
);

export const mypageAdapter = {
    async fetchMember() {
        const response = await api.get("/members");
        return normalizeMember(response);
    },

    async fetchMyBoards() {
        const response = await api.get("/boards/myBoards", {
            params: { page: 0, size: 10 },
        });
        return normalizeMyBoards(response);
    },

    async fetchLevelHistory() {
        const response = await api.get("/members/level/history", {
            params: { page: 1, size: 12 },
        });
        return normalizeLevelHistory(response);
    },

    async verifyPassword(email, password) {
        await api.post("/members/login", { email, password }, { meta: { trackNetwork: false } });
    },

    async deleteAccount() {
        await api.delete("/members");
    },

    async grantWithdrawReauth() {
        await api.post("/members/withdraw/reauth");
    },

    async uploadProfile(file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.post("/members/uploadProfile", formData);
        return normalizeMember(response);
    },

    async updateMember(memberId, payload) {
        const response = await api.patch(`/members/${memberId}`, payload);
        return normalizeMember(response);
    },

    async fetchPrivacySummary() {
        const response = await api.get("/members/privacy/summary");
        return normalizePrivacySummary(response);
    },

    async updatePrivacyConsent(consentType, granted) {
        const response = await api.patch("/members/privacy/consents", {
            consent_type: consentType,
            granted,
        });
        return normalizeConsentUpdate(response);
    },

    async downloadPrivacyExport() {
        const response = await api.get("/members/privacy/export", {
            responseType: "blob",
            meta: { trackNetwork: false },
        });
        const contentType = response.headers?.["content-type"] || "application/json";
        const filename = extractContentDispositionFilename(response.headers?.["content-disposition"])
            || `docky-privacy-export-${new Date().toISOString().slice(0, 10)}.json`;
        const blob = response.data instanceof Blob
            ? response.data
            : new Blob([response.data], { type: contentType });
        downloadBlob(blob, filename);
        return { filename };
    },
};
