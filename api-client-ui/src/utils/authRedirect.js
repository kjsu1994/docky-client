const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const MAX_POST_OAUTH_REDIRECT_LENGTH = 300;

export const normalizePostOauthRedirect = (value) => {
    const target = typeof value === "string" ? value.trim() : "";
    if (!target || target.length > MAX_POST_OAUTH_REDIRECT_LENGTH || CONTROL_CHARACTER_PATTERN.test(target)) {
        return "";
    }
    if (!target.startsWith("/") || target.startsWith("//")) {
        return "";
    }
    if (target === "/queue" || target.startsWith("/queue?")) {
        return target;
    }
    if (target === "/app" || target.startsWith("/app/") || target.startsWith("/app?")) {
        return target;
    }
    return "";
};
