const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export const normalizeProfileImageUrl = (value) => {
    if (!value || typeof value !== "string") return "";

    const raw = value.trim();
    if (!raw) return "";

    if (raw.startsWith("/api/image/view")) {
        return raw;
    }

    if (ABSOLUTE_URL_PATTERN.test(raw)) {
        try {
            const parsed = new URL(raw);
            const path = (parsed.pathname || "").replace(/^\/+/, "");
            if (!path) return raw;

            const firstSlash = path.indexOf("/");
            const objectKey = firstSlash >= 0 ? path.slice(firstSlash + 1) : path;
            if (!objectKey) return raw;

            return `/api/image/view?path=${encodeURIComponent(objectKey)}`;
        } catch (_error) {
            return raw;
        }
    }

    return raw;
};

