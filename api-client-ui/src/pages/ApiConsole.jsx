import { useMemo, useState } from "react";
import http from "../api/http";
import { apiCatalog } from "../api/apiCatalog.js";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300";

function pretty(obj) {
    try {
        if (obj === null || obj === undefined) return "";
        if (typeof obj === "string") return obj;
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

function parseJsonSafe(txt, fallback = {}) {
    const t = (txt ?? "").trim();
    if (!t) return fallback;
    return JSON.parse(t);
}

export default function ApiConsole() {
    const flat = useMemo(
        () =>
            apiCatalog.flatMap((g) =>
                g.items.map((it) => ({ ...it, group: g.group }))
            ),
        []
    );

    const [selectedKey, setSelectedKey] = useState(0);
    const selected = flat[selectedKey];

    const [method, setMethod] = useState(selected?.method ?? "GET");
    const [path, setPath] = useState(selected?.path ?? "/");

    const [paramsText, setParamsText] = useState(
        pretty(selected?.sampleParams ?? {})
    );
    const [headersText, setHeadersText] = useState(pretty({}));

    // Body 타입: json | multipart
    const [bodyType, setBodyType] = useState("json");

    // JSON body
    const [bodyText, setBodyText] = useState(pretty(selected?.sampleBody ?? {}));

    // Multipart body
    const [multipartFieldsText, setMultipartFieldsText] = useState(pretty({}));
    const [files, setFiles] = useState([]); // File[]

    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);

    const onSelect = (idx) => {
        setSelectedKey(idx);
        const it = flat[idx];

        setMethod(it.method);
        setPath(it.path);
        setParamsText(pretty(it.sampleParams ?? {}));
        setHeadersText(pretty({}));

        // body 기본값 처리
        const isMultipartDefault = it.bodyType === "multipart";

        setBodyType(isMultipartDefault ? "multipart" : "json");

        // json 기본
        setBodyText(pretty(it.sampleBody ?? {}));

        // multipart 기본
        setMultipartFieldsText(pretty(it.multipartDefaults ?? {}));
        setFiles([]);

        setResponse(null);
        setError(null);
    };


    const send = async () => {
        setLoading(true);
        setError(null);
        setResponse(null);

        const started = performance.now();

        try {
            const params = parseJsonSafe(paramsText, {});
            const headers = parseJsonSafe(headersText, {});

            const m = method.toUpperCase();

            // GET/DELETE는 body 무시
            const bodyAllowed = m !== "GET" && m !== "DELETE";

            let data = undefined;

            if (bodyAllowed) {
                if (bodyType === "multipart") {
                    // multipart/form-data
                    const fields = parseJsonSafe(multipartFieldsText, {});
                    const formData = new FormData();

                    // 텍스트 필드들 추가
                    Object.entries(fields).forEach(([k, v]) => {
                        // Spring에서 문자열로 받는 경우가 많아서 stringify 기본
                        if (v === undefined || v === null) return;
                        formData.append(k, typeof v === "string" ? v : JSON.stringify(v));
                    });

                    // files 키로 파일 추가 (다중)
                    // ✅ 백엔드 스펙이 files=FILE 이라고 했으니 key는 "files"
                    const fileKey = selected?.fileKey ?? "files";
                    for (const f of files) {
                        formData.append(fileKey, f);
                    }

                    data = formData;

                    // 주의: Content-Type을 강제로 설정하지 말 것(axios가 boundary 설정)
                    // headers["Content-Type"] = "multipart/form-data"; // ❌ 하면 오히려 깨질 수 있음
                } else {
                    // json
                    data = parseJsonSafe(bodyText, {});
                    headers["Content-Type"] = "application/json";
                }
            }

            const res = await http.request({
                method: m,
                url: path,
                params,
                headers,
                data,
            });

            const elapsedMs = Math.round(performance.now() - started);

            const payload = {
                ok: true,
                status: res.status,
                headers: res.headers,
                data: res.data,
                elapsedMs,
            };

            setResponse(payload);
            setHistory((h) =>
                [
                    {
                        ts: new Date().toISOString(),
                        method: m,
                        path,
                        params,
                        bodyType: bodyAllowed ? bodyType : "none",
                        status: res.status,
                        elapsedMs,
                    },
                    ...h,
                ].slice(0, 20)
            );
        } catch (e) {
            const elapsedMs = Math.round(performance.now() - started);
            const payload = { ok: false, ...e, elapsedMs };
            setError(payload);
            setHistory((h) =>
                [
                    {
                        ts: new Date().toISOString(),
                        method: method.toUpperCase(),
                        path,
                        bodyType: method.toUpperCase() !== "GET" && method.toUpperCase() !== "DELETE" ? bodyType : "none",
                        status: e?.status ?? "ERR",
                        elapsedMs,
                    },
                    ...h,
                ].slice(0, 20)
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 좌측: Catalog */}
            <aside className="lg:col-span-3">
                <div className="rounded-2xl border bg-white shadow-sm">
                    <div className="p-4 border-b">
                        <div className="text-sm font-semibold text-slate-900">API Catalog</div>
                        <div className="text-xs text-slate-500">명세 기반 목록</div>
                    </div>
                    <div className="p-2">
                        {apiCatalog.map((g) => (
                            <div key={g.group} className="mb-3">
                                <div className="px-2 py-1 text-xs font-semibold text-slate-600">
                                    {g.group}
                                </div>
                                <div className="space-y-1">
                                    {g.items.map((it) => {
                                        const idx = flat.findIndex(
                                            (x) => x.group === g.group && x.name === it.name
                                        );
                                        const isActive = idx === selectedKey;
                                        return (
                                            <button
                                                key={it.name}
                                                onClick={() => onSelect(idx)}
                                                className={`w-full text-left rounded-xl px-3 py-2 border transition ${
                                                    isActive
                                                        ? "bg-slate-900 text-white border-slate-900"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm font-semibold">{it.name}</div>
                                                    <div
                                                        className={`text-xs font-mono ${
                                                            isActive ? "text-slate-200" : "text-slate-500"
                                                        }`}
                                                    >
                                                        {it.method}
                                                    </div>
                                                </div>
                                                <div
                                                    className={`mt-1 text-xs font-mono ${
                                                        isActive ? "text-slate-200" : "text-slate-500"
                                                    }`}
                                                >
                                                    {it.path}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* 중앙: Request */}
            <section className="lg:col-span-6">
                <div className="rounded-2xl border bg-white shadow-sm">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Request</div>
                            <div className="text-xs text-slate-500">
                                Authorization은 http interceptor가 자동 첨부
                            </div>
                        </div>
                        <button
                            onClick={send}
                            disabled={loading}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                            {loading ? "요청 중..." : "Send"}
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Method
                                </label>
                                <select
                                    value={method}
                                    onChange={(e) => setMethod(e.target.value)}
                                    className={inputClass}
                                >
                                    {["GET", "POST", "PATCH", "DELETE"].map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Path
                                </label>
                                <input
                                    value={path}
                                    onChange={(e) => setPath(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Query Params (JSON)
                            </label>
                            <textarea
                                value={paramsText}
                                onChange={(e) => setParamsText(e.target.value)}
                                className={`${inputClass} font-mono min-h-[96px]`}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Headers (JSON)
                            </label>
                            <textarea
                                value={headersText}
                                onChange={(e) => setHeadersText(e.target.value)}
                                className={`${inputClass} font-mono min-h-[96px]`}
                            />
                            <div className="mt-1 text-xs text-slate-500">
                                Authorization은 자동 첨부되므로 일반적으로 입력하지 않습니다.
                            </div>
                        </div>

                        {/* Body Type */}
                        <div className="flex items-center gap-3">
                            <div className="text-xs font-semibold text-slate-700">Body Type</div>
                            <select
                                value={bodyType}
                                onChange={(e) => setBodyType(e.target.value)}
                                className={inputClass}
                            >
                                <option value="json">JSON</option>
                                <option value="multipart">multipart/form-data (files)</option>
                            </select>
                        </div>

                        {/* JSON Body */}
                        {bodyType === "json" ? (
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Body (JSON)
                                </label>
                                <textarea
                                    value={bodyText}
                                    onChange={(e) => setBodyText(e.target.value)}
                                    className={`${inputClass} font-mono min-h-[160px]`}
                                />
                                <div className="mt-1 text-xs text-slate-500">
                                    GET/DELETE는 Body를 무시합니다.
                                </div>
                            </div>
                        ) : (
                            /* Multipart Body */
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Fields (JSON) - 텍스트 파라미터
                                    </label>
                                    <textarea
                                        value={multipartFieldsText}
                                        onChange={(e) => setMultipartFieldsText(e.target.value)}
                                        className={`${inputClass} font-mono min-h-[140px]`}
                                        placeholder='{"title":"제목","content":"내용"}'
                                    />
                                    <div className="mt-1 text-xs text-slate-500">
                                        값이 객체면 문자열(JSON.stringify)로 들어갑니다. 서버가 문자열을 파싱해야 합니다.
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Files (key: files)
                                    </label>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                        className={inputClass}
                                    />
                                    {files.length > 0 && (
                                        <div className="mt-2 text-xs text-slate-600">
                                            선택됨: {files.map((f) => f.name).join(", ")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 우측: Response + History */}
            <aside className="lg:col-span-3 space-y-6">
                <div className="rounded-2xl border bg-white shadow-sm">
                    <div className="p-4 border-b">
                        <div className="text-sm font-semibold text-slate-900">Response</div>
                        <div className="text-xs text-slate-500">status / headers / body</div>
                    </div>

                    <div className="p-4">
                        {!response && !error ? (
                            <div className="text-sm text-slate-500">아직 응답이 없습니다.</div>
                        ) : error ? (
                            <div>
                                <div className="text-sm font-semibold text-red-700">
                                    실패 {error.status ?? ""}
                                </div>
                                <div className="mt-2 text-xs text-slate-700 break-words">
                                    {String(error.message)}
                                </div>
                                <pre className="mt-3 text-xs rounded-xl bg-slate-900 text-slate-100 p-3 overflow-auto max-h-[260px]">
{JSON.stringify(error, null, 2)}
                </pre>
                            </div>
                        ) : (
                            <div>
                                <div className="text-sm font-semibold text-slate-900">
                                    성공 {response.status} · {response.elapsedMs}ms
                                </div>
                                <pre className="mt-3 text-xs rounded-xl bg-slate-900 text-slate-100 p-3 overflow-auto max-h-[320px]">
{JSON.stringify(response.data, null, 2)}
                </pre>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border bg-white shadow-sm">
                    <div className="p-4 border-b">
                        <div className="text-sm font-semibold text-slate-900">History</div>
                        <div className="text-xs text-slate-500">최근 20건</div>
                    </div>
                    <div className="p-2">
                        {history.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500">기록이 없습니다.</div>
                        ) : (
                            <div className="space-y-1">
                                {history.map((h, i) => (
                                    <div key={i} className="rounded-xl border border-slate-200 p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-mono text-slate-700">
                                                {h.method} {h.path}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {h.status} · {h.elapsedMs}ms
                                            </div>
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500">
                                            {h.ts} · body: {h.bodyType}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
