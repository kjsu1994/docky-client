import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
    applyThemePreference,
    getStoredThemePreference,
    normalizeThemePreference,
    resolveThemePreference,
    THEME_STORAGE_KEY,
    THEME_PREFERENCES,
    updateThemeColorMeta,
    writeStoredThemePreference,
} from "../utils/themePreference.js";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [preference, setPreferenceState] = useState(getStoredThemePreference);
    const [resolvedTheme, setResolvedTheme] = useState(() => resolveThemePreference(getStoredThemePreference()));

    useEffect(() => {
        applyThemePreference(preference);
        setResolvedTheme(resolveThemePreference(preference));
    }, [preference]);

    useEffect(() => {
        if (preference !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return undefined;
        }

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            setResolvedTheme(media.matches ? "dark" : "light");
            updateThemeColorMeta("system");
        };

        handleChange();
        if (typeof media.addEventListener === "function") {
            media.addEventListener("change", handleChange);
            return () => media.removeEventListener("change", handleChange);
        }
        media.addListener(handleChange);
        return () => media.removeListener(handleChange);
    }, [preference]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const handleStorage = (event) => {
            if (event.key !== THEME_STORAGE_KEY) return;
            const normalized = normalizeThemePreference(event.newValue);
            setPreferenceState(normalized);
            setResolvedTheme(resolveThemePreference(normalized));
            applyThemePreference(normalized);
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    const setPreference = useCallback((nextPreference) => {
        const normalized = writeStoredThemePreference(nextPreference);
        setPreferenceState(normalized);
        setResolvedTheme(resolveThemePreference(normalized));
    }, []);

    const value = useMemo(() => ({
        preference,
        resolvedTheme,
        options: THEME_PREFERENCES,
        setPreference,
        normalizePreference: normalizeThemePreference,
    }), [preference, resolvedTheme, setPreference]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
};
