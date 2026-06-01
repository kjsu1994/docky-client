import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authAdapter, extractAuthErrorMessage, isAccountLockedError } from "../adapters/authAdapter.js";
import { queueAdapter } from "../adapters/queueAdapter.js";

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

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem("accessToken");
            if (token) {
                try {
                    const data = await authAdapter.fetchCurrentMember();
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

    const routeAfterQueue = useCallback(async ({ replace = false } = {}) => {
        try {
            const queueData = await queueAdapter.join();
            if (queueData.status === "WAITING" || queueData.status === "BLOCKED") {
                navigate("/queue", { replace: true });
                return;
            }
        } catch (err) {
            console.error("Queue join failed, proceeding anyway:", err);
        }

        navigate("/app", { replace });
    }, [navigate]);

    const login = async (email, password) => {
        try {
            const { accessToken, refreshToken, roles: loginRoles } = await authAdapter.loginWithPassword({ email, password });

            if (!accessToken) throw new Error("로그인 토큰을 찾을 수 없습니다.");

            localStorage.setItem("accessToken", accessToken);
            if (refreshToken) {
                localStorage.setItem("refreshToken", refreshToken);
            } else {
                localStorage.removeItem("refreshToken");
            }
            if (loginRoles) {
                localStorage.setItem("userRoles", JSON.stringify(loginRoles));
            }

            const userData = await authAdapter.fetchCurrentMember();
            setUser(withRolesFallback(userData, loginRoles || parseStoredRoles()));

            toast.success("로그인 성공!");

            await routeAfterQueue();
        } catch (error) {
            if (isAccountLockedError(error)) {
                throw error;
            }
            toast.error(extractAuthErrorMessage(error, "로그인 실패"));
            throw error;
        }
    };

    const loginWithTokens = useCallback(async ({ accessToken, refreshToken }) => {
        if (!accessToken) {
            throw new Error("액세스 토큰이 없습니다.");
        }

        localStorage.setItem("accessToken", accessToken);
        if (refreshToken) {
            localStorage.setItem("refreshToken", refreshToken);
        }

        const userData = await authAdapter.fetchCurrentMember();
        setUser(withRolesFallback(userData, parseStoredRoles()));

        const postOauthRedirect = localStorage.getItem("postOauthRedirect");
        if (postOauthRedirect) {
            localStorage.removeItem("postOauthRedirect");
            navigate(postOauthRedirect, { replace: true });
            return;
        }

        await routeAfterQueue({ replace: true });
    }, [navigate, routeAfterQueue]);

    const logout = async (options = {}) => {
        if (options && typeof options.preventDefault === "function") {
            options = {};
        }
        const { skipApi = false, silent = false } = options;

        if (!skipApi) {
            try {
                await authAdapter.logout();
            } catch (error) {
                console.error("Failed to logout from server:", error);
            }
        }

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userRoles");
        setUser(null);

        if (!silent) {
            toast.success("로그아웃되었습니다.");
        }
        navigate("/login");
    };

    const register = async (userData) => {
        try {
            await authAdapter.registerMember(userData);
            toast.success("회원가입 성공! 로그인해주세요.");
            navigate("/login");
        } catch (error) {
            toast.error(extractAuthErrorMessage(error, "회원가입 실패"));
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
