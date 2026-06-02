import { getApiErrorMessage } from "../src/utils/api.js";
import { extractChatErrorMessage } from "../src/adapters/chatAdapter.js";

const failures = [];

const expectEqual = (actual, expected, label) => {
    if (actual !== expected) {
        failures.push(`${label}: expected "${expected}", got "${actual}"`);
    }
};

expectEqual(
    getApiErrorMessage({ code: "ECONNABORTED", message: "timeout of 5000ms exceeded" }, "목록을 불러오지 못했습니다."),
    "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
    "timeout network message"
);

expectEqual(
    getApiErrorMessage({ request: {} }, "목록을 불러오지 못했습니다."),
    "서버와 연결하지 못했습니다. 네트워크 상태를 확인해주세요.",
    "offline network message"
);

expectEqual(
    getApiErrorMessage({
        response: {
            status: 400,
            data: {
                message: "입력값이 올바르지 않습니다.",
                fieldErrors: [
                    { field: "email", reason: "올바른 이메일 형식이 아닙니다." },
                    { field: "target_id", reason: "신고 대상 식별자가 올바르지 않습니다." },
                    { field: "unknownServerField", reason: "입력값을 확인해주세요." },
                ],
            },
        },
    }),
    "이메일: 올바른 이메일 형식이 아닙니다., 신고 대상: 신고 대상 식별자가 올바르지 않습니다., 입력값을 확인해주세요.",
    "field validation message labels"
);

expectEqual(
    getApiErrorMessage({
        response: {
            status: 400,
            data: {
                violationErrors: [
                    { propertyPath: "createRequest.reportStatus", reason: "필수 값입니다." },
                ],
            },
        },
    }),
    "신고 상태: 필수 값입니다.",
    "violation validation message labels"
);

expectEqual(
    getApiErrorMessage({
        response: {
            status: 400,
            data: {
                fieldErrors: [
                    { field: "title", reason: "must not be blank" },
                    { field: "size", reason: "must be less than or equal to 50" },
                ],
            },
        },
    }),
    "제목: 값을 입력해주세요., 목록 크기: 50 이하로 입력해주세요.",
    "english bean validation messages are normalized"
);

expectEqual(
    getApiErrorMessage({
        response: {
            status: 500,
            data: {
                message: "root_cause: java.lang.NullPointerException",
            },
        },
    }),
    "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    "technical server message fallback"
);

expectEqual(
    getApiErrorMessage({
        response: {
            status: 403,
            data: {
                message: "OAuth 재인증이 필요합니다.",
            },
        },
    }),
    "OAuth 재인증이 필요합니다.",
    "korean server message with product token"
);

expectEqual(
    extractChatErrorMessage({
        response: {
            status: 400,
            data: {
                violationErrors: [
                    { propertyPath: "messageRequest.roomId", reason: "0보다 커야 합니다." },
                ],
            },
        },
    }, "채팅 요청을 처리하지 못했습니다."),
    "채팅방: 0보다 커야 합니다.",
    "chat adapter shared validation labels"
);

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log("api-error-message-smoke ok");
