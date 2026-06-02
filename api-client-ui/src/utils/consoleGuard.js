const MUTED_CONSOLE_METHODS = ["debug", "info", "log", "warn", "error"];

const hasConsoleDebugOptIn = () => {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        const searchParams = new URLSearchParams(window.location.search);
        return searchParams.get("debug_console") === "1"
            || window.localStorage?.getItem("ctfmon_debug_console") === "1";
    } catch {
        return false;
    }
};

export const installProductionConsoleGuard = () => {
    if (!import.meta.env.PROD || typeof console === "undefined" || hasConsoleDebugOptIn()) {
        return;
    }

    for (const method of MUTED_CONSOLE_METHODS) {
        if (typeof console[method] === "function") {
            console[method] = () => {};
        }
    }
};
