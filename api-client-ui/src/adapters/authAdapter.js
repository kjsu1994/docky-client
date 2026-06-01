import api, { getApiErrorMessage } from "../utils/api.js";

export const unwrapAuthData = (response) => response?.data?.data ?? response?.data ?? null;

const extractBearerToken = (value) => {
    if (typeof value !== "string") return "";
    return value.replace(/^Bearer\s+/i, "");
};

export const extractAuthTokens = (headers = {}) => ({
    accessToken: extractBearerToken(headers.authorization || headers.Authorization),
    refreshToken: extractBearerToken(headers.refresh || headers.Refresh || headers.refreshtoken || headers.RefreshToken),
});

export const extractAuthRoles = (response) => {
    const body = unwrapAuthData(response);
    return Array.isArray(body?.roles) ? body.roles : null;
};

export const getAuthErrorCode = (error) => error?.response?.data?.code || "";

export const extractAuthErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const isAccountLockedError = (error) => getAuthErrorCode(error) === "ACCOUNT_LOCKED";

export const extractAccountLockInfo = (error, email) => {
    if (!isAccountLockedError(error)) return null;
    const data = error?.response?.data || {};
    const sanctionInfo = data.sanction_info || data.sanctionInfo || {};

    return {
        email,
        reason: sanctionInfo.reason || "사유가 제공되지 않았습니다.",
        startsAt: sanctionInfo.startsAt || sanctionInfo.starts_at || null,
        endsAt: sanctionInfo.endsAt || sanctionInfo.ends_at || null,
    };
};

export const normalizeEmailCheckResponse = (response) => {
    const data = unwrapAuthData(response) || {};
    return {
        email: data.email || "",
        available: Boolean(data.available),
        exists: Boolean(data.exists),
    };
};

export const authAdapter = {
    async fetchCurrentMember() {
        const response = await api.get("/members");
        return unwrapAuthData(response);
    },

    async loginWithPassword({ email, password }) {
        const response = await api.post("/members/login", { email, password });
        return {
            roles: extractAuthRoles(response),
            ...extractAuthTokens(response.headers),
        };
    },

    async logout() {
        await api.post("/members/logout");
    },

    async registerMember(userData) {
        const response = await api.post("/members", userData);
        return unwrapAuthData(response);
    },

    async requestSanctionRelease({ email, reason }) {
        const response = await api.post("/sanctions/release-request", {
            email,
            request_reason: reason?.trim() || undefined,
        });
        return unwrapAuthData(response);
    },

    async checkEmailAvailability(email) {
        const response = await api.get("/members/check-email", { params: { email } });
        return normalizeEmailCheckResponse(response);
    },

    async sendEmailVerification(email) {
        const response = await api.post("/members/email-verification/send", { email });
        return unwrapAuthData(response);
    },

    async confirmEmailVerification({ email, code }) {
        const response = await api.post("/members/email-verification/confirm", { email, code });
        return unwrapAuthData(response);
    },
};
