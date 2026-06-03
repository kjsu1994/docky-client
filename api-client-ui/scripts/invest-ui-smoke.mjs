import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost";
const chromePath = process.env.CHROME_PATH || [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => existsSync(candidate));

if (!chromePath) {
    throw new Error("Chrome or Edge executable was not found. Set CHROME_PATH to run this smoke test.");
}

const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "invest-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const blockedTexts = ["Loading", "Error", "Failed", "undefined", "NaN", "SOURCE", "limitation", "BUY", "SELL"];
const SYMBOL_QUERY_MAX_LENGTH = 80;
const SYMBOL_MAX_LENGTH = 20;

function assertStaticInvestToastRuntimeBoundary() {
    const source = readFileSync("src/pages/facility/InvestAssistant.jsx", "utf8");
    if (source.includes("from \"react-hot-toast\"") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(source)) {
        throw new Error("invest-ui-smoke: InvestAssistant must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    if (!source.includes("notifyError") || !source.includes("notifySuccess")) {
        throw new Error("invest-ui-smoke: InvestAssistant must keep success/error notifications on the dynamic toast runtime boundary.");
    }
    if (!source.includes("Broker Chart") || !source.includes("cursor-crosshair") || !source.includes("가격 캔들 차트")) {
        throw new Error("invest-ui-smoke: InvestAssistant chart must keep the broker-style chart header, crosshair, and accessible chart label.");
    }
}

class PipeCdp {
    constructor(chrome) {
        this.chrome = chrome;
        this.nextMessageId = 1;
        this.buffer = Buffer.alloc(0);
        this.pending = new Map();
        this.messageHandlers = [];

        chrome.stdio[4].on("data", (chunk) => this.handleData(chunk));
        chrome.once("exit", (code) => {
            const error = new Error(`Chrome exited before CDP command completed${code === null ? "" : `: ${code}`}`);
            for (const waiter of this.pending.values()) {
                clearTimeout(waiter.timeoutId);
                waiter.reject(error);
            }
            this.pending.clear();
        });
    }

    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    send(method, params = {}, sessionId = null, timeoutMs = 10000) {
        const id = this.nextMessageId++;
        const message = sessionId ? { id, method, params, sessionId } : { id, method, params };
        if (debug) console.log("cdp send", id, method, sessionId || "browser");
        this.chrome.stdio[3].write(`${JSON.stringify(message)}\0`);
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`${method}: timed out waiting for Chrome DevTools response`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, method, timeoutId });
        });
    }

    handleData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        let frameEnd = this.buffer.indexOf(0);
        while (frameEnd !== -1) {
            const raw = this.buffer.subarray(0, frameEnd).toString("utf8");
            this.buffer = this.buffer.subarray(frameEnd + 1);
            frameEnd = this.buffer.indexOf(0);
            if (!raw) continue;

            const message = JSON.parse(raw);
            if (debug) console.log("cdp recv", message.id || message.method, message.sessionId || "browser");
            if (message.id && this.pending.has(message.id)) {
                const waiter = this.pending.get(message.id);
                this.pending.delete(message.id);
                clearTimeout(waiter.timeoutId);
                if (message.error) {
                    waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
                } else {
                    waiter.resolve(message);
                }
                continue;
            }
            for (const handler of this.messageHandlers) {
                handler(message);
            }
        }
    }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeJson = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const encodeText = (value) => Buffer.from(value, "utf8").toString("base64");

function buildChartPoints() {
    let previousClose = 70500;
    const start = new Date("2026-04-13T00:00:00Z");

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + index);
        const trend = index * 135;
        const wave = Math.round(Math.sin(index / 3) * 620);
        const close = 70500 + trend + wave;
        const open = previousClose + Math.round(Math.cos(index / 4) * 240);
        const high = Math.max(open, close) + 520;
        const low = Math.min(open, close) - 460;
        const point = {
            trading_date: date.toISOString().slice(0, 10),
            open,
            high,
            low,
            close,
            volume: 960000 + (index * 18000),
            previous_close: previousClose,
        };
        previousClose = close;
        return point;
    });
}

