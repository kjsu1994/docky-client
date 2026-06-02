import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock3, Film, PlayCircle, RefreshCw } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { EmptyState } from "../../components/EmptyState.jsx";
import { formatDuration, streamingAdapter, streamingErrorMessage } from "../../adapters/streamingAdapter.js";

const statusTone = {
    READY: "bg-emerald-100 text-emerald-700",
    PROCESSING: "bg-amber-100 text-amber-700",
    FAILED: "bg-rose-100 text-rose-700",
    UPLOADING: "bg-sky-100 text-sky-700",
};

const LIST_PAGE_SIZE = 24;

export const StreamingHub = () => {
    const [videos, setVideos] = useState([]);
    const [selectedVideoId, setSelectedVideoId] = useState(null);
    const [playInfo, setPlayInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [playLoading, setPlayLoading] = useState(false);
    const [error, setError] = useState("");
    const [playError, setPlayError] = useState("");
    const [playbackUnsupported, setPlaybackUnsupported] = useState(false);
    const [videoPage, setVideoPage] = useState(1);
    const [hasMoreVideos, setHasMoreVideos] = useState(false);
    const listRequestSeqRef = useRef(0);
    const playRequestSeqRef = useRef(0);
    const videoRef = useRef(null);

    const nativeHlsSupported = useMemo(() => {
        if (typeof document === "undefined") return false;
        const video = document.createElement("video");
        return Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
    }, []);

    const selectedVideo = videos.find((video) => video.videoId === selectedVideoId) || null;

    const fetchVideos = useCallback(async ({ page = 1, append = false } = {}) => {
        const requestId = listRequestSeqRef.current + 1;
        listRequestSeqRef.current = requestId;
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError("");
        try {
            const result = await streamingAdapter.fetchVideos({ page, size: LIST_PAGE_SIZE });
            if (listRequestSeqRef.current !== requestId) return;
            setVideos((currentVideos) => {
                if (!append) return result.items;
                const merged = new Map(currentVideos.map((video) => [video.videoId, video]));
                result.items.forEach((video) => merged.set(video.videoId, video));
                return Array.from(merged.values());
            });
            setVideoPage(result.page);
            setHasMoreVideos(result.hasMore);
            if (!append) {
                setSelectedVideoId((currentId) => (result.items.some((item) => item.videoId === currentId) ? currentId : null));
            }
        } catch (err) {
            if (listRequestSeqRef.current !== requestId) return;
            if (!append) {
                setVideos([]);
                setHasMoreVideos(false);
            }
            setError(streamingErrorMessage(err, "스트리밍 목록을 불러오지 못했습니다."));
        } finally {
            if (listRequestSeqRef.current === requestId) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, []);

    const fetchPlayInfo = useCallback(async (videoId) => {
        const requestId = playRequestSeqRef.current + 1;
        playRequestSeqRef.current = requestId;
        setPlayError("");
        setPlaybackUnsupported(false);
        if (!videoId) {
            setPlayInfo(null);
            setPlayLoading(false);
            return;
        }

        setPlayLoading(true);
        try {
            const nextPlayInfo = await streamingAdapter.fetchPlayInfo(videoId);
            if (playRequestSeqRef.current === requestId) {
                setPlayInfo(nextPlayInfo);
            }
        } catch (err) {
            if (playRequestSeqRef.current !== requestId) return;
            setPlayInfo(null);
            setPlayError(streamingErrorMessage(err, "재생 정보를 불러오지 못했습니다."));
        } finally {
            if (playRequestSeqRef.current === requestId) {
                setPlayLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    useEffect(() => {
        fetchPlayInfo(selectedVideoId);
    }, [fetchPlayInfo, selectedVideoId]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !playInfo?.playlistUrl) {
            return undefined;
        }

        let cancelled = false;
        let hlsInstance = null;
        setPlaybackUnsupported(false);
        video.pause();
        video.removeAttribute("src");
        video.load();

        if (nativeHlsSupported) {
            video.src = playInfo.playlistUrl;
            video.load();
            return undefined;
        }

        import("hls.js/light")
            .then((module) => {
                if (cancelled) return;
                const Hls = module.default;
                if (!Hls?.isSupported?.()) {
                    setPlaybackUnsupported(true);
                    video.src = playInfo.playlistUrl;
                    video.load();
                    return;
                }

                hlsInstance = new Hls({ enableWorker: true });
                hlsInstance.loadSource(playInfo.playlistUrl);
                hlsInstance.attachMedia(video);
                hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
                    if (data?.fatal) {
                        setPlayError("스트리밍 재생 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                    }
                });
            })
            .catch(() => {
                if (cancelled) return;
                setPlaybackUnsupported(true);
                video.src = playInfo.playlistUrl;
                video.load();
            });

        return () => {
            cancelled = true;
            hlsInstance?.destroy();
        };
    }, [nativeHlsSupported, playInfo?.playlistUrl]);

    const renderThumbnail = (video, className) => {
        if (video?.thumbnailUrl) {
            return <img src={video.thumbnailUrl} alt="" className={className} loading="lazy" />;
        }
        return (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                <Film className="h-8 w-8" />
            </div>
        );
    };

    return (
        <section className="space-y-6 pb-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black text-primary-600">스트리밍</p>
                        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">영상 스트리밍 허브</h1>
                        <p className="mt-2 text-sm font-medium text-slate-500">변환이 완료된 영상을 빠르게 찾고 바로 재생합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchVideos()}
                        disabled={loading}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        새로고침
                    </button>
                </div>
            </div>

            {playbackUnsupported ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>이 브라우저에서 전용 재생 엔진을 사용할 수 없어 내장 플레이어로 재생을 시도합니다.</div>
                    </div>
                </div>
            ) : null}

            {!selectedVideoId ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">재생 목록</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">썸네일, 제목, 설명, 재생시간을 확인하고 영상을 선택하세요.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{videos.length}개</span>
                    </div>

                    {loading ? (
                        <LoadingSpinner text="영상 목록을 불러오는 중입니다..." />
                    ) : error ? (
                        <ErrorMessage message={error} onRetry={fetchVideos} />
                    ) : !videos.length ? (
                        <EmptyState message="재생 가능한 영상이 없습니다." subMessage="관리자 화면에서 변환 완료된 영상을 등록하면 여기에 표시됩니다." />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {videos.map((video) => (
                                    <button
                                        key={video.videoId}
                                        type="button"
                                        onClick={() => setSelectedVideoId(video.videoId)}
                                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg"
                                    >
                                        <div className="aspect-video w-full bg-slate-100 p-3">
                                            {renderThumbnail(video, "h-full w-full rounded-xl bg-slate-100 object-contain")}
                                        </div>
                                        <div className="space-y-3 p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="line-clamp-2 text-lg font-black text-slate-900">{video.title}</div>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusTone[video.status] || "bg-slate-100 text-slate-600"}`}>{video.statusLabel}</span>
                                            </div>
                                            <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-500">{video.description || "등록된 영상 설명이 없습니다."}</p>
                                            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
                                                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDuration(video.durationSeconds)}</span>
                                                <span className="inline-flex items-center gap-1.5 font-black text-primary-600">상세 보기 <PlayCircle className="h-4 w-4" /></span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {hasMoreVideos ? (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => fetchVideos({ page: videoPage + 1, append: true })}
                                        disabled={loadingMore}
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${loadingMore ? "animate-spin" : ""}`} />
                                        {loadingMore ? "불러오는 중..." : "더 보기"}
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={() => setSelectedVideoId(null)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            목록으로 돌아가기
                        </button>
                        {selectedVideo ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone[selectedVideo.status] || "bg-slate-100 text-slate-600"}`}>{selectedVideo.statusLabel}</span>
                        ) : null}
                    </div>

                    <div className="space-y-5">
                        <div>
                            <p className="text-[11px] font-black text-primary-600">현재 재생</p>
                            <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">{selectedVideo?.title || playInfo?.title || "선택한 영상"}</h2>
                        </div>

                        <div className="overflow-hidden rounded-2xl bg-slate-950 shadow-xl shadow-slate-900/20">
                            {playLoading ? (
                                <div className="flex aspect-video min-h-[260px] items-center justify-center text-sm font-bold text-white/70">플레이어를 준비하는 중입니다...</div>
                            ) : playInfo ? (
                                <video
                                    key={playInfo.playlistUrl}
                                    ref={videoRef}
                                    className="aspect-video max-h-[70vh] w-full bg-black object-contain"
                                    controls
                                    preload="metadata"
                                    poster={playInfo.thumbnailUrl || selectedVideo?.thumbnailUrl || undefined}
                                >
                                    브라우저가 영상 재생을 지원하지 않습니다.
                                </video>
                            ) : (
                                <div className="flex aspect-video min-h-[260px] items-center justify-center text-sm font-bold text-white/70">재생 정보를 불러오지 못했습니다.</div>
                            )}
                        </div>

                        {playError ? (
                            <ErrorMessage message={playError} onRetry={() => fetchPlayInfo(selectedVideoId)} />
                        ) : null}

                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
                            <div className="flex items-center gap-2 font-black text-slate-900">
                                <PlayCircle className="h-4 w-4 text-primary-600" />
                                재생 정보
                            </div>
                            <div className="mt-3 space-y-2">
                                <div><span className="font-bold text-slate-800">재생시간:</span> {formatDuration(playInfo?.durationSeconds || selectedVideo?.durationSeconds)}</div>
                                <div className="break-all"><span className="font-bold text-slate-800">플레이리스트:</span> {playInfo?.playlistUrl ? <a className="text-primary-600 underline" href={playInfo.playlistUrl} target="_blank" rel="noopener noreferrer">{playInfo.playlistUrl}</a> : "없음"}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default StreamingHub;
