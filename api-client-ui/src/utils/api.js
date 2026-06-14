import axios from "axios";
import {
    clearAuthSession,
    getStoredAccessToken,
    getStoredRefreshToken,
    hasRefreshCookieHint,
    updateStoredAuthTokens,
} from "./authStorage.js";
import { beginNetworkActivity, endNetworkActivity } from "./networkActivity.js";
import { notifyError } from "./toast.js";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

export const REQUEST_ID_HEADER = "X-Request-Id";

const PUBLIC_AUTH_PATHS = [
    "/members/login",
    "/members/email-verification/send",
    "/members/email-verification/confirm",
    "/members/check-email",
    "/members/account-recovery/find-id",
    "/members/account-recovery/password-reset/send",
    "/members/account-recovery/password-reset/confirm",
    "/members/account-recovery/password-reset/temporary-password",
    "/sanctions/release-request",
];

let refreshPromise = null;
let sessionExpiredNotified = false;

const NETWORK_ERROR_MESSAGE = "서버와 연결하지 못했습니다. 네트워크 상태를 확인해주세요.";
const TIMEOUT_ERROR_MESSAGE = "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.";
const DEFAULT_ERROR_MESSAGE = "요청 처리 중 오류가 발생했습니다.";
const DEFAULT_VALIDATION_REASON = "입력값을 확인해주세요.";
const HANGUL_PATTERN = /[가-힣]/u;
const ENGLISH_LETTER_PATTERN = /[A-Za-z]/u;
const TECHNICAL_SERVER_MESSAGE_PATTERN =
    /\b(?:root_cause|stack\s*trace|NullPointerException|IllegalArgumentException|SQLException|SQLIntegrityConstraintViolationException|Internal Server Error|Bad Request|Unauthorized|Forbidden|ORA-\d{5}|java\.)\b/i;

const FIELD_LABELS = {
    adminNote: "관리 메모",
    boardId: "게시글",
    commentId: "댓글",
    contents: "본문",
    detail: "상세 내용",
    dueDate: "날짜",
    email: "이메일",
    file: "파일",
    files: "파일",
    hiddenYn: "숨김 여부",
    keyword: "검색어",
    memberId: "회원",
    name: "이름",
    page: "페이지",
    password: "비밀번호",
    reason: "사유",
    reportStatus: "신고 상태",
    roomId: "채팅방",
    size: "목록 크기",
    targetId: "신고 대상",
    targetType: "신고 대상 유형",
    title: "제목",
};

const shouldTrackNetworkActivity = (config) => config?.meta?.trackNetwork !== false;

const normalizeUrl = (url = "") => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) {
        try {
            return new URL(url).pathname.replace(/^\/api/, "");
        } catch {
            return url;
        }
    }
    return String(url).replace(/^\/api/, "");
};

const browserOrigin = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "http://localhost";
};

const combineBaseAndRequestUrl = (baseURL = "", requestUrl = "") => {
    const rawRequestUrl = String(requestUrl || "");
    if (/^https?:\/\//i.test(rawRequestUrl)) {
        return rawRequestUrl;
    }
    const rawBaseUrl = String(baseURL || "");
    if (!rawBaseUrl) {
        return rawRequestUrl;
    }
    return `${rawBaseUrl.replace(/\/+$/, "")}/${rawRequestUrl.replace(/^\/+/, "")}`;
};

export const getHeaderValue = (headers, name) => {
    if (!headers || !name) return undefined;
    if (typeof headers.get === "function") {
        return headers.get(name) || headers.get(name.toLowerCase()) || undefined;
    }
    const lowerName = name.toLowerCase();
    const entry = Object.entries(headers).find(([key]) => String(key).toLowerCase() === lowerName);
    return entry ? entry[1] : undefined;
};

const hasHeaderValue = (headers, name) => {
    const value = getHeaderValue(headers, name);
    return value !== undefined && value !== null && String(value).trim() !== "";
};

