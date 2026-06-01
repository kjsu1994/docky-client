const baseUrl = process.env.SMOKE_API_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost";
const concurrency = Number(process.env.SMOKE_API_CONCURRENCY || 100);
const p95LimitMs = Number(process.env.SMOKE_API_P95_MS || 2500);

const endpoints = [
    "/api/stats/dashboard",
    "/api/boards/latest?kind=FREE_BOARD&kind=ADMIN_NOTICE&page=0&size=6",
    "/api/banners?placement=HOME_HERO&target=USER&limit=10",
];

if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error("SMOKE_API_CONCURRENCY must be a positive number.");
}

if (!Number.isFinite(p95LimitMs) || p95LimitMs < 1) {
    throw new Error("SMOKE_API_P95_MS must be a positive number.");
}

const samples = [];

async function requestEndpoint(pathname) {
    const started = performance.now();
    try {
        const response = await fetch(`${baseUrl}${pathname}`, {
            headers: {
                "Cache-Control": "no-cache",
            },
        });
        await response.arrayBuffer();
        samples.push({
            pathname,
            status: response.status,
            durationMs: performance.now() - started,
        });
    } catch (error) {
        samples.push({
            pathname,
            status: 0,
            durationMs: performance.now() - started,
            error: error.message,
        });
    }
}

function percentile(rows, ratio) {
    const index = Math.min(rows.length - 1, Math.floor(rows.length * ratio));
    return rows[index]?.durationMs ?? 0;
}

function statusCounts(rows) {
    return rows.reduce((counts, row) => {
        counts[row.status] = (counts[row.status] || 0) + 1;
        return counts;
    }, {});
}

await Promise.all(
    Array.from({ length: concurrency }, () => Promise.all(endpoints.map(requestEndpoint)))
);

const failures = [];

for (const endpoint of endpoints) {
    const rows = samples
        .filter((sample) => sample.pathname === endpoint)
        .sort((left, right) => left.durationMs - right.durationMs);
    const statuses = statusCounts(rows);
    const p50 = percentile(rows, 0.5);
    const p95 = percentile(rows, 0.95);
    const max = rows[rows.length - 1]?.durationMs ?? 0;

    console.log(`${endpoint}`);
    console.log(`count=${rows.length} statuses=${JSON.stringify(statuses)} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`);

    const nonOkRows = rows.filter((row) => row.status !== 200);
    if (nonOkRows.length) {
        failures.push(`${endpoint}: expected all 200 responses, got ${JSON.stringify(statuses)}`);
    }
    if (p95 > p95LimitMs) {
        failures.push(`${endpoint}: p95 ${p95.toFixed(1)}ms exceeded ${p95LimitMs}ms`);
    }
}

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log(`home-api-load-smoke ok (${concurrency} concurrent home fan-out clients, p95 <= ${p95LimitMs}ms)`);
