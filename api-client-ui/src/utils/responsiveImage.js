const PUBLIC_IMAGE_PROXY_PATH = "/api/image/view";
const PUBLIC_IMAGE_VARIANT_PATH = "/api/image/variant";
const PUBLIC_IMAGE_HOSTS = new Set(["docky.co.kr", "www.docky.co.kr"]);
const PUBLIC_IMAGE_PREFIXES = ["editor/", "profile/", "banners/"];
const PUBLIC_IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp|bmp)$/i;

const currentOrigin = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "https://docky.co.kr";
};

const isSafePublicImageKey = (value) => {
    const key = String(value || "").trim();
    return Boolean(key) &&
        key.length <= 512 &&
        !key.startsWith("/") &&
        !key.includes("..") &&
        !key.includes("\\") &&
        !key.includes("?") &&
        !key.includes("#") &&
        !/\s/.test(key) &&
        PUBLIC_IMAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
        PUBLIC_IMAGE_EXTENSION_PATTERN.test(key);
};

export const extractPublicImageObjectKey = (src) => {
    const raw = String(src || "").trim();
    if (!raw) return "";

    try {
        const parsed = new URL(raw, currentOrigin());
        const sameOrigin = parsed.origin === currentOrigin();
        const publicHost = PUBLIC_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
        if (!sameOrigin && !publicHost) return "";
        if (parsed.pathname !== PUBLIC_IMAGE_PROXY_PATH) return "";

        const key = parsed.searchParams.get("path");
        return isSafePublicImageKey(key) ? key : "";
    } catch {
        return "";
    }
};

export const publicImageVariantUrl = (src, width, { format = "auto" } = {}) => {
    const key = extractPublicImageObjectKey(src);
    if (!key) return "";
    const numericWidth = Number(width);
    if (!Number.isFinite(numericWidth) || numericWidth <= 0) return "";

    const params = new URLSearchParams();
    params.set("path", key);
    params.set("width", String(Math.round(numericWidth)));
    params.set("format", format || "auto");
    return `${PUBLIC_IMAGE_VARIANT_PATH}?${params.toString()}`;
};

export const publicImageSrcSet = (src, widths = [160, 320, 640]) => {
    const entries = widths
        .map((width) => {
            const url = publicImageVariantUrl(src, width);
            return url ? `${url} ${width}w` : "";
        })
        .filter(Boolean);
    return entries.join(", ");
};

export const publicImageBackgroundSet = (src, oneXWidth = 960, twoXWidth = 1600) => {
    const oneX = publicImageVariantUrl(src, oneXWidth);
    const twoX = publicImageVariantUrl(src, twoXWidth);
    if (!oneX || !twoX) {
        return src ? `url("${src}")` : "";
    }
    return `image-set(url("${oneX}") 1x, url("${twoX}") 2x)`;
};
