import axios from "axios";

const http = axios.create({
    baseURL: "/api",
    timeout: 15000,
});
// =========================
// Request Interceptor
// =========================
http.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// =========================
// Error Normalize Helper
// =========================
function normalizeAxiosError(err) {
    return {
        status: err?.response?.status ?? null,
        message:
            err?.response?.data?.message ??
            (typeof err?.response?.data === "string" ? err.response.data : null) ??
            err?.message ??
            "Unknown error",
        data: err?.response?.data ?? null,
        headers: err?.response?.headers ?? null,
        url: err?.config?.url ?? null,
        method: err?.config?.method ?? null,
    };
}

// =========================
// Response Interceptor
// =========================
http.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;

        if (!original) {
            return Promise.reject(normalizeAxiosError(err));
        }

        // =========================
        // 401 → Refresh 시도
        // ⭐ 수정: /boards 관련 URL은 401 시 refresh 시도하지 않고 바로 에러 반환
        // =========================
        if (
            err.response?.status === 401 &&
            !original._retry &&
            !original.url?.includes("/boards")  // ⭐ 변경: startsWith → includes
        ) {
            original._retry = true;

            try {
                const refreshToken = localStorage.getItem("refreshToken");
                if (!refreshToken) throw new Error("No refresh token");

                // refresh 요청 (axios 사용 → interceptor 무한루프 방지)
                const refreshRes = await axios.get(
                    "/api/auth/reissue",
                    {
                        headers: {
                            Authorization: `Bearer ${refreshToken}`,
                        },
                        timeout: 15000,
                    }
                );

                // 🔑 헤더에서 새 accessToken 추출
                const authHeader =
                    refreshRes.headers?.authorization ||
                    refreshRes.headers?.Authorization;

                const newAccessToken =
                    typeof authHeader === "string"
                        ? authHeader.replace(/^Bearer\s+/i, "")
                        : null;

                if (!newAccessToken) {
                    throw new Error("Refresh succeeded but Authorization header missing");
                }

                // 저장
                localStorage.setItem("accessToken", newAccessToken);

                // 원래 요청에 새 토큰 주입
                original.headers = original.headers ?? {};
                original.headers.Authorization = `Bearer ${newAccessToken}`;

                return http(original);
            } catch (refreshErr) {
                // =========================
                // Refresh 실패 → 강제 로그아웃
                // =========================
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/login";
                return;
            }
        }

        // =========================
        // 기타 에러 (boards 관련 401 포함)
        // =========================
        return Promise.reject(normalizeAxiosError(err));
    }
);

export default http;