const financialSummary = {
    source: "DART",
    business_year: 2025,
    report_code: "11011",
    revenue: 300900000000000,
    operating_income: 34900000000000,
    net_income: 30400000000000,
    total_assets: 455900000000000,
    total_liabilities: 92700000000000,
    total_equity: 363200000000000,
    current_assets: 198200000000000,
    current_liabilities: 75600000000000,
    debt_ratio: 25.5,
    current_ratio: 262.2,
    revenue_growth_rate: 5.8,
    operating_income_growth_rate: 7.1,
    net_income_growth_rate: 6.4,
    currency: "KRW",
    market_cap: 430000000000000,
    profit_margin: 11.6,
    return_on_equity: 8.7,
};

const priceSnapshot = {
    source: "KIS",
    as_of_date: "2026-05-29",
    price: 74200,
    change_amount: 900,
    change_percent: 1.23,
    open: 73300,
    high: 74800,
    low: 72800,
    previous_close: 73300,
    volume: 14850000,
};

const opinion = {
    signal: "BUY",
    score: 72,
    summary: "수익성과 현금흐름이 안정적이며 메모리 업황 회복 기대가 반영되고 있습니다.",
    positives: ["현금 창출력이 안정적입니다.", "주요 사업의 수요 회복 신호가 있습니다."],
    risks: ["환율과 반도체 가격 변동성은 계속 확인해야 합니다."],
};

const analysisV1 = {
    market: "KR",
    symbol: "005930",
    company_name: "삼성전자",
    price_snapshot: priceSnapshot,
    financial_summary: financialSummary,
    opinion,
    limitations: ["KR analysis uses annual DART financial statements for fundamentals."],
};

const analysisV2 = {
    market: "KR",
    symbol: "005930",
    company_name: "삼성전자",
    overview: {
        source: "DART",
        exchange: "KOSPI",
        currency: "KRW",
        sector: "정보기술",
        industry: "반도체",
        description: "반도체와 모바일, 디스플레이 사업을 영위하는 국내 대표 기업입니다.",
    },
    price_snapshot: priceSnapshot,
    financial_summary: financialSummary,
    technical_indicators: {
        sma20: 72800,
        sma50: 71600,
        sma200: 69400,
        rsi14: 58.2,
        macd: 320,
        macd_signal: 250,
        macd_histogram: 70,
    },
    news_issues: [{
        title: "메모리 업황 회복 기대 확대",
        source: "",
        published_at: "2026-05-29",
        summary: "주요 고객사의 재고 조정이 마무리되며 수요 회복 기대가 커지고 있습니다.",
        url: "https://example.com/invest-smoke",
        sentiment_score: 0.72,
        sentiment_label: "긍정",
        related_symbols: ["005930"],
    }],
    opinion,
    limitations: ["KR v2 uses DART annual financial summary and Naver news search results."],
};

