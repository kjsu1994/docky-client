const DIAGNOSTIC_URL_BASE = "http://ctfmon.local";

const compactObject = (value) => {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
    );
};

const hasConsoleDebugOptIn = () => {
    if (typeof window === "undefined") return false;
    try {
        const searchParams = new URLSearchParams(window.location.search);
        return searchParams.get("debug_console") === "1"
            || window.localStorage?.getItem("ctfmon_debug_console") === "1";
    } catch {
        return false;
    }
};

const toSafePath = (url) => {
    if (typeof url !== "string" || !url.trim()) return undefined;

    try {
        return new URL(url.trim(), DIAGNOSTIC_URL_BASE).pathname || "/";
    } catch {
        const path = url.trim().split(/[?#]/)[0];
        return path.startsWith("/") ? path : undefined;
    }
};

export const safeClientError = (error) => {
    if (!error || typeof error !== "object") {
        return { type: error === null ? "null" : typeof error };
    }

    const config = error.config || {};
    const response = error.response || {};

    return compactObject({
        name: typeof error.name === "string" ? error.name : undefined,
        message: typeof error.message === "string" ? error.message : undefined,
        code: typeof error.code === "string" ? error.code : undefined,
        status: response.status ?? error.status,
        method: typeof config.method === "string" ? config.method.toUpperCase() : undefined,
        path: toSafePath(config.url),
    });
};

export const logClientError = (label, error) => {
    if ((!import.meta.env.DEV && !hasConsoleDebugOptIn()) || typeof console === "undefined" || typeof console.error !== "function") {
        return;
    }

    console.error(label, safeClientError(error));
};
