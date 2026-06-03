const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const PROFILE_OBJECT_KEY_MAX_LENGTH = 512;
const INTERNAL_STORAGE_HOST_PATTERN = /^(localhost|127\.0\.0\.1|minio|host\.docker\.internal)$/i;
const PROFILE_IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp|bmp)$/i;
const PROFILE_PUBLIC_HOSTS = new Set(["ctfmon.shop", "www.ctfmon.shop"]);

const isValidProfileObjectKey = (objectKey) => {
    const normalized = String(objectKey || "").trim();
    return Boolean(normalized) &&
        normalized.length <= PROFILE_OBJECT_KEY_MAX_LENGTH &&
        normalized.startsWith("profile/") &&
        !normalized.startsWith("/") &&
        !normalized.includes("..") &&
        !normalized.includes("\\") &&
        !normalized.includes("?") &&
        !normalized.includes("#") &&
        !/\s/.test(normalized) &&
        PROFILE_IMAGE_EXTENSION_PATTERN.test(normalized);
};

const toProfileProxyUrl = (objectKey) =>
    isValidProfileObjectKey(objectKey) ? `/api/image/view?path=${encodeURIComponent(objectKey)}` : "";

const extractStorageObjectKey = (path) => {
    const normalized = String(path || "").replace(/^\/+/, "");
    if (normalized.startsWith("upload-files/")) {
        return normalized.replace(/^upload-files\//, "");
    }
    const firstSlash = normalized.indexOf("/");
    return firstSlash >= 0 ? normalized.slice(firstSlash + 1) : normalized;
};

const isInternalStorageUrl = (url) =>
    INTERNAL_STORAGE_HOST_PATTERN.test(url.hostname) ||
    url.port === "9000";

const getCurrentOrigin = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "https://ctfmon.shop";
};

const isTrustedProfileStorageUrl = (url) =>
    isInternalStorageUrl(url) ||
    PROFILE_PUBLIC_HOSTS.has(url.hostname.toLowerCase()) ||
    url.origin === getCurrentOrigin();

export const normalizeProfileImageUrl = (value) => {
    if (!value || typeof value !== "string") return "";

    const raw = value.trim();
    if (!raw) return "";
    const compact = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
    if (
        compact.startsWith("javascript:") ||
        compact.startsWith("vbscript:") ||
        compact.startsWith("data:") ||
        raw.startsWith("//")
    ) {
        return "";
    }

    if (raw.startsWith("/api/image/view")) {
        try {
            const origin = typeof window !== "undefined" && window.location?.origin
                ? window.location.origin
                : "https://ctfmon.shop";
            const parsed = new URL(raw, origin);
            return toProfileProxyUrl(parsed.searchParams.get("path"));
        } catch {
            return "";
        }
    }

    if (raw.startsWith("/upload-files/")) {
        return toProfileProxyUrl(raw.replace(/^\/upload-files\//, ""));
    }

    if (raw.startsWith("/") && !raw.startsWith("//")) {
        return raw;
    }

    if (ABSOLUTE_URL_PATTERN.test(raw)) {
        try {
            const parsed = new URL(raw);
            if (!["http:", "https:"].includes(parsed.protocol)) return "";
            if (parsed.pathname === "/api/image/view") {
                return isTrustedProfileStorageUrl(parsed)
                    ? toProfileProxyUrl(parsed.searchParams.get("path"))
                    : raw;
            }
            if (!isTrustedProfileStorageUrl(parsed)) return raw;
            return toProfileProxyUrl(extractStorageObjectKey(parsed.pathname));
        } catch (_error) {
            return raw;
        }
    }

    return toProfileProxyUrl(raw);
};
