import { useEffect, useMemo, useRef, useState } from "react";
import { Film, RefreshCw, Upload, Trash2, AlertTriangle, Clapperboard, LoaderCircle, Server, WandSparkles, FolderSearch, CheckSquare } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";
import { confirmAction } from "../../common/confirmAction.jsx";
import { streamingAdapter, streamingErrorMessage } from "../../adapters/streamingAdapter.js";
import { loadToast, notifyError, notifySuccess } from "../../utils/toast.js";

const statusTone = {
    READY: "bg-emerald-100 text-emerald-700",
    PROCESSING: "bg-amber-100 text-amber-700",
    FAILED: "bg-rose-100 text-rose-700",
    UPLOADING: "bg-sky-100 text-sky-700",
};

const phaseMeta = {
    uploading: {
        title: "파일 업로드 중",
        description: "브라우저에서 서버로 영상을 전송하고 있습니다.",
        tone: "border-sky-200 bg-sky-50/80 text-sky-800",
        icon: Upload,
    },
    server: {
        title: "서버 처리 중",
        description: "대용량 파일은 퍼센트가 잠시 멈춰 보여도 서버가 수신 중일 수 있습니다.",
        tone: "border-indigo-200 bg-indigo-50/80 text-indigo-800",
        icon: Server,
    },
    processing: {
        title: "변환 중",
        description: "업로드는 완료됐고 ffmpeg가 HLS와 썸네일을 생성하고 있습니다.",
        tone: "border-amber-200 bg-amber-50/80 text-amber-800",
        icon: WandSparkles,
    },
};

const formatFileSizeInMb = (size) => `${Math.max(1, Math.round(size / 1024 / 1024))}MB`;
const ADMIN_LIST_PAGE_SIZE = 50;
const MAX_STREAMING_BATCH_FILES = 8;

