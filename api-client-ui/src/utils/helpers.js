import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { logClientError } from "./clientDiagnostics.js";

// 날짜 표시
export const formatDate = (date) => {
    if (!date) return "";
    return format(new Date(date), "yyyy-MM-dd HH:mm", { locale: ko });
};

// 상대 시간 표시 (예: 3일 전, 2시간 전)
export const formatRelativeTime = (date) => {
    if (!date) return "";
    return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: ko,
    });
};

export const normalizeChatTimestamp = (value) => {
    if (!value) return new Date().toISOString();
    if (value instanceof Date) return value.toISOString();

    const raw = String(value).trim();
    if (!raw) return new Date().toISOString();

    const spaceFormat = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/;
    if (spaceFormat.test(raw)) {
        return `${raw.replace(" ", "T")}+09:00`;
    }

    const noZoneIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    if (noZoneIso.test(raw)) {
        return `${raw}+09:00`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
};

// 게시판 종류 표시명
export const getBoardKindLabel = (kind) => {
    const labels = {
        FREE_BOARD: "사용자게시판",
        ADMIN_NOTICE: "공지사항",
        QUESTION_ANSWER: "Q&A 게시판",
    };
    return labels[kind] || kind;
};

// 게시판 종류 배지 색상
export const getBoardKindColor = (kind) => {
    const colors = {
        FREE_BOARD: "bg-blue-100 text-blue-700",
        ADMIN_NOTICE: "bg-amber-100 text-amber-700",
        QUESTION_ANSWER: "bg-green-100 text-green-700",
    };
    return colors[kind] || "bg-slate-100 text-slate-700";
};

// 파일 크기 표시
export const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// 이미지 파일 판별
export const isImageFile = (filename) => {
    if (!filename) return false;
    const ext = filename.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext);
};

// 긴 텍스트 줄임
export const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

// HTML 태그 제거
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

export const normalizeExternalUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("/") || raw.startsWith("#") || raw.startsWith("//")) return "";

    const compact = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
    if (
        compact.startsWith("javascript:") ||
        compact.startsWith("vbscript:") ||
        compact.startsWith("data:")
    ) {
        return "";
    }

    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
    const domainLike = /^[\w-]+(\.[\w-]+)+(\/|$|[?#])/u.test(raw);
    if (!hasScheme && !domainLike) return "";

    try {
        const parsed = new URL(hasScheme ? raw : `https://${raw}`);
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
};

export const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const encodeInlineHandlerArg = (value) => escapeHtml(JSON.stringify(String(value ?? "")));

// 내부 저장소 URL 판별
const INTERNAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|minio|host\.docker\.internal)$/i;
const PUBLIC_IMAGE_PROXY_PATH = "/api/image/view";
const PUBLIC_IMAGE_OBJECT_PREFIXES = ["editor/", "profile/"];
const PUBLIC_IMAGE_OBJECT_MAX_LENGTH = 512;
const PUBLIC_IMAGE_HOSTS = new Set(["ctfmon.shop", "www.ctfmon.shop"]);
const RASTER_IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp|bmp)$/i;
const CHAT_ATTACHMENT_PROXY_PATHS = new Set(["/api/chat/file/view", "/api/chat/file/download"]);

const getCurrentOrigin = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "https://ctfmon.shop";
};

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

const isAllowedPublicImageObjectKey = (objectKey) => {
    const normalized = String(objectKey || "").trim();
    if (
        !normalized ||
        normalized.length > PUBLIC_IMAGE_OBJECT_MAX_LENGTH ||
        normalized.startsWith("/") ||
        normalized.includes("..") ||
        normalized.includes("\\") ||
        normalized.includes("?") ||
        normalized.includes("#") ||
        /\s/.test(normalized)
    ) {
        return false;
    }

    return PUBLIC_IMAGE_OBJECT_PREFIXES.some((prefix) => normalized.startsWith(prefix)) &&
        RASTER_IMAGE_EXTENSION_PATTERN.test(normalized);
};

const isSafeChatAttachmentObjectKey = (objectKey) => {
    const normalized = String(objectKey || "").trim();
    return Boolean(normalized) &&
        normalized.length <= PUBLIC_IMAGE_OBJECT_MAX_LENGTH &&
        normalized.startsWith("chat/") &&
        !normalized.startsWith("/") &&
        !normalized.includes("..") &&
        !normalized.includes("\\") &&
        !normalized.includes("?") &&
        !normalized.includes("#") &&
        !/\s/.test(normalized);
};

