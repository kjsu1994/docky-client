export const DAUM_POSTCODE_SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
export const DAUM_POSTCODE_LOAD_TIMEOUT_MS = 8000;

let daumPostcodeLoadPromise = null;

export const loadDaumPostcodeScript = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return Promise.reject(new Error("주소 검색은 브라우저 환경에서만 사용할 수 있습니다."));
    }

    if (window.daum?.Postcode) {
        return Promise.resolve(window.daum.Postcode);
    }

    if (daumPostcodeLoadPromise) {
        return daumPostcodeLoadPromise;
    }

    daumPostcodeLoadPromise = new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = null;
        let script = document.querySelector('script[data-daum-postcode="true"]');

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            script?.removeEventListener("load", onLoad);
            script?.removeEventListener("error", onError);
        };

        const settle = (callback, value) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (callback === reject) {
                daumPostcodeLoadPromise = null;
            }
            callback(value);
        };

        const onLoad = () => {
            if (window.daum?.Postcode) {
                settle(resolve, window.daum.Postcode);
                return;
            }
            settle(reject, new Error("주소 검색 스크립트가 초기화되지 않았습니다."));
        };

        const onError = () => {
            settle(reject, new Error("주소 검색 스크립트를 불러오지 못했습니다."));
        };

        if (!script) {
            script = document.createElement("script");
            script.src = DAUM_POSTCODE_SCRIPT_URL;
            script.async = true;
            script.dataset.daumPostcode = "true";
            document.head.appendChild(script);
        }

        script.addEventListener("load", onLoad, { once: true });
        script.addEventListener("error", onError, { once: true });
        timeoutId = setTimeout(() => {
            settle(reject, new Error("주소 검색 스크립트 로딩 시간이 초과되었습니다."));
        }, DAUM_POSTCODE_LOAD_TIMEOUT_MS);
    });

    return daumPostcodeLoadPromise;
};
