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

const storageCandidates = () => [getStorage("session"), getStorage("local")].filter(Boolean);

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

const getFirstStoredValue = (key) => {
    for (const storage of storageCandidates()) {
        const value = safeGet(storage, key).trim();
        if (value) return value;
    }
    return "";
};

export const getStoredAccessToken = () => getFirstStoredValue(ACCESS_TOKEN_KEY);

// Legacy fallback only. New refresh tokens live in an HttpOnly cookie.
export const getStoredRefreshToken = () => getFirstStoredValue(REFRESH_TOKEN_KEY);

export const getStoredUserRoles = () => getFirstStoredValue(USER_ROLES_KEY);

export const hasRefreshCookieHint = () => {
    if (typeof document === "undefined") return false;
    return document.cookie
        .split(";")
        .map((value) => value.trim())
        .some((value) => value === "docky_refresh_hint=1");
};

export const clearAuthSession = () => {
    [getStorage("local"), getStorage("session")].forEach((storage) => {
        safeRemove(storage, ACCESS_TOKEN_KEY);
        safeRemove(storage, REFRESH_TOKEN_KEY);
        safeRemove(storage, USER_ROLES_KEY);
    });
};

export const persistAuthSession = ({ accessToken, refreshToken, roles, remember = false } = {}) => {
    clearAuthSession();
    const storage = getStorage("session");
    safeSet(storage, ACCESS_TOKEN_KEY, accessToken);
    if (Array.isArray(roles)) {
        safeSet(storage, USER_ROLES_KEY, JSON.stringify(roles));
    }
};

export const updateStoredAuthTokens = ({ accessToken, refreshToken } = {}) => {
    const local = getStorage("local");
    const session = getStorage("session");
    safeRemove(local, ACCESS_TOKEN_KEY);
    safeRemove(local, REFRESH_TOKEN_KEY);
    safeRemove(session, REFRESH_TOKEN_KEY);
    const storage = session;
    safeSet(storage, ACCESS_TOKEN_KEY, accessToken);
};
