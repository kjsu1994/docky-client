import axios from "axios";
import toast from "react-hot-toast";
import { beginNetworkActivity, endNetworkActivity } from "./networkActivity";

const api = axios.create({
    baseURL: "/api",
});

const shouldTrackNetworkActivity = (config) => config?.meta?.trackNetwork !== false;

// 요청 인터셉터 / Request interceptor
api.interceptors.request.use(
    (config) => {
        if (shouldTrackNetworkActivity(config)) {
            beginNetworkActivity();
        }

        config.headers = config.headers || {};

        // FormData는 브라우저가 boundary 포함 Content-Type을 자동 설정해야 함 / let browser set multipart boundary.
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

// 응답 인터셉터 - 에러 처리 / Response interceptor
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
        const originalRequest = error.config;

        // 401 에러 처리 (토큰 만료)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem("refreshToken");
            if (refreshToken) {
                try {
                    // 리프레시 토큰으로 새 액세스 토큰 발급
                    const response = await axios.get("/api/auth/reissue", {
                        headers: {
                            Authorization: `Bearer ${refreshToken}`,
                        },
                    });

                    const authHeader = response.headers?.authorization || response.headers?.Authorization;
                    const accessToken =
                        typeof authHeader === "string"
                            ? authHeader.replace(/^Bearer\s+/i, "")
                            : null;

                    if (!accessToken) {
                        throw new Error("재발급 토큰을 찾을 수 없습니다.");
                    }

                    localStorage.setItem("accessToken", accessToken);

                    // 실패한 요청 재시도
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // 리프레시 토큰 만료의 경우
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    window.location.href = "/login";
                    toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
                    return Promise.reject(refreshError);
                }
            } else {
                // 리프레시 토큰 없는 경우
                localStorage.removeItem("accessToken");
                window.location.href = "/login";
            }
        }

        return Promise.reject(error);
    }
);

export default api;

// Multipart 요청 전용 함수 / Multipart helper
export const uploadFiles = async (endpoint, formData, method = "post", config = {}) => {
    beginNetworkActivity();
    try {
        return await api.request({
            method,
            url: endpoint,
            data: formData,
            ...config,
        });
    } finally {
        endNetworkActivity();
    }
};
