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

const isPasswordResetRequired = (body) => Boolean(body?.passwordResetRequired || body?.password_reset_required);

const temporaryPasswordExpiresAt = (body) => (
    body?.temporaryPasswordExpiresAt || body?.temporary_password_expires_at || null
);

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

    async loginWithPassword({ email, password, remember = false }) {
        const response = await api.post("/members/login", { email, password, remember });
        const body = unwrapAuthData(response) || {};
        return {
            roles: extractAuthRoles(response),
            email: body.email || email,
            memberId: body.memberId || body.member_id || null,
            passwordResetRequired: isPasswordResetRequired(body),
            temporaryPasswordExpiresAt: temporaryPasswordExpiresAt(body),
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

    async findLoginId({ name, phone }) {
        const response = await api.post("/members/account-recovery/find-id", { name, phone });
        const data = unwrapAuthData(response) || {};
        return {
            accepted: Boolean(data.accepted),
            maskedEmails: Array.isArray(data.maskedEmails)
                ? data.maskedEmails
                : Array.isArray(data.masked_emails)
                  ? data.masked_emails
                  : [],
            message: data.message || "",
        };
    },

    async sendPasswordResetVerification(email) {
        const response = await api.post("/members/account-recovery/password-reset/send", { email });
        return unwrapAuthData(response);
    },

    async confirmPasswordResetVerification({ email, code }) {
        const response = await api.post("/members/account-recovery/password-reset/confirm", { email, code });
        return unwrapAuthData(response);
    },

    async issueTemporaryPassword(email) {
        const response = await api.post("/members/account-recovery/password-reset/temporary-password", { email });
        return unwrapAuthData(response);
    },

    async changeRequiredPassword({ currentPassword, newPassword }) {
        const response = await api.post("/members/password/change-required", {
            current_password: currentPassword,
            new_password: newPassword,
        });
        return unwrapAuthData(response);
    },

    async fetchLoginSessions() {
        const response = await api.get("/members/sessions");
        const data = unwrapAuthData(response) || {};
        return Array.isArray(data.sessions) ? data.sessions : [];
    },

    async logoutOtherSessions() {
        const response = await api.post("/members/sessions/logout-others");
        return unwrapAuthData(response);
    },

    async revokeLoginSession(sessionId) {
        const response = await api.delete(`/members/sessions/${encodeURIComponent(sessionId)}`);
        return unwrapAuthData(response);
    },

    async fetchAdminMfaStatus() {
        const response = await api.get("/members/admin-mfa/status");
        return unwrapAuthData(response);
    },

    async sendAdminMfaCode() {
        const response = await api.post("/members/admin-mfa/send");
        return unwrapAuthData(response);
    },

    async confirmAdminMfaCode(code) {
        const response = await api.post("/members/admin-mfa/confirm", { code });
        return unwrapAuthData(response);
    },
};