const analysisV3 = {
    market: "KR",
    symbol: "005930",
    company_name: "삼성전자",
    available_sections: ["overview", "financial_summary", "price_snapshot", "technical_indicators", "price_risk", "risk_adjusted_return", "scenario_stress", "strategy_backtest", "news_issues"],
    overview: analysisV2.overview,
    price_snapshot: priceSnapshot,
    financial_summary: financialSummary,
    valuation: {
        market_cap: 430000000000000,
        per: 14.2,
        eps: 5225,
        profit_margin: 11.6,
        return_on_equity: 8.7,
        debt_ratio: 25.5,
        current_ratio: 262.2,
        revenue_growth_rate: 5.8,
        valuation_label: "적정 가치",
    },
    sentiment_snapshot: {
        article_count: 8,
        positive_count: 5,
        neutral_count: 2,
        negative_count: 1,
        average_sentiment_score: 0.62,
        sentiment_label: "긍정",
    },
    news_issues: analysisV2.news_issues,
    kr_financial_snapshot: financialSummary,
    kr_financial_history: [
        { business_year: 2023, revenue: 258900000000000, operating_income: 6570000000000, net_income: 15490000000000, total_equity: 354700000000000, profit_margin: 2.5, return_on_equity: 4.4, debt_ratio: 26.4, current_ratio: 259.8 },
        { business_year: 2024, revenue: 285200000000000, operating_income: 32400000000000, net_income: 29800000000000, total_equity: 361400000000000, profit_margin: 11.4, return_on_equity: 8.2, debt_ratio: 25.9, current_ratio: 261.1 },
        { business_year: 2025, revenue: 300900000000000, operating_income: 34900000000000, net_income: 30400000000000, total_equity: 363200000000000, profit_margin: 11.6, return_on_equity: 8.7, debt_ratio: 25.5, current_ratio: 262.2 },
    ],
    kr_quarterly_earnings: [
        { period_label: "2025 1분기", business_year: 2025, quarter: "Q1", revenue: 71900000000000, revenue_qoq: 2.1, operating_income: 6550000000000, operating_income_qoq: 4.2, net_income: 6100000000000, net_income_qoq: 3.8, operating_margin: 9.1, net_margin: 8.5 },
        { period_label: "2025 2분기", business_year: 2025, quarter: "Q2", revenue: 74300000000000, revenue_qoq: 3.3, operating_income: 7090000000000, operating_income_qoq: 8.2, net_income: 6500000000000, net_income_qoq: 6.6, operating_margin: 9.5, net_margin: 8.7 },
        { period_label: "2025 3분기", business_year: 2025, quarter: "Q3", revenue: 76400000000000, revenue_qoq: 2.8, operating_income: 8890000000000, operating_income_qoq: 25.4, net_income: 7420000000000, net_income_qoq: 14.2, operating_margin: 11.6, net_margin: 9.7 },
        { period_label: "2025 4분기", business_year: 2025, quarter: "Q4", revenue: 78200000000000, revenue_qoq: 2.4, operating_income: 9100000000000, operating_income_qoq: 2.4, net_income: 8030000000000, net_income_qoq: 8.2, operating_margin: 11.6, net_margin: 10.3 },
    ],
    dividend_snapshot: {
        dividend_per_share: 1444,
        dividend_yield: 1.94,
        dividend_growth_rate: 2.1,
        dividend_payout_ratio: 28.4,
        dividend_label: "안정 배당",
        history: [
            { business_year: 2023, dividend_per_share: 1444, reported_dividend_yield: 2.1 },
            { business_year: 2024, dividend_per_share: 1444, reported_dividend_yield: 2.0 },
            { business_year: 2025, dividend_per_share: 1444, reported_dividend_yield: 1.94 },
        ],
    },
    etf_profile: {
        etf: false,
        summary: "일반 상장주식입니다.",
        highlights: ["대형주", "반도체"],
    },
    price_risk_snapshot: {
        trading_days: 260,
        trailing_return3m: 8.4,
        trailing_return1y: 18.6,
        annualized_volatility: 24.8,
        average_daily_move: 1.1,
        max_drawdown: -14.7,
        daily_value_at_risk95: 2.6,
        risk_score: 74,
        risk_label: "LOW",
        notes: ["최근 가격 변동성은 계산 기준상 관리 가능한 범위입니다."],
    },
    risk_adjusted_return_snapshot: {
        trading_days: 260,
        total_return: 18.6,
        annualized_return: 17.8,
        annualized_volatility: 24.8,
        downside_deviation: 13.2,
        sharpe_ratio: 0.72,
        sortino_ratio: 1.35,
        calmar_ratio: 1.21,
        positive_day_ratio: 54.6,
        efficiency_score: 68,
        efficiency_label: "BALANCED",
        notes: ["Sharpe, Sortino, Calmar are calculated from historical daily candles."],
    },
    strategy_backtest_snapshot: {
        strategy_name: "SMA20/SMA60 추세 필터",
        trading_days: 260,
        benchmark_return: 18.6,
        strategy_return: 23.4,
        benchmark_max_drawdown: -14.7,
        strategy_max_drawdown: -8.2,
        exposure_percent: 64.8,
        trade_count: 3,
        win_rate: 55.2,
        signal: "OUTPERFORMED",
        summary: "최근 일봉 구간에서 추세 필터가 단순 보유 대비 성과 또는 낙폭 관리에 유리했습니다.",
        notes: ["이 결과는 과거 일봉으로 계산한 보조 검증이며 미래 수익을 보장하지 않습니다."],
    },
    scenario_stress_snapshot: {
        trading_days: 260,
        risk_label: "MEDIUM",
        summary: "과거 일봉 기준 20거래일 최악 구간 수익률은 -12.4%입니다.",
        cases: [
            { horizon: "1거래일", horizon_trading_days: 1, worst_return: -3.2, start_date: "2025-02-10", end_date: "2025-02-11" },
            { horizon: "5거래일", horizon_trading_days: 5, worst_return: -7.1, start_date: "2025-03-03", end_date: "2025-03-10" },
            { horizon: "20거래일", horizon_trading_days: 20, worst_return: -12.4, start_date: "2025-04-01", end_date: "2025-04-29" },
        ],
        notes: ["과거 최악 구간은 미래 손실을 보장하거나 제한하지 않습니다."],
    },
    recommendation: {
        buy_percent: 60,
        neutral_percent: 30,
        sell_percent: 10,
        confidence: 78,
        signal: "BUY",
        summary: "장기 관점에서 긍정적입니다. 다만 단기 가격 변동성은 분할 접근이 필요합니다.",
        reasons: ["실적 회복 구간", "재무 안정성"],
        risks: ["업황 사이클"],
        factors: [
            { key: "fundamentals", label: "기초체력", score: 74, weight: 25, signal: "POSITIVE", summary: "이익과 재무안정성은 양호한 수준입니다." },
            { key: "growth", label: "성장성", score: 62, weight: 20, signal: "NEUTRAL", summary: "매출 성장률 추이는 +5.80%입니다." },
            { key: "valuation", label: "밸류에이션", score: 60, weight: 15, signal: "NEUTRAL", summary: "현재 PER은 14.2배입니다." },
            { key: "momentum", label: "모멘텀", score: 67, weight: 20, signal: "POSITIVE", summary: "가격 흐름과 기술 추세는 양호한 수준입니다." },
            { key: "price_risk", label: "가격 리스크", score: 74, weight: 15, signal: "POSITIVE", summary: "연 변동성 24.8%, 최대 낙폭 -14.7%, 일간 VaR 2.6% 기준 리스크 점수는 74점입니다." },
            { key: "risk_adjusted_return", label: "위험 대비 수익", score: 68, weight: 10, signal: "POSITIVE", summary: "Sharpe 0.72, Sortino 1.35, Calmar 1.21 기준 효율 점수는 68점입니다." },
            { key: "scenario_stress", label: "손실 시나리오", score: 56, weight: 10, signal: "NEUTRAL", summary: "20거래일 최악 구간 -12.4% 기준 손실 시나리오 리스크는 MEDIUM입니다." },
            { key: "strategy_backtest", label: "전략 검증", score: 72, weight: 10, signal: "POSITIVE", summary: "SMA20/SMA60 추세 필터 수익률 +23.4%, 단순 보유 +18.6%입니다." },
            { key: "sentiment", label: "뉴스 감성", score: 75, weight: 20, signal: "POSITIVE", summary: "최근 뉴스 평균 감성 점수는 0.62입니다." },
        ],
    },
    limitations: ["국내 ETF 구성종목과 애널리스트 컨센서스는 아직 연동되지 않았습니다."],
};

