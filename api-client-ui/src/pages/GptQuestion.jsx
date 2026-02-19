import { useState } from "react";
import { Bot, SendHorizontal, Sparkles } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export const GptQuestion = () => {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) {
            toast.error("질문을 입력해주세요.");
            return;
        }

        setLoading(true);
        setAnswer("");
        try {
            const response = await api.post("/gpt/question", { question });
            const data = response.data?.data || response.data;
            const message = data?.answer || data?.content || data?.message || "";
            setAnswer(message || JSON.stringify(data, null, 2));
        } catch (error) {
            toast.error(error.response?.data?.message || "GPT 질문 처리에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card p-8 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <Bot className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">그린 AI 어시스턴트</h1>
                </div>
                <p className="text-emerald-100">
                    친환경 실천, 탄소 저감, 재활용에 대해 질문해보세요.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="block text-sm font-semibold text-slate-700">
                            질문
                        </label>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            className="input-base min-h-[180px] resize-y"
                            placeholder="예: 일상에서 전기 사용량을 줄이는 현실적인 방법 5가지를 알려줘"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <SendHorizontal className="h-4 w-4" />
                            {loading ? "답변 생성 중..." : "질문 보내기"}
                        </button>
                    </form>
                </div>

                <div className="card p-6 bg-slate-50 border-emerald-100">
                    <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        질문 예시
                    </h2>
                    <div className="space-y-2 text-sm text-slate-700">
                        <button className="text-left w-full hover:text-emerald-700" onClick={() => setQuestion("자취방에서 월 전기요금을 줄일 수 있는 루틴을 짜줘.")}>
                            자취방 전기 절약 루틴
                        </button>
                        <button className="text-left w-full hover:text-emerald-700" onClick={() => setQuestion("친환경 제품 리뷰를 작성할 때 신뢰도를 높이는 기준을 알려줘.")}>
                            친환경 리뷰 작성 기준
                        </button>
                        <button className="text-left w-full hover:text-emerald-700" onClick={() => setQuestion("초보자가 시작하기 좋은 녹색활동 7가지를 추천해줘.")}>
                            초보 녹색활동 추천
                        </button>
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <h2 className="font-semibold text-slate-900 mb-3">답변</h2>
                <div className="min-h-[160px] rounded-xl border border-slate-200 bg-white p-4 whitespace-pre-wrap leading-relaxed text-slate-700">
                    {answer || "질문을 보내면 답변이 이 영역에 표시됩니다."}
                </div>
            </div>
        </div>
    );
};
