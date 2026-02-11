import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
    baseURL: "/api",
    headers: {
        "Content-Type": "application/json",
    },
});

// 요청 인터셉터 - Authorization 헤더 자동 추가
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 401 에러 처리 (토큰 만료)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem("refreshToken");
            if (refreshToken) {
                try {
                    // 리프레시 토큰으로 새 액세스 토큰 발급
                    const response = await axios.post("/api/auth/refresh", {
                        refreshToken,
                    });

                    const { accessToken } = response.data;
                    localStorage.setItem("accessToken", accessToken);

                    // 실패한 요청 재시도
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // 리프레시 토큰도 만료된 경우
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    window.location.href = "/login";
                    toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
                    return Promise.reject(refreshError);
                }
            } else {
                // 리프레시 토큰이 없는 경우
                localStorage.removeItem("accessToken");
                window.location.href = "/login";
            }
        }

        return Promise.reject(error);
    }
);

export default api;

// Multipart 요청용 별도 함수
export const uploadFiles = async (endpoint, formData) => {
    const token = localStorage.getItem("accessToken");
    return axios.post(`/api${endpoint}`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
            Authorization: token ? `Bearer ${token}` : "",
        },
    });
};