const portfolioResponse = {
    items: [
        {
            item_id: 1,
            market: "KR",
            symbol: "005930",
            company_name: "삼성전자",
            item_type: "WATCHLIST",
            quantity: 10,
            planned_amount: 1000000,
            target_allocation_percent: 10,
            risk_budget_percent: 1,
            average_price: 74200,
            alert_above_price: 74000,
            alert_below_price: 69000,
            position_cost: 742000,
            risk_budget_amount: 10000,
            current_price: 76000,
            current_change_percent: 1.25,
            current_value: 760000,
            unrealized_pnl: 18000,
            unrealized_pnl_percent: 2.4259,
            current_allocation_percent: 100,
            alert_status: "TRIGGERED",
            alert_messages: ["ALERT_ABOVE_TRIGGERED"],
            quote_provider: "KIS",
            quote_as_of_date: "2026-05-29",
            memo: "장기 관점에서 분할 매수 후보로 검토합니다.",
        },
    ],
    item_count: 1,
    total_planned_amount: 1000000,
    total_position_cost: 742000,
    total_current_value: 760000,
    provider_warnings: [],
};

function routeMock(url, method) {
    const { hostname, pathname } = new URL(url);

    if (method === "GET" && hostname === "oapi.map.naver.com") {
        return { status: 200, contentType: "application/javascript; charset=utf-8", bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 100,
                    name: "투자 검증자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/invest/symbols/suggest") {
        return {
            status: 200,
            body: {
                data: {
                    market: "KR",
                    query: "삼성",
                    items: [
                        { symbol: "005930", company_name: "삼성전자", display_name: "삼성전자(005930)", exchange: "KOSPI", asset_type: "STOCK", currency: "KRW", region: "KR", match_score: 98 },
                        { symbol: "000660", company_name: "SK하이닉스", display_name: "SK하이닉스(000660)", exchange: "KOSPI", asset_type: "STOCK", currency: "KRW", region: "KR", match_score: 61 },
                    ],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/invest/analysis") {
        return { status: 200, body: { data: analysisV1 } };
    }

    if (method === "GET" && pathname === "/api/invest/analysis/v2") {
        return { status: 200, body: { data: analysisV2 } };
    }

    if (method === "GET" && pathname === "/api/invest/analysis/v3") {
        return { status: 200, body: { data: analysisV3 } };
    }

    if (method === "GET" && pathname === "/api/invest/portfolio") {
        return { status: 200, body: { data: portfolioResponse } };
    }

    if (method === "GET" && pathname === "/api/invest/chart") {
        return {
            status: 200,
            body: {
                data: {
                    market: "KR",
                    symbol: "005930",
                    interval: new URL(url).searchParams.get("interval") || "DAY",
                    source: "KIS",
                    currency: "KRW",
                    points: buildChartPoints(),
                    limitations: ["KR chart uses KIS daily history."],
                },
            },
        };
    }

    return null;
}

async function handleFetchRequest(cdp, sessionId, event) {
    const { requestId, request } = event.params;
    const mock = routeMock(request.url, request.method);
    if (!mock) {
        await cdp.send("Fetch.continueRequest", { requestId }, sessionId);
        return;
    }

    await cdp.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: mock.status,
        responseHeaders: [
            { name: "Content-Type", value: mock.contentType || "application/json; charset=utf-8" },
            { name: "Cache-Control", value: "no-store" },
        ],
        body: mock.bodyText !== undefined ? encodeText(mock.bodyText) : encodeJson(mock.body),
    }, sessionId);
}

async function evaluate(cdp, sessionId, expression) {
    const response = await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression,
    }, sessionId);
    return response.result?.result?.value;
}

