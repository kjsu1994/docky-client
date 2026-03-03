import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ArrowUpRight, Bot, CircleAlert, Globe2, Landmark, RefreshCw, Search, Sparkles } from "lucide-react";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../utils/helpers";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

const MARKETS = [
    { value: "KR", label: "국내", helper: "KIS 시세, DART 재무, 네이버 뉴스", icon: Landmark },
    { value: "US", label: "미국", helper: "KIS 시세, Alpha Vantage 재무/뉴스/기술지표", icon: Globe2 },
];

const PRESETS = {
    KR: ["005930", "000660", "035420"],
    US: ["AAPL", "MSFT", "NVDA"],
};

const CHART_INTERVALS = [
    { value: "DAY", label: "일봉" },
    { value: "WEEK", label: "주봉" },
    { value: "MONTH", label: "월봉" },
];

const formatCompact = (value, digits = 2) => {
    if (value === null || value === undefined || value === "") return "-";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return new Intl.NumberFormat("ko-KR", {
        notation: Math.abs(num) >= 1000000 ? "compact" : "standard",
        maximumFractionDigits: digits,
    }).format(num);
};

const formatCurrency = (value, currency = "KRW") => {
    if (value === null || value === undefined || value === "") return "-";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    const safeCurrency = currency === "USD" ? "USD" : "KRW";
    return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: safeCurrency === "USD" ? 2 : 0,
    }).format(num);
};

const formatPercent = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
};

const toneBySignal = (signal) => {
    if (["POSITIVE", "BUY"].includes(signal)) return "bg-emerald-100 text-emerald-700";
    if (["CAUTION", "NEGATIVE", "SELL"].includes(signal)) return "bg-rose-100 text-rose-700";
    if (["UNKNOWN", "UNAVAILABLE", "INSUFFICIENT_DATA"].includes(signal)) return "bg-slate-100 text-slate-600";
    return "bg-amber-100 text-amber-700";
};

const toneByValue = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "text-slate-900";
    if (num > 0) return "text-emerald-600";
    if (num < 0) return "text-rose-600";
    return "text-slate-900";
};

const normalizeSymbol = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const bracketMatch = raw.match(/\[\s*([A-Za-z0-9._-]+)\s*\]$/);
    if (bracketMatch) return bracketMatch[1].toUpperCase();
    const parenMatch = raw.match(/\(\s*([A-Za-z0-9._-]+)\s*\)$/);
    if (parenMatch) return parenMatch[1].toUpperCase();
    return raw.toUpperCase();
};

const buildFallbackChart = ({ market, symbol, interval, priceSnapshot, currency, source }) => {
    const close = Number(priceSnapshot?.price);
    const open = Number(priceSnapshot?.open ?? close);
    const high = Number(priceSnapshot?.high ?? Math.max(open, close));
    const low = Number(priceSnapshot?.low ?? Math.min(open, close));
    const volume = Number(priceSnapshot?.volume);

    if (![open, high, low, close].every((value) => Number.isFinite(value))) {
        return null;
    }

    return {
        market,
        symbol,
        interval,
        source: source || priceSnapshot?.source || "SNAPSHOT_FALLBACK",
        currency: currency || (market === "US" ? "USD" : "KRW"),
        points: [{
            trading_date: priceSnapshot?.as_of_date || new Date().toISOString().slice(0, 10),
            open,
            high,
            low,
            close,
            volume: Number.isFinite(volume) ? volume : null,
        }],
        limitations: ["차트 히스토리 조회에 실패해 현재가 스냅샷 1봉으로 대체 표시합니다."],
    };
};

const Badge = ({ children, className = "" }) => <span className={`badge ${className}`}>{children}</span>;

const Card = ({ title, subtitle, children }) => (
    <section className="card bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
        <div className="mt-5">{children}</div>
    </section>
);

const EmptySlot = ({ message }) => (
    <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm font-medium text-slate-400">
        {message}
    </div>
);

