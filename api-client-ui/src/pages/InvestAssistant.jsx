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
    { value: "US", label: "미국", helper: "KIS 시세, SEC EDGAR 재무/배당, KIS 기술지표", icon: Globe2 },
];

const PRESETS = {
    KR: ["005930", "000660", "035420"],
    US: ["AAPL", "MSFT", "NVDA"],
};

const AVAILABLE_SECTION_LABELS = {
    overview: "기업 개요",
    financial_summary: "재무 요약",
    price_snapshot: "시세 스냅샷",
    dividend_snapshot: "배당 스냅샷",
    kr_financial_history: "국내 재무 추이",
    kr_quarterly_earnings: "국내 분기 실적",
    technical_indicators: "기술 지표",
    news_issues: "뉴스 / 이슈",
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

const formatAvailableSection = (value) => AVAILABLE_SECTION_LABELS[value] || value;

const formatValuationLabel = (value) => {
    const labels = {
        VALUE_ZONE: "저평가 구간",
        FAIR_VALUE: "적정 가치",
        PREMIUM: "프리미엄 구간",
        LOSS_MAKING: "적자 구간",
        UNAVAILABLE: "산출 불가",
    };
    return labels[value] || value || "-";
};

const formatProviderDetail = (value) => {
    if (!value) return "-";

    const exactMatches = {
        "SEC EDGAR request failed": "SEC EDGAR 요청이 실패했습니다.",
        "SEC EDGAR returned empty response": "SEC EDGAR 응답이 비어 있습니다.",
        "unexpected provider error": "예기치 않은 제공자 오류",
    };

    return exactMatches[value] || value;
};

const formatLimitation = (value) => {
    if (!value) return "-";

    const replacements = [
        {
            pattern: /^KR KIS quote issue:\s*(.+)$/i,
            format: (_, detail) => `국내 KIS 시세 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^US KIS quote issue:\s*(.+)$/i,
            format: (_, detail) => `미국 KIS 시세 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^US SEC fundamentals\/overview provider issue:\s*(.+)$/i,
            format: (_, detail) => `미국 SEC 재무/기업개요 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^US overview\/fundamentals provider issue:\s*(.+)$/i,
            format: (_, detail) => `미국 기업 개요/기초지표 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^US technical-indicator provider issue:\s*(.+)$/i,
            format: (_, detail) => `미국 기술지표 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^US news provider issue:\s*(.+)$/i,
            format: (_, detail) => `미국 뉴스 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^US dividends\/financial statements provider issue:\s*(.+)$/i,
            format: (_, detail) => `미국 배당/재무제표 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^KR news provider issue:\s*(.+)$/i,
            format: (_, detail) => `국내 뉴스 제공자 오류: ${formatProviderDetail(detail)}`,
        },
        {
            pattern: /^KR comparison skipped for\s+(.+?):\s*(.+)$/i,
            format: (_, symbol, detail) => `국내 비교 종목 ${symbol} 조회를 건너뜀: ${detail}`,
        },
        {
            pattern: /^US comparison skipped for\s+(.+?):\s*(.+)$/i,
            format: (_, symbol, detail) => `미국 비교 종목 ${symbol} 조회를 건너뜀: ${detail}`,
        },
    ];

    for (const replacement of replacements) {
        const match = value.match(replacement.pattern);
        if (match) {
            return replacement.format(...match);
        }
    }

    const exactMatches = {
        "KR analysis uses annual DART financial statements for fundamentals.": "국내 분석은 연간 DART 재무제표를 기준으로 기초지표를 계산합니다.",
        "KR technical indicators and issue scoring are not integrated yet.": "국내 기술 지표와 이슈 점수는 아직 연동되지 않았습니다.",
        "KR v2 uses DART annual financial summary and Naver news search results.": "국내 v2 분석은 DART 연간 재무 요약과 네이버 뉴스 검색 결과를 사용합니다.",
        "KR technical indicators still need a historical market-data provider.": "국내 기술 지표는 과거 시세 데이터 제공자 연동이 추가로 필요합니다.",
        "KR real-time quote is empty until KIS app key/app secret are configured.": "국내 실시간 시세는 KIS 앱 키/시크릿 설정 전까지 비어 있습니다.",
        "KR technical indicators, ETF holdings, and analyst consensus are not integrated yet.": "국내 기술 지표, ETF 보유내역, 애널리스트 컨센서스는 아직 연동되지 않았습니다.",
        "KR chart uses KIS daily history.": "국내 차트는 KIS 일봉 이력을 사용합니다.",
        "US chart uses KIS daily history.": "미국 차트는 KIS 일봉 이력을 사용합니다.",
        "US chart fell back to a single KIS snapshot candle because KIS daily history was unavailable.": "미국 차트는 KIS 일봉 이력을 사용할 수 없어 단일 KIS 스냅샷 봉으로 대체되었습니다.",
        "US fundamentals/overview provider issue: unexpected provider error": "미국 기초지표/기업 개요 제공자 오류: 예기치 않은 제공자 오류",
        "US real-time quote is using fallback data until KIS credentials are configured.": "미국 실시간 시세는 KIS 인증정보 설정 전까지 대체 데이터를 사용합니다.",
        "US v3 uses SEC EDGAR annual filing data and KIS market data.": "미국 v3 분석은 SEC EDGAR 연간 공시 데이터와 KIS 시세 데이터를 사용합니다.",
        "US news sentiment, fund flows, options activity, and analyst consensus are not integrated yet.": "미국 뉴스 감성, 자금 유입, 옵션 활동, 애널리스트 컨센서스는 아직 연동되지 않았습니다.",
        "Intraday depth, earnings calendar, analyst revisions, and ETF holdings are not integrated yet.": "장중 호가, 실적 캘린더, 애널리스트 리비전, ETF 보유내역은 아직 연동되지 않았습니다.",
        "Provider rate limits can affect burst traffic; server caching and fallback tiers are the next step.": "제공자 호출 제한으로 순간 트래픽 영향이 있을 수 있으며, 다음 단계는 서버 캐시와 대체 계층 강화입니다.",
        "ETF holdings, analyst estimates, and earnings-calendar signals are not integrated yet.": "ETF 보유내역, 애널리스트 추정치, 실적 캘린더 신호는 아직 연동되지 않았습니다.",
        "ETF holdings, fund flows, options activity, and analyst consensus are not integrated yet.": "ETF 보유내역, 자금 유입, 옵션 활동, 애널리스트 컨센서스는 아직 연동되지 않았습니다.",
    };

    return exactMatches[value] || value;
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
    <section className="card bg-white p-4 sm:p-6">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
        <div className="mt-4 sm:mt-5">{children}</div>
    </section>
);

const EmptySlot = ({ message }) => (
    <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm font-medium text-slate-400">
        {message}
    </div>
);

const DEFAULT_VISIBLE_INDICATORS = {
    sma: true,
    bollinger: true,
    rsi: true,
    macd: true,
};

const INDICATOR_STORAGE_KEY = "invest-chart-indicators-v1";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SYMBOL_SUGGEST_DISPLAY_LIMIT = 2;

const buildIndicatorSeries = (points) => {
    const source = Array.isArray(points) ? points : [];
    const toEmaSeries = (values, period) => {
        const multiplier = 2 / (period + 1);
        let ema = null;
        return values.map((value, index) => {
            if (!Number.isFinite(value)) return null;
            if (index + 1 < period) return null;
            if (index + 1 === period) {
                ema = values.slice(0, period).reduce((acc, current) => acc + current, 0) / period;
                return ema;
            }
            ema = ((value - ema) * multiplier) + ema;
            return ema;
        });
    };

    const base = source
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

    const closes = base.map((item) => item.close);
    const ema12Series = toEmaSeries(closes, 12);
    const ema26Series = toEmaSeries(closes, 26);
    const macdSeries = closes.map((_, index) => {
        const ema12 = ema12Series[index];
        const ema26 = ema26Series[index];
        return Number.isFinite(ema12) && Number.isFinite(ema26) ? ema12 - ema26 : null;
    });
    const signalBase = toEmaSeries(macdSeries.map((value) => Number.isFinite(value) ? value : 0), 9);
    const signalSeries = signalBase.map((value, index) => Number.isFinite(macdSeries[index]) ? value : null);

    const gains = [null];
    const losses = [null];
    for (let index = 1; index < closes.length; index += 1) {
        const delta = closes[index] - closes[index - 1];
        gains.push(Math.max(delta, 0));
        losses.push(Math.max(-delta, 0));
    }

    return base.map((item, index) => {
        const average = (period) => {
            if (index + 1 < period) return null;
            const slice = base.slice(index - period + 1, index + 1);
            return slice.reduce((acc, current) => acc + current.close, 0) / period;
        };
        const standardDeviation = (period, mean) => {
            if (index + 1 < period || !Number.isFinite(mean)) return null;
            const slice = base.slice(index - period + 1, index + 1);
            const variance = slice.reduce((acc, current) => acc + ((current.close - mean) ** 2), 0) / period;
            return Math.sqrt(variance);
        };
        const computeRsi = (period) => {
            if (index < period) return null;
            const avgGain = gains.slice(index - period + 1, index + 1).reduce((acc, current) => acc + current, 0) / period;
            const avgLoss = losses.slice(index - period + 1, index + 1).reduce((acc, current) => acc + current, 0) / period;
            if (avgLoss === 0) return 100;
            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        };

        const sma5 = average(5);
        const sma20 = average(20);
        const deviation20 = standardDeviation(20, sma20);
        const bollingerUpper = Number.isFinite(sma20) && Number.isFinite(deviation20) ? sma20 + (deviation20 * 2) : null;
        const bollingerLower = Number.isFinite(sma20) && Number.isFinite(deviation20) ? sma20 - (deviation20 * 2) : null;
        const macd = macdSeries[index];
        const signal = signalSeries[index];
        const histogram = Number.isFinite(macd) && Number.isFinite(signal) ? macd - signal : null;

        return {
            ...item,
            sma5,
            sma20,
            bollingerUpper,
            bollingerLower,
            rsi14: computeRsi(14),
            macd,
            macdSignal: signal,
            macdHistogram: histogram,
        };
    });
};

const analyzeIndicatorState = (points) => {
    const series = buildIndicatorSeries(points);
    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;

    if (!latest) {
        return { messages: [], score: null, label: "", details: [] };
    }

    let scoreDelta = 0;
    const messages = [];
    const details = [];

    if (Number.isFinite(latest.rsi14)) {
        if (latest.rsi14 >= 70) {
            scoreDelta -= 8;
            messages.push(`RSI 14가 ${latest.rsi14.toFixed(1)}로 과열 구간입니다. 기준선 70 상단입니다.`);
            details.push(`RSI ${latest.rsi14.toFixed(1)} > 70: -8점`);
        } else if (latest.rsi14 <= 30) {
            scoreDelta += 8;
            messages.push(`RSI 14가 ${latest.rsi14.toFixed(1)}로 과매도 구간입니다. 기준선 30 하단입니다.`);
            details.push(`RSI ${latest.rsi14.toFixed(1)} < 30: +8점`);
        } else if (latest.rsi14 >= 55) {
            scoreDelta += 3;
            messages.push(`RSI 14는 ${latest.rsi14.toFixed(1)}로 기준선 50 위 강세권입니다.`);
            details.push(`RSI ${latest.rsi14.toFixed(1)} >= 55: +3점`);
        } else if (latest.rsi14 <= 45) {
            scoreDelta -= 3;
            messages.push(`RSI 14는 ${latest.rsi14.toFixed(1)}로 기준선 50 아래 약세권입니다.`);
            details.push(`RSI ${latest.rsi14.toFixed(1)} <= 45: -3점`);
        } else {
            messages.push(`RSI 14는 ${latest.rsi14.toFixed(1)}로 30~70 중립 구간입니다.`);
            details.push(`RSI ${latest.rsi14.toFixed(1)} 중립: 0점`);
        }
    }

    if (
        previous
        && Number.isFinite(previous.macd)
        && Number.isFinite(previous.macdSignal)
        && Number.isFinite(latest.macd)
        && Number.isFinite(latest.macdSignal)
    ) {
        const prevSpread = previous.macd - previous.macdSignal;
        const latestSpread = latest.macd - latest.macdSignal;

        if (prevSpread <= 0 && latestSpread > 0) {
            scoreDelta += 10;
            messages.push("MACD가 시그널선을 상향 돌파했습니다. 0선 기준 단기 골든크로스 신호입니다.");
            details.push("MACD 골든크로스: +10점");
        } else if (prevSpread >= 0 && latestSpread < 0) {
            scoreDelta -= 10;
            messages.push("MACD가 시그널선을 하향 이탈했습니다. 0선 기준 단기 데드크로스 신호입니다.");
            details.push("MACD 데드크로스: -10점");
        } else if (latest.macd > latest.macdSignal && latest.macd >= 0) {
            scoreDelta += 6;
            messages.push("MACD와 시그널이 0선 위에서 움직여 상대적으로 강한 모멘텀입니다.");
            details.push("MACD > Signal and > 0: +6점");
        } else if (latest.macd < latest.macdSignal && latest.macd <= 0) {
            scoreDelta -= 6;
            messages.push("MACD와 시그널이 0선 아래에 머물러 약한 모멘텀입니다.");
            details.push("MACD < Signal and < 0: -6점");
        } else if (latest.macd > latest.macdSignal && latest.macd < 0) {
            messages.push("MACD가 시그널선 위로 올라왔지만 아직 0선 아래라 약세 구간에서 반등을 시도하는 모습입니다.");
            details.push("MACD 반등 시도 구간: 0점");
        } else if (latest.macd < latest.macdSignal && latest.macd > 0) {
            messages.push("MACD가 시그널선 아래로 내려왔지만 아직 0선 위라 강세 구간에서 단기 숨 고르기 흐름입니다.");
            details.push("MACD 강세 둔화 구간: 0점");
        } else {
            messages.push("MACD가 0선 부근에서 방향성을 탐색 중이라 뚜렷한 추세 우위는 아직 약합니다.");
            details.push("MACD 방향성 탐색 구간: 0점");
        }
    }

    if (Number.isFinite(latest.close) && Number.isFinite(latest.bollingerUpper) && Number.isFinite(latest.bollingerLower)) {
        if (latest.close >= latest.bollingerUpper) {
            scoreDelta -= 6;
            messages.push("종가가 볼린저 상단 밴드에 닿아 단기 과열 여부를 점검할 구간입니다.");
            details.push("종가 >= 볼린저 상단: -6점");
        } else if (latest.close <= latest.bollingerLower) {
            scoreDelta += 6;
            messages.push("종가가 볼린저 하단 밴드에 닿아 기술적 반등 가능성을 볼 수 있습니다.");
            details.push("종가 <= 볼린저 하단: +6점");
        } else if (latest.close >= latest.sma20) {
            scoreDelta += 2;
            messages.push("종가가 볼린저 중심선인 20일선 위에 있어 밴드 기준 강한 편입니다.");
            details.push("종가 >= 20일선: +2점");
        } else {
            scoreDelta -= 2;
            messages.push("종가가 볼린저 중심선인 20일선 아래에 있어 밴드 기준 약한 편입니다.");
            details.push("종가 < 20일선: -2점");
        }
    }

    const score = clamp(Math.round(50 + scoreDelta), 0, 100);
    const label = score >= 60 ? "기술 우세" : score <= 40 ? "기술 경계" : "기술 중립";
    return { messages, score, label, details };
};

const buildIndicatorSnapshot = (points) => {
    const series = buildIndicatorSeries(points);
    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;

    if (!latest) {
        return {
            rsiSummary: "차트 데이터가 부족합니다.",
            macdSummary: "차트 데이터가 부족합니다.",
            bollingerSummary: "차트 데이터가 부족합니다.",
        };
    }

    let rsiSummary = "RSI 해석 데이터가 부족합니다.";
    if (Number.isFinite(latest.rsi14)) {
        if (latest.rsi14 >= 70) {
            rsiSummary = `과열 구간입니다. 기준선 70 상단인 ${latest.rsi14.toFixed(1)}입니다.`;
        } else if (latest.rsi14 <= 30) {
            rsiSummary = `과매도 구간입니다. 기준선 30 하단인 ${latest.rsi14.toFixed(1)}입니다.`;
        } else if (latest.rsi14 >= 55) {
            rsiSummary = `기준선 50 위 강세권입니다. 현재 ${latest.rsi14.toFixed(1)}입니다.`;
        } else if (latest.rsi14 <= 45) {
            rsiSummary = `기준선 50 아래 약세권입니다. 현재 ${latest.rsi14.toFixed(1)}입니다.`;
        } else {
            rsiSummary = `30~70 중립 구간입니다. 현재 ${latest.rsi14.toFixed(1)}입니다.`;
        }
    }

    let macdSummary = "MACD 해석 데이터가 부족합니다.";
    if (
        previous
        && Number.isFinite(previous.macd)
        && Number.isFinite(previous.macdSignal)
        && Number.isFinite(latest.macd)
        && Number.isFinite(latest.macdSignal)
    ) {
        const prevSpread = previous.macd - previous.macdSignal;
        const latestSpread = latest.macd - latest.macdSignal;
        if (prevSpread <= 0 && latestSpread > 0) {
            macdSummary = "시그널선을 상향 돌파해 단기 골든크로스 신호입니다.";
        } else if (prevSpread >= 0 && latestSpread < 0) {
            macdSummary = "시그널선을 하향 이탈해 단기 데드크로스 신호입니다.";
        } else if (latest.macd > latest.macdSignal && latest.macd >= 0) {
            macdSummary = "0선 위에서 움직여 상대적으로 강한 모멘텀입니다.";
        } else if (latest.macd < latest.macdSignal && latest.macd <= 0) {
            macdSummary = "0선 아래에 머물러 약한 모멘텀입니다.";
        } else if (latest.macd > latest.macdSignal && latest.macd < 0) {
            macdSummary = "시그널선 위로 올라왔지만 아직 0선 아래라 약세 구간 반등 시도 단계입니다.";
        } else if (latest.macd < latest.macdSignal && latest.macd > 0) {
            macdSummary = "시그널선 아래로 내려왔지만 아직 0선 위라 강세 구간의 단기 조정 흐름입니다.";
        } else {
            macdSummary = "0선 부근에서 방향성을 탐색 중이라 뚜렷한 추세 우위가 약합니다.";
        }
    }

    let bollingerSummary = "볼린저 해석 데이터가 부족합니다.";
    if (
        Number.isFinite(latest.close)
        && Number.isFinite(latest.bollingerUpper)
        && Number.isFinite(latest.bollingerLower)
        && Number.isFinite(latest.sma20)
    ) {
        if (latest.close >= latest.bollingerUpper) {
            bollingerSummary = "상단 밴드에 닿아 단기 과열 여부를 점검할 구간입니다.";
        } else if (latest.close <= latest.bollingerLower) {
            bollingerSummary = "하단 밴드에 닿아 기술적 반등 가능성을 볼 수 있습니다.";
        } else if (latest.close >= latest.sma20) {
            bollingerSummary = "중심선인 20일선 위에 있어 밴드 기준 강한 편입니다.";
        } else {
            bollingerSummary = "중심선인 20일선 아래에 있어 밴드 기준 약한 편입니다.";
        }
    }

    return { rsiSummary, macdSummary, bollingerSummary };
};

const formatChartTickLabel = (tradingDate, interval) => {
    if (!tradingDate) return "";
    const [year, month] = String(tradingDate).split("-");
    if (!year || !month) return tradingDate;
    if (interval === "MONTH") {
        return `${year}년`;
    }
    return `${year}년 ${Number(month)}월`;
};

const CandlestickChart = ({ points, currency, interval }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [visibleIndicators, setVisibleIndicators] = useState(() => {
        if (typeof window === "undefined") {
            return DEFAULT_VISIBLE_INDICATORS;
        }
        try {
            const saved = window.localStorage.getItem(INDICATOR_STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : null;
            return parsed ? { ...DEFAULT_VISIBLE_INDICATORS, ...parsed } : DEFAULT_VISIBLE_INDICATORS;
        } catch {
            return DEFAULT_VISIBLE_INDICATORS;
        }
    });

    const candles = useMemo(() => buildIndicatorSeries(points), [points]);
    const indicatorSnapshot = useMemo(() => buildIndicatorSnapshot(points), [points]);
    const visibleCount = interval === "DAY" ? 60 : interval === "WEEK" ? 78 : 36;
    const visibleCandles = useMemo(() => candles.slice(-visibleCount), [candles, visibleCount]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(visibleIndicators));
    }, [visibleIndicators]);

    useEffect(() => {
        setHoveredIndex(null);
    }, [points, interval]);

    if (!visibleCandles.length) {
        return <EmptySlot message="차트 데이터가 없습니다." />;
    }

    const toggleIndicator = (key) => {
        setVisibleIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const width = 820;
    const height = 520;
    const paddingX = 28;
    const paddingTop = 18;
    const gap = 14;
    const candleAreaHeight = 220;
    const volumeAreaHeight = 54;
    const rsiAreaHeight = 74;
    const macdAreaHeight = 86;
    const candleTop = paddingTop;
    const candleBottom = candleTop + candleAreaHeight;
    const volumeTop = candleBottom + gap;
    const volumeBottom = volumeTop + volumeAreaHeight;
    const rsiTop = volumeBottom + gap;
    const rsiBottom = rsiTop + rsiAreaHeight;
    const macdTop = rsiBottom + gap;
    const macdBottom = macdTop + macdAreaHeight;
    const plotWidth = width - paddingX * 2;
    const priceCandidates = visibleCandles.flatMap((item) => [
        item.low,
        item.high,
        visibleIndicators.sma ? item.sma5 : null,
        visibleIndicators.sma ? item.sma20 : null,
        visibleIndicators.bollinger ? item.bollingerUpper : null,
        visibleIndicators.bollinger ? item.bollingerLower : null,
    ]).filter((value) => Number.isFinite(value));
    const min = Math.min(...priceCandidates);
    const max = Math.max(...priceCandidates);
    const spread = Math.max(max - min, 1);
    const slotWidth = plotWidth / visibleCandles.length;
    const candleWidth = Math.max(Math.min(slotWidth * 0.58, 18), 6);
    const latest = visibleCandles[visibleCandles.length - 1];
    const first = visibleCandles[0];
    const hovered = hoveredIndex == null ? latest : visibleCandles[hoveredIndex];
    const trendUp = (latest?.close ?? 0) >= (first?.close ?? 0);
    const maxVolume = Math.max(...visibleCandles.map((item) => item.volume || 0), 0);
    const hasVolume = maxVolume > 0;
    const macdValues = visibleCandles.flatMap((item) => [item.macd, item.macdSignal, item.macdHistogram]).filter((value) => Number.isFinite(value));
    const macdExtent = macdValues.length ? Math.max(...macdValues.map((value) => Math.abs(value)), 0.0001) : 1;
    const toPriceY = (value) => candleBottom - (((value - min) / spread) * candleAreaHeight);
    const toVolumeY = (value) => {
        if (!hasVolume) return volumeBottom;
        const safeValue = Number.isFinite(value) ? value : 0;
        return volumeBottom - ((safeValue / maxVolume) * volumeAreaHeight);
    };
    const toRsiY = (value) => {
        const safeValue = Number.isFinite(value) ? value : 50;
        return rsiBottom - ((safeValue / 100) * rsiAreaHeight);
    };
    const toMacdY = (value) => {
        const safeValue = Number.isFinite(value) ? value : 0;
        return macdTop + ((macdExtent - safeValue) / (macdExtent * 2)) * macdAreaHeight;
    };
    const changeRate = (priceValue) => {
        const num = Number(priceValue);
        const reference = Number(hovered?.referenceClose);
        if (!Number.isFinite(num) || !Number.isFinite(reference) || reference === 0) return null;
        return ((num - reference) / reference) * 100;
    };
    const renderPriceLine = (label, value) => {
        const rate = changeRate(value);
        return `${label} ${formatCurrency(value, currency)}${rate == null ? '' : ` (${formatPercent(rate)})`}`;
    };
    const tickIndexes = visibleCandles.length <= 1
        ? [0]
        : Array.from(new Set([
            0,
            Math.max(0, Math.floor((visibleCandles.length - 1) * 0.25)),
            Math.max(0, Math.floor((visibleCandles.length - 1) * 0.5)),
            Math.max(0, Math.floor((visibleCandles.length - 1) * 0.75)),
            visibleCandles.length - 1,
        ]));
    const buildPath = (field, toY) => {
        const coordinates = visibleCandles
            .map((item, index) => {
                const value = Number(item[field]);
                if (!Number.isFinite(value)) return null;
                const x = paddingX + slotWidth * index + slotWidth / 2;
                const y = toY(value);
                return `${x},${y}`;
            })
            .filter(Boolean);
        return coordinates.length >= 2 ? `M ${coordinates.join(' L ')}` : null;
    };
    const sma5Path = buildPath('sma5', toPriceY);
    const sma20Path = buildPath('sma20', toPriceY);
    const bollingerUpperPath = buildPath('bollingerUpper', toPriceY);
    const bollingerLowerPath = buildPath('bollingerLower', toPriceY);
    const rsiPath = buildPath('rsi14', toRsiY);
    const macdPath = buildPath('macd', toMacdY);
    const macdSignalPath = buildPath('macdSignal', toMacdY);

    return (
        <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Candlestick</div>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                        국내와 미국 모두 동일한 캔들 차트를 사용하며, 볼린저 밴드와 RSI, MACD를 함께 확인할 수 있습니다.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {[
                            { key: 'sma', label: '이동평균' },
                            { key: 'bollinger', label: '볼린저 밴드' },
                            { key: 'rsi', label: 'RSI' },
                            { key: 'macd', label: 'MACD' },
                        ].map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className={`rounded-full px-3 py-1.5 text-[11px] font-black ${visibleIndicators[item.key] ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                                onClick={() => toggleIndicator(item.key)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="min-w-[300px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm">
                    <div className="text-sm font-black text-slate-900">{hovered?.trading_date || '-'}</div>
                    <div className="mt-2 grid gap-4 grid-cols-[0.95fr_1.05fr] items-start">
                        <div className="grid grid-cols-1 gap-y-1.5">
                            <span>{renderPriceLine('시가', hovered?.open)}</span>
                            <span>{renderPriceLine('고가', hovered?.high)}</span>
                            <span>{renderPriceLine('저가', hovered?.low)}</span>
                            <span>{renderPriceLine('종가', hovered?.close)}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-y-1 border-l border-slate-100 pl-4 text-[11px] font-bold text-slate-500">
                            {visibleIndicators.sma ? <span>SMA 5 {hovered?.sma5 != null ? formatCurrency(hovered.sma5, currency) : '-'}</span> : null}
                            {visibleIndicators.sma ? <span>SMA 20 {hovered?.sma20 != null ? formatCurrency(hovered.sma20, currency) : '-'}</span> : null}
                            {visibleIndicators.bollinger ? <span>볼린저 밴드 {hovered?.bollingerUpper != null && hovered?.bollingerLower != null ? `${formatCurrency(hovered.bollingerLower, currency)} ~ ${formatCurrency(hovered.bollingerUpper, currency)}` : '-'}</span> : null}
                            {visibleIndicators.rsi ? <span>RSI 14 {hovered?.rsi14 != null ? formatCompact(hovered.rsi14, 2) : '-'}</span> : null}
                            {visibleIndicators.macd ? <span>MACD {hovered?.macd != null ? formatCompact(hovered.macd, 3) : '-'}</span> : null}
                            {visibleIndicators.macd ? <span>Signal {hovered?.macdSignal != null ? formatCompact(hovered.macdSignal, 3) : '-'}</span> : null}
                            {visibleIndicators.macd ? <span>Histogram {hovered?.macdHistogram != null ? formatCompact(hovered.macdHistogram, 3) : '-'}</span> : null}
                            <span>거래량 {hovered?.volume != null ? formatCompact(hovered.volume) : '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-[1.4rem] bg-white/70 p-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-[32rem] min-w-[760px] w-full">
                    <text x={paddingX} y={rsiTop - 4} fill="#7c3aed" fontSize="11" fontWeight="800">RSI (기준 30 / 50 / 70)</text>
                    <text x={paddingX} y={macdTop - 4} fill="#2563eb" fontSize="11" fontWeight="800">MACD (중심선 0 / Signal / Histogram)</text>
                    {[0, 1, 2, 3].map((step) => {
                        const y = candleTop + (candleAreaHeight * step) / 3;
                        return <line key={`price-grid-${step}`} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
                    })}
                    <line x1={paddingX} y1={candleBottom} x2={width - paddingX} y2={candleBottom} stroke="#cbd5e1" strokeWidth="1" />
                    <line x1={paddingX} y1={volumeBottom} x2={width - paddingX} y2={volumeBottom} stroke="#e2e8f0" strokeWidth="1" />
                    {visibleIndicators.rsi ? <line x1={paddingX} y1={toRsiY(70)} x2={width - paddingX} y2={toRsiY(70)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1" /> : null}
                    {visibleIndicators.rsi ? <line x1={paddingX} y1={toRsiY(50)} x2={width - paddingX} y2={toRsiY(50)} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth="1" /> : null}
                    {visibleIndicators.rsi ? <line x1={paddingX} y1={toRsiY(30)} x2={width - paddingX} y2={toRsiY(30)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1" /> : null}
                    {visibleIndicators.rsi ? <line x1={paddingX} y1={rsiBottom} x2={width - paddingX} y2={rsiBottom} stroke="#e2e8f0" strokeWidth="1" /> : null}
                    {visibleIndicators.macd ? <line x1={paddingX} y1={toMacdY(0)} x2={width - paddingX} y2={toMacdY(0)} stroke="#cbd5e1" strokeWidth="1" /> : null}
                    {visibleIndicators.macd ? <line x1={paddingX} y1={macdBottom} x2={width - paddingX} y2={macdBottom} stroke="#e2e8f0" strokeWidth="1" /> : null}

                    {visibleIndicators.bollinger && bollingerUpperPath ? <path d={bollingerUpperPath} fill="none" stroke="#d946ef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" /> : null}
                    {visibleIndicators.bollinger && bollingerLowerPath ? <path d={bollingerLowerPath} fill="none" stroke="#f5d0fe" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" /> : null}
                    {visibleIndicators.sma && sma20Path ? <path d={sma20Path} fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" /> : null}
                    {visibleIndicators.sma && sma5Path ? <path d={sma5Path} fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" /> : null}
                    {visibleIndicators.rsi && rsiPath ? <path d={rsiPath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
                    {visibleIndicators.macd && macdSignalPath ? <path d={macdSignalPath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
                    {visibleIndicators.macd && macdPath ? <path d={macdPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}

                    {visibleCandles.map((item, index) => {
                        const centerX = paddingX + slotWidth * index + slotWidth / 2;
                        const openY = toPriceY(item.open);
                        const closeY = toPriceY(item.close);
                        const highY = toPriceY(item.high);
                        const lowY = toPriceY(item.low);
                        const bodyTop = Math.min(openY, closeY);
                        const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
                        const rising = item.close >= item.open;
                        const stroke = rising ? '#059669' : '#dc2626';
                        const fill = rising ? '#10b981' : '#ef4444';
                        const active = hoveredIndex === index;
                        const volumeHeight = hasVolume && item.volume != null ? Math.max(volumeBottom - toVolumeY(item.volume), 2) : 0;
                        const volumeY = hasVolume && item.volume != null ? volumeBottom - volumeHeight : volumeBottom;
                        const histogramY = toMacdY(item.macdHistogram || 0);
                        const zeroY = toMacdY(0);
                        const histogramHeight = Math.max(Math.abs(histogramY - zeroY), 1.5);

                        return (
                            <g key={`${item.trading_date || 'point'}-${index}`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                                <rect x={paddingX + slotWidth * index} y={candleTop} width={slotWidth} height={macdBottom - candleTop} fill="transparent" />
                                <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={stroke} strokeWidth={active ? 2.4 : 1.6} strokeLinecap="round" />
                                <rect x={centerX - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} rx="1.5" fill={fill} stroke={active ? '#0f172a' : stroke} strokeWidth={active ? 1.5 : 1} opacity={active ? 1 : 0.92} />
                                {hasVolume ? <rect x={centerX - candleWidth / 2} y={volumeY} width={candleWidth} height={volumeHeight} rx="1.5" fill={rising ? '#86efac' : '#fca5a5'} opacity={active ? 0.95 : 0.75} /> : null}
                                {visibleIndicators.macd && Number.isFinite(item.macdHistogram) ? (
                                    <rect x={centerX - candleWidth / 2} y={Math.min(histogramY, zeroY)} width={candleWidth} height={histogramHeight} rx="1.5" fill={item.macdHistogram >= 0 ? '#93c5fd' : '#fdba74'} opacity={active ? 1 : 0.85} />
                                ) : null}
                            </g>
                        );
                    })}
                    {tickIndexes.map((index) => {
                        const item = visibleCandles[index];
                        if (!item) return null;
                        const centerX = paddingX + slotWidth * index + slotWidth / 2;
                        return (
                            <text
                                key={`tick-label-${item.trading_date || index}`}
                                x={centerX}
                                y={height - 6}
                                textAnchor="middle"
                                fill="#64748b"
                                fontSize="11"
                                fontWeight="800"
                            >
                                {formatChartTickLabel(item.trading_date, interval)}
                            </text>
                        );
                    })}
                </svg>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black text-slate-400">첫 종가</div><div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(first?.close, currency)}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black text-slate-400">최신 종가</div><div className="mt-1 text-sm font-black text-slate-900">{formatCurrency(latest?.close, currency)}</div></div>
                <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black text-slate-400">RSI 14</div>
                    <div className={`mt-1 text-sm font-black ${toneByValue((hovered?.rsi14 || 0) - 50)}`}>{visibleIndicators.rsi && hovered?.rsi14 != null ? formatCompact(hovered.rsi14, 2) : '-'}</div>
                    <div className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">{indicatorSnapshot.rsiSummary}</div>
                </div>
                <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black text-slate-400">MACD Histogram</div>
                    <div className={`mt-1 text-sm font-black ${toneByValue(hovered?.macdHistogram)}`}>{visibleIndicators.macd && hovered?.macdHistogram != null ? formatCompact(hovered.macdHistogram, 3) : '-'}</div>
                    <div className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">{indicatorSnapshot.macdSummary}</div>
                </div>
                <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs font-black text-slate-400">볼린저 위치</div>
                    <div className={`mt-1 text-sm font-black ${toneByValue((hovered?.close || 0) - (hovered?.sma20 || 0))}`}>{visibleIndicators.bollinger && hovered?.sma20 != null ? `20일선 ${formatCurrency(hovered.sma20, currency)}` : '-'}</div>
                    <div className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">{indicatorSnapshot.bollingerSummary}</div>
                </div>
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
                        <div className="flex items-center justify-between gap-3"><span>매출 QoQ</span><span className={toneByValue(item.revenue_qoq)}>{formatPercent(item.revenue_qoq)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>영업이익</span><span className={toneByValue(item.operating_income)}>{formatCompact(item.operating_income)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>영업이익 QoQ</span><span className={toneByValue(item.operating_income_qoq)}>{formatPercent(item.operating_income_qoq)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>순이익</span><span className={toneByValue(item.net_income)}>{formatCompact(item.net_income)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span>순이익 QoQ</span><span className={toneByValue(item.net_income_qoq)}>{formatPercent(item.net_income_qoq)}</span></div>
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
                    const responseItems = Array.isArray(unwrapData(response)?.items) ? unwrapData(response).items : [];
                    const rankedItems = [...responseItems].sort((left, right) => {
                        const leftScore = Number(left?.match_score);
                        const rightScore = Number(right?.match_score);
                        if (Number.isFinite(leftScore) && Number.isFinite(rightScore) && leftScore !== rightScore) {
                            return rightScore - leftScore;
                        }
                        return 0;
                    });
                    setItems(rankedItems.slice(0, SYMBOL_SUGGEST_DISPLAY_LIMIT));
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
    const dividendCurrency = market === "US" ? "USD" : "KRW";
    const usProviderWarning = !isKr && !summary
        ? limitations.find((item) => /alpha vantage|provider issue|api key/i.test(item))
        : "";
    const indicatorAnalysis = useMemo(() => analyzeIndicatorState(chartData?.points), [chartData?.points]);
    const indicatorSnapshot = useMemo(() => buildIndicatorSnapshot(chartData?.points), [chartData?.points]);
    const indicatorMessages = indicatorAnalysis.messages || [];

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

        setLoading(true);
        setError("");

        try {
            const [r1, r2, r3] = await Promise.all([
                api.get("/invest/analysis", { params: { market, symbol } }),
                api.get("/invest/analysis/v2", { params: { market, symbol } }),
                api.get("/invest/analysis/v3", { params: { market, symbol } }),
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
        <div className="-mx-4 space-y-6 px-1 animate-fade-in pb-10 sm:mx-0 sm:space-y-8 sm:px-0">
            <section className="card bg-white p-4 sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-sky-700"><Bot className="h-3.5 w-3.5" />Invest Workspace</div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">투자 도우미.</h1>
                <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">종목 검색 후 현재가, 일봉/주봉/월봉 차트, 기본 분석, 뉴스, 추천 레이어까지 한 번에 확인할 수 있습니다.</p>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {MARKETS.map((item) => {
                            const Icon = item.icon;
                            const active = market === item.value;
                            return (
                                <button key={item.value} type="button" className={`rounded-[2rem] border p-4 text-left ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`} onClick={() => { const preset = PRESETS[item.value][0]; setMarket(item.value); setSelectedSymbol(preset); setSymbolInput(preset); setChartInterval("DAY"); setChartData(null); }}>
                                    <Icon className="h-5 w-5" />
                                    <div className="mt-3 text-lg font-black">{item.label}</div>
                                    <div className={`mt-1 text-xs font-medium ${active ? "text-slate-300" : "text-slate-400"}`}>{item.helper}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                        <div className="text-sm font-black text-slate-900">{currentMarket.label} 시장</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">{price?.source === "KIS" ? "KIS 실시간 시세 응답을 사용 중입니다." : "가용 provider 기준 응답을 사용 중입니다."}</div>
                        <div className="mt-4 space-y-4">
                            <SymbolSuggestBox market={market} value={symbolInput} onChange={(value) => { setSymbolInput(value); setSelectedSymbol(""); }} onSelect={selectSymbol} />
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
            {!loading && !error && !v1 ? <section className="card bg-white p-5 sm:p-8 text-center"><Sparkles className="mx-auto h-10 w-10 text-primary-500" /><h2 className="mt-3 text-2xl font-black text-slate-900">종목을 검색하고 분석을 시작해 주세요.</h2></section> : null}

            {v1 ? (
                <>
                    <Card title={v1.company_name || v1.symbol} subtitle={`${v1.market} · ${v1.symbol}`}>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {price?.source ? <Badge className="bg-sky-100 text-sky-700">시세 {price.source}</Badge> : null}
                            {summary?.source ? <Badge className="bg-slate-100 text-slate-700">재무 {summary.source}</Badge> : null}
                            {chartData?.source ? <Badge className="bg-indigo-100 text-indigo-700">차트 {chartData.source}</Badge> : null}
                            {v3 ? <Badge className="bg-violet-100 text-violet-700">추천 V3</Badge> : null}
                        </div>
                        {usProviderWarning ? (
                            <div className="mb-4 rounded-[1.4rem] border border-amber-100 bg-amber-50/70 p-4 text-sm font-medium leading-relaxed text-amber-900">
                                미국 재무/배당 provider 상태: {formatLimitation(usProviderWarning)}
                            </div>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">현재가</div><div className="mt-1 text-lg font-black text-slate-900">{price?.price != null ? formatCurrency(price.price, currency) : "-"}</div></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">등락률</div><div className={`mt-1 text-lg font-black ${toneByValue(price?.change_percent)}`}>{price?.change_percent != null ? formatPercent(price.change_percent) : "-"}</div></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{dividend?.dividend_yield != null ? "현재 배당수익률" : "시가총액"}</div><div className="mt-1 text-lg font-black text-slate-900">{dividend?.dividend_yield != null ? formatPercent(dividend.dividend_yield) : (summary?.market_cap != null ? formatCompact(summary.market_cap) : "-")}</div></div>
                            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{dividend?.dividend_per_share != null ? "연간 DPS" : "매출 성장률"}</div><div className={`mt-1 text-lg font-black ${dividend?.dividend_per_share != null ? "text-slate-900" : toneByValue(summary?.revenue_growth_rate)}`}>{dividend?.dividend_per_share != null ? formatCurrency(dividend.dividend_per_share, dividendCurrency) : (summary?.revenue_growth_rate != null ? formatPercent(summary.revenue_growth_rate) : "-")}</div></div>
                        </div>
                    </Card>

                    <Card title="현재가 차트" subtitle="종목 검색 후 일봉, 주봉, 월봉으로 전환할 수 있습니다.">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {CHART_INTERVALS.map((item) => (
                                <button key={item.value} type="button" className={`rounded-full px-4 py-2 text-sm font-black ${chartInterval === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => { setChartInterval(item.value); if (selectedSymbol) { fetchChart(market, selectedSymbol, item.value, { priceSnapshot: price, currency: summary?.currency || (market === "US" ? "USD" : "KRW"), source: price?.source }); } }} disabled={chartLoading}>{item.label}</button>
                            ))}
                        </div>
                        {chartLoading ? <LoadingSpinner text="차트 데이터를 불러오는 중입니다..." /> : <CandlestickChart points={chartData?.points} currency={currency} interval={chartData?.interval} />}
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
                        <Card title="기본 의견" subtitle="수익성, 안정성, 배당 해석과 보조지표 신호를 함께 반영한 의견">
                            <div className="flex flex-wrap gap-2">
                                {opinion?.signal ? <Badge className={toneBySignal(opinion.signal)}>{opinion.signal}</Badge> : null}
                                {opinion?.score != null ? <Badge className="bg-slate-100 text-slate-700">의견 점수 {opinion.score}</Badge> : null}
                                {indicatorAnalysis.score != null ? <Badge className="bg-sky-100 text-sky-700" title={indicatorAnalysis.details?.join(" | ")}>기술 점수 {indicatorAnalysis.score}</Badge> : null}
                                {indicatorAnalysis.label ? <Badge className="bg-indigo-100 text-indigo-700" title={indicatorAnalysis.details?.join(" | ")}>{indicatorAnalysis.label}</Badge> : null}
                                {dividend?.dividend_label ? <Badge className="bg-emerald-100 text-emerald-700">{dividend.dividend_label}</Badge> : null}
                            </div>
                            <p className="mt-4 text-sm leading-relaxed text-slate-600">{opinion?.summary || "의견 정보가 없습니다."}</p>
                            {indicatorMessages.length ? (
                                <div className="mt-4 space-y-2 rounded-[1.4rem] border border-sky-100 bg-sky-50/70 p-4">
                                    <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">보조지표 해석</div>
                                    {indicatorMessages.map((item, index) => <p key={`${item}-${index}`} className="text-sm font-medium leading-relaxed text-sky-900">• {item}</p>)}
                                </div>
                            ) : null}
                        </Card>

                        <Card title="핵심 재무 지표" subtitle={isKr ? "최근 결산 기준 수익성, 안정성, 성장성 요약" : "최근 연간 보고서와 overview 기준 수익성, 안정성, 성장성 요약"}>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">매출</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (krFinancial?.revenue != null ? formatCompact(krFinancial.revenue) : "-") : (summary?.revenue != null ? formatCompact(summary.revenue) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">영업이익</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (krFinancial?.operating_income != null ? formatCompact(krFinancial.operating_income) : "-") : (summary?.operating_income != null ? formatCompact(summary.operating_income) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">순이익</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (krFinancial?.net_income != null ? formatCompact(krFinancial.net_income) : "-") : (summary?.net_income != null ? formatCompact(summary.net_income) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">영업이익률</div><div className={`mt-1 text-base font-black ${toneByValue(isKr ? krFinancial?.profit_margin : summary?.profit_margin)}`}>{isKr ? (krFinancial?.profit_margin != null ? formatPercent(krFinancial.profit_margin) : "-") : (summary?.profit_margin != null ? formatPercent(summary.profit_margin) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">ROE</div><div className={`mt-1 text-base font-black ${toneByValue(isKr ? krFinancial?.return_on_equity : summary?.return_on_equity)}`}>{isKr ? (krFinancial?.return_on_equity != null ? formatPercent(krFinancial.return_on_equity) : "-") : (summary?.return_on_equity != null ? formatPercent(summary.return_on_equity) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">부채비율</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (krFinancial?.debt_ratio != null ? formatPercent(krFinancial.debt_ratio) : "-") : (summary?.debt_ratio != null ? formatPercent(summary.debt_ratio) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">유동비율</div><div className={`mt-1 text-base font-black ${toneByValue(isKr ? krFinancial?.current_ratio : summary?.current_ratio)}`}>{isKr ? (krFinancial?.current_ratio != null ? formatPercent(krFinancial.current_ratio) : "-") : (summary?.current_ratio != null ? formatPercent(summary.current_ratio) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">매출 성장률</div><div className={`mt-1 text-base font-black ${toneByValue(isKr ? krFinancial?.revenue_growth_rate : summary?.revenue_growth_rate)}`}>{isKr ? (krFinancial?.revenue_growth_rate != null ? formatPercent(krFinancial.revenue_growth_rate) : "-") : (summary?.revenue_growth_rate != null ? formatPercent(summary.revenue_growth_rate) : "-")}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">영업이익 성장률</div><div className={`mt-1 text-base font-black ${toneByValue(isKr ? krFinancial?.operating_income_growth_rate : summary?.operating_income_growth_rate)}`}>{isKr ? (krFinancial?.operating_income_growth_rate != null ? formatPercent(krFinancial.operating_income_growth_rate) : "-") : (summary?.operating_income_growth_rate != null ? formatPercent(summary.operating_income_growth_rate) : "-")}</div></div>
                                </div>
                            </Card>

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

                        {dividend ? (
                            <Card title="배당 정보" subtitle={isKr ? "DART 배당 + KIS 현재가 기준" : "SEC EDGAR 연간 배당 + KIS 현재가 기준"}>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{isKr ? "주당 배당금" : "연간 DPS"}</div><div className="mt-1 text-base font-black text-slate-900">{dividend?.dividend_per_share != null ? formatCurrency(dividend.dividend_per_share, dividendCurrency) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">현재 배당수익률</div><div className="mt-1 text-base font-black text-slate-900">{dividend?.dividend_yield != null ? formatPercent(dividend.dividend_yield) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">배당 성장률</div><div className={`mt-1 text-base font-black ${toneByValue(dividend?.dividend_growth_rate)}`}>{dividend?.dividend_growth_rate != null ? formatPercent(dividend.dividend_growth_rate) : "-"}</div></div>
                                    <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{isKr ? "현금배당성향" : "배당성향"}</div><div className="mt-1 text-base font-black text-slate-900">{dividend?.dividend_payout_ratio != null ? formatPercent(dividend.dividend_payout_ratio) : "-"}</div></div>
                                </div>
                                {dividend?.history?.length ? (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        {dividend.history.map((item) => (
                                            <div key={`${item.business_year}-${item.dividend_per_share || 0}`} className="rounded-2xl border border-slate-100 bg-white p-4">
                                                <div className="text-xs font-black text-slate-400">{item.business_year}년 {isKr ? "DPS" : "연간 DPS"}</div>
                                                <div className="mt-1 text-base font-black text-slate-900">{item.dividend_per_share != null ? formatCurrency(item.dividend_per_share, dividendCurrency) : "-"}</div>
                                                <div className="mt-2 text-xs font-medium text-slate-500">{isKr ? "공시 배당수익률" : "기준 배당수익률"} {item.reported_dividend_yield != null ? formatPercent(item.reported_dividend_yield) : "-"}</div>
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

                        <Card title={isKr ? "보조 진단값" : "v3 진단값"} subtitle={isKr ? "재무, 배당, 뉴스 기반 보조 해석" : "밸류, 배당, 기술, SEC 기준 보고 정보"}>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">밸류 레이블</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (v3?.valuation?.valuation_label || "-") : formatValuationLabel(v3?.valuation?.valuation_label)}</div></div>
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{isKr ? "평균 감성" : "배당 레이블"}</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (v3?.sentiment_snapshot?.average_sentiment_score != null ? formatCompact(v3.sentiment_snapshot.average_sentiment_score, 3) : "-") : (dividend?.dividend_label || "배당 정보 부족")}</div></div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <div className="text-xs font-black text-slate-400">기술 진단</div>
                                    <div className={`mt-1 text-base font-black ${indicatorAnalysis.score != null ? toneByValue(indicatorAnalysis.score - 50) : "text-slate-900"}`}>{indicatorAnalysis.label ? `${indicatorAnalysis.label} (${indicatorAnalysis.score ?? 0}점)` : "기술 진단 없음"}</div>
                                    <div className="mt-2 space-y-1 text-[11px] font-medium leading-relaxed text-slate-500">
                                        <div>RSI: {indicatorSnapshot.rsiSummary}</div>
                                        <div>MACD: {indicatorSnapshot.macdSummary}</div>
                                        <div>볼린저: {indicatorSnapshot.bollingerSummary}</div>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black text-slate-400">{isKr ? "ETF 추정" : "SEC 기준 연도"}</div><div className="mt-1 text-base font-black text-slate-900">{isKr ? (v3?.etf_profile?.etf ? "ETF 가능성 있음" : "일반 종목 분석") : (summary?.business_year ? `${summary.business_year}년 ${summary?.report_code || ""}`.trim() : "연간 보고 정보 없음")}</div></div>
                            </div>
                        </Card>
                    </div>

                    <div className={`grid gap-5 ${isKr ? "xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
                        {isKr ? (
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
                        ) : null}

                        <Card title="제약사항 / 섹션 상태" subtitle="provider 상태와 available sections">
                            <div className="space-y-3">
                                {limitations.length ? limitations.map((item, index) => (
                                    <div key={`${item}-${index}`} className="flex gap-3 rounded-[1.4rem] border border-amber-100 bg-amber-50/70 p-4"><CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" /><p className="text-sm font-medium leading-relaxed text-amber-900">{formatLimitation(item)}</p></div>
                                )) : <EmptySlot message="현재 표시할 limitation 정보가 없습니다." />}
                            </div>
                            {v3?.available_sections?.length ? <div className="mt-5 flex flex-wrap gap-2">{v3.available_sections.map((item) => <Badge key={item} className="bg-slate-900 text-white">{formatAvailableSection(item)}</Badge>)}</div> : null}
                        </Card>
                    </div>
                </>
            ) : null}
        </div>
    );
};























