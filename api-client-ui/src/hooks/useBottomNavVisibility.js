import { useEffect, useState } from "react";

export const BOTTOM_NAV_VISIBILITY_EVENT = "bottom-nav-visibility-change";

const getStoredState = () => {
    if (typeof window === "undefined") {
        return { enabled: false, visible: true };
    }

    const { bottomNavEnabled, bottomNavVisible } = document.documentElement.dataset;
    if (bottomNavEnabled === "true") {
        return { enabled: true, visible: bottomNavVisible !== "false" };
    }

    return {
        enabled: Boolean(window.matchMedia?.("(max-width: 1023px)").matches),
        visible: true,
    };
};

export const publishBottomNavVisibility = ({ enabled, visible }) => {
    if (typeof window === "undefined") return;

    const nextState = {
        enabled: Boolean(enabled),
        visible: Boolean(visible),
    };
    document.documentElement.dataset.bottomNavEnabled = String(nextState.enabled);
    document.documentElement.dataset.bottomNavVisible = String(nextState.visible);
    window.dispatchEvent(new CustomEvent(BOTTOM_NAV_VISIBILITY_EVENT, { detail: nextState }));
};

export const useBottomNavVisibility = () => {
    const [state, setState] = useState(getStoredState);

    useEffect(() => {
        const handleChange = (event) => {
            setState(event.detail || getStoredState());
        };
        window.addEventListener(BOTTOM_NAV_VISIBILITY_EVENT, handleChange);
        setState(getStoredState());
        return () => window.removeEventListener(BOTTOM_NAV_VISIBILITY_EVENT, handleChange);
    }, []);

    return state;
};
