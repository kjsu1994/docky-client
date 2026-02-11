import http from "./http";

export async function createMember(payload) {
    const res = await http.post("/members", payload);
    return res.data;
}

export async function loginMember(payload) {
    const res = await http.post("/members/login", payload);

    // body = 회원정보 DTO
    const body = res.data;

    // Authorization 헤더에서 accessToken 파싱
    const authHeader = res.headers?.authorization || res.headers?.Authorization;
    const accessToken =
        typeof authHeader === "string"
            ? authHeader.replace(/^Bearer\s+/i, "")
            : null;

    // Refresh 헤더에서 refreshToken 파싱 (서버가 Refresh 헤더로 보내는 경우)
    const refreshHeader = res.headers?.refresh || res.headers?.Refresh;
    const refreshToken =
        typeof refreshHeader === "string"
            ? refreshHeader.replace(/^Bearer\s+/i, "")
            : null;

    // member_id 추출 (snake_case 대응)
    const memberId = body?.member_id ?? body?.memberId ?? null;

    return {
        member: body,
        memberId,
        accessToken,
        refreshToken,
        rawAuthHeader: authHeader || null,
    };
}
