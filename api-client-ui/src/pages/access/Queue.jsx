import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, Users, Loader2, AlertCircle } from "lucide-react";
import api from "../../utils/api.js";
import toast from "react-hot-toast";

const WAITING_UI_DELAY_MS = 700;
const POLL_INTERVAL_MS = 1200;

export const Queue = () => {
    const [queueInfo, setQueueInfo] = useState({
        rank: 0,
        total_waiting: 0,
        expected_time: 0,
        status: "WAITING",
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showWaitingUi, setShowWaitingUi] = useState(false);
    const navigate = useNavigate();
    const pollTimerRef = useRef(null);
    const waitingUiTimerRef = useRef(null);

    const clearTimers = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        if (waitingUiTimerRef.current) {
            clearTimeout(waitingUiTimerRef.current);
            waitingUiTimerRef.current = null;
        }
    };

    const startWaitingUiDelay = () => {
        if (showWaitingUi || waitingUiTimerRef.current) return;
        waitingUiTimerRef.current = setTimeout(() => {
            setShowWaitingUi(true);
            waitingUiTimerRef.current = null;
        }, WAITING_UI_DELAY_MS);
    };

    const fetchQueueStatus = async () => {
        try {
            const response = await api.get("/api/queue/status");
            const data = response.data?.data || response.data;
            setQueueInfo(data);
            setLoading(false);
            setError("");

            if (data.status === "ALLOWED") {
                clearTimers();
                toast.success("입장 가능합니다. 이동 중...");
                navigate("/app", { replace: true });
                return;
            }

            // WAITING일 때도 잠깐 지속되는 경우에만 대기 UI 노출
            startWaitingUiDelay();
        } catch (err) {
            console.error("Failed to fetch queue status:", err);
            setLoading(false);
            setError(err?.response?.data?.message || "대기열 정보를 가져오는데 실패했습니다.");
            if (err?.response?.status === 401) {
                clearTimers();
                navigate("/login", { replace: true });
            }
        }
    };

    useEffect(() => {
        fetchQueueStatus();
        pollTimerRef.current = setInterval(fetchQueueStatus, POLL_INTERVAL_MS);
        return () => clearTimers();
    }, [navigate]);

    const formatTime = (seconds) => {
        const safe = Number(seconds || 0);
        if (safe <= 0) return "잠시 후 입장";
        if (safe < 60) return `${safe}초`;
        const mins = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${mins}분 ${secs}초`;
    };

    const progress = queueInfo.total_waiting > 0
        ? Math.max(5, 100 - ((queueInfo.rank || 0) / queueInfo.total_waiting) * 100)
        : 0;

    // 대기열이 아닌 경우는 최소한의 로딩 화면만 짧게 표시
    if (!showWaitingUi && !error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="flex items-center gap-3 text-primary-600 font-bold">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{loading ? "로그인 상태 확인 중..." : "입장 가능 여부 확인 중..."}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white mb-4 shadow-lg animate-pulse">
                        <Timer className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">접속 대기 중입니다</h1>
                    <p className="text-slate-600">현재 접속량이 많습니다. 잠시만 기다려주세요.</p>
                </div>

                <div className="card p-8 space-y-8 shadow-xl border-t-4 border-primary-500">
                    {error ? (
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-start gap-3 text-rose-700">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold">오류 발생</p>
                                <p>{error}</p>
                                <button type="button" onClick={fetchQueueStatus} className="mt-2 font-bold underline">
                                    다시 시도
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                        <Users className="h-4 w-4" />
                                        <span>대기 순번</span>
                                    </div>
                                    <div className="text-2xl font-black text-primary-600">
                                        {loading ? "..." : `${queueInfo.rank.toLocaleString()}번`}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                        <Timer className="h-4 w-4" />
                                        <span>예상 시간</span>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800">
                                        {loading ? "..." : formatTime(queueInfo.expected_time)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <span>진행률</span>
                                    <span>{loading ? "계산 중..." : `${Math.floor(progress)}%`}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-center text-slate-400">
                                    새로고침하거나 창을 닫으면 대기 순서가 초기화될 수 있습니다.
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-primary-600 font-bold">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>서버 연결 대기 중...</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-8 text-center text-sm text-slate-500 flex items-center justify-center gap-4">
                    <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        총 대기 {queueInfo.total_waiting.toLocaleString()}명
                    </span>
                </div>
            </div>
        </div>
    );
};

