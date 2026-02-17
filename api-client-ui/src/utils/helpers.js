import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

// 날짜 포맷팅
export const formatDate = (date) => {
    if (!date) return "";
    return format(new Date(date), "yyyy-MM-dd HH:mm", { locale: ko });
};

// 상대 시간 표시 (예: 3분 전, 2시간 전)
export const formatRelativeTime = (date) => {
    if (!date) return "";
    return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: ko,
    });
};

// 게시판 종류 한글 변환
export const getBoardKindLabel = (kind) => {
    const labels = {
        FREE_BOARD: "자유게시판",
        ECO_REVIEW: "Q&A 게시판",
        GREEN_ACTIVE: "녹색활동",
    };
    return labels[kind] || kind;
};

// 게시판 종류 색상
export const getBoardKindColor = (kind) => {
    const colors = {
        FREE_BOARD: "bg-blue-100 text-blue-700",
        ECO_REVIEW: "bg-green-100 text-green-700",
        GREEN_ACTIVE: "bg-emerald-100 text-emerald-700",
    };
    return colors[kind] || "bg-slate-100 text-slate-700";
};

// 파일 크기 포맷팅
export const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// 이미지 파일 확인
export const isImageFile = (filename) => {
    if (!filename) return false;
    const ext = filename.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
};

// 텍스트 자르기 (말줄임)
export const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

// HTML 문자열을 목록/검색용 일반 텍스트로 정제
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

// 숫자 포맷팅 (천 단위 콤마)
export const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString("ko-KR");
};

// 디바운스 함수
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

// 로컬 스토리지 헬퍼
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