export const AdminStreamingStudio = () => {
    const { user } = useAuth();
    const isAdmin = useMemo(() => isAdminUser(user), [user]);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [videos, setVideos] = useState([]);
    const [videoPage, setVideoPage] = useState(1);
    const [totalVideoCount, setTotalVideoCount] = useState(0);
    const [hasMoreVideos, setHasMoreVideos] = useState(false);
    const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);
    const [inboxFiles, setInboxFiles] = useState([]);
    const [selectedInboxFiles, setSelectedInboxFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inboxLoading, setInboxLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [importingInbox, setImportingInbox] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadPhase, setUploadPhase] = useState("idle");
    const [error, setError] = useState("");
    const lastProgressAtRef = useRef(0);
    const videoRequestSeqRef = useRef(0);

    const isSingleUpload = selectedFiles.length <= 1;
    const hasQueueWork = useMemo(
        () => videos.some((video) => video.status === "UPLOADING" || video.status === "PROCESSING"),
        [videos]
    );
    const readyInboxFiles = useMemo(
        () => inboxFiles.filter((file) => file.ready),
        [inboxFiles]
    );

    const fetchVideos = async ({ silent = false, page = 1, append = false } = {}) => {
        const requestId = videoRequestSeqRef.current + 1;
        videoRequestSeqRef.current = requestId;
        if (append) {
            setLoadingMoreVideos(true);
        } else if (!silent) {
            setLoading(true);
        }
        setError("");
        try {
            const result = await streamingAdapter.fetchAdminVideos({ silent, page, size: ADMIN_LIST_PAGE_SIZE });
            if (videoRequestSeqRef.current !== requestId) return;
            setVideos((currentVideos) => {
                if (!append) return result.items;
                const merged = new Map(currentVideos.map((video) => [video.videoId, video]));
                result.items.forEach((video) => merged.set(video.videoId, video));
                return Array.from(merged.values());
            });
            setVideoPage(result.page);
            setTotalVideoCount(result.totalElements);
            setHasMoreVideos(result.hasMore);
        } catch (err) {
            if (videoRequestSeqRef.current !== requestId) return;
            if (!append) {
                setVideos([]);
                setTotalVideoCount(0);
                setHasMoreVideos(false);
            }
            setError(streamingErrorMessage(err, "스트리밍 관리 목록을 불러오지 못했습니다."));
        } finally {
            if (videoRequestSeqRef.current === requestId && !silent) {
                setLoading(false);
            }
            if (videoRequestSeqRef.current === requestId) {
                setLoadingMoreVideos(false);
            }
        }
    };

    const fetchInboxFiles = async ({ silent = false } = {}) => {
        if (!silent) {
            setInboxLoading(true);
        }
        try {
            const items = await streamingAdapter.fetchAdminInboxFiles({ silent });
            setInboxFiles(items);
            setSelectedInboxFiles((prev) => prev.filter((fileName) => items.some((item) => item.fileName === fileName && item.ready)));
        } catch (err) {
            if (!silent) {
                notifyError(streamingErrorMessage(err, "inbox 파일 목록을 불러오지 못했습니다."));
            }
            setInboxFiles([]);
            setSelectedInboxFiles([]);
        } finally {
            if (!silent) {
                setInboxLoading(false);
            }
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchVideos();
            fetchInboxFiles();
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!isAdmin || (!hasQueueWork && uploadPhase !== "processing")) {
            return;
        }
        const intervalId = window.setInterval(() => {
            fetchVideos({ silent: true });
        }, 5000);
        return () => window.clearInterval(intervalId);
    }, [hasQueueWork, isAdmin, uploadPhase]);

    useEffect(() => {
        if (!uploading || uploadPhase !== "uploading") {
            return;
        }
        const intervalId = window.setInterval(() => {
            if (!lastProgressAtRef.current) {
                return;
            }
            if (Date.now() - lastProgressAtRef.current > 4000) {
                setUploadPhase("server");
            }
        }, 1000);
        return () => window.clearInterval(intervalId);
    }, [uploadPhase, uploading]);

    useEffect(() => {
        if (!uploading && !importingInbox && uploadPhase === "processing" && !hasQueueWork) {
            const timeoutId = window.setTimeout(() => {
                setUploadPhase("idle");
                setUploadProgress(0);
            }, 1500);
            return () => window.clearTimeout(timeoutId);
        }
    }, [hasQueueWork, importingInbox, uploadPhase, uploading]);

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setSelectedFiles([]);
        const fileInput = document.getElementById("streaming-file-input");
        if (fileInput) fileInput.value = "";
    };

    const handleFileSelection = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length > MAX_STREAMING_BATCH_FILES) {
            notifyError(`한 번에 최대 ${MAX_STREAMING_BATCH_FILES}개 영상만 등록할 수 있습니다.`);
            setSelectedFiles(files.slice(0, MAX_STREAMING_BATCH_FILES));
            return;
        }
        setSelectedFiles(files);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFiles.length) {
            notifyError("업로드할 영상 파일을 선택해주세요.");
            return;
        }
        if (selectedFiles.length > MAX_STREAMING_BATCH_FILES) {
            notifyError(`한 번에 최대 ${MAX_STREAMING_BATCH_FILES}개 영상만 등록할 수 있습니다.`);
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setUploadPhase("uploading");
        lastProgressAtRef.current = Date.now();

        try {
            const items = await streamingAdapter.uploadAdminVideos({
                title,
                description,
                files: selectedFiles,
                onUploadProgress: (event) => {
                    lastProgressAtRef.current = Date.now();
                    if (uploadPhase !== "uploading") {
                        setUploadPhase("uploading");
                    }
                    if (!event?.total) return;
                    setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
                },
            });
            const createdCount = items.length || selectedFiles.length;
            setUploadPhase("processing");
            setUploadProgress(100);
            notifySuccess(`${createdCount}개 영상 업로드가 등록되었습니다. 서버에서 변환을 시작합니다.`);
            resetForm();
            await fetchVideos({ silent: true });
        } catch (err) {
            setUploadPhase("idle");
            setUploadProgress(0);
            notifyError(streamingErrorMessage(err, "영상 업로드에 실패했습니다."));
        } finally {
            setUploading(false);
        }
    };

    const handleImportInbox = async () => {
        if (!selectedInboxFiles.length) {
            notifyError("가져올 inbox 파일을 선택해주세요.");
            return;
        }

        setImportingInbox(true);
        setUploadPhase("processing");
        setUploadProgress(100);
        try {
            const items = await streamingAdapter.importAdminInboxFiles({
                fileNames: selectedInboxFiles,
                description,
            });
            const importedCount = items.length || selectedInboxFiles.length;
            notifySuccess(`${importedCount}개 inbox 영상 가져오기가 시작되었습니다.`);
            setSelectedInboxFiles([]);
            await Promise.all([
                fetchVideos({ silent: true }),
                fetchInboxFiles({ silent: true }),
            ]);
        } catch (err) {
            setUploadPhase("idle");
            setUploadProgress(0);
            notifyError(streamingErrorMessage(err, "inbox 파일 가져오기에 실패했습니다."));
        } finally {
            setImportingInbox(false);
        }
    };

    const toggleInboxSelection = (fileName) => {
        setSelectedInboxFiles((prev) => {
            if (prev.includes(fileName)) {
                return prev.filter((item) => item !== fileName);
            }
            if (prev.length >= MAX_STREAMING_BATCH_FILES) {
                notifyError(`한 번에 최대 ${MAX_STREAMING_BATCH_FILES}개 영상만 가져올 수 있습니다.`);
                return prev;
            }
            return [...prev, fileName];
        });
    };

    const handleDelete = async (videoId) => {
        const confirmed = await confirmAction({
            title: "영상을 삭제할까요?",
            description: "원본, HLS 파일, 썸네일이 함께 제거됩니다.",
            confirmText: "삭제",
        });
        if (!confirmed) return;
        let toastApi = null;
        let toastId = null;
        try {
            toastApi = await loadToast();
            toastId = toastApi.loading("영상을 삭제하는 중입니다...");
        } catch {
            // 알림 런타임 로드 실패가 삭제 동작 자체를 막지 않도록 한다.
        }
        try {
            await streamingAdapter.deleteAdminVideo(videoId);
            await fetchVideos({ silent: true });
            if (toastApi && toastId) {
                toastApi.success("영상이 삭제되었습니다.", { id: toastId });
            } else {
                notifySuccess("영상이 삭제되었습니다.");
            }
        } catch (err) {
            const message = streamingErrorMessage(err, "영상 삭제에 실패했습니다.");
            if (toastApi && toastId) {
                toastApi.error(message, { id: toastId });
            } else {
                notifyError(message);
            }
        }
    };

    if (!isAdmin) {
        return (
            <section className="surface-panel space-y-4 p-6 text-center text-rose-800 sm:p-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">관리자 전용 페이지</h1>
                <p className="text-sm font-medium opacity-70">관리자 또는 마스터 권한이 필요합니다.</p>
            </section>
        );
    }

    const currentPhaseMeta = uploadPhase !== "idle" ? phaseMeta[uploadPhase] : null;
    const CurrentPhaseIcon = currentPhaseMeta?.icon || LoaderCircle;

    return (
        <section className="space-y-6 animate-fade-in pb-10 sm:space-y-8">
            <div className="surface-panel flex flex-col gap-4 p-5 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-[11px] font-black text-primary-500">관리자 스트리밍</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">스트리밍 스튜디오</h1>
                    <p className="mt-2 text-sm font-medium text-slate-400">웹 업로드와 inbox 반입을 함께 관리하는 관리자 전용 스튜디오입니다.</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        fetchVideos();
                        fetchInboxFiles();
                    }}
                    disabled={loading || inboxLoading}
                    className="btn-secondary w-full px-4 py-3 sm:w-auto"
                >
                    <RefreshCw className={`h-4 w-4 ${loading || inboxLoading ? "animate-spin" : ""}`} />
                    전체 새로고침
                </button>
            </div>

            {currentPhaseMeta ? (
                <div className={`rounded-card border p-5 shadow-card ${currentPhaseMeta.tone}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-2xl bg-white/70 p-2">
                                <CurrentPhaseIcon className={`h-5 w-5 ${uploadPhase === "processing" ? "animate-pulse" : ""}`} />
                            </div>
                            <div>
                                <div className="text-sm font-black">{currentPhaseMeta.title}</div>
                                <div className="mt-1 text-sm font-medium opacity-80">{currentPhaseMeta.description}</div>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-black">
                            {uploadPhase === "processing" ? (hasQueueWork ? "변환 대기/진행 중" : "변환 완료 반영 중") : `${uploadProgress}%`}
                        </div>
                    </div>
                    {uploadPhase !== "processing" ? (
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                            <div className="h-full rounded-full bg-current transition-all duration-300" style={{ width: `${Math.max(uploadProgress, 2)}%` }} />
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <form onSubmit={handleUpload} className="surface-panel space-y-5 p-5 sm:p-6">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">영상 업로드</h2>
                            <p className="mt-2 text-sm font-medium text-slate-400">지원 형식: MP4, MOV, MKV, WEBM. 권장 형식은 MP4이며 최대 3GB까지 허용됩니다.</p>
                        </div>

                        <div className="space-y-4">
                            <input
                                className="input-base"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={isSingleUpload ? "영상 제목" : "여러 파일 업로드 시 비워두면 각 파일명으로 제목이 생성됩니다."}
                                maxLength={200}
                            />
                            <textarea className="input-base min-h-[120px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="영상 설명 (선택, inbox 가져오기에도 공통 적용)" maxLength={1000} />
                            <div className="rounded-card border border-dashed border-line bg-control/70 p-4">
                                <input
                                    id="streaming-file-input"
                                    type="file"
                                    multiple
                                    accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime,video/x-matroska,video/webm"
                                    onChange={handleFileSelection}
                                    className="block w-full text-sm font-semibold text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-primary-600 file:px-4 file:py-2.5 file:font-black file:text-white hover:file:bg-primary-700"
                                />
                                {selectedFiles.length ? (
                                    <div className="mt-4 space-y-2">
                                        <div className="text-xs font-black text-slate-500">선택 파일 {selectedFiles.length}개</div>
                                        <div className="max-h-40 space-y-2 overflow-auto pr-1">
                                            {selectedFiles.map((file) => (
                                                <div key={`${file.name}-${file.size}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                                                    <span className="truncate pr-3">{file.name}</span>
                                                    <span className="shrink-0 text-slate-400">{formatFileSizeInMb(file.size)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                                파일 1개: 제목을 직접 입력할 수 있습니다. 파일 여러 개: 제목을 비워두면 파일명으로 각각 자동 등록됩니다. 한 번에 최대 {MAX_STREAMING_BATCH_FILES}개까지 등록할 수 있습니다.
                            </div>
                        </div>

                        <button type="submit" disabled={uploading || importingInbox} className="btn-primary w-full px-4 py-3.5">
                            <Upload className="h-4 w-4" />
                            {uploading ? "업로드 요청 처리 중..." : `영상 ${selectedFiles.length > 1 ? "일괄 업로드 시작" : "업로드 시작"}`}
                        </button>
                    </form>

                    <div className="surface-panel space-y-5 p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">inbox 반입</h2>
                                <p className="mt-2 text-sm font-medium text-slate-400">`C:\compose\minio-data\streaming\inbox` 에 넣은 영상을 스캔하고 선택해서 가져옵니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchInboxFiles()}
                                disabled={inboxLoading}
                                className="btn-secondary shrink-0 px-4 py-3"
                            >
                                <FolderSearch className={`h-4 w-4 ${inboxLoading ? "animate-spin" : ""}`} />
                                스캔
                            </button>
                        </div>

                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                            큰 파일은 Cloudflare 업로드 제한을 피하기 위해 inbox 폴더에 직접 넣은 뒤 여기서 가져오면 됩니다. 최근 10초 안에 수정된 파일은 복사 중일 수 있어 자동으로 제외됩니다.
                        </div>

                        {!inboxFiles.length ? (
                            <div className="rounded-card border border-dashed border-line bg-control/60 p-6 text-center text-sm font-medium text-ink-muted">
                                스캔된 inbox 파일이 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
                                {inboxFiles.map((file) => {
                                    const selected = selectedInboxFiles.includes(file.fileName);
                                    return (
                                        <label key={file.fileName} className={`block rounded-[1.5rem] border p-4 transition-all ${selected ? "border-primary-200 bg-primary-50/50" : "border-slate-100 bg-slate-50/40"}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                                                        checked={selected}
                                                        disabled={!file.ready}
                                                        onChange={() => toggleInboxSelection(file.fileName)}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-black text-slate-900">{file.fileName}</div>
                                                        <div className="mt-1 text-xs font-semibold text-slate-500">제목: {file.title} · {file.sourceExtension?.toUpperCase() || "-"} · {file.fileSize ? formatFileSizeInMb(file.fileSize) : "-"}</div>
                                                        {!file.ready ? (
                                                            <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-700">
                                                                {file.blockedReason || "현재 가져올 수 없는 파일입니다."}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${file.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{file.ready ? "가져오기 가능" : "차단됨"}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 rounded-card bg-control/70 px-4 py-3 text-xs font-semibold text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                            <div>가져오기 가능 파일 {readyInboxFiles.length}개 / 선택 {selectedInboxFiles.length}개 / 1회 최대 {MAX_STREAMING_BATCH_FILES}개</div>
                            <button
                                type="button"
                                onClick={handleImportInbox}
                                disabled={importingInbox || !selectedInboxFiles.length}
                                className="btn-primary min-h-10 px-4 py-2.5 text-xs"
                            >
                                <CheckSquare className="h-4 w-4" />
                                {importingInbox ? "가져오는 중..." : "선택 파일 가져오기"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="surface-panel p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">업로드/변환 현황</h2>
                            <p className="mt-1 text-sm font-medium text-slate-400">원본 보관, HLS 변환, 썸네일 생성 상태를 확인합니다.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                            {totalVideoCount > videos.length ? `${videos.length}/${totalVideoCount}개` : `${videos.length}개`}
                        </span>
                    </div>

                    {loading ? (
                        <div className="rounded-card border border-line bg-control/70 p-6 text-center text-sm font-semibold text-ink-muted">목록을 불러오는 중입니다...</div>
                    ) : error ? (
                        <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-6 text-sm font-semibold text-rose-700">{error}</div>
                    ) : !videos.length ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-card border border-dashed border-line bg-control/60 p-5 text-center sm:min-h-[420px]">
                            <Clapperboard className="h-10 w-10 text-slate-300" />
                            <p className="mt-4 text-base font-black text-slate-700">업로드된 영상이 없습니다.</p>
                            <p className="mt-2 text-sm font-medium text-slate-400">왼쪽 폼에서 첫 영상을 등록하거나 inbox에서 가져오면 상태가 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 max-h-[980px] overflow-auto pr-1">
                                {videos.map((video) => (
                                    <div key={video.videoId} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/30 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-start gap-4">
                                                {video.thumbnailUrl ? (
                                                    <img src={video.thumbnailUrl} alt={video.title} className="h-24 w-40 rounded-2xl object-contain bg-slate-100 p-2" loading="lazy" decoding="async" />
                                                ) : (
                                                    <div className="flex h-24 w-40 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                                                        <Film className="h-6 w-6" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="line-clamp-2 text-base font-black text-slate-900">{video.title}</div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                                                        <span className={`rounded-full px-2.5 py-1 font-black ${statusTone[video.status] || "bg-slate-100 text-slate-600"}`}>{video.statusLabel}</span>
                                                        <span>{video.sourceExtension?.toUpperCase()}</span>
                                                        <span>{video.fileSize ? formatFileSizeInMb(video.fileSize) : "-"}</span>
                                                        <span>{video.durationSeconds ? `${video.durationSeconds}초` : "재생시간 미확정"}</span>
                                                    </div>
                                                    {video.failureReason ? (
                                                        <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700">
                                                            실패 사유: {video.failureReason}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => handleDelete(video.videoId)} className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition-colors hover:bg-rose-100">
                                                <Trash2 className="h-4 w-4" />
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {hasMoreVideos ? (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => fetchVideos({ silent: true, page: videoPage + 1, append: true })}
                                        disabled={loadingMoreVideos}
                                        className="btn-secondary min-h-11 px-5 py-3"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loadingMoreVideos ? "animate-spin" : ""}`} />
                                        {loadingMoreVideos ? "불러오는 중..." : "더 보기"}
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};
