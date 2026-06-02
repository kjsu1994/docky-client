import api, { getApiErrorMessage } from "../utils/api.js";

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
        const response = await api.get("/addresses/geocode", {
            params: { address: normalizedAddress },
        });
        return normalizeGeocodeResponse(response);
    },
};