const createRequestId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `web-${crypto.randomUUID()}`;
    }
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const isSameOriginApiRequest = (config = {}) => {
    try {
        const origin = browserOrigin();
        const combined = combineBaseAndRequestUrl(config.baseURL ?? api.defaults.baseURL, config.url);
        const resolved = new URL(combined || "/", origin);
        return resolved.origin === origin && (resolved.pathname === "/api" || resolved.pathname.startsWith("/api/"));
    } catch {
        return false;
    }
};

const isPublicAuthRequest = (config) => {
    const url = normalizeUrl(config?.url);
    return PUBLIC_AUTH_PATHS.some((path) => url === path || url.startsWith(`${path}?`));
};

const stripBearerToken = (value) => {
    return typeof value === "string" ? value.replace(/^Bearer\s+/i, "") : null;
};

const extractBearerToken = (headers) => {
    return stripBearerToken(headers?.authorization || headers?.Authorization);
};

const clearStoredAuth = () => {
    clearAuthSession();
};

const redirectToLogin = () => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/login") {
        window.location.href = "/login";
    }
};

const notifySessionExpired = () => {
    if (sessionExpiredNotified) return;
    sessionExpiredNotified = true;
    notifyError("세션이 만료되었습니다. 다시 로그인해주세요.");
};

const isTimeoutError = (error) => (
    error?.code === "ECONNABORTED" ||
    String(error?.message || "").toLowerCase().includes("timeout")
);

const normalizeFieldKey = (field) => {
    if (typeof field !== "string" || !field.trim()) return "";
    const normalized = field
        .replace(/\[(\d+)\]/g, "")
        .split(".")
        .filter(Boolean)
        .pop();
    if (!normalized) return "";
    return normalized.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

const fieldLabel = (field) => {
    const key = normalizeFieldKey(field);
    return FIELD_LABELS[key] || "";
};

const isUserFacingServerMessage = (message) => {
    if (typeof message !== "string") return false;
    const trimmed = message.trim();
    if (!trimmed) return false;
    if (TECHNICAL_SERVER_MESSAGE_PATTERN.test(trimmed)) return false;
    return HANGUL_PATTERN.test(trimmed) || !ENGLISH_LETTER_PATTERN.test(trimmed);
};

const normalizeValidationReason = (reason) => {
    if (reason == null) return DEFAULT_VALIDATION_REASON;

    const trimmed = String(reason).trim();
    if (!trimmed) return DEFAULT_VALIDATION_REASON;
    if (trimmed === "must not be blank") return "값을 입력해주세요.";
    if (trimmed === "must not be empty") return "값을 1개 이상 입력해주세요.";
    if (trimmed === "must not be null") return "필수 값입니다.";
    if (trimmed === "must be a well-formed email address") return "올바른 이메일 형식이어야 합니다.";
    if (trimmed.startsWith("must be less than or equal to ")) {
        return `${trimmed.slice("must be less than or equal to ".length)} 이하로 입력해주세요.`;
    }
    if (trimmed.startsWith("must be greater than or equal to ")) {
        return `${trimmed.slice("must be greater than or equal to ".length)} 이상으로 입력해주세요.`;
    }
    if (trimmed.startsWith("must be greater than ")) {
        return `${trimmed.slice("must be greater than ".length)}보다 크게 입력해주세요.`;
    }
    if (trimmed.startsWith("must be less than ")) {
        return `${trimmed.slice("must be less than ".length)}보다 작게 입력해주세요.`;
    }
    if (trimmed.startsWith("size must be between ")) {
        const range = trimmed.slice("size must be between ".length);
        const separator = range.indexOf(" and ");
        if (separator > 0) {
            return `길이는 ${range.slice(0, separator)}자 이상 ${range.slice(separator + " and ".length)}자 이하로 입력해주세요.`;
        }
    }
    if (trimmed.startsWith("must match ")) return "형식이 올바르지 않습니다.";

    return isUserFacingServerMessage(trimmed) ? trimmed : DEFAULT_VALIDATION_REASON;
};

const formatValidationErrors = (errors, fieldKey) => {
    if (!Array.isArray(errors) || errors.length === 0) return "";
    return errors
        .map((item) => {
            const reason = normalizeValidationReason(item?.reason || item?.message);
            const label = fieldLabel(item?.[fieldKey]);
            if (label && reason) return `${label}: ${reason}`;
            return reason || label;
        })
        .filter(Boolean)
        .join(", ");
};

export const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken && !hasRefreshCookieHint()) {
        throw new Error("리프레시 토큰이 없습니다.");
    }

    const headers = {};
    if (refreshToken) {
        headers.Refresh = refreshToken;
        headers.Authorization = `Bearer ${refreshToken}`;
    }

    beginNetworkActivity();
    refreshPromise = axios
        .post("/api/auth/reissue", null, {
            headers,
            withCredentials: true,
        })
        .then((response) => {
            const accessToken = extractBearerToken(response.headers);
            if (!accessToken) {
                throw new Error("재발급 토큰을 찾을 수 없습니다.");
            }
            updateStoredAuthTokens({ accessToken });
            sessionExpiredNotified = false;
            return accessToken;
        })
        .finally(() => {
            refreshPromise = null;
            endNetworkActivity();
        });

    return refreshPromise;
};

