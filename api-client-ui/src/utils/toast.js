export const loadToast = () => import("react-hot-toast").then((module) => module.default);

const DEFAULT_TOAST_ID = "app-action-toast";
const DEFAULT_LOADING_TOAST_ID = "app-loading-toast";
const DEFAULT_TOAST_DURATION_MS = 3200;
const ERROR_TOAST_DURATION_MS = 4200;
const LOADING_TOAST_MAX_DURATION_MS = 20000;
const TOAST_REMOVE_DELAY_MS = 600;
const cleanupTimers = new Map();

const TOAST_MESSAGE_TRANSLATIONS = new Map([
    ["Game started.", "게임을 시작했습니다."],
    ["Game returned to the lobby.", "게임이 대기방으로 돌아왔습니다."],
    ["Game finished.", "게임이 종료되었습니다."],
    ["Game ended.", "게임이 종료되었습니다."],
    ["Action applied.", "행동이 반영되었습니다."],
    ["Room created.", "방을 만들었습니다."],
    ["Room joined.", "방에 입장했습니다."],
    ["Room left.", "방에서 나갔습니다."],
    ["Room reopened.", "방이 다시 열렸습니다."],
    ["Room code copied.", "방 코드를 복사했습니다."],
    ["Player joined.", "플레이어가 입장했습니다."],
    ["Player left.", "플레이어가 퇴장했습니다."],
    ["Ready state changed.", "준비 상태를 변경했습니다."],
    ["Room settings updated.", "방 설정을 저장했습니다."],
    ["Poker game finished.", "포커 게임이 종료되었습니다."],
    ["Poker action applied.", "포커 행동이 반영되었습니다."],
    ["Citadels game finished.", "시타델 게임이 종료되었습니다."],
    ["Citadels action applied.", "시타델 행동이 반영되었습니다."],
    ["6 nimmt! game finished.", "6 nimmt! 게임이 종료되었습니다."],
    ["6 nimmt! action applied.", "6 nimmt! 행동이 반영되었습니다."],
    ["Invalid action.", "지금은 실행할 수 없는 행동입니다."],
    ["Not your turn.", "내 차례가 아닙니다."],
    ["Already ready.", "이미 준비 상태입니다."],
    ["Game already started.", "이미 시작된 게임입니다."],
    ["Room is full.", "방 정원이 가득 찼습니다."],
    ["Room not found.", "방을 찾을 수 없습니다."],
    ["Player not found.", "플레이어 정보를 찾을 수 없습니다."],
    ["Cannot join room.", "이 방에 입장할 수 없습니다."],
    ["You are not in this room.", "이 방의 참가자가 아닙니다."],
    ["Only host can start game.", "방장만 게임을 시작할 수 있습니다."],
    ["Only host can change settings.", "방장만 설정을 변경할 수 있습니다."],
    ["Not enough players.", "시작 인원이 부족합니다."],
    ["Not all players are ready.", "모든 참가자가 준비해야 합니다."],
    ["Invalid room code.", "방 코드가 올바르지 않습니다."],
    ["No available seats.", "빈 좌석이 없습니다."],
]);

const TOAST_GAME_NAME_TRANSLATIONS = new Map([
    ["Catan", "카탄"],
    ["Blokus", "블로커스"],
    ["Citadels", "시타델"],
    ["6 nimmt!", "6 nimmt!"],
    ["Telestrations", "텔레스트레이션"],
    ["Poker", "포커"],
    ["Mafia", "마피아"],
    ["Mahe", "마헤"],
    ["Dalmuti", "달무티"],
    ["Las Vegas", "라스베가스"],
    ["No Thanks", "노땡스"],
    ["Good ETC", "비디오게임"],
]);

const translateToastGameName = (gameName) => {
    const normalized = String(gameName || "").trim();
    return TOAST_GAME_NAME_TRANSLATIONS.get(normalized) || normalized;
};

const TOAST_MESSAGE_PATTERNS = [
    [/^(.+?) game finished\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 게임이 종료되었습니다.`],
    [/^(.+?) game ended\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 게임이 종료되었습니다.`],
    [/^(.+?) action applied\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 행동이 반영되었습니다.`],
    [/^(.+?) room created\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 방을 만들었습니다.`],
    [/^(.+?) room joined\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 방에 입장했습니다.`],
    [/^(.+?) room left\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 방에서 나갔습니다.`],
    [/^(.+?) room settings updated\.$/i, ([, gameName]) => `${translateToastGameName(gameName)} 방 설정을 저장했습니다.`],
];

const normalizeToastMessage = (message) => {
    const text = String(message ?? "").trim();
    if (!text) return "";
    const exact = TOAST_MESSAGE_TRANSLATIONS.get(text);
    if (exact) return exact;
    for (const [pattern, buildMessage] of TOAST_MESSAGE_PATTERNS) {
        const match = text.match(pattern);
        if (match) return buildMessage(match);
    }
    return text;
};

const singleToastOptions = (options) => ({
    ...(options || {}),
    id: options?.id || DEFAULT_TOAST_ID,
    duration: options?.duration ?? DEFAULT_TOAST_DURATION_MS,
    removeDelay: options?.removeDelay ?? TOAST_REMOVE_DELAY_MS,
});

