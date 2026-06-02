import { useCallback, useEffect, useRef } from "react";
import {
    ADS_CONSENT_STORAGE_KEY,
    isAdsenseBanner,
    normalizeAdsConsent,
    writeStoredAdsConsent,
} from "../../utils/adsense.js";

const GOOGLESYNDICATION_SCRIPT = "googlesyndication.com/pagead/js/adsbygoogle.js";

export const HomeAdsenseRuntime = ({
    activeBanner,
    adsConsent,
    adsenseClientId,
    bannerIndex,
    isBannerInView,
    isPageHidden,
    onConsentChange,
    onImpression,
}) => {
    const adsenseInitializedRef = useRef(false);
    const adsensePushKeysRef = useRef(new Set());
    const impressionSentRef = useRef(new Set());

    const updateConsent = useCallback((value, { persist = true } = {}) => {
        adsensePushKeysRef.current = new Set();
        const nextConsent = persist ? writeStoredAdsConsent(value) : normalizeAdsConsent(value);
        onConsentChange(nextConsent);
    }, [onConsentChange]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const handleStorage = (event) => {
            if (event.key !== ADS_CONSENT_STORAGE_KEY) return;
            updateConsent(event.newValue, { persist: false });
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [updateConsent]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.requestNonPersonalizedAds = adsConsent === "non_personalized" ? 1 : 0;
    }, [adsConsent]);

    const pushAdsenseBanner = useCallback(() => {
        if (!isAdsenseBanner(activeBanner) || adsConsent === null) return;
        if (isPageHidden || !isBannerInView) return;
        if (typeof window === "undefined") return;

        const pushKey = [
            activeBanner.id ?? bannerIndex,
            adsConsent,
            activeBanner.adsenseClient || adsenseClientId,
            activeBanner.adsenseSlot || "0000000000",
        ].join(":");
        if (adsensePushKeysRef.current.has(pushKey)) return;
        adsensePushKeysRef.current.add(pushKey);
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
            adsensePushKeysRef.current.delete(pushKey);
        }
    }, [activeBanner, adsConsent, adsenseClientId, bannerIndex, isBannerInView, isPageHidden]);

    useEffect(() => {
        if (!isAdsenseBanner(activeBanner) || !adsenseClientId || adsConsent === null) return;

        const scriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;
        const exists = Array.from(document.scripts || []).some(
            (script) => script.src && script.src.includes(GOOGLESYNDICATION_SCRIPT)
        );

        if (exists) {
            adsenseInitializedRef.current = true;
            return;
        }

        const script = document.createElement("script");
        script.async = true;
        script.src = scriptSrc;
        script.crossOrigin = "anonymous";
        script.onload = () => {
            adsenseInitializedRef.current = true;
            pushAdsenseBanner();
        };
        document.head.appendChild(script);
        pushAdsenseBanner();
    }, [activeBanner, adsConsent, adsenseClientId, pushAdsenseBanner]);

    useEffect(() => {
        if (!isAdsenseBanner(activeBanner) || adsConsent === null) return;
        if (!activeBanner?.id || isPageHidden || !isBannerInView) return;
        const key = String(activeBanner.id);
        if (impressionSentRef.current.has(key)) return;
        impressionSentRef.current.add(key);
        onImpression(activeBanner, "IMPRESSION");
    }, [activeBanner, adsConsent, isBannerInView, isPageHidden, onImpression]);

    useEffect(() => {
        if (!adsenseInitializedRef.current) return;
        pushAdsenseBanner();
    }, [pushAdsenseBanner]);

    if (adsConsent !== null) {
        return (
            <button
                type="button"
                className="fixed right-4 top-4 z-50 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-xl transition hover:border-primary-200 hover:text-primary-700 sm:right-6"
                onClick={() => updateConsent(null)}
                aria-label="광고 개인화 설정 변경"
            >
                광고 설정 변경
            </button>
        );
    }

    return (
        <div
            className="fixed inset-x-4 top-4 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[420px]"
            role="dialog"
            aria-modal="false"
            aria-labelledby="home-ads-consent-title"
            aria-describedby="home-ads-consent-description"
        >
            <div id="home-ads-consent-title" className="text-sm font-black text-slate-900">광고 개인화 설정</div>
            <p id="home-ads-consent-description" className="mt-1 text-xs text-slate-600">
                맞춤 광고 동의 여부를 선택해 주세요. 선택은 언제든 변경할 수 있습니다.
            </p>
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    className="btn-primary flex-1 text-xs"
                    onClick={() => updateConsent("personalized")}
                >
                    맞춤 광고 동의
                </button>
                <button
                    type="button"
                    className="btn-secondary flex-1 text-xs"
                    onClick={() => updateConsent("non_personalized")}
                    aria-label="비개인화 광고"
                >
                    비개인화 광고
                </button>
            </div>
        </div>
    );
};
