import { useState, useEffect } from "react";
import { Search, Newspaper, ExternalLink, Calendar, TrendingUp } from "lucide-react";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatRelativeTime } from "../utils/helpers";

export const News = () => {
    const [query, setQuery] = useState("AI");
    const [searchInput, setSearchInput] = useState("AI");
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sortBy, setSortBy] = useState("sim"); // sim: 정확도순, date: 날짜순
    const [display, setDisplay] = useState(20);

    // 뉴스 검색
    const fetchNews = async (searchQuery = query, sortType = sortBy, displayCount = display) => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/news", {
                params: {
                    query: searchQuery,
                    sort: sortType,
                    display: displayCount,
                    start: 1
                }
            });

            // API 응답 구조에 따라 처리
            const newsData = response.data?.items || response.data || [];
            setNews(newsData);

            if (newsData.length === 0) {
                setError("검색 결과가 없습니다. 다른 키워드로 검색해보세요.");
            }
        } catch (err) {
            console.error("Failed to fetch news:", err);
            setError(err.response?.data?.message || "뉴스를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 초기 로드
    useEffect(() => {
        fetchNews();
    }, []);

    // 검색 핸들러
    const handleSearch = (e) => {
        e.preventDefault();
        if (!searchInput.trim()) {
            setError("검색어를 입력해주세요.");
            return;
        }
        setQuery(searchInput);
        fetchNews(searchInput, sortBy, display);
    };

    // 정렬 변경
    const handleSortChange = (newSort) => {
        setSortBy(newSort);
        fetchNews(query, newSort, display);
    };

    // HTML 태그 제거 및 특수문자 변환
    const cleanHtml = (html) => {
        if (!html) return "";
        return html
            .replace(/<[^>]*>/g, "")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .replace(/<b>/g, "")
            .replace(/<\/b>/g, "");
    };

    // 날짜 포맷팅
    const formatDate = (dateString) => {
        try {
            // "Wed, 12 Feb 2026 10:30:00 +0900" 형식
            const date = new Date(dateString);
            return formatRelativeTime(date);
        } catch {
            return dateString;
        }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="card p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <Newspaper className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">환경 뉴스</h1>
                </div>
                <p className="text-blue-100">최신 환경 관련 뉴스를 검색하고 확인하세요</p>
            </div>

            {/* 검색 및 필터 */}
            <div className="card p-6 space-y-4">
                {/* 검색바 */}
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="환경, 탄소중립, 재생에너지 등..."
                            className="input-base pl-11 w-full"
                        />
                    </div>
                    <button type="submit" className="btn-primary px-6">
                        검색
                    </button>
                </form>

                {/* 필터 옵션 */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">정렬:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => handleSortChange(e.target.value)}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="sim">정확도순</option>
                            <option value="date">날짜순</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">결과 수:</span>
                        <select
                            value={display}
                            onChange={(e) => {
                                const newDisplay = parseInt(e.target.value);
                                setDisplay(newDisplay);
                                fetchNews(query, sortBy, newDisplay);
                            }}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={10}>10개</option>
                            <option value={20}>20개</option>
                            <option value={30}>30개</option>
                            <option value={50}>50개</option>
                        </select>
                    </div>

                    {news.length > 0 && (
                        <div className="ml-auto text-sm text-slate-600">
                            총 <span className="font-semibold text-blue-600">{news.length}</span>개의 뉴스
                        </div>
                    )}
                </div>

                {/* 인기 키워드 */}
                <div>
                    <div className="text-sm font-semibold text-slate-700 mb-2">인기 검색어:</div>
                    <div className="flex flex-wrap gap-2">
                        {["AI", "바이브코딩", "자동화", "딥러닝", "AI 에이전트", "AI 모델"].map((keyword) => (
                            <button
                                key={keyword}
                                onClick={() => {
                                    setSearchInput(keyword);
                                    setQuery(keyword);
                                    fetchNews(keyword, sortBy, display);
                                }}
                                className="px-3 py-1.5 text-sm rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                            >
                                #{keyword}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 로딩 및 에러 */}
            {loading && <LoadingSpinner text="뉴스를 검색하는 중..." />}
            {error && !loading && <ErrorMessage message={error} />}

            {/* 뉴스 리스트 */}
            {!loading && !error && news.length > 0 && (
                <div className="space-y-4">
                    {news.map((item, index) => (
                        <NewsCard key={index} item={item} cleanHtml={cleanHtml} formatDate={formatDate} />
                    ))}
                </div>
            )}

            {/* 빈 상태 */}
            {!loading && !error && news.length === 0 && (
                <div className="card p-12 text-center">
                    <Newspaper className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        뉴스를 검색해보세요
                    </h3>
                    <p className="text-slate-600">
                        관심 있는 환경 관련 키워드로 최신 뉴스를 찾아보세요.
                    </p>
                </div>
            )}
        </div>
    );
};

// 뉴스 카드 컴포넌트
const NewsCard = ({ item, cleanHtml, formatDate }) => {
    return (
        <div className="card p-6 hover:shadow-lg transition-all group">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    {/* 제목 */}
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                        <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                        >
                            {cleanHtml(item.title)}
                        </a>
                    </h3>

                    {/* 설명 */}
                    <p className="text-slate-600 text-sm mb-3 line-clamp-3">
                        {cleanHtml(item.description)}
                    </p>

                    {/* 메타 정보 */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(item.pubDate)}</span>
                        </div>
                        {item.originallink && (
                            <a
                                href={item.originallink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span>원문 보기</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* 네이버 뉴스 링크 버튼 */}
                <div className="flex sm:flex-col gap-2">
                    <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary whitespace-nowrap text-sm px-4 py-2"
                    >
                        <ExternalLink className="h-4 w-4 inline mr-1" />
                        읽기
                    </a>
                </div>
            </div>
        </div>
    );
};