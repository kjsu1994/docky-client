import { logClientError } from "./clientDiagnostics.js";

export const THEME_STORAGE_KEY = "docky.theme";
export const THEME_PREFERENCES = ["system", "light", "dark"];
export const THEME_COLORS = {
    light: "#f8fafc",
    dark: "#020617",
};

export const normalizeThemePreference = (value) => (
    THEME_PREFERENCES.includes(value) ? value : "system"
);

export const getStoredThemePreference = () => {
    if (typeof window === "undefined") return "system";
    try {
        return normalizeThemePreference(window.localStorage?.getItem(THEME_STORAGE_KEY));
    } catch (error) {
        logClientError("theme.preference.read", error);
        return "system";
    }
};

export const resolveThemePreference = (preference) => {
    const normalized = normalizeThemePreference(preference);
    if (normalized === "light" || normalized === "dark") return normalized;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const applyThemePreference = (preference) => {
    if (typeof document === "undefined") return;
    const normalized = normalizeThemePreference(preference);
    const root = document.documentElement;

    root.dataset.themePreference = normalized;
    if (normalized === "light" || normalized === "dark") {
        root.dataset.theme = normalized;
        updateThemeColorMeta(normalized);
        return;
    }

    delete root.dataset.theme;
    updateThemeColorMeta(normalized);
};

export const updateThemeColorMeta = (preference) => {
    if (typeof document === "undefined") return;
    const resolvedTheme = resolveThemePreference(preference);
    const content = THEME_COLORS[resolvedTheme] || THEME_COLORS.light;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head?.appendChild(meta);
    }
    meta.setAttribute("content", content);
};

export const writeStoredThemePreference = (preference) => {
    const normalized = normalizeThemePreference(preference);
    if (typeof window === "undefined") return normalized;
    try {
        if (normalized === "system") {
            window.localStorage?.removeItem(THEME_STORAGE_KEY);
        } else {
            window.localStorage?.setItem(THEME_STORAGE_KEY, normalized);
        }
    } catch (error) {
        logClientError("theme.preference.write", error);
    }
    applyThemePreference(normalized);
    return normalized;
};
