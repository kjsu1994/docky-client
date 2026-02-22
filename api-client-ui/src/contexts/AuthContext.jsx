import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

const parseStoredRoles = () => {
    try {
        const raw = localStorage.getItem("userRoles");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const withRolesFallback = (userData, rolesFallback) => {
    if (!userData || typeof userData !== "object") return userData;
    if (Array.isArray(userData.roles) && userData.roles.length > 0) return userData;
    if (Array.isArray(rolesFallback) && rolesFallback.length > 0) {
        return { ...userData, roles: rolesFallback };
    }
    return userData;
};

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

    // 珥덇린 濡쒕뱶 ???좏겙 ?뺤씤 諛??ъ슜???뺣낫 媛?몄삤湲?
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem("accessToken");
            if (token) {
                try {
                    const response = await api.get("/members");
                    const data = response.data.data || response.data;
                    setUser(withRolesFallback(data, parseStoredRoles()));
                } catch (error) {
                    console.error("Failed to fetch user:", error);
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("userRoles");
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    //2026.02.12 ?섏젙
    const login = async (email, password) => {
        try {
            const response = await api.post("/members/login", { email, password });
            const loginBody = response.data?.data || response.data;
            const loginRoles = Array.isArray(loginBody?.roles) ? loginBody.roles : null;

            // ?ㅻ뜑?먯꽌 ?좏겙 異붿텧 (??뚮Ц??諛?Bearer ?묐몢?????
            const authHeader = response.headers?.authorization || response.headers?.Authorization;
            const refreshHeader = response.headers?.refresh || response.headers?.Refresh;

            const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
            const refreshToken = refreshHeader?.replace(/^Bearer\s+/i, "");

            if (!accessToken) throw new Error("?좏겙??李얠쓣 ???놁뒿?덈떎.");

            localStorage.setItem("accessToken", accessToken);
            localStorage.setItem("refreshToken", refreshToken);
            if (loginRoles) {
                localStorage.setItem("userRoles", JSON.stringify(loginRoles));
            }

            // ?좎? ?뺣낫瑜?媛?몄삱 ???좏겙??諛붾줈 ?곸슜?섎룄濡??ㅼ젙 ?뺤씤 ?꾩슂
            const userResponse = await api.get("/members");
            const userData = userResponse.data.data || userResponse.data;
            setUser(withRolesFallback(userData, loginRoles || parseStoredRoles()));

            toast.success("로그인성공!");

            // 媛???湲곗뿴 吏꾩엯 ?쒕룄 (The Iron Queue)
            try {
                // 濡쒓렇???깃났 吏곹썑 ?湲곗뿴 吏꾩엯 ?붿껌
                const queueResponse = await api.post("/api/queue/join");
                const queueData = queueResponse.data?.data || queueResponse.data;
                
                // 留뚯빟 'WAITING' ?곹깭?쇰㈃ ?湲??섏씠吏濡??대룞?섏뿬 ?쒕쾲 ?湲?
                if (queueData.status === "WAITING") {
                    navigate("/queue", { replace: true });
                    return;
                }
            } catch (err) {
                // ?湲곗뿴 ?쒖뒪???ㅻ쪟 ?쒖뿉???쒕퉬??媛?⑹꽦???꾪빐 ?쇰떒 吏꾩엯 ?덉슜
                console.error("Queue join failed, proceeding anyway:", err);
            }

            navigate("/app"); // ?湲곗뿴???녾굅??'ALLOWED'??寃쎌슦 硫붿씤?쇰줈 ?대룞
        } catch (error) {
            if (error?.response?.data?.code === "ACCOUNT_LOCKED") {
                throw error;
            }
            toast.error(error.response?.data?.message || "로그인실패");
            throw error;
        }
    };

    const loginWithTokens = async ({ accessToken, refreshToken }) => {
        if (!accessToken) {
            throw new Error("?≪꽭???좏겙???놁뒿?덈떎.");
        }

        localStorage.setItem("accessToken", accessToken);
        if (refreshToken) {
            localStorage.setItem("refreshToken", refreshToken);
        }

        const userResponse = await api.get("/members");
        const userData = userResponse.data.data || userResponse.data;
        setUser(withRolesFallback(userData, parseStoredRoles()));

        // 媛???湲곗뿴 吏꾩엯 ?쒕룄 (OAuth 濡쒓렇???좎???
        try {
            // OAuth濡?濡쒓렇?명븳 寃쎌슦?먮룄 ?숈씪?섍쾶 ?湲곗뿴 ?뺤씤
            const queueResponse = await api.post("/api/queue/join");
            const queueData = queueResponse.data?.data || queueResponse.data;
            
            // ?湲?以묒씠硫??꾩슜 ?섏씠吏濡?由щ떎?대젆??
            if (queueData.status === "WAITING") {
                navigate("/queue", { replace: true });
                return;
            }
        } catch (err) {
            console.error("Queue join failed, proceeding anyway:", err);
        }

        // 諛붾줈 ?낆옣 媛?ν븯嫄곕굹 ?湲곗뿴 ?ㅻ쪟 ??硫붿씤?쇰줈 ?대룞
        navigate("/app", { replace: true });
    };

    const logout = async (options = {}) => {
        if (options && typeof options.preventDefault === "function") {
            options = {};
        }
        const { skipApi = false, silent = false } = options;

        if (!skipApi) {
            try {
                await api.post("/members/logout");
            } catch (error) {
                // ?쒕쾭 濡쒓렇?꾩썐 ?ㅽ뙣?щ룄 ?대씪?댁뼵???몄뀡? ?뺣━
                console.error("Failed to logout from server:", error);
            }
        }

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userRoles");
        setUser(null);

        if (!silent) {
            toast.success("Logged out successfully.");
        }
        navigate("/login");
    };

    const register = async (userData) => {
        try {
            await api.post("/members", userData);
            toast.success("?뚯썝媛???깃났! 濡쒓렇?명빐二쇱꽭??");
            navigate("/login");
        } catch (error) {
            toast.error(error.response?.data?.message || "?뚯썝媛???ㅽ뙣");
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                loginWithTokens,
                logout,
                register,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
