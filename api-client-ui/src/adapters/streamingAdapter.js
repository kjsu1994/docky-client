import api, { getApiErrorMessage, uploadFiles } from "../utils/api.js";

const unwrapStreamingData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeUrl = (url) => {
    if (!url) return "";
    return String(url);
};

const STREAMING_PUBLIC_HOSTS = new Set(["ctfmon.shop", "www.ctfmon.shop", "localhost", "127.0.0.1"]);
const STREAMING_ASSET_PATTERN = /^\/api\/streaming\/videos\/(\d+)\/(thumbnail|playlist\.m3u8|hls\/index\.m3u8)$/;

const getCurrentOrigin = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "https://ctfmon.shop";
};

export const normalizeStreamingAssetUrl = (url, videoId, assetType) => {
    const raw = normalizeUrl(url).trim();
    if (!raw || !videoId) return "";

    try {
        const parsed = new URL(raw, getCurrentOrigin());
        const currentOrigin = new URL(getCurrentOrigin());
        const trustedHost = parsed.origin === currentOrigin.origin ||
            STREAMING_PUBLIC_HOSTS.has(parsed.hostname.toLowerCase());
        if (!trustedHost || parsed.search || parsed.hash) return "";

        const match = parsed.pathname.match(STREAMING_ASSET_PATTERN);
        if (!match || String(match[1]) !== String(videoId)) return "";

        const pathType = match[2];
        if (assetType === "thumbnail" && pathType !== "thumbnail") return "";
        if (assetType === "playlist" && pathType !== "playlist.m3u8" && pathType !== "hls/index.m3u8") return "";

        return parsed.pathname;
    } catch {
        return "";
    }
};

export const STREAMING_STATUS_LABELS = {
    READY: "재생 가능",
    PROCESSING: "변환 중",
    FAILED: "실패",
    UPLOADING: "업로드 중",
};

export const normalizeStreamingVideo = (video) => {
    const videoId = video?.videoId ?? video?.video_id ?? video?.id ?? null;
    return {
        videoId,
        title: video?.title || "제목 없는 영상",
        description: video?.description || "",
        status: video?.status || "READY",
        statusLabel: STREAMING_STATUS_LABELS[video?.status] || "상태 확인 중",
        sourceExtension: video?.sourceExtension ?? video?.source_extension ?? "",
        contentType: video?.contentType ?? video?.content_type ?? "",
        fileSize: toNumber(video?.fileSize ?? video?.file_size),
        durationSeconds: toNumber(video?.durationSeconds ?? video?.duration_seconds),
        thumbnailUrl: normalizeStreamingAssetUrl(video?.thumbnailUrl ?? video?.thumbnail_url, videoId, "thumbnail"),
        playlistUrl: normalizeStreamingAssetUrl(video?.playlistUrl ?? video?.playlist_url, videoId, "playlist"),
        createdAt: video?.createdAt ?? video?.created_at ?? "",
        modifiedAt: video?.modifiedAt ?? video?.modified_at ?? "",
        failureReason: video?.failureReason ?? video?.failure_reason ?? "",
    };
};

export const normalizeStreamingList = (response) => {
    const data = unwrapStreamingData(response);
    const items = Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.content) ? data.content
            : Array.isArray(data) ? data
                : [];
    return items.map(normalizeStreamingVideo).filter((video) => video.videoId);
};

export const normalizeStreamingPage = (response) => {
    const data = unwrapStreamingData(response);
    const items = normalizeStreamingList(response);
    const page = toNumber(data?.page ?? data?.page_number, 1);
    const size = toNumber(data?.size ?? data?.page_size, items.length);
    const totalElements = toNumber(data?.totalElements ?? data?.total_elements, items.length);
    const totalPages = toNumber(data?.totalPages ?? data?.total_pages, items.length ? 1 : 0);
    return {
        items,
        page,
        size,
        totalElements,
        totalPages,
        hasMore: totalPages > 0 && page < totalPages,
    };
};

export const normalizeInboxFile = (file) => {
    const fileName = file?.fileName ?? file?.file_name ?? "";
    return {
        fileName,
        title: file?.title || fileName,
        sourceExtension: file?.sourceExtension ?? file?.source_extension ?? "",
        fileSize: toNumber(file?.fileSize ?? file?.file_size),
        modifiedAt: file?.modifiedAt ?? file?.modified_at ?? "",
        ready: Boolean(file?.ready),
        blockedReason: file?.blockedReason ?? file?.blocked_reason ?? "",
    };
};

export const normalizeInboxList = (response) => {
    const data = unwrapStreamingData(response);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items.map(normalizeInboxFile).filter((file) => file.fileName);
};

export const normalizePlayInfo = (response) => {
    const data = unwrapStreamingData(response);
    if (!data) return null;
    return {
        videoId: data.videoId ?? data.video_id ?? null,
        title: data.title || "",
        playlistUrl: normalizeStreamingAssetUrl(data.playlistUrl ?? data.playlist_url, data.videoId ?? data.video_id, "playlist"),
        thumbnailUrl: normalizeStreamingAssetUrl(data.thumbnailUrl ?? data.thumbnail_url, data.videoId ?? data.video_id, "thumbnail"),
        durationSeconds: toNumber(data.durationSeconds ?? data.duration_seconds),
        status: data.status || "READY",
    };
};

export const formatDuration = (seconds) => {
    const value = toNumber(seconds);
    if (!value) return "재생시간 확인 중";
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    if (minutes <= 0) return `${rest}초`;
    return `${minutes}분 ${String(rest).padStart(2, "0")}초`;
};

export const streamingErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const streamingAdapter = {
    async fetchVideos({ page = 1, size = 24 } = {}) {
        const response = await api.get("/streaming/videos", {
            params: { page, size },
        });
        return normalizeStreamingPage(response);
    },

    async fetchPlayInfo(videoId) {
        const response = await api.get(`/streaming/videos/${videoId}/play`);
        return normalizePlayInfo(response);
    },

    async fetchAdminVideos({ silent = false, page = 1, size = 50 } = {}) {
        const response = await api.get("/admin/streaming/videos", {
            params: { page, size },
            meta: { trackNetwork: !silent },
        });
        return normalizeStreamingPage(response);
    },

    async fetchAdminInboxFiles({ silent = false } = {}) {
        const response = await api.get("/admin/streaming/videos/inbox", {
            meta: { trackNetwork: !silent },
        });
        return normalizeInboxList(response);
    },

    async uploadAdminVideos({ title, description, files, onUploadProgress }) {
        const formData = new FormData();
        if (title?.trim()) {
            formData.append("title", title.trim());
        }
        formData.append("description", description?.trim() || "");
        files.forEach((file) => formData.append("files", file));

        const response = await uploadFiles("/admin/streaming/videos/batch", formData, "post", {
            onUploadProgress,
        });
        return normalizeStreamingList(response);
    },

    async importAdminInboxFiles({ fileNames, description }) {
        const response = await api.post("/admin/streaming/videos/inbox/import", {
            file_names: fileNames,
            description: description?.trim() || null,
        });
        return normalizeStreamingList(response);
    },

    async deleteAdminVideo(videoId) {
        await api.delete(`/admin/streaming/videos/${videoId}`);
    },
};
