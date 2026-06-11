const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_ROLES_KEY = "userRoles";

const getStorage = (type) => {
    if (typeof window === "undefined") return null;
    try {
        return type === "session" ? window.sessionStorage : window.localStorage;
    } catch {
        return null;
    }
};

const safeGet = (storage, key) => {
    try {
        return storage?.getItem(key) || "";
    } catch {
        return "";
    }
};

const safeSet = (storage, key, value) => {
    try {
        if (value == null || value === "") {
            storage?.removeItem(key);
            return;
        }
        storage?.setItem(key, value);
    } catch {
        // Ignore storage quota or privacy-mode failures.
    }
};

const safeRemove = (storage, key) => {
    try {
        storage?.removeItem(key);
    } catch {
        // Ignore storage access failures.
    }
};

const authStorage = () => {
    const local = getStorage("local");
    const session = getStorage("session");
    const localToken = safeGet(local, ACCESS_TOKEN_KEY);
    const sessionToken = safeGet(session, ACCESS_TOKEN_KEY);
    const localRefreshToken = safeGet(local, REFRESH_TOKEN_KEY);
    const sessionRefreshToken = safeGet(session, REFRESH_TOKEN_KEY);
    if (localToken || localRefreshToken) return local;
    if (sessionToken || sessionRefreshToken) return session;
    return local;
};

export const getStoredAccessToken = () => safeGet(authStorage(), ACCESS_TOKEN_KEY).trim();

export const getStoredRefreshToken = () => safeGet(authStorage(), REFRESH_TOKEN_KEY).trim();

export const getStoredUserRoles = () => safeGet(authStorage(), USER_ROLES_KEY);

export const clearAuthSession = () => {
    [getStorage("local"), getStorage("session")].forEach((storage) => {
        safeRemove(storage, ACCESS_TOKEN_KEY);
        safeRemove(storage, REFRESH_TOKEN_KEY);
        safeRemove(storage, USER_ROLES_KEY);
    });
};

export const persistAuthSession = ({ accessToken, refreshToken, roles, remember = false } = {}) => {
    clearAuthSession();
    const storage = getStorage(remember ? "local" : "session");
    safeSet(storage, ACCESS_TOKEN_KEY, accessToken);
    safeSet(storage, REFRESH_TOKEN_KEY, refreshToken);
    if (Array.isArray(roles)) {
        safeSet(storage, USER_ROLES_KEY, JSON.stringify(roles));
    }
};

export const updateStoredAuthTokens = ({ accessToken, refreshToken } = {}) => {
    const storage = authStorage();
    safeSet(storage, ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
        safeSet(storage, REFRESH_TOKEN_KEY, refreshToken);
    }
};
