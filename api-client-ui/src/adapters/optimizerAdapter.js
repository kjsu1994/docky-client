import api, { getApiErrorMessage } from "../utils/api.js";

export const OPTIMIZER_MAX_PARTICIPANTS = 8;
export const OPTIMIZER_ADDRESS_MAX_LENGTH = 120;

const unwrapOptimizerData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

export const normalizeOptimizerAddress = (value) => String(value || "").trim().replace(/\s+/g, " ");

export const normalizeOptimizerAddresses = (addresses = []) => {
    const dedup = new Map();
    for (const value of Array.isArray(addresses) ? addresses : []) {
        const normalized = normalizeOptimizerAddress(value);
        if (!normalized) continue;
        if (normalized.length > OPTIMIZER_ADDRESS_MAX_LENGTH) {
            throw new Error("주소는 120자 이하로 입력해 주세요.");
        }
        dedup.set(normalized.toLowerCase(), normalized);
    }
    const result = Array.from(dedup.values());
    if (result.length > OPTIMIZER_MAX_PARTICIPANTS) {
        throw new Error("주소는 최대 8개까지 입력할 수 있습니다.");
    }
    return result;
};

const toNumberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const roundMinutes = (value) => {
    const parsed = toNumberOrNull(value);
    return parsed === null ? value : Math.round(parsed);
};

const normalizeCandidate = (candidate = {}, index = 0) => ({
    ...candidate,
    name: candidate.name || `후보 ${index + 1}`,
    address: candidate.address || "주소 정보 없음",
    latitude: toNumberOrNull(candidate.latitude),
    longitude: toNumberOrNull(candidate.longitude),
});

const normalizeUserResult = (user = {}, index = 0) => ({
    ...user,
    name: user.name || `참여자 ${index + 1}`,
    travel_time: roundMinutes(user.travel_time ?? user.travelTime),
    summary: user.summary || "",
});

export const normalizeOptimizationResult = (response) => {
    const data = unwrapOptimizerData(response);
    const candidates = Array.isArray(data?.candidates) ? data.candidates.map(normalizeCandidate) : [];
    const userResults = Array.isArray(data?.user_results ?? data?.userResults)
        ? (data.user_results ?? data.userResults).map(normalizeUserResult)
        : [];

    return {
        ...data,
        candidates,
        avg_travel_time: roundMinutes(data?.avg_travel_time ?? data?.avgTravelTime),
        travel_time_std_dev: roundMinutes(data?.travel_time_std_dev ?? data?.travelTimeStdDev),
        recommended_reason: data?.recommended_reason ?? data?.recommendedReason ?? "",
        user_results: userResults,
    };
};

export const extractOptimizerErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const optimizerAdapter = {
    async optimizeMeetingPoint(addresses) {
        const response = await api.post("/optimizer/optimize", normalizeOptimizerAddresses(addresses));
        return normalizeOptimizationResult(response);
    },
};
