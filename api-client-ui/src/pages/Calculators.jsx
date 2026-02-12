import { useState } from "react";
import { Calculator, Zap, TrendingDown, Info, DollarSign, BarChart3 } from "lucide-react";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatNumber } from "../utils/helpers";

export const Calculators = () => {
    const [formData, setFormData] = useState({
        powerConsumption: "",
        hour: ""
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [history, setHistory] = useState([]);

    // 계산 실행
    const handleCalculate = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // 입력값 검증
        if (!formData.powerConsumption || !formData.hour) {
            setError("모든 필드를 입력해주세요.");
            setLoading(false);
            return;
        }

        if (parseFloat(formData.powerConsumption) <= 0 || parseFloat(formData.hour) <= 0) {
            setError("0보다 큰 값을 입력해주세요.");
            setLoading(false);
            return;
        }

        try {
            const response = await api.post("/calculators", {
                powerConsumption: formData.powerConsumption,
                hour: formData.hour
            });

            const data = response.data?.data || response.data;
            setResult(data);

            // 히스토리에 추가
            setHistory(prev => [{
                ...data,
                timestamp: new Date(),
                powerConsumption: formData.powerConsumption,
                hour: formData.hour
            }, ...prev.slice(0, 4)]); // 최근 5개만 유지

        } catch (err) {
            console.error("Failed to calculate:", err);
            setError(err.response?.data?.message || "계산에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 입력 변경 핸들러
    const handleChange = (e) => {
        const { name, value } = e.target;
        // 숫자와 소수점만 허용
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // 초기화
    const handleReset = () => {
        setFormData({
            powerConsumption: "",
            hour: ""
        });
        setResult(null);
        setError("");
    };

    // 예시 값으로 채우기
    const fillExample = (power, hours) => {
        setFormData({
            powerConsumption: power.toString(),
            hour: hours.toString()
        });
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="card p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <Calculator className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">전기요금 계산기</h1>
                </div>
                <p className="text-green-100">가전제품의 전력 소비량과 사용 시간을 입력하여 예상 전기요금을 계산하세요</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 계산기 입력 폼 */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Zap className="h-5 w-5 text-green-600" />
                            전력 정보 입력
                        </h2>

                        <form onSubmit={handleCalculate} className="space-y-6">
                            {/* 소비 전력 */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    소비 전력 (W)
                                </label>
                                <input
                                    type="text"
                                    name="powerConsumption"
                                    value={formData.powerConsumption}
                                    onChange={handleChange}
                                    placeholder="예: 1000 (W)"
                                    className="input-base w-full"
                                    required
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    가전제품의 소비 전력을 와트(W) 단위로 입력하세요
                                </p>
                            </div>

                            {/* 사용 시간 */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    사용 시간 (시간/일)
                                </label>
                                <input
                                    type="text"
                                    name="hour"
                                    value={formData.hour}
                                    onChange={handleChange}
                                    placeholder="예: 8 (시간)"
                                    className="input-base w-full"
                                    required
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    하루에 몇 시간 사용하는지 입력하세요
                                </p>
                            </div>

                            {/* 예시 버튼들 */}
                            <div>
                                <div className="text-sm font-semibold text-slate-700 mb-2">빠른 입력:</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fillExample(100, 24)}
                                        className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        LED 전구 (100W, 24시간)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fillExample(1000, 8)}
                                        className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        에어컨 (1000W, 8시간)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fillExample(200, 4)}
                                        className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        냉장고 (200W, 4시간)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fillExample(150, 6)}
                                        className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        컴퓨터 (150W, 6시간)
                                    </button>
                                </div>
                            </div>

                            {/* 에러 메시지 */}
                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    <div className="font-semibold mb-1">입력 오류</div>
                                    {error}
                                </div>
                            )}

                            {/* 버튼들 */}
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex-1"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="loading-spinner" />
                                            계산 중...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <Calculator className="h-4 w-4" />
                                            전기요금 계산하기
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="btn-secondary px-6"
                                >
                                    초기화
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* 계산 결과 */}
                    {result && (
                        <div className="card p-6 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
                            <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                계산 결과
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* 총 사용량 */}
                                <div className="bg-white rounded-xl p-4 shadow-sm">
                                    <div className="text-sm text-slate-600 mb-1">일일 전력 사용량</div>
                                    <div className="text-2xl font-bold text-slate-900">
                                        {formatNumber(result.totalUsage || result.total_usage)} Wh
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        = {((result.totalUsage || result.total_usage) / 1000).toFixed(2)} kWh
                                    </div>
                                </div>

                                {/* 예상 전기요금 */}
                                <div className="bg-white rounded-xl p-4 shadow-sm">
                                    <div className="text-sm text-slate-600 mb-1">일일 예상 전기요금</div>
                                    <div className="text-2xl font-bold text-green-600">
                                        {formatNumber(result.electricCharges || result.electric_charges)}원
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        월 약 {formatNumber((result.electricCharges || result.electric_charges) * 30)}원
                                    </div>
                                </div>
                            </div>

                            {/* 절약 팁 */}
                            <div className="mt-4 p-4 bg-white rounded-xl border border-green-200">
                                <div className="flex items-start gap-2">
                                    <TrendingDown className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-slate-900 mb-1">절약 팁</div>
                                        <p className="text-sm text-slate-600">
                                            사용 시간을 {formData.hour}시간에서 {Math.max(1, parseInt(formData.hour) - 2)}시간으로 줄이면
                                            하루 약 <span className="font-semibold text-green-600">
                                                {formatNumber(Math.round((result.electricCharges || result.electric_charges) * 2 / parseInt(formData.hour)))}원
                                            </span>을 절약할 수 있습니다!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 사이드바 - 계산 히스토리 및 정보 */}
                <div className="space-y-6">
                    {/* 계산 히스토리 */}
                    {history.length > 0 && (
                        <div className="card p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">최근 계산 내역</h3>
                            <div className="space-y-3">
                                {history.map((item, index) => (
                                    <div key={index} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                        <div className="text-xs text-slate-500 mb-1">
                                            {item.timestamp.toLocaleTimeString()}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900">
                                            {item.powerConsumption}W × {item.hour}시간
                                        </div>
                                        <div className="text-sm text-green-600 font-bold mt-1">
                                            {formatNumber(item.electricCharges || item.electric_charges)}원/일
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 전기요금 정보 */}
                    <div className="card p-6 bg-blue-50 border-2 border-blue-200">
                        <div className="flex items-start gap-2 mb-3">
                            <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <h3 className="text-lg font-bold text-blue-900">전기요금 안내</h3>
                        </div>
                        <div className="space-y-2 text-sm text-blue-800">
                            <p>• 1kWh = 1000Wh</p>
                            <p>• 기본 요금은 별도입니다</p>
                            <p>• 실제 요금은 사용량 구간별로 차등 적용됩니다</p>
                            <p>• 이 계산기는 대략적인 예상 요금입니다</p>
                        </div>
                    </div>

                    {/* 일반 가전제품 소비전력 참고 */}
                    <div className="card p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">가전제품 소비전력 참고</h3>
                        <div className="space-y-2 text-sm">
                            <PowerReference device="에어컨" power="1000~2000W" />
                            <PowerReference device="냉장고" power="100~200W" />
                            <PowerReference device="세탁기" power="500~700W" />
                            <PowerReference device="전자레인지" power="1000~1500W" />
                            <PowerReference device="TV" power="100~300W" />
                            <PowerReference device="컴퓨터" power="100~300W" />
                            <PowerReference device="LED 전구" power="10~20W" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 전력 참고 컴포넌트
const PowerReference = ({ device, power }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
        <span className="text-slate-700">{device}</span>
        <span className="font-semibold text-slate-900">{power}</span>
    </div>
);