import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, Users, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export const Queue = () => {
    const [queueInfo, setQueueInfo] = useState({
        rank: 0,
        total_waiting: 0,
        expected_time: 0,
        status: "WAITING"
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const timerRef = useRef(null);

    const fetchQueueStatus = async () => {
        try {
            const response = await api.get("/api/queue/status");
            const data = response.data?.data || response.data;
            
            setQueueInfo(data);
            setLoading(false);

            if (data.status === "ALLOWED") {
                clearInterval(timerRef.current);
                toast.success("입장 가능합니다! 이동 중...");
                navigate("/app", { replace: true });
            }
        } catch (err) {
            console.error("Failed to fetch queue status:", err);
            setError("대기열 정보를 가져오는 데 실패했습니다.");
            // 401이면 로그인으로
            if (err.response?.status === 401) {
                navigate("/login");
            }
        }
    };

    useEffect(() => {
        // 즉시 한 번 호출
        fetchQueueStatus();
        
        // 3초마다 폴링
        timerRef.current = setInterval(fetchQueueStatus, 3000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [navigate]);

    // 예상 시간 포맷팅 (초 -> 분:초)
    const formatTime = (seconds) => {
        if (seconds <= 0) return "잠시 후 입장";
        if (seconds < 60) return `${seconds}초`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}분 ${secs}초`;
    };

    // 퍼센트 계산 (임의로 총 대기열 대비 현재 순번으로 계산)
    const progress = queueInfo.total_waiting > 0 
        ? Math.max(5, 100 - (queueInfo.rank / queueInfo.total_waiting * 100))
        : 0;

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white mb-4 shadow-lg animate-pulse">
                        <Timer className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        접속 대기 중입니다
                    </h1>
                    <p className="text-slate-600">
                        현재 많은 사용자가 접속 중입니다. 잠시만 기다려 주세요.
                    </p>
                </div>

                <div className="card p-8 space-y-8 shadow-xl border-t-4 border-primary-500">
                    {error ? (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3 text-red-700">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold">오류 발생</p>
                                <p>{error}</p>
                                <button 
                                    onClick={() => window.location.reload()}
                                    className="mt-2 font-bold underline"
                                >
                                    새로고침
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 상태 정보 카드 */}
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

                            {/* 진행 바 */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <span>진행도</span>
                                    <span>{loading ? "계산 중..." : `${Math.floor(progress)}%`}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-center text-slate-400">
                                    * 페이지를 새로고침하거나 닫지 마세요. 대기 순서가 초기화될 수 있습니다.
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-primary-600 font-bold animate-bounce">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>서버 연결 대기 중...</span>
                            </div>
                        </>
                    )}
                </div>

                {/* 하단 안내 */}
                <div className="mt-8 text-center text-sm text-slate-500 flex items-center justify-center gap-4">
                    <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        총 대기: {queueInfo.total_waiting.toLocaleString()}명
                    </span>
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span>정상 서비스 진입 시 자동 이동됩니다</span>
                </div>
            </div>
        </div>
    );
};
