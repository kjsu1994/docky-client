import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

// ?醫롮? ?????
export const formatDate = (date) => {
    if (!date) return "";
    return format(new Date(date), "yyyy-MM-dd HH:mm", { locale: ko });
};

// ?怨? ??볦퍢 ??뽯뻻 (?? 3???? 2??볦퍢 ??
export const formatRelativeTime = (date) => {
    if (!date) return "";
    return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: ko,
    });
};

// 野껊슣????ル굝履???? 癰궰??
export const getBoardKindLabel = (kind) => {
    const labels = {
        FREE_BOARD: "자유게시판",
        ADMIN_NOTICE: "공지사항",
        QUESTION_ANSWER: "Q&A 게시판",
    };
    return labels[kind] || kind;
};

// 野껊슣????ル굝履???깃맒
export const getBoardKindColor = (kind) => {
    const colors = {
        FREE_BOARD: "bg-blue-100 text-blue-700",
        ADMIN_NOTICE: "bg-amber-100 text-amber-700",
        QUESTION_ANSWER: "bg-green-100 text-green-700",
    };
    return colors[kind] || "bg-slate-100 text-slate-700";
};

// ???뵬 ??由??????
export const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// ???筌왖 ???뵬 ?類ㅼ뵥
export const isImageFile = (filename) => {
    if (!filename) return false;
    const ext = filename.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
};

// ??용뮞???癒?뀮疫?(筌띾Ŋ夷??
export const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

// HTML ?얜챷???곸뱽 筌뤴뫖以?野꺜??깆뒠 ??곗뺘 ??용뮞?紐껋쨮 ?類ㅼ젫
export const stripHtmlTags = (html) => {
    if (!html) return "";
    return String(html)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
};

// ??ъ쁽 ?????(筌???μ맄 ?꾠끇彛?
const INTERNAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|minio|host\.docker\.internal)$/i;

const getAssetOrigin = () => {
    const envOrigin = import.meta.env.VITE_ASSET_ORIGIN;
    if (envOrigin && String(envOrigin).trim()) {
        return String(envOrigin).trim().replace(/\/$/, "");
    }

    if (typeof window !== "undefined" && window.location?.origin) {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
            return "http://localhost:9000";
        }
        return window.location.origin;
    }

    return "";
};

export const resolveAssetUrl = (rawUrl) => {
    if (!rawUrl) return rawUrl;
    const input = String(rawUrl).trim();
    if (!input) return input;

    const toImageProxy = (key) => `/api/image/view?path=${encodeURIComponent(key)}`;

    if (input.startsWith("/api/image/view")) {
        return input;
    }

    if (input.startsWith("/upload-files/")) {
        return toImageProxy(input.replace(/^\/upload-files\//, ""));
    }

    const assetOrigin = getAssetOrigin();
    if (!assetOrigin) return input;

    if (input.startsWith("/")) {
        return `${assetOrigin}${input}`;
    }

    try {
        const parsed = new URL(input);

        // Legacy editor/minio URLs -> backend image proxy.
        if (parsed.pathname.startsWith("/upload-files/")) {
            const objectKey = parsed.pathname.replace(/^\/upload-files\//, "");
            return toImageProxy(objectKey);
        }

        const shouldReplaceHost =
            INTERNAL_HOST_PATTERN.test(parsed.hostname) ||
            parsed.port === "9000";
        if (!shouldReplaceHost) return input;
        return `${assetOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return input;
    }
};

export const normalizeContentImageUrls = (html) => {
    if (!html) return "";
    return String(html).replace(/(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (_, prefix, src, suffix) => {
        return `${prefix}${resolveAssetUrl(src)}${suffix}`;
    });
};

export const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString("ko-KR");
};

// ?遺얠뺍??곷뮞 ??λ땾
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// 嚥≪뮇類???쎈꽅?귐? ????
export const storage = {
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error("Storage set error:", error);
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error("Storage remove error:", error);
        }
    },
};
