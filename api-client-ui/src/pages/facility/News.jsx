import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Newspaper, ExternalLink, Calendar, TrendingUp } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { formatRelativeTime } from "../../utils/helpers.js";
import { NEWS_DEFAULT_DISPLAY, NEWS_DEFAULT_QUERY, NEWS_DEFAULT_SORT, newsAdapter, newsErrorMessage, normalizeNewsQuery } from "../../adapters/newsAdapter.js";

const quickKeywords = ["기후위기", "탄소중립", "재생에너지", "전기차", "미세먼지"];

export const News = () => {
    const [query, setQuery] = useState(NEWS_DEFAULT_QUERY);
    const [searchInput, setSearchInput] = useState(NEWS_DEFAULT_QUERY);
    const [news, setNews] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sortBy, setSortBy] = useState(NEWS_DEFAULT_SORT);
    const [display, setDisplay] = useState(NEWS_DEFAULT_DISPLAY);
    const requestSeqRef = useRef(0);
    const initialLoadRef = useRef(false);

    const fetchNews = useCallback(async ({ nextQuery = query, nextSort = sortBy, nextDisplay = display } = {}) => {
        const requestId = requestSeqRef.current + 1;
        requestSeqRef.current = requestId;
        setLoading(true);
        setError("");
        try {
            const result = await newsAdapter.search({
                query: nextQuery,
                sort: nextSort,
                display: nextDisplay,
                start: 1,
            });
            if (requestSeqRef.current !== requestId) return;
            setNews(result.items);
            setTotal(result.total);
            if (result.items.length === 0) {
                setError("검색 결과가 없습니다. 다른 키워드로 다시 검색해보세요.");
            }
        } catch (err) {
            if (requestSeqRef.current !== requestId) return;
            console.error("Failed to fetch news:", err);
            setNews([]);
            setTotal(0);
            setError(newsErrorMessage(err, "뉴스를 불러오지 못했습니다."));
        } finally {
            if (requestSeqRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [display, query, sortBy]);

    useEffect(() => {
        if (initialLoadRef.current) return;
        initialLoadRef.current = true;
        fetchNews({
            nextQuery: NEWS_DEFAULT_QUERY,
            nextSort: NEWS_DEFAULT_SORT,
            nextDisplay: NEWS_DEFAULT_DISPLAY,
        });
    }, [fetchNews]);

    const handleSearch = (event) => {
        event.preventDefault();
        const nextQuery = normalizeNewsQuery(searchInput);
        setSearchInput(nextQuery);
        setQuery(nextQuery);
        fetchNews({ nextQuery, nextSort: sortBy, nextDisplay: display });
    };

    const handleSortChange = (nextSort) => {
        setSortBy(nextSort);
        fetchNews({ nextQuery: query, nextSort, nextDisplay: display });
    };

    const handleDisplayChange = (nextDisplay) => {
        setDisplay(nextDisplay);
        fetchNews({ nextQuery: query, nextSort: sortBy, nextDisplay });
    };

    const handleKeywordClick = (keyword) => {
        setSearchInput(keyword);
        setQuery(keyword);
        fetchNews({ nextQuery: keyword, nextSort: sortBy, nextDisplay: display });
    };

    const retry = () => fetchNews({ nextQuery: query, nextSort: sortBy, nextDisplay: display });

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <Newspaper className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">환경 뉴스</h1>
                                <p className="text-sm font-medium text-slate-500">환경, 에너지, 지속가능성 이슈를 빠르게 확인하세요.</p>
                            </div>
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        {total ? `검색 결과 ${Math.min(news.length, total).toLocaleString()} / ${total.toLocaleString()}건` : "실시간 뉴스 검색"}
                    </div>
                </div>
            </div>

            <div className="card p-6 space-y-4">
                <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder="예: 탄소중립, 재생에너지, 미세먼지"
                            className="input-base w-full pl-11"
                            maxLength={60}
                        />
                    </div>
                    <button type="submit" className="btn-primary px-6" disabled={loading}>
                        검색
                    </button>
                </form>

                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">정렬</span>
                        <select
                            value={sortBy}
                            onChange={(event) => handleSortChange(event.target.value)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            disabled={loading}
                        >
                            <option value="sim">정확도순</option>
                            <option value="date">최신순</option>
                        </select>
                    </label>

                    <label className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">결과 수</span>
                        <select
                            value={display}
                            onChange={(event) => handleDisplayChange(Number(event.target.value))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            disabled={loading}
                        >
                            <option value={10}>10개</option>
                            <option value={20}>20개</option>
                            <option value={30}>30개</option>
                            <option value={50}>50개</option>
                        </select>
                    </label>
                </div>

                <div>
                    <div className="mb-2 text-sm font-semibold text-slate-700">빠른 검색어</div>
                    <div className="flex flex-wrap gap-2">
                        {quickKeywords.map((keyword) => (
                            <button
                                key={keyword}
                                type="button"
                                onClick={() => handleKeywordClick(keyword)}
                                disabled={loading}
                                className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                #{keyword}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? <LoadingSpinner text="뉴스를 검색하는 중..." /> : null}
            {!loading && error ? <ErrorMessage message={error} onRetry={retry} /> : null}

            {!loading && !error && news.length > 0 ? (
                <div className="space-y-4">
                    {news.map((item) => (
                        <NewsCard key={item.id} item={item} />
                    ))}
                </div>
            ) : null}

            {!loading && !error && news.length === 0 ? (
                <div className="card p-12 text-center">
                    <Newspaper className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">뉴스를 검색해보세요</h3>
                    <p className="text-slate-600">관심 있는 환경 키워드로 최신 뉴스를 찾아볼 수 있습니다.</p>
                </div>
            ) : null}
        </div>
    );
};

const formatDate = (dateString) => {
    if (!dateString) return "날짜 정보 없음";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return formatRelativeTime(date);
};

const NewsCard = ({ item }) => (
    <article className="card p-6 transition-all hover:shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row">
            <div className="min-w-0 flex-1">
                <h3 className="mb-2 line-clamp-2 text-lg font-bold text-slate-900 transition-colors hover:text-emerald-700">
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                        {item.title}
                    </a>
                </h3>
                <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(item.pubDate)}
                    </span>
                    {item.originalLink ? (
                        <a
                            href={item.originalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-700 hover:underline"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            원문 보기
                        </a>
                    ) : null}
                </div>
            </div>

            <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex h-10 items-center justify-center whitespace-nowrap px-4 text-sm"
            >
                <ExternalLink className="mr-1 h-4 w-4" />
                읽기
            </a>
        </div>
    </article>
);

export default News;
