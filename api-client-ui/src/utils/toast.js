export const loadToast = () => import("react-hot-toast").then((module) => module.default);

const DEFAULT_TOAST_ID = "app-action-toast";
const DEFAULT_LOADING_TOAST_ID = "app-loading-toast";
const DEFAULT_TOAST_DURATION_MS = 3200;
const ERROR_TOAST_DURATION_MS = 4200;
const LOADING_TOAST_MAX_DURATION_MS = 20000;
const TOAST_REMOVE_DELAY_MS = 600;

const TOAST_MESSAGE_TRANSLATIONS = new Map([
    ["Game started.", "게임이 시작되었습니다."],
    ["Game returned to the lobby.", "게임을 대기방으로 되돌렸습니다."],
    ["Player joined.", "플레이어가 입장했습니다."],
    ["Player left.", "플레이어가 퇴장했습니다."],
    ["Ready state changed.", "준비 상태를 변경했습니다."],
    ["Room settings updated.", "방 설정을 저장했습니다."],
    ["Poker game finished.", "포커 게임이 종료되었습니다."],
    ["Poker action applied.", "포커 행동을 반영했습니다."],
    ["Citadels game finished.", "시티델 게임이 종료되었습니다."],
    ["Citadels action applied.", "시티델 행동을 반영했습니다."],
    ["6 nimmt! game finished.", "6 nimmt! 게임이 종료되었습니다."],
    ["6 nimmt! action applied.", "6 nimmt! 행동을 반영했습니다."],
]);

const normalizeToastMessage = (message) => {
    const text = String(message ?? "").trim();
    if (!text) return "";
    return TOAST_MESSAGE_TRANSLATIONS.get(text) || text;
};

const singleToastOptions = (options) => ({
    ...(options || {}),
    id: options?.id || DEFAULT_TOAST_ID,
    duration: options?.duration ?? DEFAULT_TOAST_DURATION_MS,
    removeDelay: options?.removeDelay ?? TOAST_REMOVE_DELAY_MS,
});

const dispatchToast = (handler) => {
    loadToast()
        .then(handler)
        .catch(() => {});
};

export const notifySuccess = (rawMessage, options) => {
    const message = normalizeToastMessage(rawMessage);
    dispatchToast((toast) => toast.success(message, singleToastOptions(options)));
};

export const notifyError = (rawMessage, suppliedOptions) => {
    const message = normalizeToastMessage(rawMessage);
    const options = { duration: ERROR_TOAST_DURATION_MS, ...(suppliedOptions || {}) };
    dispatchToast((toast) => toast.error(message, singleToastOptions(options)));
};

export const notifyLoading = async (message, options) => {
    try {
        const toast = await loadToast();
        const loadingDuration = options?.duration ?? LOADING_TOAST_MAX_DURATION_MS;
        const id = toast.loading(normalizeToastMessage(message), {
            ...(options || {}),
            id: options?.id || DEFAULT_LOADING_TOAST_ID,
            duration: loadingDuration,
        });
        let cleanupTimer = globalThis.setTimeout?.(() => {
            toast.dismiss(id);
            globalThis.setTimeout?.(() => toast.remove?.(id), TOAST_REMOVE_DELAY_MS);
        }, loadingDuration + TOAST_REMOVE_DELAY_MS);
        const clearCleanupTimer = () => {
            if (cleanupTimer) {
                globalThis.clearTimeout?.(cleanupTimer);
                cleanupTimer = null;
            }
        };
        const scheduleRemove = (duration) => {
            globalThis.setTimeout?.(() => {
                toast.dismiss(id);
                globalThis.setTimeout?.(() => toast.remove?.(id), TOAST_REMOVE_DELAY_MS);
            }, duration + TOAST_REMOVE_DELAY_MS);
        };
        const dismiss = () => {
            clearCleanupTimer();
            toast.dismiss(id);
            globalThis.setTimeout?.(() => toast.remove?.(id), TOAST_REMOVE_DELAY_MS);
        };
        return {
            id,
            dismiss,
            success: (nextMessage, nextOptions) => {
                clearCleanupTimer();
                const duration = nextOptions?.duration ?? DEFAULT_TOAST_DURATION_MS;
                toast.success(normalizeToastMessage(nextMessage), {
                    ...(nextOptions || {}),
                    id,
                    duration,
                });
                scheduleRemove(duration);
            },
            error: (nextMessage, nextOptions) => {
                clearCleanupTimer();
                const duration = nextOptions?.duration ?? ERROR_TOAST_DURATION_MS;
                toast.error(normalizeToastMessage(nextMessage), {
                    ...(nextOptions || {}),
                    id,
                    duration,
                });
                scheduleRemove(duration);
            },
        };
    } catch {
        return {
            id: null,
            dismiss: () => {},
            success: (nextMessage, nextOptions) => notifySuccess(nextMessage, nextOptions),
            error: (nextMessage, nextOptions) => notifyError(nextMessage, nextOptions),
        };
    }
};

export const notify = (rawMessage, options) => {
    const message = normalizeToastMessage(rawMessage);
    dispatchToast((toast) => toast(message, singleToastOptions(options)));
};
