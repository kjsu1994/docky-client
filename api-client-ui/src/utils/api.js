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

const extractBearerToken = (headers) => {
    const authHeader = headers?.authorization || headers?.Authorization;
    return typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "") : null;
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
        .get("/api/auth/reissue", {
            headers: {
                Authorization: `Bearer ${refreshToken}`,
            },
        })
        .then((response) => {
            const accessToken = extractBearerToken(response.headers);
            if (!accessToken) {
                throw new Error("재발급 토큰을 찾을 수 없습니다.");
            }
            localStorage.setItem("accessToken", accessToken);
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

export default api;

export const uploadFiles = async (endpoint, formData, method = "post", config = {}) =>
    api.request({
        method,
        url: endpoint,
        data: formData,
        timeout: 120000,
        ...config,
    });
