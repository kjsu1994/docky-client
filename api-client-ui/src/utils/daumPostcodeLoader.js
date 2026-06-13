export const DAUM_POSTCODE_SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
export const DAUM_POSTCODE_LOAD_TIMEOUT_MS = 8000;

let daumPostcodeLoadPromise = null;
let activePostcodeLayerClose = null;

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
            script?.remove();
            settle(reject, new Error("주소 검색 스크립트를 불러오지 못했습니다."));
        };

        if (!script) {
            script = document.createElement("script");
            script.src = DAUM_POSTCODE_SCRIPT_URL;
            script.async = true;
            script.dataset.daumPostcode = "true";
        }

        script.addEventListener("load", onLoad, { once: true });
        script.addEventListener("error", onError, { once: true });
        if (!script.parentNode) {
            document.head.appendChild(script);
        }
        timeoutId = setTimeout(() => {
            script?.remove();
            settle(reject, new Error("주소 검색 스크립트 로딩 시간이 초과되었습니다."));
        }, DAUM_POSTCODE_LOAD_TIMEOUT_MS);
    });

    return daumPostcodeLoadPromise;
};

export const openDaumPostcodeLayer = async ({ oncomplete, onclose } = {}) => {
    const Postcode = await loadDaumPostcodeScript();

    activePostcodeLayerClose?.();

    const previouslyFocused = typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overlay = document.createElement("div");
    const panel = document.createElement("div");
    const closeButton = document.createElement("button");
    const container = document.createElement("div");

    overlay.dataset.daumPostcodeLayer = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "주소 검색");
    overlay.style.cssText = [
        "position: fixed",
        "inset: 0",
        "z-index: 10000",
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "padding: 12px",
        "background: rgb(15 23 42 / 0.58)",
    ].join(";");

    panel.style.cssText = [
        "position: relative",
        "width: min(520px, 100%)",
        "height: min(640px, calc(100vh - 32px))",
        "overflow: hidden",
        "border-radius: 16px",
        "border: 1px solid rgb(var(--color-border))",
        "background: rgb(var(--color-surface))",
        "box-shadow: 0 24px 80px rgb(var(--color-shadow) / 0.24)",
    ].join(";");

    closeButton.type = "button";
    closeButton.textContent = "닫기";
    closeButton.style.cssText = [
        "position: absolute",
        "right: 12px",
        "top: 10px",
        "z-index: 1",
        "border: 0",
        "border-radius: 10px",
        "padding: 8px 12px",
        "background: rgb(var(--color-text))",
        "color: rgb(var(--color-text-inverse))",
        "font-size: 12px",
        "font-weight: 900",
        "cursor: pointer",
    ].join(";");

    container.style.cssText = [
        "width: 100%",
        "height: 100%",
        "box-sizing: border-box",
        "padding-top: 44px",
        "background: #fff",
    ].join(";");

    let closed = false;
    const cleanup = () => {
        overlay.removeEventListener("click", onOverlayClick);
        closeButton.removeEventListener("click", close);
        document.removeEventListener("keydown", onKeyDown);
    };
    const close = ({ restoreFocus = true } = {}) => {
        if (closed) return;
        closed = true;
        cleanup();
        overlay.remove();
        if (activePostcodeLayerClose === close) {
            activePostcodeLayerClose = null;
        }
        onclose?.();
        if (restoreFocus) {
            previouslyFocused?.focus?.({ preventScroll: true });
        }
    };
    function onOverlayClick(event) {
        if (event.target === overlay) {
            close();
        }
    }
    function onKeyDown(event) {
        if (event.key === "Escape") {
            close();
        }
    }

    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeyDown);

    panel.appendChild(closeButton);
    panel.appendChild(container);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    activePostcodeLayerClose = close;

    try {
        new Postcode({
            oncomplete: (data) => {
                close({ restoreFocus: false });
                oncomplete?.(data);
            },
            width: "100%",
            height: "100%",
        }).embed(container);
    } catch (error) {
        close();
        throw error;
    }

    closeButton.focus({ preventScroll: true });
    return close;
};
