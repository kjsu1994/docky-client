import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizePostOauthRedirect } from "../utils/authRedirect.js";
import {
    clearAuthSession,
    getStoredAccessToken,
    getStoredRefreshToken,
    getStoredUserRoles,
    persistAuthSession,
} from "../utils/authStorage.js";
import { logClientError } from "../utils/clientDiagnostics.js";
import { notifyError, notifySuccess } from "../utils/toast.js";

const AuthContext = createContext(null);
const loadAuthAdapter = () => import("../adapters/authAdapter.js");
const loadApi = () => import("../utils/api.js");
export { normalizePostOauthRedirect } from "../utils/authRedirect.js";

const parseStoredRoles = () => {
    try {
        const raw = getStoredUserRoles();
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
            const token = getStoredAccessToken();
            const refreshToken = getStoredRefreshToken();
            if (token || refreshToken) {
                try {
                    if (!token && refreshToken) {
                        const { refreshAccessToken } = await loadApi();
                        await refreshAccessToken();
                    }
                    const { authAdapter } = await loadAuthAdapter();
                    const data = await authAdapter.fetchCurrentMember();
                    setUser(withRolesFallback(data, parseStoredRoles()));
                } catch (error) {
                    logClientError("auth.member.fetch", error);
                    clearAuthSession();
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const requestQueueAdmission = useCallback(async () => {
        try {
            const { queueAdapter } = await import("../adapters/queueAdapter.js");
            return await queueAdapter.join();
        } catch (err) {
            logClientError("auth.queue.join", err);
            return null;
        }
    }, []);

    const routeAfterQueue = useCallback((queueData, { replace = false } = {}) => {
        if (queueData?.status === "WAITING" || queueData?.status === "BLOCKED") {
            navigate("/queue", { replace: true });
            return;
        }
        navigate("/app", { replace });
    }, [navigate]);

    const login = async (email, password, options = {}) => {
        let authModule = null;
        try {
            authModule = await loadAuthAdapter();
            const { authAdapter } = authModule;
            const remember = Boolean(options.remember);
            const { accessToken, refreshToken, roles: loginRoles } = await authAdapter.loginWithPassword({ email, password, remember });

            if (!accessToken) throw new Error("로그인 토큰을 찾을 수 없습니다.");

            persistAuthSession({ accessToken, refreshToken, roles: loginRoles, remember });

            const [userData, queueData] = await Promise.all([
                authAdapter.fetchCurrentMember(),
                requestQueueAdmission(),
            ]);
            setUser(withRolesFallback(userData, loginRoles || parseStoredRoles()));

            notifySuccess("로그인 성공!");

            routeAfterQueue(queueData);
        } catch (error) {
            if (authModule?.isAccountLockedError?.(error)) {
                throw error;
            }
            notifyError(authModule?.extractAuthErrorMessage?.(error, "로그인 실패") || "로그인 실패");
            throw error;
        }
    };

    const loginWithTokens = useCallback(async ({ accessToken, refreshToken, remember = true }) => {
        if (!accessToken) {
            throw new Error("액세스 토큰이 없습니다.");
        }

        persistAuthSession({ accessToken, refreshToken, roles: parseStoredRoles(), remember });

        const postOauthRedirect = normalizePostOauthRedirect(localStorage.getItem("postOauthRedirect"));
        const { authAdapter } = await loadAuthAdapter();
        const [userData, queueData] = await Promise.all([
            authAdapter.fetchCurrentMember(),
            postOauthRedirect ? Promise.resolve(null) : requestQueueAdmission(),
        ]);
        setUser(withRolesFallback(userData, parseStoredRoles()));

        localStorage.removeItem("postOauthRedirect");
        if (postOauthRedirect) {
            navigate(postOauthRedirect, { replace: true });
            return;
        }

        routeAfterQueue(queueData, { replace: true });
    }, [navigate, requestQueueAdmission, routeAfterQueue]);

    const logout = async (options = {}) => {
        if (options && typeof options.preventDefault === "function") {
            options = {};
        }
        const { skipApi = false, silent = false } = options;

        if (!skipApi) {
            try {
                const { authAdapter } = await loadAuthAdapter();
                await authAdapter.logout();
            } catch (error) {
                logClientError("auth.logout", error);
            }
        }

        clearAuthSession();
        setUser(null);

        if (!silent) {
            notifySuccess("로그아웃되었습니다.");
        }
        navigate("/login");
    };

    const register = async (userData) => {
        let authModule = null;
        try {
            authModule = await loadAuthAdapter();
            const { authAdapter } = authModule;
            await authAdapter.registerMember(userData);
            notifySuccess("회원가입 성공! 로그인해주세요.");
            navigate("/login");
        } catch (error) {
            notifyError(authModule?.extractAuthErrorMessage?.(error, "회원가입 실패") || "회원가입 실패");
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
