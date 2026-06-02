export const ADS_CONSENT_STORAGE_KEY = "ads_personalization_consent";

export const normalizeAdsConsent = (value) => {
    return value === "personalized" || value === "non_personalized" ? value : null;
};

export const readStoredAdsConsent = () => {
    if (typeof window === "undefined") return null;
    try {
        return normalizeAdsConsent(window.localStorage.getItem(ADS_CONSENT_STORAGE_KEY));
    } catch {
        return null;
    }
};

export const writeStoredAdsConsent = (value) => {
    const nextConsent = normalizeAdsConsent(value);
    if (typeof window === "undefined") return nextConsent;
    try {
        if (nextConsent) {
            window.localStorage.setItem(ADS_CONSENT_STORAGE_KEY, nextConsent);
        } else {
            window.localStorage.removeItem(ADS_CONSENT_STORAGE_KEY);
        }
    } catch {
        // localStorage failure should not block the banner UI.
    }
    return nextConsent;
};

export const isAdsenseBanner = (banner) => {
    return banner?.renderMode === "ADSENSE" && banner?.adProvider?.toUpperCase() === "ADSENSE";
};
