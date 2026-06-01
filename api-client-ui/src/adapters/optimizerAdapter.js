import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapOptimizerData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

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
        const response = await api.post("/optimizer/optimize", addresses);
        return normalizeOptimizationResult(response);
    },
};
