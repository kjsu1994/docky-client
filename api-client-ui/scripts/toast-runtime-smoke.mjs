import { __toastRuntimeTest } from "../src/utils/toast.js";

const {
    cleanupTimers,
    dismissAndRemoveToast,
    normalizeToastMessage,
    scheduleToastCleanup,
} = __toastRuntimeTest;

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(`toast-runtime-smoke: ${message}`);
    }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createFakeToast = () => {
    const calls = [];
    return {
        calls,
        toast: {
            dismiss: (id) => calls.push(`dismiss:${id}`),
            remove: (id) => calls.push(`remove:${id}`),
        },
    };
};

assert(normalizeToastMessage("Game started.") === "게임을 시작했습니다.", "game-start message must be Korean");
assert(normalizeToastMessage("Player joined.") === "플레이어가 입장했습니다.", "player-join message must be Korean");
assert(normalizeToastMessage("Room created.") === "방을 만들었습니다.", "room-created message must be Korean");
assert(normalizeToastMessage("Action applied.") === "행동이 반영되었습니다.", "generic action message must be Korean");
assert(normalizeToastMessage("Blokus action applied.") === "블로커스 행동이 반영되었습니다.", "pattern game-action message must be Korean");
assert(normalizeToastMessage("Las Vegas game finished.") === "라스베가스 게임이 종료되었습니다.", "pattern game-finished message must be Korean");
assert(normalizeToastMessage("No Thanks room settings updated.") === "노땡스 방 설정을 저장했습니다.", "pattern room-settings message must be Korean");
assert(normalizeToastMessage("Not your turn.") === "내 차례가 아닙니다.", "common action error must be Korean");
assert(normalizeToastMessage("Room is full.") === "방 정원이 가득 찼습니다.", "common room error must be Korean");
assert(normalizeToastMessage("사용자 메시지") === "사용자 메시지", "already-Korean messages must pass through");

{
    const fake = createFakeToast();
    scheduleToastCleanup(fake.toast, "runtime-toast", 12, 8);
    await delay(50);
    assert(fake.calls.join("|") === "dismiss:runtime-toast|remove:runtime-toast", "scheduled toast must dismiss then remove");
    assert(!cleanupTimers.has("runtime-toast"), "scheduled toast timer entry must be cleared after remove");
}

{
    const fake = createFakeToast();
    scheduleToastCleanup(fake.toast, "replace-toast", 40, 20);
    await delay(5);
    scheduleToastCleanup(fake.toast, "replace-toast", 10, 5);
    await delay(45);
    assert(fake.calls.join("|") === "dismiss:replace-toast|remove:replace-toast", "rescheduled toast must not keep the old timer alive");
    assert(!cleanupTimers.has("replace-toast"), "rescheduled toast timer entry must be cleared");
}

{
    const fake = createFakeToast();
    dismissAndRemoveToast(fake.toast, "manual-toast", 5);
    await delay(30);
    assert(fake.calls.join("|") === "dismiss:manual-toast|remove:manual-toast", "manual dismiss must remove the toast after removeDelay");
    assert(!cleanupTimers.has("manual-toast"), "manual dismiss timer entry must be cleared");
}

{
    const fake = createFakeToast();
    scheduleToastCleanup(fake.toast, "infinite-toast", Infinity, 5);
    await delay(20);
    assert(fake.calls.length === 0, "infinite toast duration must not schedule cleanup");
    assert(!cleanupTimers.has("infinite-toast"), "infinite toast must not leave cleanup timer state");
}

console.log("toast-runtime-smoke ok (managed toast cleanup and Korean mapping)");