async function waitForText(cdp, sessionId, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const pageState = await evaluate(cdp, sessionId, `(() => ({
        href: location.href,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 300) || "",
    }))()`).catch(() => null);
    throw new Error(`Timed out waiting for text: ${text}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
}

async function clickByText(cdp, sessionId, text) {
    const target = await evaluate(cdp, sessionId, `(() => {
        const target = Array.from(document.querySelectorAll("button,a,input"))
            .find((node) => (node.innerText || node.value || node.placeholder || node.getAttribute("aria-label") || "").includes(${JSON.stringify(text)}));
        if (!target) return null;
        target.scrollIntoView({ block: "center", inline: "center" });
        const rect = target.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    })()`);
    if (!target) throw new Error(`Could not click text: ${text}`);

    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 }, sessionId);
}

async function inspectInvest(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    const navigation = await cdp.send("Page.navigate", { url: `${baseUrl}/app/invest` }, sessionId);
    if (navigation.result?.errorText) {
        throw new Error(`invest ${viewport.name}: navigation failed ${navigation.result.errorText}`);
    }

    await waitForText(cdp, sessionId, "투자 도우미");
    const symbolControls = await evaluate(cdp, sessionId, `(() => {
        const input = Array.from(document.querySelectorAll("input"))
            .find((node) => (node.placeholder || "").includes("종목코드") || (node.placeholder || "").includes("티커"));
        const helper = document.getElementById("invest-symbol-query-hint");
        return {
            hasInput: Boolean(input),
            maxLength: input ? input.maxLength : null,
            helperText: helper ? helper.innerText : "",
        };
    })()`);
    if (
        !symbolControls.hasInput
        || symbolControls.maxLength !== SYMBOL_QUERY_MAX_LENGTH
        || !symbolControls.helperText.includes(`${SYMBOL_QUERY_MAX_LENGTH}자`)
        || !symbolControls.helperText.includes(`${SYMBOL_MAX_LENGTH}자`)
    ) {
        throw new Error(`invest ${viewport.name}: symbol input bounds missing ${JSON.stringify(symbolControls)}`);
    }
    await clickByText(cdp, sessionId, "분석 시작");
    await waitForText(cdp, sessionId, "삼성전자");
    await waitForText(cdp, sessionId, "현재가 차트");
    await waitForText(cdp, sessionId, "기본 의견");
    await waitForText(cdp, sessionId, "투자 전 리스크 가드");
    await waitForText(cdp, sessionId, "가격 리스크 스냅샷");
    await waitForText(cdp, sessionId, "위험 대비 수익");
    await waitForText(cdp, sessionId, "Sharpe");
    await waitForText(cdp, sessionId, "Sortino");
    await waitForText(cdp, sessionId, "Calmar");
    await waitForText(cdp, sessionId, "손실 시나리오");
    await waitForText(cdp, sessionId, "내 투자 후보");
    await waitForText(cdp, sessionId, "예정금액 입력합계");
    await waitForText(cdp, sessionId, "현재가 평가합계");
    await waitForText(cdp, sessionId, "평가손익");
    await waitForText(cdp, sessionId, "알림 도달");
    await waitForText(cdp, sessionId, "상단 알림가에 도달했습니다.");
    await waitForText(cdp, sessionId, "퀀트 전략 검증");
    await waitForText(cdp, sessionId, "SMA20/SMA60 추세 필터");
    await waitForText(cdp, sessionId, "투자 판단 매트릭스");
    await waitForText(cdp, sessionId, "VaR 1일 손실");
    await waitForText(cdp, sessionId, "실행 계획서");
    await waitForText(cdp, sessionId, "VaR 한도 수량");
    await waitForText(cdp, sessionId, "재검토 기준가");
    await waitForText(cdp, sessionId, "하단 알림 후보");
    await waitForText(cdp, sessionId, "장기 관점");
    await waitForText(cdp, sessionId, "방법론 참고");
    await waitForText(cdp, sessionId, "SEC 자산배분");
    await waitForText(cdp, sessionId, "FINRA 분산투자");
    await clickByText(cdp, sessionId, "주봉");
    await delay(500);

    const value = await evaluate(cdp, sessionId, `(() => {
        const root = document.documentElement;
        const body = document.body;
        const text = body ? body.innerText : "";
        const overflowNodes = Array.from(document.querySelectorAll("body *"))
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    tag: node.tagName,
                    text: (node.innerText || node.getAttribute("aria-label") || "").trim().slice(0, 60),
                    width: Math.round(rect.width),
                    right: Math.round(rect.right),
                };
            })
            .filter((node) => node.right > root.clientWidth + 2 && node.width > 0)
            .slice(0, 5);
        return {
            text,
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            bodyWidth: body ? body.scrollWidth : 0,
            overflowNodes,
        };
    })()`);

    for (const text of ["투자 도우미", "삼성전자", "현재가 차트", "투자 전 리스크 가드", "가격 리스크 스냅샷", "위험 대비 수익", "Sharpe", "Sortino", "Calmar", "손실 시나리오", "실행 계획서", "VaR 한도 수량", "재검토 기준가", "하단 알림 후보", "내 투자 후보", "예정금액 입력합계", "퀀트 전략 검증", "SMA20/SMA60 추세 필터", "투자 판단 매트릭스", "비중 주의", "VaR 1일 손실", "포지션 크기", "전략 검증", "가격 리스크", "기초체력", "장기 관점", "방법론 참고", "SEC 자산배분", "FINRA 분산투자", "매수", "출처 미상"]) {
        if (!value.text.includes(text)) {
            throw new Error(`invest ${viewport.name}: missing text ${text}`);
        }
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`invest ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`invest ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `invest ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth}`;
}

async function main() {
    assertStaticInvestToastRuntimeBoundary();

    const chrome = spawn(chromePath, [
        "--headless=new",
        "--remote-debugging-pipe",
        `--user-data-dir=${userDataDir}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });

    if (debug) {
        chrome.stderr.on("data", (chunk) => process.stderr.write(chunk));
    } else {
        chrome.stderr.on("data", () => {});
    }

    const waitForChromeExit = () => new Promise((resolve) => {
        if (chrome.exitCode !== null) {
            resolve();
            return;
        }
        chrome.once("exit", resolve);
    });

    const cdp = new PipeCdp(chrome);
    let sessionId = null;
    const runtimeErrors = [];

    try {
        await cdp.send("Browser.getVersion");
        const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
        const targetId = targetResponse.result?.targetId;
        if (!targetId) throw new Error("Could not create Chrome target for invest smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for invest smoke test.");

        cdp.onMessage((message) => {
            if (message.sessionId !== sessionId) return;
            if (message.method === "Fetch.requestPaused") {
                handleFetchRequest(cdp, sessionId, message).catch((error) => {
                    if (!String(error.message || "").includes("Invalid InterceptionId")) {
                        runtimeErrors.push(error.message);
                    }
                });
            } else if (message.method === "Runtime.exceptionThrown") {
                runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
            }
        });

        await cdp.send("Page.enable", {}, sessionId);
        await cdp.send("Runtime.enable", {}, sessionId);
        await cdp.send("Fetch.enable", {
            patterns: [
                { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
            ],
        }, sessionId);
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectInvest(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`invest-ui-smoke ok (${results.length} responsive checks)`);
    } finally {
        if (chrome.exitCode === null) {
            chrome.kill();
            await Promise.race([waitForChromeExit(), delay(1500)]);
        }
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
                rmSync(userDataDir, { recursive: true, force: true });
                break;
            } catch (error) {
                if (attempt === 5) {
                    console.warn(`Could not remove temporary Chrome profile ${userDataDir}: ${error.message}`);
                    break;
                }
                await delay(300);
            }
        }
    }
}

try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
