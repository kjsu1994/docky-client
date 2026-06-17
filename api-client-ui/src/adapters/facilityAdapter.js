import api, { getApiErrorMessage } from "../utils/api.js";

export const FACILITY_KEYWORD_MAX_LENGTH = 60;

const unwrapFacilityData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

const normalizeSearchResponse = (response) => {
    const data = unwrapFacilityData(response);
    const items = Array.isArray(data?.items) ? data.items : [];
    return {
        totalCount: Number(data?.total_count ?? data?.totalCount ?? items.length) || 0,
        items,
    };
};

const clampNumber = (value, fallback, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
};

const clampInteger = (value, fallback, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(numeric)));
};

const lotSearchParams = ({ latitude, longitude, radiusKm, limit }) => ({
    latitude,
    longitude,
    radius_km: clampNumber(radiusKm, 3, 0, 30),
    limit: clampInteger(limit, 50, 1, 200),
});

export const normalizeFacilityKeyword = (value) => {
    const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
    return normalized ? normalized.slice(0, FACILITY_KEYWORD_MAX_LENGTH) : "";
};

export const normalizeImportResult = (response) => {
    const data = unwrapFacilityData(response);
    return {
        ...data,
        importedCount: Number(data?.imported_count ?? data?.importedCount ?? 0) || 0,
        geocodeJobStarted: Boolean(data?.geocode_job_started ?? data?.geocodeJobStarted),
        estimatedTargetCount: Number(data?.estimated_target_count ?? data?.estimatedTargetCount ?? 0) || 0,
        importedEquipmentRowCount: Number(data?.imported_equipment_row_count ?? data?.importedEquipmentRowCount ?? 0) || 0,
        geocodeApiCallCount: Number(data?.geocode_api_call_count ?? data?.geocodeApiCallCount ?? 0) || 0,
        geocodedAddressCount: Number(data?.geocoded_address_count ?? data?.geocodedAddressCount ?? 0) || 0,
    };
};

export const normalizeMedicalImportStatus = (response) => {
    const data = unwrapFacilityData(response);
    return {
        ...data,
        status: data?.status ?? "IDLE",
        message: data?.message ?? "",
        importedCount: Number(data?.imported_count ?? data?.importedCount ?? 0) || 0,
        importedEquipmentRowCount: Number(data?.imported_equipment_row_count ?? data?.importedEquipmentRowCount ?? 0) || 0,
    };
};

export const extractFacilityErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

const csvParams = (csvPath) => ({
    params: {
        csvPath: csvPath?.trim() || undefined,
    },
});

const csvFileFormData = (file, extraFiles = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(extraFiles).forEach(([key, value]) => {
        if (value) {
            formData.append(key, value);
        }
    });
    return formData;
};

const importCsvFile = async (endpoint, file, extraFiles = {}) => {
    const response = await api.post(endpoint, csvFileFormData(file, extraFiles), {
        timeout: 0,
    });
    return response;
};

export const facilityAdapter = {
    async fetchParkingLots({ latitude, longitude, radiusKm, limit, paidOnly = false, keyword = "", sort = "distance" }) {
        const response = await api.get("/parking/lots", {
            params: {
                ...lotSearchParams({ latitude, longitude, radiusKm, limit }),
                paid_only: paidOnly,
                keyword: normalizeFacilityKeyword(keyword) || undefined,
                sort,
            },
        });
        return normalizeSearchResponse(response);
    },

    async importParkingLots(csvPath) {
        const response = await api.post("/admin/parking/import", null, csvParams(csvPath));
        return normalizeImportResult(response);
    },

    async importParkingLotsFile(file) {
        const response = await importCsvFile("/admin/parking/import-file", file);
        return normalizeImportResult(response);
    },

    async fetchRestroomLots({ latitude, longitude, radiusKm, openType = "all", sort = "distance", limit, keyword = "" }) {
        const response = await api.get("/restrooms/lots", {
            params: {
                ...lotSearchParams({ latitude, longitude, radiusKm, limit }),
                open_type: openType,
                keyword: normalizeFacilityKeyword(keyword) || undefined,
                sort,
            },
        });
        return normalizeSearchResponse(response);
    },

    async importRestroomLots(csvPath) {
        const response = await api.post("/admin/restroom/import", null, csvParams(csvPath));
        return normalizeImportResult(response);
    },

    async importRestroomLotsFile(file) {
        const response = await importCsvFile("/admin/restroom/import-file", file);
        return normalizeImportResult(response);
    },

    async fetchLibraryLots({ latitude, longitude, radiusKm, limit }) {
        const response = await api.get("/libraries/lots", {
            params: lotSearchParams({ latitude, longitude, radiusKm, limit }),
        });
        return normalizeSearchResponse(response);
    },

    async importLibraryLots(csvPath) {
        const response = await api.post("/admin/library/import", null, csvParams(csvPath));
        return normalizeImportResult(response);
    },

    async importLibraryLotsFile(file) {
        const response = await importCsvFile("/admin/library/import-file", file);
        return normalizeImportResult(response);
    },

    async fetchBunkerLots({ latitude, longitude, radiusKm, limit }) {
        const response = await api.get("/bunkers/lots", {
            params: lotSearchParams({ latitude, longitude, radiusKm, limit }),
        });
        return normalizeSearchResponse(response);
    },

    async importBunkerLots(csvPath) {
        const response = await api.post("/admin/bunker/import", null, csvParams(csvPath));
        return normalizeImportResult(response);
    },

    async importBunkerLotsFile(file) {
        const response = await importCsvFile("/admin/bunker/import-file", file);
        return normalizeImportResult(response);
    },

    async fetchMedicalLots({ latitude, longitude, radiusKm, limit }) {
        const response = await api.get("/medical/lots", {
            params: lotSearchParams({ latitude, longitude, radiusKm, limit }),
        });
        return normalizeSearchResponse(response);
    },

    async fetchMedicalLotDetail(medicalLotId) {
        const response = await api.get(`/medical/lots/${medicalLotId}`);
        return unwrapFacilityData(response);
    },

    async importMedicalLots(csvPath) {
        const response = await api.post("/admin/medical/import", null, csvParams(csvPath));
        return normalizeMedicalImportStatus(response);
    },

    async importMedicalLotsFile({ file, locationFile } = {}) {
        const response = await importCsvFile("/admin/medical/import-file", file, { locationFile });
        return normalizeMedicalImportStatus(response);
    },

    async fetchMedicalImportStatus() {
        const response = await api.get("/admin/medical/import/status");
        return normalizeMedicalImportStatus(response);
    },
};
