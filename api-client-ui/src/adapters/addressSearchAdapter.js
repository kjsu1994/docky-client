import api, { getApiErrorMessage } from "../utils/api.js";
import { loadNaverMapsSdk } from "../utils/naverMapsLoader.js";

export const ADDRESS_QUERY_MAX_LENGTH = 120;

const unwrapAddressData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

const normalizeCoordinate = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeAddressItem = (item = {}) => {
    const roadAddress = item.road_address ?? item.roadAddress ?? null;
    const jibunAddress = item.jibun_address ?? item.jibunAddress ?? null;
    const address = item.address ?? roadAddress ?? jibunAddress ?? "";

    return {
        address,
        roadAddress,
        jibunAddress,
        latitude: normalizeCoordinate(item.latitude),
        longitude: normalizeCoordinate(item.longitude),
    };
};

export const normalizeAddressSuggestResponse = (response) => {
    const data = unwrapAddressData(response);
    const items = Array.isArray(data?.items) ? data.items.map(normalizeAddressItem) : [];

    return {
        totalCount: Number(data?.total_count ?? data?.totalCount ?? items.length) || 0,
        items,
    };
};

export const normalizeGeocodeResponse = (response) => normalizeAddressItem(unwrapAddressData(response));

export const extractAddressSearchErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const normalizeAddressQuery = (value) => String(value || "").trim().slice(0, ADDRESS_QUERY_MAX_LENGTH);

const shouldTryNaverSdkFallback = (error) => {
    const status = Number(error?.response?.status || 0);
    return status === 0 || status === 404 || status >= 500;
};

const normalizeNaverSdkGeocodeItem = (item = {}, originalAddress) => normalizeAddressItem({
    address: item.roadAddress || item.jibunAddress || originalAddress,
    roadAddress: item.roadAddress,
    jibunAddress: item.jibunAddress,
    latitude: item.y,
    longitude: item.x,
});

const geocodeWithNaverSdk = async (normalizedAddress) => {
    const maps = await loadNaverMapsSdk();
    const service = maps?.Service;

    if (typeof service?.geocode !== "function") {
        throw new Error("Naver geocoder is unavailable");
    }

    return new Promise((resolve, reject) => {
        service.geocode({ query: normalizedAddress }, (status, response) => {
            const okStatus = service.Status?.OK;
            if (okStatus !== undefined && status !== okStatus) {
                reject(new Error("Naver geocoder failed"));
                return;
            }

            const firstItem = response?.v2?.addresses?.[0];
            if (!firstItem) {
                reject(new Error("Naver geocoder returned no result"));
                return;
            }

            const normalized = normalizeNaverSdkGeocodeItem(firstItem, normalizedAddress);
            if (!Number.isFinite(normalized.latitude) || !Number.isFinite(normalized.longitude)) {
                reject(new Error("Naver geocoder returned invalid coordinates"));
                return;
            }
            resolve(normalized);
        });
    });
};

const geocodeAddressViaApi = async (normalizedAddress) => {
    const response = await api.get("/addresses/geocode", {
        params: { address: normalizedAddress },
    });
    return normalizeGeocodeResponse(response);
};

export const addressSearchAdapter = {
    async suggestAddresses({ query, limit = 5 }) {
        const normalizedQuery = normalizeAddressQuery(query);
        const response = await api.get("/addresses/suggest", {
            params: { query: normalizedQuery, limit },
        });
        return normalizeAddressSuggestResponse(response);
    },

    async geocodeAddress(address) {
        const normalizedAddress = normalizeAddressQuery(address);
        try {
            return await geocodeAddressViaApi(normalizedAddress);
        } catch (error) {
            if (!shouldTryNaverSdkFallback(error)) {
                throw error;
            }
            try {
                return await geocodeWithNaverSdk(normalizedAddress);
            } catch {
                throw error;
            }
        }
    },
};
