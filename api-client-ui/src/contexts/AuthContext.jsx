import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // 초기 로드 시 토큰 확인 및 사용자 정보 가져오기
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem("accessToken");
            if (token) {
                try {
                    const response = await api.get("/members");
                    setUser(response.data.data || response.data);
                } catch (error) {
                    console.error("Failed to fetch user:", error);
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    //2026.02.12 수정
    const login = async (email, password) => {
        try {
            const response = await api.post("/members/login", { email, password });

            // 헤더에서 토큰 추출 (대소문자 및 Bearer 접두어 대응)
            const authHeader = response.headers?.authorization || response.headers?.Authorization;
            const refreshHeader = response.headers?.refresh || response.headers?.Refresh;

            const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
            const refreshToken = refreshHeader?.replace(/^Bearer\s+/i, "");

            if (!accessToken) throw new Error("토큰을 찾을 수 없습니다.");

            localStorage.setItem("accessToken", accessToken);
            localStorage.setItem("refreshToken", refreshToken);

            // 유저 정보를 가져올 때 토큰이 바로 적용되도록 설정 확인 필요
            const userResponse = await api.get("/members");
            setUser(userResponse.data.data || userResponse.data);

            toast.success("로그인 성공!");
            navigate("/app"); // 이제 정상 실행될 겁니다!
        } catch (error) {
            toast.error(error.response?.data?.message || "로그인 실패");
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
        toast.success("로그아웃되었습니다");
        navigate("/login");
    };

    const register = async (userData) => {
        try {
            await api.post("/members", userData);
            toast.success("회원가입 성공! 로그인해주세요.");
            navigate("/login");
        } catch (error) {
            toast.error(error.response?.data?.message || "회원가입 실패");
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                register,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};