const CandlestickChart = ({ points, currency }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const candles = useMemo(() => {
        const source = Array.isArray(points) ? points : [];
        return source
            .map((item, index) => {
                const open = Number(item.open);
                const high = Number(item.high);
                const low = Number(item.low);
                const close = Number(item.close);
                const volume = Number(item.volume);
                if (![open, high, low, close].every((value) => Number.isFinite(value))) {
                    return null;
                }
                const previousClose = Number(item.previous_close);
                const fallbackPreviousClose = index > 0 ? Number(source[index - 1]?.close) : open;
                const referenceClose = Number.isFinite(previousClose)
                    ? previousClose
                    : (Number.isFinite(fallbackPreviousClose) ? fallbackPreviousClose : open);
                return {
                    ...item,
                    open,
                    high,
                    low,
                    close,
                    volume: Number.isFinite(volume) ? volume : null,
                    referenceClose,
                };
            })
            .filter(Boolean);
    }, [points]);

    if (!candles.length) {
        return <EmptySlot message="차트 OHLC 데이터가 없습니다." />;
    }

    const width = 820;
    const height = 360;
    const paddingX = 28;
    const paddingTop = 18;
    const volumeGap = 14;
    const candleAreaHeight = 238;
    const volumeAreaHeight = 66;
    const candleBottom = paddingTop + candleAreaHeight;
    const volumeTop = candleBottom + volumeGap;
    const volumeBottom = volumeTop + volumeAreaHeight;
    const plotWidth = width - paddingX * 2;
    const min = Math.min(...candles.map((item) => item.low));
    const max = Math.max(...candles.map((item) => item.high));
    const spread = Math.max(max - min, 1);
    const slotWidth = plotWidth / candles.length;
    const candleWidth = Math.max(Math.min(slotWidth * 0.58, 18), 6);
    const latest = candles[candles.length - 1];
    const first = candles[0];
    const hovered = hoveredIndex == null ? latest : candles[hoveredIndex];
    const trendUp = latest.close >= first.close;
    const maxVolume = Math.max(...candles.map((item) => item.volume || 0), 0);
    const hasVolume = maxVolume > 0;
    const toY = (value) => candleBottom - (((value - min) / spread) * candleAreaHeight);
    const toVolumeY = (value) => {
        if (!hasVolume) return volumeBottom;
        const safeValue = Number.isFinite(value) ? value : 0;
        return volumeBottom - ((safeValue / maxVolume) * volumeAreaHeight);
    };
    const changeRate = (priceValue) => {
        const num = Number(priceValue);
        const reference = Number(hovered?.referenceClose);
        if (!Number.isFinite(num) || !Number.isFinite(reference) || reference === 0) return null;
        return ((num - reference) / reference) * 100;
    };
    const renderPriceLine = (label, value) => {
        const rate = changeRate(value);
        return `${label} ${formatCurrency(value, currency)}${rate == null ? "" : ` (${formatPercent(rate)})`}`;
    };

    return (
        <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Candlestick</div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                        국내와 미국 모두 동일한 캔들 차트를 사용하며, 봉에 마우스를 올리면 시가, 고가, 저가, 종가와 등락률을 함께 확인할 수 있습니다.
                    </p>
                </div>
                <div className="min-w-[280px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm">
                    <div className="text-sm font-black text-slate-900">{hovered?.trading_date || "-"}</div>
                    <div className="mt-2 grid grid-cols-1 gap-y-1.5">
                        <span>{renderPriceLine("시가", hovered?.open)}</span>
                        <span>{renderPriceLine("고가", hovered?.high)}</span>
                        <span>{renderPriceLine("저가", hovered?.low)}</span>
                        <span>{renderPriceLine("종가", hovered?.close)}</span>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-500">
                        거래량 {hovered?.volume != null ? formatCompact(hovered.volume) : "-"}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-[1.4rem] bg-white/70 p-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-80 min-w-[760px] w-full">
                    {[0, 1, 2, 3].map((step) => {
                        const y = paddingTop + (candleAreaHeight * step) / 3;
                        return <line key={`price-grid-${step}`} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
                    })}
                    <line x1={paddingX} y1={candleBottom} x2={width - paddingX} y2={candleBottom} stroke="#cbd5e1" strokeWidth="1" />
                    <line x1={paddingX} y1={volumeBottom} x2={width - paddingX} y2={volumeBottom} stroke="#e2e8f0" strokeWidth="1" />

                    {candles.map((item, index) => {
                        const centerX = paddingX + slotWidth * index + slotWidth / 2;
                        const openY = toY(item.open);
                        const closeY = toY(item.close);
                        const highY = toY(item.high);
                        const lowY = toY(item.low);
                        const bodyTop = Math.min(openY, closeY);
                        const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
                        const rising = item.close >= item.open;
                        const stroke = rising ? "#059669" : "#dc2626";
                        const fill = rising ? "#10b981" : "#ef4444";
                        const active = hoveredIndex === index;
                        const volumeHeight = hasVolume && item.volume != null ? Math.max(volumeBottom - toVolumeY(item.volume), 2) : 0;
                        const volumeY = hasVolume && item.volume != null ? volumeBottom - volumeHeight : volumeBottom;

                        return (
                            <g key={`${item.trading_date || "point"}-${index}`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                                <rect x={paddingX + slotWidth * index} y={paddingTop} width={slotWidth} height={volumeBottom - paddingTop} fill="transparent" />
                                <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={stroke} strokeWidth={active ? 2.4 : 1.6} strokeLinecap="round" />
                                <rect x={centerX - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} rx="1.5" fill={fill} stroke={active ? "#0f172a" : stroke} strokeWidth={active ? 1.5 : 1} opacity={active ? 1 : 0.92} />
                                {hasVolume ? (
                                    <rect x={centerX - candleWidth / 2} y={volumeY} width={candleWidth} height={volumeHeight} rx="1.5" fill={rising ? "#86efac" : "#fca5a5"} opacity={active ? 0.95 : 0.75} />
                                ) : null}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black text-slate-400">첫 종가</div><div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(first?.close, currency)}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black text-slate-400">최신 종가</div><div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(latest?.close, currency)}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black text-slate-400">최신 날짜</div><div className="mt-1 text-sm font-black text-slate-900">{latest?.trading_date || "-"}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black text-slate-400">추세</div><div className={`mt-1 text-sm font-black ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>{trendUp ? "상승" : "하락"}</div></div>
            </div>
        </div>
    );
};

const FinancialTrendBars = ({ history }) => {
    const items = Array.isArray(history) ? history : [];

    if (!items.length) {
        return <EmptySlot message="최근 3개년 재무 추이 데이터가 없습니다." />;
    }

    const amountMax = Math.max(...items.flatMap((item) => [Number(item.revenue) || 0, Number(item.operating_income) || 0, Number(item.net_income) || 0]), 1);

    return (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="text-sm font-black text-slate-900">금액 추이</div>
                <div className="mt-4 space-y-4">
                    {items.map((item) => (
                        <div key={item.business_year} className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-slate-500">
                                <span>{item.business_year}년</span>
                                <span>매출 {formatCompact(item.revenue)}</span>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500"><span>매출</span><span>{formatCompact(item.revenue)}</span></div>
                                    <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.max(((Number(item.revenue) || 0) / amountMax) * 100, 3)}%` }} /></div>
                                </div>
                                <div>
                                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500"><span>영업이익</span><span>{formatCompact(item.operating_income)}</span></div>
                                    <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(((Math.abs(Number(item.operating_income)) || 0) / amountMax) * 100, 3)}%` }} /></div>
                                </div>
                                <div>
                                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500"><span>순이익</span><span>{formatCompact(item.net_income)}</span></div>
                                    <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.max(((Math.abs(Number(item.net_income)) || 0) / amountMax) * 100, 3)}%` }} /></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4">
                <div className="text-sm font-black text-slate-900">비율 추이</div>
                <div className="mt-4 space-y-3">
                    {items.map((item) => (
                        <div key={`${item.business_year}-ratio`} className="rounded-2xl bg-slate-50 p-4">
                            <div className="text-xs font-black text-slate-400">{item.business_year}년</div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold text-slate-700">
                                <div>영업이익률 <span className={toneByValue(item.profit_margin)}>{formatPercent(item.profit_margin)}</span></div>
                                <div>ROE <span className={toneByValue(item.return_on_equity)}>{formatPercent(item.return_on_equity)}</span></div>
                                <div>부채비율 <span className="text-slate-900">{formatPercent(item.debt_ratio)}</span></div>
                                <div>유동비율 <span className={toneByValue(item.current_ratio)}>{formatPercent(item.current_ratio)}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const QuarterlyEarningsGrid = ({ items }) => {
    const quarters = Array.isArray(items) ? items : [];

    if (!quarters.length) {
        return <EmptySlot message="최근 분기 실적 데이터가 없습니다." />;
    }

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quarters.map((item) => (
                <article key={item.period_label || `${item.business_year}-${item.quarter}`} className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{item.period_label || `${item.business_year} ${item.quarter}`}</div>
                    <div className="mt-4 space-y-3 text-sm font-bold text-slate-700">
                        <div className="flex items-center justify-between gap-3"><span>매출</span><span className="text-slate-900">{formatCompact(item.revenue)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>영업이익</span><span className={toneByValue(item.operating_income)}>{formatCompact(item.operating_income)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>순이익</span><span className={toneByValue(item.net_income)}>{formatCompact(item.net_income)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>영업이익률</span><span className={toneByValue(item.operating_margin)}>{formatPercent(item.operating_margin)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>순이익률</span><span className={toneByValue(item.net_margin)}>{formatPercent(item.net_margin)}</span></div>
                    </div>
                </article>
            ))}
        </div>
    );
};

const SymbolSuggestBox = ({ market, value, onChange, onSelect }) => {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const rootRef = useRef(null);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    useEffect(() => {
        const keyword = value.trim();
        const formattedSelection = /\([A-Za-z0-9._-]+\)$/.test(keyword);
        if (keyword.length < 2 || formattedSelection) {
            setItems([]);
            setOpen(false);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await api.get("/invest/symbols/suggest", {
                    params: { market, query: keyword, limit: 5 },
                });
                if (!cancelled) {
                    setItems(Array.isArray(unwrapData(response)?.items) ? unwrapData(response).items : []);
                    setOpen(true);
                }
            } catch {
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [market, value]);

    return (
        <div ref={rootRef}>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">종목 검색</label>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input className="input-base pl-10" value={value} onChange={(event) => onChange(event.target.value)} onFocus={() => items.length && setOpen(true)} placeholder={market === "KR" ? "회사명, ETF명, 종목코드" : "회사명, ETF명, 티커"} />
                {open ? (
                    <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl">
                        {loading ? <div className="px-3 py-2 text-xs font-semibold text-slate-400">검색 중...</div> : null}
                        {!loading && items.map((item, index) => (
                            <button key={`${item.symbol}-${index}`} type="button" className="block w-full rounded-xl px-3 py-3 text-left hover:bg-slate-50" onClick={() => { onSelect(item); setOpen(false); }}>
                                <div className="text-sm font-black text-slate-900">{item.display_name || item.company_name || item.symbol}</div>
                                <div className="mt-1 text-xs font-medium text-slate-500">{[item.company_name, item.symbol].filter(Boolean).join(" · ") || item.symbol}</div>
                            </button>
                        ))}
                        {!loading && items.length === 0 ? <div className="px-3 py-2 text-xs font-semibold text-slate-400">일치하는 종목이 없습니다.</div> : null}
                    </div>
                ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS[market].map((preset) => (
                    <button key={preset} type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600" onClick={() => onSelect({ symbol: preset, company_name: preset })}>{preset}</button>
                ))}
            </div>
        </div>
    );
};

export const InvestAssistant = () => {
    const [market, setMarket] = useState("KR");
    const [symbolInput, setSymbolInput] = useState("삼성전자(005930)");
    const [selectedSymbol, setSelectedSymbol] = useState("005930");
    const [compareInput, setCompareInput] = useState("");
    const [v1, setV1] = useState(null);
    const [v2, setV2] = useState(null);
    const [v3, setV3] = useState(null);
    const [chartInterval, setChartInterval] = useState("DAY");
    const [chartData, setChartData] = useState(null);
    const [chartLoading, setChartLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const currentMarket = useMemo(() => MARKETS.find((item) => item.value === market) || MARKETS[0], [market]);
    const price = v3?.price_snapshot || v2?.price_snapshot || v1?.price_snapshot;
    const summary = v3?.financial_summary || v2?.financial_summary || v1?.financial_summary;
    const opinion = v2?.opinion || v1?.opinion;
    const recommendation = v3?.recommendation;
    const currency = chartData?.currency || summary?.currency || (market === "US" ? "USD" : "KRW");
    const newsIssues = v3?.news_issues || v2?.news_issues || [];
    const limitations = [...(v3?.limitations || v2?.limitations || v1?.limitations || []), ...(chartData?.limitations || [])];
    const isKr = market === "KR";
    const krFinancial = v3?.kr_financial_snapshot;
    const krFinancialHistory = v3?.kr_financial_history || [];
    const krQuarterlyEarnings = v3?.kr_quarterly_earnings || [];
    const dividend = v3?.dividend_snapshot;

    const fetchChart = async (nextMarket, symbol, interval, fallbackSource = {}) => {
        setChartLoading(true);
        try {
            const response = await api.get("/invest/chart", { params: { market: nextMarket, symbol, interval } });
            const nextChart = unwrapData(response);
            if (Array.isArray(nextChart?.points) && nextChart.points.length) {
                setChartData(nextChart);
                return;
            }
            throw new Error("Chart points are empty");
        } catch (fetchError) {
            const fallbackChart = buildFallbackChart({ market: nextMarket, symbol, interval, priceSnapshot: fallbackSource.priceSnapshot, currency: fallbackSource.currency, source: fallbackSource.source });
            if (fallbackChart) {
                setChartData(fallbackChart);
                toast.error(fetchError?.response?.data?.message || "차트 히스토리를 불러오지 못해 현재가 기준으로 대체 표시합니다.");
            } else {
                setChartData(null);
                toast.error(fetchError?.response?.data?.message || "차트 데이터를 불러오지 못했습니다.");
            }
        } finally {
            setChartLoading(false);
        }
    };

    const fetchAnalysis = async ({ silent = false } = {}) => {
        const symbol = normalizeSymbol(selectedSymbol || symbolInput);
        if (!symbol) {
            toast.error("종목을 선택하거나 입력해 주세요.");
            return;
        }

        const compareSymbols = compareInput.split(",").map((item) => normalizeSymbol(item)).filter(Boolean).slice(0, 3);

        setLoading(true);
        setError("");

        try {
            const [r1, r2, r3] = await Promise.all([
                api.get("/invest/analysis", { params: { market, symbol } }),
                api.get("/invest/analysis/v2", { params: { market, symbol, compare_symbols: compareSymbols } }),
                api.get("/invest/analysis/v3", { params: { market, symbol, compare_symbols: compareSymbols } }),
            ]);

            const nextV1 = unwrapData(r1);
            const nextV2 = unwrapData(r2);
            const nextV3 = unwrapData(r3);
            const nextPrice = nextV3?.price_snapshot || nextV2?.price_snapshot || nextV1?.price_snapshot;
            const nextSummary = nextV3?.financial_summary || nextV2?.financial_summary || nextV1?.financial_summary;

            setSelectedSymbol(symbol);
            setV1(nextV1);
            setV2(nextV2);
            setV3(nextV3);

            await fetchChart(market, symbol, chartInterval, {
                priceSnapshot: nextPrice,
                currency: nextSummary?.currency || (market === "US" ? "USD" : "KRW"),
                source: nextPrice?.source,
            });

            if (!silent) {
                toast.success(`${market === "KR" ? "국내" : "미국"} 투자 분석을 불러왔습니다.`);
            }
        } catch (fetchError) {
            setV1(null);
            setV2(null);
            setV3(null);
            setChartData(null);
            setError(fetchError?.response?.data?.message || "투자 분석 데이터를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const selectSymbol = (item) => {
        const symbol = normalizeSymbol(item?.symbol);
        setSelectedSymbol(symbol);
        setSymbolInput(item?.display_name || item?.company_name || symbol);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <section className="card bg-white p-6 sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-sky-700"><Bot className="h-3.5 w-3.5" />Invest Workspace</div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">회사명이나 ETF명으로 검색해 국내와 미국 종목을 한 화면에서 분석합니다.</h1>
                <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">종목 검색 후 현재가, 일봉/주봉/월봉 차트, 기본 분석, 뉴스, 추천 레이어까지 한 번에 확인할 수 있습니다.</p>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {MARKETS.map((item) => {
                            const Icon = item.icon;
                            const active = market === item.value;
                            return (
                                <button key={item.value} type="button" className={`rounded-[2rem] border p-4 text-left ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`} onClick={() => { const preset = PRESETS[item.value][0]; setMarket(item.value); setSelectedSymbol(preset); setSymbolInput(preset); setCompareInput(""); setChartInterval("DAY"); setChartData(null); }}>
                                    <Icon className="h-5 w-5" />
                                    <div className="mt-3 text-lg font-black">{item.label}</div>
                                    <div className={`mt-1 text-xs font-medium ${active ? "text-slate-300" : "text-slate-400"}`}>{item.helper}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                        <div className="text-sm font-black text-slate-900">{currentMarket.label} 시장</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">{price?.source === "KIS" ? "KIS 실시간 시세 응답을 사용 중입니다." : "가용 provider 기준 응답을 사용 중입니다."}</div>
                        <div className="mt-4 space-y-4">
                            <SymbolSuggestBox market={market} value={symbolInput} onChange={(value) => { setSymbolInput(value); setSelectedSymbol(""); }} onSelect={selectSymbol} />
                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">비교 종목</label>
                                <input className="input-base" value={compareInput} onChange={(event) => setCompareInput(event.target.value)} placeholder={market === "KR" ? "예: 000660, 035420" : "예: MSFT, NVDA"} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <button type="button" className="btn-primary" onClick={() => fetchAnalysis()} disabled={loading}>{loading ? "분석 조회 중..." : "분석 시작"}</button>
                                <button type="button" className="btn-secondary" onClick={() => fetchAnalysis({ silent: true })} disabled={loading}><RefreshCw className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {loading ? <LoadingSpinner size="lg" text="투자 분석 데이터를 불러오는 중입니다..." /> : null}
            {error ? <ErrorMessage message={error} onRetry={() => fetchAnalysis()} /> : null}
            {!loading && !error && !v1 ? <section className="card bg-white p-8 text-center"><Sparkles className="mx-auto h-10 w-10 text-primary-500" /><h2 className="mt-3 text-2xl font-black text-slate-900">종목을 검색하고 분석을 시작해 주세요.</h2></section> : null}

            {v1 ? (
                <>
                    <Card title={v1.company_name || v1.symbol} subtitle={`${v1.market} · ${v1.symbol}`}>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {price?.source ? <Badge className="bg-sky-100 text-sky-700">시세 {price.source}</Badge> : null}
                            {summary?.source ? <Badge className="bg-slate-100 text-slate-700">재무 {summary.source}</Badge> : null}
                            {chartData?.source ? <Badge className="bg-indigo-100 text-indigo-700">차트 {chartData.source}</Badge> : null}
                            {v3 ? <Badge className="bg-violet-100 text-violet-700">추천 V3</Badge> : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">현재가</div><div className="mt-1 text-lg font-black text-slate-900">{price?.price != null ? formatCurrency(price.price, currency) : "-"}</div></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">등락률</div><div className={`mt-1 text-lg font-black ${toneByValue(price?.change_percent)}`}>{price?.change_percent != null ? formatPercent(price.change_percent) : "-"}</div></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{isKr ? "현재 배당수익률" : "시가총액"}</div><div className="mt-1 text-lg font-black text-slate-900">{isKr ? (dividend?.dividend_yield != null ? formatPercent(dividend.dividend_yield) : "-") : (summary?.market_cap != null ? formatCompact(summary.market_cap) : "-")}</div></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{isKr ? "배당금" : "매출 성장률"}</div><div className={`mt-1 text-lg font-black ${isKr ? "text-slate-900" : toneByValue(summary?.revenue_growth_rate)}`}>{isKr ? (dividend?.dividend_per_share != null ? formatCurrency(dividend.dividend_per_share, "KRW") : "-") : (summary?.revenue_growth_rate != null ? formatPercent(summary.revenue_growth_rate) : "-")}</div></div>
                        </div>
                    </Card>

                    <Card title="현재가 차트" subtitle="종목 검색 후 일봉, 주봉, 월봉으로 전환할 수 있습니다.">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {CHART_INTERVALS.map((item) => (
                                <button key={item.value} type="button" className={`rounded-full px-4 py-2 text-sm font-black ${chartInterval === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => { setChartInterval(item.value); if (selectedSymbol) { fetchChart(market, selectedSymbol, item.value, { priceSnapshot: price, currency: summary?.currency || (market === "US" ? "USD" : "KRW"), source: price?.source }); } }} disabled={chartLoading}>{item.label}</button>
                            ))}
                        </div>
                        {chartLoading ? <LoadingSpinner text="차트 데이터를 불러오는 중입니다..." /> : <CandlestickChart points={chartData?.points} currency={currency} />}
                    </Card>

                    {isKr ? (
                        <Card title="최근 3개년 재무 추이" subtitle="DART 최근 연간 결산 기준 매출, 영업이익, 순이익과 비율 흐름">
                            <FinancialTrendBars history={krFinancialHistory} />
                        </Card>
                    ) : null}

                    {isKr ? (
                        <Card title="최근 분기 실적" subtitle="DART 최근 4개 분기 기준 매출, 영업이익, 순이익">
                            <QuarterlyEarningsGrid items={krQuarterlyEarnings} />
                        </Card>
                    ) : null}

                    <div className={`grid gap-5 ${isKr ? "xl:grid-cols-2" : "xl:grid-cols-3"}`}>
                        <Card title="기본 의견" subtitle="수익성, 안정성, 배당 해석을 함께 반영한 의견">
                            <div className="flex flex-wrap gap-2">
                                {opinion?.signal ? <Badge className={toneBySignal(opinion.signal)}>{opinion.signal}</Badge> : null}
                                {opinion?.score != null ? <Badge className="bg-slate-100 text-slate-700">점수 {opinion.score}</Badge> : null}
                                {dividend?.dividend_label && isKr ? <Badge className="bg-emerald-100 text-emerald-700">{dividend.dividend_label}</Badge> : null}
                            </div>
                            <p className="mt-4 text-sm leading-relaxed text-slate-600">{opinion?.summary || "의견 정보가 없습니다."}</p>
                        </Card>

                        {isKr ? (
                            <Card title="핵심 재무 지표" subtitle="최근 결산 기준 수익성, 안정성, 성장성 요약">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">매출</div><div className="mt-1 text-base font-black text-slate-900">{krFinancial?.revenue != null ? formatCompact(krFinancial.revenue) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">영업이익</div><div className="mt-1 text-base font-black text-slate-900">{krFinancial?.operating_income != null ? formatCompact(krFinancial.operating_income) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">순이익</div><div className="mt-1 text-base font-black text-slate-900">{krFinancial?.net_income != null ? formatCompact(krFinancial.net_income) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">영업이익률</div><div className={`mt-1 text-base font-black ${toneByValue(krFinancial?.profit_margin)}`}>{krFinancial?.profit_margin != null ? formatPercent(krFinancial.profit_margin) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">ROE</div><div className={`mt-1 text-base font-black ${toneByValue(krFinancial?.return_on_equity)}`}>{krFinancial?.return_on_equity != null ? formatPercent(krFinancial.return_on_equity) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">부채비율</div><div className="mt-1 text-base font-black text-slate-900">{krFinancial?.debt_ratio != null ? formatPercent(krFinancial.debt_ratio) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">유동비율</div><div className={`mt-1 text-base font-black ${toneByValue(krFinancial?.current_ratio)}`}>{krFinancial?.current_ratio != null ? formatPercent(krFinancial.current_ratio) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">매출 성장률</div><div className={`mt-1 text-base font-black ${toneByValue(krFinancial?.revenue_growth_rate)}`}>{krFinancial?.revenue_growth_rate != null ? formatPercent(krFinancial.revenue_growth_rate) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">영업이익 성장률</div><div className={`mt-1 text-base font-black ${toneByValue(krFinancial?.operating_income_growth_rate)}`}>{krFinancial?.operating_income_growth_rate != null ? formatPercent(krFinancial.operating_income_growth_rate) : "-"}</div></div>
                                </div>
                            </Card>
                        ) : null}

                        {isKr ? (
                            <Card title="강점과 주의 포인트" subtitle="기본 의견에서 읽어낸 핵심 포인트">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50/70 p-4">
                                        <div className="text-sm font-black text-emerald-700">강점</div>
                                        <div className="mt-3 space-y-2">
                                            {opinion?.positives?.length ? opinion.positives.map((item, index) => <p key={`${item}-${index}`} className="text-sm font-medium leading-relaxed text-emerald-900">• {item}</p>) : <p className="text-sm font-medium text-emerald-900">표시할 강점이 없습니다.</p>}
                                        </div>
                                    </div>
                                    <div className="rounded-[1.6rem] border border-rose-100 bg-rose-50/70 p-4">
                                        <div className="text-sm font-black text-rose-700">주의 포인트</div>
                                        <div className="mt-3 space-y-2">
                                            {opinion?.risks?.length ? opinion.risks.map((item, index) => <p key={`${item}-${index}`} className="text-sm font-medium leading-relaxed text-rose-900">• {item}</p>) : <p className="text-sm font-medium text-rose-900">표시할 주의 포인트가 없습니다.</p>}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ) : null}

                        {isKr ? (
                            <Card title="배당 정보" subtitle="DART 배당 + KIS 현재가 기준">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">주당 배당금</div><div className="mt-1 text-base font-black text-slate-900">{dividend?.dividend_per_share != null ? formatCurrency(dividend.dividend_per_share, "KRW") : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">현재 배당수익률</div><div className="mt-1 text-base font-black text-slate-900">{dividend?.dividend_yield != null ? formatPercent(dividend.dividend_yield) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">배당 성장률</div><div className={`mt-1 text-base font-black ${toneByValue(dividend?.dividend_growth_rate)}`}>{dividend?.dividend_growth_rate != null ? formatPercent(dividend.dividend_growth_rate) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">현금배당성향</div><div className="mt-1 text-base font-black text-slate-900">{dividend?.dividend_payout_ratio != null ? formatPercent(dividend.dividend_payout_ratio) : "-"}</div></div>
                                </div>
                                {dividend?.history?.length ? (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        {dividend.history.map((item) => (
                                            <div key={`${item.business_year}-${item.dividend_per_share || 0}`} className="rounded-2xl border border-slate-100 bg-white p-4">
                                                <div className="text-xs font-black text-slate-400">{item.business_year}년 DPS</div>
                                                <div className="mt-1 text-base font-black text-slate-900">{item.dividend_per_share != null ? formatCurrency(item.dividend_per_share, "KRW") : "-"}</div>
                                                <div className="mt-2 text-xs font-medium text-slate-500">공시 배당수익률 {item.reported_dividend_yield != null ? formatPercent(item.reported_dividend_yield) : "-"}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <EmptySlot message="배당 이력 데이터가 없습니다." />}
                            </Card>
                        ) : null}

                        <Card title="추천 레이어" subtitle="v3 recommendation">
                            {recommendation ? (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge className={toneBySignal(recommendation.signal)}>{recommendation.signal}</Badge>
                                        <Badge className="bg-slate-100 text-slate-700">신뢰도 {recommendation.confidence ?? 0}</Badge>
                                    </div>
                                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="flex h-full w-full"><div className="bg-emerald-500" style={{ width: `${recommendation.buy_percent ?? 0}%` }} /><div className="bg-amber-400" style={{ width: `${recommendation.neutral_percent ?? 0}%` }} /><div className="bg-rose-500" style={{ width: `${recommendation.sell_percent ?? 0}%` }} /></div></div>
                                    <p className="mt-4 text-sm leading-relaxed text-slate-600">{recommendation.summary}</p>
                                </>
                            ) : <EmptySlot message="v3 추천 데이터가 없습니다." />}
                        </Card>

                        <Card title={isKr ? "보조 진단값" : "v3 진단값"} subtitle={isKr ? "재무, 배당, 뉴스 기반 보조 해석" : "valuation / sentiment / ETF 힌트"}>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">밸류 레이블</div><div className="mt-1 text-base font-black text-slate-900">{v3?.valuation?.valuation_label || "-"}</div></div>
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">평균 감성</div><div className="mt-1 text-base font-black text-slate-900">{v3?.sentiment_snapshot?.average_sentiment_score != null ? formatCompact(v3.sentiment_snapshot.average_sentiment_score, 3) : "-"}</div></div>
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">기사 수</div><div className="mt-1 text-base font-black text-slate-900">{v3?.sentiment_snapshot?.article_count ?? "-"}</div></div>
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">ETF 추정</div><div className="mt-1 text-base font-black text-slate-900">{v3?.etf_profile?.etf ? "ETF 가능성 있음" : "일반 종목 분석"}</div></div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                        <Card title="뉴스 / 이슈" subtitle="v2/v3 issue 카드">
                            <div className="space-y-3">
                                {newsIssues.length ? newsIssues.map((item, index) => (
                                    <article key={`${item.url || item.title || "news"}-${index}`} className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-black leading-snug text-slate-900">{item.title}</div>
                                                <div className="mt-1 text-xs font-medium text-slate-400">{item.source || "SOURCE"}{item.published_at ? ` · ${formatDate(item.published_at)}` : ""}</div>
                                            </div>
                                            {item.sentiment_label ? <Badge className="bg-slate-900 text-white">{item.sentiment_label}</Badge> : null}
                                        </div>
                                        <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.summary || "요약 정보가 제공되지 않았습니다."}</p>
                                        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary-600">원문 보기<ArrowUpRight className="h-4 w-4" /></a> : null}
                                    </article>
                                )) : <EmptySlot message="뉴스 또는 이슈 데이터가 없습니다." />}
                            </div>
                        </Card>

                        <Card title="제약사항 / 섹션 상태" subtitle="provider 상태와 available sections">
                            <div className="space-y-3">
                                {limitations.length ? limitations.map((item, index) => (
                                    <div key={`${item}-${index}`} className="flex gap-3 rounded-[1.4rem] border border-amber-100 bg-amber-50/70 p-4"><CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" /><p className="text-sm font-medium leading-relaxed text-amber-900">{item}</p></div>
                                )) : <EmptySlot message="현재 표시할 limitation 정보가 없습니다." />}
                            </div>
                            {v3?.available_sections?.length ? <div className="mt-5 flex flex-wrap gap-2">{v3.available_sections.map((item) => <Badge key={item} className="bg-slate-900 text-white">{item}</Badge>)}</div> : null}
                        </Card>
                    </div>
                </>
            ) : null}
        </div>
    );
};








