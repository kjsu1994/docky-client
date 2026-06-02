import { useEffect, useState } from "react";

const NAVER_MAPS_SCRIPT_ID = "naver-maps-sdk";
const NAVER_MAPS_SDK_SRC = "https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=hpqjn6tjrs&submodules=geocoder";

let naverMapsPromise = null;

export const loadNaverMapsSdk = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return Promise.reject(new Error("지도는 브라우저 환경에서만 사용할 수 있습니다."));
    }
    if (window.naver?.maps) {
        return Promise.resolve(window.naver.maps);
    }
    if (naverMapsPromise) return naverMapsPromise;

    naverMapsPromise = new Promise((resolve, reject) => {
        const finish = () => {
            if (window.naver?.maps) {
                resolve(window.naver.maps);
                return;
            }
            reject(new Error("지도 SDK가 초기화되지 않았습니다."));
        };
        const fail = () => reject(new Error("지도 SDK를 불러오지 못했습니다."));

        const existing = document.getElementById(NAVER_MAPS_SCRIPT_ID);
        if (existing) {
            existing.addEventListener("load", finish, { once: true });
            existing.addEventListener("error", fail, { once: true });
            if (window.naver?.maps) finish();
            return;
        }

        const script = document.createElement("script");
        script.id = NAVER_MAPS_SCRIPT_ID;
        script.type = "text/javascript";
        script.src = NAVER_MAPS_SDK_SRC;
        script.async = true;
        script.defer = true;
        script.addEventListener("load", finish, { once: true });
        script.addEventListener("error", fail, { once: true });
        document.head.appendChild(script);
    }).catch((error) => {
        naverMapsPromise = null;
        throw error;
    });

    return naverMapsPromise;
};

export const useNaverMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;
        loadNaverMapsSdk()
            .then(() => {
                if (mounted) setIsLoaded(true);
            })
            .catch(() => {
                if (mounted) setError(true);
            });
        return () => {
            mounted = false;
        };
    }, []);

    return { isLoaded, error };
};
