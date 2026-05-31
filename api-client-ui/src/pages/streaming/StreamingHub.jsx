import { useEffect, useMemo, useRef, useState } from "react";
import { Film, PlayCircle, RefreshCw, AlertTriangle, Clapperboard, ArrowLeft, Clock3 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api.js";

const unwrap = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

const statusTone = {
    READY: "bg-emerald-100 text-emerald-700",
    PROCESSING: "bg-amber-100 text-amber-700",
    FAILED: "bg-rose-100 text-rose-700",
    UPLOADING: "bg-sky-100 text-sky-700",
};

export const StreamingHub = () => {
    const [videos, setVideos] = useState([]);
    const [selectedVideoId, setSelectedVideoId] = useState(null);
    const [playInfo, setPlayInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [playLoading, setPlayLoading] = useState(false);
    const [error, setError] = useState("");
    const [playbackUnsupported, setPlaybackUnsupported] = useState(false);
    const videoRef = useRef(null);

    const nativeHlsSupported = useMemo(() => {
        if (typeof document === "undefined") return false;
        const video = document.createElement("video");
        return Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
    }, []);
    const selectedVideo = videos.find((video) => video.video_id === selectedVideoId) || null;

    const fetchVideos = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/streaming/videos");
            const payload = unwrap(response.data);
            const items = Array.isArray(payload?.items) ? payload.items : [];
            setVideos(items);
            setSelectedVideoId((prev) => (items.some((item) => item.video_id === prev) ? prev : null));
        } catch (err) {
            setVideos([]);
            setError(err?.response?.data?.message || "스트리밍 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayInfo = async (videoId) => {
        if (!videoId) {
            setPlayInfo(null);
            return;
        }
        setPlayLoading(true);
        try {
            const response = await api.get(`/streaming/videos/${videoId}/play`);
            setPlayInfo(unwrap(response.data));
        } catch (err) {
            setPlayInfo(null);
            toast.error(err?.response?.data?.message || "재생 정보를 불러오지 못했습니다.");
        } finally {
            setPlayLoading(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, []);

    useEffect(() => {
        fetchPlayInfo(selectedVideoId);
    }, [selectedVideoId]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !playInfo?.playlist_url) {
            return undefined;
        }

        let cancelled = false;
        let hlsInstance = null;
        setPlaybackUnsupported(false);
        video.pause();
        video.removeAttribute("src");
        video.load();

        if (nativeHlsSupported) {
            video.src = playInfo.playlist_url;
            video.load();
            return undefined;
        }

        import("hls.js")
            .then((module) => {
                if (cancelled) return;
                const Hls = module.default;
                if (!Hls?.isSupported?.()) {
                    setPlaybackUnsupported(true);
                    video.src = playInfo.playlist_url;
                    video.load();
                    return;
                }

                hlsInstance = new Hls({ enableWorker: true });
                hlsInstance.loadSource(playInfo.playlist_url);
                hlsInstance.attachMedia(video);
                hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
                    if (data?.fatal) {
                        toast.error("스트리밍 재생 중 오류가 발생했습니다.");
                    }
                });
            })
            .catch(() => {
                if (cancelled) return;
                setPlaybackUnsupported(true);
                video.src = playInfo.playlist_url;
                video.load();
            });

        return () => {
            cancelled = true;
            hlsInstance?.destroy();
        };
    }, [nativeHlsSupported, playInfo?.playlist_url]);

    const renderThumbnail = (video, className) => {
        if (video?.thumbnail_url) {
            return <img src={video.thumbnail_url} alt={video.title} className={className} />;
        }
        return (
            <div className="flex h-full w-full items-center justify-center rounded-[1.5rem] bg-slate-100 text-slate-300">
                <Film className="h-8 w-8" />
            </div>
        );
    };

    return (
        <section className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
                <div>
                    <p className="text-[11px] font-black text-primary-500">스트리밍</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">영상 스트리밍 허브</h1>
                    <p className="mt-2 text-sm font-medium text-slate-400">목록에서 영상을 고른 뒤 상세 화면에서 재생할 수 있습니다.</p>
                </div>
                <button
                    type="button"
                    onClick={fetchVideos}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    새로고침
                </button>
            </div>

            {playbackUnsupported && (
                <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5 text-sm font-semibold text-amber-800">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            이 브라우저에서는 HLS 전용 재생 엔진을 사용할 수 없어 내장 플레이어로 재생을 시도합니다. Safari 계열 브라우저가 가장 안정적입니다.
                        </div>
                    </div>
                </div>
            )}

            {!selectedVideoId ? (
                <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/40">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900">재생 목록</h2>
                            <p className="mt-1 text-sm font-medium text-slate-400">썸네일, 제목, 설명, 재생시간을 확인한 뒤 영상을 선택하세요.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{videos.length}개</span>
                    </div>

                    {loading ? (
                        <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-6 text-center text-sm font-semibold text-slate-400">목록을 불러오는 중입니다...</div>
                    ) : error ? (
                        <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-6 text-sm font-semibold text-rose-700">{error}</div>
                    ) : !videos.length ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/40 text-center">
                            <Clapperboard className="h-10 w-10 text-slate-300" />
                            <p className="mt-4 text-base font-black text-slate-700">재생 가능한 영상이 없습니다.</p>
                            <p className="mt-2 text-sm font-medium text-slate-400">관리자 화면에서 변환 완료된 영상을 등록하면 여기에 나타납니다.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {videos.map((video) => (
                                <button
                                    key={video.video_id}
                                    type="button"
                                    onClick={() => setSelectedVideoId(video.video_id)}
                                    className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl hover:shadow-slate-200/50"
                                >
                                    <div className="h-56 w-full bg-slate-100 p-3">
                                        {renderThumbnail(video, "h-full w-full rounded-[1.5rem] object-contain bg-slate-100")}
                                    </div>
                                    <div className="space-y-3 p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="line-clamp-2 text-lg font-black text-slate-900">{video.title}</div>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusTone[video.status] || "bg-slate-100 text-slate-600"}`}>{video.status}</span>
                                        </div>
                                        <p className="line-clamp-3 text-sm leading-6 text-slate-500">{video.description || "등록된 영상 설명이 없습니다."}</p>
                                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
                                            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{video.duration_seconds ? `${video.duration_seconds}초` : "재생시간 확인 중"}</span>
                                            <span className="inline-flex items-center gap-1.5 font-black text-primary-600">상세 보기 <PlayCircle className="h-4 w-4" /></span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/40">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={() => setSelectedVideoId(null)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            목록으로 돌아가기
                        </button>
                        {selectedVideo ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone[selectedVideo.status] || "bg-slate-100 text-slate-600"}`}>{selectedVideo.status}</span>
                        ) : null}
                    </div>

                    <div className="space-y-5">
                        <div>
                            <p className="text-[11px] font-black text-primary-500">현재 재생</p>
                            <h2 className="mt-2 text-3xl font-black text-slate-900">{selectedVideo?.title || playInfo?.title}</h2>
                        </div>

                        <div className="overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl shadow-slate-900/20">
                            {playLoading ? (
                                <div className="flex h-[520px] items-center justify-center text-sm font-bold text-white/70">플레이어를 준비하는 중입니다...</div>
                            ) : playInfo ? (
                                <video
                                    key={playInfo.playlist_url}
                                    ref={videoRef}
                                    className="h-[520px] w-full bg-black object-contain"
                                    controls
                                    preload="metadata"
                                    poster={playInfo.thumbnail_url || undefined}
                                >
                                    브라우저가 HLS 재생을 지원하지 않습니다.
                                </video>
                            ) : (
                                <div className="flex h-[520px] items-center justify-center text-sm font-bold text-white/70">재생 정보를 불러오지 못했습니다.</div>
                            )}
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5 text-sm text-slate-600">
                            <div className="flex items-center gap-2 font-black text-slate-900">
                                <PlayCircle className="h-4 w-4 text-primary-600" />
                                재생 정보
                            </div>
                            <div className="mt-3 space-y-2">
                                <div><span className="font-bold text-slate-800">재생시간:</span> {playInfo?.duration_seconds ? `${playInfo.duration_seconds}초` : "확인 중"}</div>
                                <div className="break-all"><span className="font-bold text-slate-800">플레이리스트:</span> {playInfo?.playlist_url ? <a className="text-primary-600 underline" href={playInfo.playlist_url} target="_blank" rel="noreferrer">{playInfo.playlist_url}</a> : "없음"}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