const clearCleanupTimer = (id) => {
    const entry = cleanupTimers.get(id);
    if (!entry) return;
    if (entry.dismissTimer) globalThis.clearTimeout?.(entry.dismissTimer);
    if (entry.removeTimer) globalThis.clearTimeout?.(entry.removeTimer);
    cleanupTimers.delete(id);
};

const scheduleToastCleanup = (toast, id, duration, removeDelay = TOAST_REMOVE_DELAY_MS) => {
    if (!id || !Number.isFinite(duration) || duration === Infinity) return;
    clearCleanupTimer(id);
    const delay = Math.max(0, duration);
    const safeRemoveDelay = Math.max(0, removeDelay);
    if (typeof globalThis.setTimeout !== "function") {
        toast.dismiss(id);
        toast.remove?.(id);
        return;
    }
    const entry = { dismissTimer: null, removeTimer: null };
    entry.dismissTimer = globalThis.setTimeout?.(() => {
        const current = cleanupTimers.get(id);
        if (current !== entry) return;
        toast.dismiss(id);
        entry.removeTimer = globalThis.setTimeout?.(() => {
            if (cleanupTimers.get(id) !== entry) return;
            toast.remove?.(id);
            cleanupTimers.delete(id);
        }, safeRemoveDelay);
    }, delay);
    cleanupTimers.set(id, entry);
};

const dismissAndRemoveToast = (toast, id, removeDelay = TOAST_REMOVE_DELAY_MS) => {
    if (!id) return;
    clearCleanupTimer(id);
    toast.dismiss(id);
    const safeRemoveDelay = Math.max(0, removeDelay);
    if (typeof globalThis.setTimeout !== "function") {
        toast.remove?.(id);
        return;
    }
    const entry = { dismissTimer: null, removeTimer: null };
    entry.removeTimer = globalThis.setTimeout?.(() => {
        if (cleanupTimers.get(id) !== entry) return;
        toast.remove?.(id);
        cleanupTimers.delete(id);
    }, safeRemoveDelay);
    cleanupTimers.set(id, entry);
};

const dispatchToast = (handler) => {
    loadToast()
        .then(handler)
        .catch(() => {});
};

const showManagedToast = (rawMessage, suppliedOptions, emitter) => {
    const message = normalizeToastMessage(rawMessage);
    dispatchToast((toast) => {
        const options = singleToastOptions(suppliedOptions);
        const id = emitter(toast, message, options);
        scheduleToastCleanup(toast, id, options.duration, options.removeDelay);
    });
};

export const notifySuccess = (rawMessage, options) => {
    showManagedToast(rawMessage, options, (toast, message, toastOptions) => toast.success(message, toastOptions));
};

export const notifyError = (rawMessage, suppliedOptions) => {
    const options = { duration: ERROR_TOAST_DURATION_MS, ...(suppliedOptions || {}) };
    showManagedToast(rawMessage, options, (toast, message, toastOptions) => toast.error(message, toastOptions));
};

export const notifyLoading = async (message, options) => {
    try {
        const toast = await loadToast();
        const loadingDuration = options?.duration ?? LOADING_TOAST_MAX_DURATION_MS;
        const removeDelay = options?.removeDelay ?? TOAST_REMOVE_DELAY_MS;
        const id = toast.loading(normalizeToastMessage(message), {
            ...(options || {}),
            id: options?.id || DEFAULT_LOADING_TOAST_ID,
            duration: loadingDuration,
            removeDelay,
        });
        scheduleToastCleanup(toast, id, loadingDuration, removeDelay);
        const dismiss = () => {
            dismissAndRemoveToast(toast, id, removeDelay);
        };
        return {
            id,
            dismiss,
            success: (nextMessage, nextOptions) => {
                clearCleanupTimer(id);
                const duration = nextOptions?.duration ?? DEFAULT_TOAST_DURATION_MS;
                const nextRemoveDelay = nextOptions?.removeDelay ?? removeDelay;
                toast.success(normalizeToastMessage(nextMessage), {
                    ...(nextOptions || {}),
                    id,
                    duration,
                    removeDelay: nextRemoveDelay,
                });
                scheduleToastCleanup(toast, id, duration, nextRemoveDelay);
            },
            error: (nextMessage, nextOptions) => {
                clearCleanupTimer(id);
                const duration = nextOptions?.duration ?? ERROR_TOAST_DURATION_MS;
                const nextRemoveDelay = nextOptions?.removeDelay ?? removeDelay;
                toast.error(normalizeToastMessage(nextMessage), {
                    ...(nextOptions || {}),
                    id,
                    duration,
                    removeDelay: nextRemoveDelay,
                });
                scheduleToastCleanup(toast, id, duration, nextRemoveDelay);
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
    showManagedToast(rawMessage, options, (toast, message, toastOptions) => toast(message, toastOptions));
};

export const __toastRuntimeTest = {
    cleanupTimers,
    dismissAndRemoveToast,
    normalizeToastMessage,
    scheduleToastCleanup,
};
