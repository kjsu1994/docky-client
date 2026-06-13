import { logClientError } from "./clientDiagnostics.js";

export const THEME_STORAGE_KEY = "docky.theme";
export const THEME_PREFERENCES = ["system", "light", "dark"];

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
        return;
    }

    delete root.dataset.theme;
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