export const isSafeBoardContentImageUrl = (value) => {
    if (!value) return false;
    const raw = String(value).trim();
    if (!raw) return false;
    const compact = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
    if (
        compact.startsWith("javascript:") ||
        compact.startsWith("vbscript:") ||
        compact.startsWith("data:")
    ) {
        return false;
    }

    try {
        const parsed = new URL(raw, getCurrentOrigin());
        if (!["http:", "https:"].includes(parsed.protocol)) return false;
        if (parsed.pathname !== PUBLIC_IMAGE_PROXY_PATH) return false;

        const sameOrigin = parsed.origin === getCurrentOrigin();
        const publicHost = PUBLIC_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
        if (!sameOrigin && !publicHost) return false;

        return isAllowedPublicImageObjectKey(parsed.searchParams.get("path"));
    } catch {
        return false;
    }
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

export const resolveChatAttachmentUrl = (rawUrl, fileName = "") => {
    if (!rawUrl) return rawUrl;
    const input = String(rawUrl).trim();
    if (!input) return input;

    const buildChatUrl = (objectKey) => {
        const encodedPath = encodeURIComponent(objectKey);
        if (isImageFile(fileName || objectKey)) {
            return `/api/chat/file/view?path=${encodedPath}`;
        }
        const safeName = fileName || objectKey.split("/").pop() || "attachment";
        return `/api/chat/file/download?path=${encodedPath}&name=${encodeURIComponent(safeName)}`;
    };

    if (input.startsWith("/api/chat/file/view") || input.startsWith("/api/chat/file/download")) {
        try {
            const parsed = new URL(input, getCurrentOrigin());
            return isSafeChatAttachmentObjectKey(parsed.searchParams.get("path")) ? input : "";
        } catch {
            return "";
        }
    }

    if (input.startsWith("/upload-files/chat/")) {
        return buildChatUrl(input.replace(/^\/upload-files\//, ""));
    }

    try {
        const parsed = new URL(input, getCurrentOrigin());
        if (CHAT_ATTACHMENT_PROXY_PATHS.has(parsed.pathname) && isSafeChatAttachmentObjectKey(parsed.searchParams.get("path"))) {
            return `${parsed.pathname}${parsed.search}`;
        }
        if (parsed.pathname.startsWith("/upload-files/chat/")) {
            const objectKey = parsed.pathname.replace(/^\/upload-files\//, "");
            return isSafeChatAttachmentObjectKey(objectKey) ? buildChatUrl(objectKey) : "";
        }
    } catch {
        return "";
    }

    return "";
};

export const normalizeContentImageUrls = (html) => {
    if (!html) return "";
    return String(html).replace(/(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (_, prefix, src, suffix) => {
        return `${prefix}${resolveAssetUrl(src)}${suffix}`;
    });
};

const BOARD_CONTENT_ALLOWED_TAGS = new Set([
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "u",
    "ul",
]);

const BOARD_CONTENT_DROP_TAGS = new Set([
    "button",
    "embed",
    "form",
    "iframe",
    "input",
    "link",
    "math",
    "meta",
    "object",
    "script",
    "select",
    "style",
    "svg",
    "textarea",
    "template",
]);

const isSafeBoardContentUrl = (value, { image = false } = {}) => {
    if (!value) return false;
    const raw = String(value).trim();
    if (!raw) return false;
    const compact = raw.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
    if (
        compact.startsWith("javascript:") ||
        compact.startsWith("vbscript:") ||
        compact.startsWith("data:")
    ) {
        return false;
    }
    if (raw.startsWith("#")) return !image;
    if (raw.startsWith("/") && !raw.startsWith("//")) {
        return image ? isSafeBoardContentImageUrl(raw) : true;
    }

    try {
        const parsed = new URL(raw, getCurrentOrigin());
        if (image) {
            return isSafeBoardContentImageUrl(raw);
        }
        return ["http:", "https:", "mailto:"].includes(parsed.protocol);
    } catch {
        return false;
    }
};

const unwrapNode = (node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
};

const sanitizeBoardContentElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    if (BOARD_CONTENT_DROP_TAGS.has(tagName)) {
        element.remove();
        return;
    }

    Array.from(element.childNodes).forEach(sanitizeBoardContentNode);

    if (!BOARD_CONTENT_ALLOWED_TAGS.has(tagName)) {
        unwrapNode(element);
        return;
    }

    Array.from(element.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (
            name.startsWith("on") ||
            name === "style" ||
            name === "srcdoc" ||
            name === "formaction" ||
            name.startsWith("xmlns") ||
            name.includes(":")
        ) {
            element.removeAttribute(attribute.name);
            return;
        }

        const isAllowed =
            name === "title" ||
            (tagName === "a" && ["href", "target", "rel"].includes(name)) ||
            (tagName === "img" && ["src", "alt", "width", "height", "loading", "decoding"].includes(name));

        if (!isAllowed) {
            element.removeAttribute(attribute.name);
        }
    });

    if (tagName === "a") {
        const href = element.getAttribute("href");
        if (href && isSafeBoardContentUrl(href)) {
            element.setAttribute("target", "_blank");
            element.setAttribute("rel", "noopener noreferrer");
        } else {
            element.removeAttribute("href");
            element.removeAttribute("target");
            element.removeAttribute("rel");
        }
    }

    if (tagName === "img") {
        const src = element.getAttribute("src");
        if (!src || !isSafeBoardContentUrl(src, { image: true })) {
            element.remove();
            return;
        }
        ["width", "height"].forEach((name) => {
            const value = element.getAttribute(name);
            if (value && !/^\d{1,4}$/.test(value)) {
                element.removeAttribute(name);
            }
        });
        element.setAttribute("loading", "lazy");
        element.setAttribute("decoding", "async");
    }
};

function sanitizeBoardContentNode(node) {
    if (node.nodeType === 1) {
        sanitizeBoardContentElement(node);
        return;
    }
    if (node.nodeType !== 3) {
        node.remove();
    }
}

export const sanitizeBoardContentHtml = (html) => {
    if (!html) return "";
    if (typeof document === "undefined") return String(html);

    const template = document.createElement("template");
    template.innerHTML = String(html);
    Array.from(template.content.childNodes).forEach(sanitizeBoardContentNode);
    return template.innerHTML;
};

export const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString("ko-KR");
};

// 입력 지연 처리
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

// 로컬 스토리지 JSON 헬퍼
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
            logClientError("storage.set", error);
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            logClientError("storage.remove", error);
        }
    },
};
