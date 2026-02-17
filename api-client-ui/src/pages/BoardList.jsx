import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Search,
    PlusCircle,
    Eye,
    Heart,
    Filter,
    Calendar,
    Image as ImageIcon,
    Megaphone,
} from "lucide-react";
import { useBoards } from "../hooks/useBoards";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import {
    getBoardKindLabel,
    formatRelativeTime,
    truncateText,
    formatNumber,
    stripHtmlTags,
} from "../utils/helpers";

// MinIO Docker 내부 URL → 브라우저 접근 가능 URL로 변환
const toPublicUrl = (url) => {
    if (!url) return null;
    return url
        .replace("http://host.docker.internal:9000", "http://localhost:9000")
        .replace("http://minio:9000", "http://localhost:9000");
};

// 이미지 파일 여부 확인
const isImageUrl = (url) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
};

const hasRole = (roles, roleName) => {
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes(roleName);
    return String(roles).includes(roleName);
};

const isAdminPost = (board) => {
    if (!board) return false;
    if (board.is_notice === true || board.isNotice === true) return true;
    if (board.admin_post === true || board.adminPost === true) return true;

    return (
        hasRole(board.roles, "ROLE_ADMIN") ||
        hasRole(board.role, "ROLE_ADMIN") ||
        hasRole(board.member?.roles, "ROLE_ADMIN") ||
        hasRole(board.member?.role, "ROLE_ADMIN")
    );
};