api.interceptors.request.use(
    (config) => {
        if (shouldTrackNetworkActivity(config)) {
            beginNetworkActivity();
        }

        config.headers = config.headers || {};

        // FormData 요청은 브라우저가 multipart boundary를 직접 설정해야 합니다.
        const isMultipart = typeof FormData !== "undefined" && config.data instanceof FormData;
        if (isMultipart) {
            delete config.headers["Content-Type"];
            delete config.headers["content-type"];
        } else if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
            config.headers["Content-Type"] = "application/json";
        }

        const token = getStoredAccessToken();
        const sameOriginApiRequest = isSameOriginApiRequest(config);
        if (sameOriginApiRequest && !hasHeaderValue(config.headers, REQUEST_ID_HEADER)) {
            config.headers[REQUEST_ID_HEADER] = createRequestId();
        }
        if (token && sameOriginApiRequest && !isPublicAuthRequest(config)) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        if (shouldTrackNetworkActivity(error?.config)) {
            endNetworkActivity();
        }
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        if (shouldTrackNetworkActivity(response?.config)) {
            endNetworkActivity();
        }
        return response;
    },
    async (error) => {
        if (shouldTrackNetworkActivity(error?.config)) {
            endNetworkActivity();
        }

        const originalRequest = error.config || {};
        const canRefresh =
            error.response?.status === 401 &&
            !originalRequest._retry &&
            isSameOriginApiRequest(originalRequest) &&
            !isPublicAuthRequest(originalRequest) &&
            normalizeUrl(originalRequest.url) !== "/auth/reissue";

        if (!canRefresh) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            const accessToken = await refreshAccessToken();
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
        } catch (refreshError) {
            clearStoredAuth();
            notifySessionExpired();
            redirectToLogin();
            return Promise.reject(refreshError);
        }
    }
);

export const getApiErrorMessage = (error, fallbackMessage = DEFAULT_ERROR_MESSAGE) => {
    const fallback = fallbackMessage || DEFAULT_ERROR_MESSAGE;
    const data = error?.response?.data;
    const serverMessage = data?.message;

    if (Array.isArray(data?.fieldErrors) && data.fieldErrors.length > 0) {
        return formatValidationErrors(data.fieldErrors, "field") || fallback;
    }
    if (Array.isArray(data?.violationErrors) && data.violationErrors.length > 0) {
        return formatValidationErrors(data.violationErrors, "propertyPath") || fallback;
    }
    if (isUserFacingServerMessage(serverMessage)) {
        return serverMessage.trim();
    }

    if (!error?.response) {
        return isTimeoutError(error) ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE;
    }

    const status = Number(error.response.status || 0);
    if (status === 400) return "요청 값을 확인해주세요.";
    if (status === 401) return "로그인이 필요합니다.";
    if (status === 403) return "접근 권한이 없습니다.";
    if (status === 404) return "요청한 정보를 찾을 수 없습니다.";
    if (status === 413) return "요청한 파일 또는 데이터가 허용 크기를 초과했습니다.";
    if (status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    if (status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

    return fallback;
};

export default api;

export const uploadFiles = async (endpoint, formData, method = "post", config = {}) =>
    api.request({
        method,
        url: endpoint,
        data: formData,
        timeout: 120000,
        ...config,
    });
