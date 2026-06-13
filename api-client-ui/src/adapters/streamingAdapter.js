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

const STREAMING_PUBLIC_HOSTS = new Set(["docky.co.kr", "www.docky.co.kr", "localhost", "127.0.0.1"]);
const STREAMING_ASSET_PATTERN = /^\/api\/streaming\/videos\/(\d+)\/(thumbnail|playlist\.m3u8|hls\/index\.m3u8)$/;

const getCurrentOrigin = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "https://docky.co.kr";
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

const DIRECT_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024;

const deriveTitleFromFileName = (fileName) => {
    const name = String(fileName || "").trim();
    if (!name) return "titleless-video";
    const dotIndex = name.lastIndexOf(".");
    return dotIndex > 0 ? name.slice(0, dotIndex) : name;
};

const normalizeDirectUploadTicket = (response) => {
    const data = unwrapStreamingData(response);
    return {
        uploadUrl: data?.uploadUrl ?? data?.upload_url ?? "",
        method: data?.method || "PUT",
        objectKey: data?.objectKey ?? data?.object_key ?? "",
        headers: data?.headers && typeof data.headers === "object" ? data.headers : {},
    };
};

const putDirectUpload = ({ ticket, file, onUploadProgress, uploadedBytes, totalBytes }) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method || "PUT", ticket.uploadUrl, true);
    xhr.withCredentials = false;
    Object.entries(ticket.headers || {}).forEach(([key, value]) => {
        if (value != null) xhr.setRequestHeader(key, String(value));
    });
    xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onUploadProgress) return;
        onUploadProgress({
            loaded: uploadedBytes + event.loaded,
            total: totalBytes,
        });
    };
    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
        }
        reject(new Error(`direct upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("direct upload network error"));
    xhr.onabort = () => reject(new Error("direct upload aborted"));
    xhr.send(file);
});

const uploadAdminVideosDirect = async ({ title, description, files, onUploadProgress }) => {
    const fileList = Array.from(files || []);
    const totalBytes = fileList.reduce((sum, file) => sum + (file?.size || 0), 0);
    let uploadedBytes = 0;
    const items = [];

    for (const file of fileList) {
        const resolvedTitle = fileList.length === 1 && title?.trim()
            ? title.trim()
            : deriveTitleFromFileName(file.name);
        const initiateResponse = await api.post("/admin/streaming/videos/direct-upload", {
            title: resolvedTitle,
            description: description?.trim() || null,
            file_name: file.name,
            content_type: file.type || null,
            file_size: file.size,
        });
        const ticket = normalizeDirectUploadTicket(initiateResponse);
        if (!ticket.uploadUrl || !ticket.objectKey) {
            throw new Error("direct upload ticket is invalid");
        }

        await putDirectUpload({
            ticket,
            file,
            onUploadProgress,
            uploadedBytes,
            totalBytes,
        });
        uploadedBytes += file.size || 0;
        onUploadProgress?.({ loaded: uploadedBytes, total: totalBytes });

        const completeResponse = await api.post("/admin/streaming/videos/direct-upload/complete", {
            object_key: ticket.objectKey,
            title: resolvedTitle,
            description: description?.trim() || null,
            file_name: file.name,
            content_type: file.type || null,
            file_size: file.size,
        });
        const completed = normalizeStreamingVideo(unwrapStreamingData(completeResponse));
        if (completed.videoId) {
            items.push(completed);
        }
    }

    return items;
};

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
        const fileList = Array.from(files || []);
        if (fileList.some((file) => (file?.size || 0) > DIRECT_UPLOAD_THRESHOLD_BYTES)) {
            return uploadAdminVideosDirect({ title, description, files: fileList, onUploadProgress });
        }

        const formData = new FormData();
        if (title?.trim()) {
            formData.append("title", title.trim());
        }
        formData.append("description", description?.trim() || "");
        fileList.forEach((file) => formData.append("files", file));

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