export const BoardList = () => {
    const { kind = "FREE_BOARD" } = useParams();
    const navigate = useNavigate();
    const [pagingByKind, setPagingByKind] = useState({
        FREE_BOARD: { page: 1, size: 10 },
        ECO_REVIEW: { page: 1, size: 10 },
        GREEN_ACTIVE: { page: 1, size: 10 },
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("latest");

    const currentPaging = pagingByKind[kind] || { page: 1, size: 10 };
    const page = currentPaging.page;
    const size = currentPaging.size;

    const { boards, loading, error, pageInfo } = useBoards(kind, page, size);

    const filteredBoards = boards.filter((board) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        const plainContents = stripHtmlTags(board.contents || board.content || "");
        return (
            board.title?.toLowerCase().includes(searchLower) ||
            plainContents.toLowerCase().includes(searchLower) ||
            board.board_creator?.toLowerCase().includes(searchLower)
        );
    });

    const sortedBoards = [...filteredBoards].sort((a, b) => {
        switch (sortBy) {
            case "latest":
                return new Date(b.created_at) - new Date(a.created_at);
            case "popular":
                return (b.view_count || 0) - (a.view_count || 0);
            case "likes":
                return (b.like_count || 0) - (a.like_count || 0);
            default:
                return 0;
        }
    });

    const noticeBoards = sortedBoards.filter(isAdminPost);
    const regularBoards = sortedBoards.filter((board) => !isAdminPost(board));

    const handlePageChange = (newPage) => {
        setPagingByKind((prev) => ({
            ...prev,
            [kind]: {
                ...(prev[kind] || { size: 10 }),
                page: newPage,
            },
        }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSizeChange = (newSize) => {
        setPagingByKind((prev) => ({
            ...prev,
            [kind]: {
                page: 1,
                size: newSize,
            },
        }));
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {getBoardKindLabel(kind)}
                    </h1>
                    {pageInfo?.totalElements > 0 && (
                        <p className="text-sm text-slate-500 mt-1">
                            총 {formatNumber(pageInfo.totalElements)}개의 게시글
                        </p>
                    )}
                </div>
                <button
                    onClick={() => navigate(`/app/boards/${kind}/new`)}
                    className="btn-primary flex items-center gap-2"
                >
                    <PlusCircle className="h-4 w-4" />
                    글쓰기
                </button>
            </div>

            {/* 검색 + 정렬 */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="제목, 내용, 작성자 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-base pl-9 w-full"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="input-base"
                    >
                        <option value="latest">최신순</option>
                        <option value="popular">조회순</option>
                        <option value="likes">좋아요순</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">표시 개수</span>
                    <select
                        value={size}
                        onChange={(e) => handleSizeChange(Number(e.target.value))}
                        className="input-base"
                    >
                        <option value={10}>10개</option>
                        <option value={20}>20개</option>
                        <option value={50}>50개</option>
                    </select>
                </div>
            </div>

            {/* 게시글 목록 */}
            {loading ? (
                <LoadingSpinner text="게시글 불러오는 중..." />
            ) : error ? (
                <ErrorMessage message={error} />
            ) : sortedBoards.length === 0 ? (
                <EmptyState
                    title="게시글이 없습니다"
                    description={
                        searchTerm
                            ? "검색 결과가 없습니다. 다른 키워드로 검색해보세요."
                            : "첫 번째 게시글을 작성해보세요!"
                    }
                    actionLabel={!searchTerm ? "글쓰기" : ""}
                    onAction={
                        !searchTerm ? () => navigate(`/app/boards/${kind}/new`) : null
                    }
                />
            ) : (
                <>
                    {noticeBoards.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                                <Megaphone className="h-4 w-4" />
                                관리자 공지
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {noticeBoards.map((board) => (
                                    <NoticeBoardCard
                                        key={`notice-${board.board_id || board.boardId}`}
                                        board={board}
                                        kind={kind}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        {regularBoards.map((board) => (
                            <BoardCard
                                key={board.board_id || board.boardId}
                                board={board}
                                kind={kind}
                            />
                        ))}
                    </div>

                    {!searchTerm && pageInfo?.totalPages > 1 && (
                        <div className="py-4">
                            <Pagination
                                currentPage={page}
                                totalPages={pageInfo.totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const BoardCard = ({ board, kind }) => {
    const boardId = board.board_id || board.boardId;
    const plainContents = stripHtmlTags(board.contents || board.content || "");

    // delegateImagePath: 게시글 대표 이미지 URL (백엔드가 업로드 파일 중 마지막 이미지를 저장)
    const rawThumbnail = board.delegate_image_path || board.delegateImagePath || null;
    const thumbnailUrl = isImageUrl(rawThumbnail) ? toPublicUrl(rawThumbnail) : null;

    // 이미지 로드 실패 시 fallback 처리
    const [imgError, setImgError] = useState(false);
    const showThumbnail = thumbnailUrl && !imgError;

    return (
        <Link
            to={`/app/boards/${kind}/${boardId}`}
            className="card hover:shadow-lg transition-all block group overflow-hidden"
        >
            <div className="flex items-stretch">

                {/* ── 썸네일 영역 ── */}
                {showThumbnail ? (
                    <div className="w-32 sm:w-40 flex-shrink-0 relative bg-slate-100">
                        <img
                            src={thumbnailUrl}
                            alt="게시글 썸네일"
                            className="w-full h-full object-cover"
                            style={{ minHeight: "110px", maxHeight: "140px" }}
                            onError={() => setImgError(true)}
                        />
                    </div>
                ) : (
                    // 이미지 없을 때는 0px (공간 차지 안 함)
                    null
                )}

                {/* ── 텍스트 영역 ── */}
                <div className={`flex-1 min-w-0 p-4 ${showThumbnail ? "sm:p-5" : "p-5"}`}>
                    {/* 제목 */}
                    <h3 className="font-semibold text-slate-900 mb-1.5 group-hover:text-primary-600 transition-colors line-clamp-1 text-base">
                        {board.title}
                    </h3>

                    {/* 본문 미리보기 */}
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                        {truncateText(plainContents, 150)}
                    </p>

                    {/* 하단 메타 정보 */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {/* 작성자 */}
                        <span className="font-medium text-slate-600">
                            {board.board_creator || board.boardCreator || "익명"}
                        </span>

                        {/* 날짜 */}
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatRelativeTime(new Date(board.created_at || board.createdAt))}
                        </span>

                        {/* 구분선 */}
                        <span className="ml-auto flex items-center gap-3">
                            {/* 조회수 */}
                            <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {formatNumber(board.view_count || board.viewCount || 0)}
                            </span>
                            {/* 좋아요 */}
                            <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {formatNumber(board.like_count || board.likeCount || 0)}
                            </span>
                            {/* 이미지 첨부 뱃지 (이미지 없을 때만 아이콘으로 표시) */}
                            {!showThumbnail && rawThumbnail && (
                                <span className="flex items-center gap-1 text-slate-300">
                                    <ImageIcon className="h-3 w-3" />
                                </span>
                            )}
                        </span>
                    </div>
                </div>

            </div>
        </Link>
    );
};

const NoticeBoardCard = ({ board, kind }) => {
    const boardId = board.board_id || board.boardId;
    const plainContents = stripHtmlTags(board.contents || board.content || "");
    return (
        <Link
            to={`/app/boards/${kind}/${boardId}`}
            className="block rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 hover:shadow-sm transition-all"
        >
            <div className="flex items-center justify-between gap-2 text-[11px] text-amber-700 mb-1">
                <span className="font-bold">공지</span>
                <span>{formatRelativeTime(new Date(board.created_at || board.createdAt))}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                {board.title}
            </h3>
            <div className="mt-1 text-xs text-slate-600 line-clamp-1">
                {truncateText(plainContents, 80)}
            </div>
        </Link>
    );
};
