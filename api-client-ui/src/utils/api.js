import axios from "axios";
import toast from "react-hot-toast";
import { beginNetworkActivity, endNetworkActivity } from "./networkActivity.js";

const api = axios.create({
    baseURL: "/api",
});

const PUBLIC_AUTH_PATHS = [
    "/members/login",
    "/members/email-verification/send",
    "/members/email-verification/confirm",
    "/members/check-email",
    "/sanctions/release-request",
];

let refreshPromise = null;
let sessionExpiredNotified = false;

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

const extractRefreshToken = (headers) => {
    return stripBearerToken(headers?.refresh || headers?.Refresh || headers?.refreshtoken || headers?.RefreshToken);
};

const clearStoredAuth = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userRoles");
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
    toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
};

const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
        throw new Error("리프레시 토큰이 없습니다.");
    }

    beginNetworkActivity();
    refreshPromise = axios
        .post("/api/auth/reissue", null, {
            headers: {
                Refresh: refreshToken,
                Authorization: `Bearer ${refreshToken}`,
            },
        })
        .then((response) => {
            const accessToken = extractBearerToken(response.headers);
            if (!accessToken) {
                throw new Error("재발급 토큰을 찾을 수 없습니다.");
            }
            const nextRefreshToken = extractRefreshToken(response.headers);
            localStorage.setItem("accessToken", accessToken);
            if (nextRefreshToken) {
                localStorage.setItem("refreshToken", nextRefreshToken);
            }
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

        const token = localStorage.getItem("accessToken");
        if (token) {
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

export const getApiErrorMessage = (error, fallbackMessage = "요청 처리 중 오류가 발생했습니다.") => {
    const fallback = fallbackMessage || "요청 처리 중 오류가 발생했습니다.";
    const data = error?.response?.data;
    const serverMessage = data?.message;

    if (typeof serverMessage === "string" && serverMessage.trim()) {
        return serverMessage.trim();
    }
    if (Array.isArray(data?.fieldErrors) && data.fieldErrors.length > 0) {
        return data.fieldErrors.map((item) => `${item.field}: ${item.reason}`).join(", ");
    }
    if (Array.isArray(data?.violationErrors) && data.violationErrors.length > 0) {
        return data.violationErrors.map((item) => `${item.propertyPath}: ${item.reason}`).join(", ");
    }

    if (!error?.response) {
        return fallbackMessage || "서버와 연결하지 못했습니다. 네트워크 상태를 확인해주세요.";
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
