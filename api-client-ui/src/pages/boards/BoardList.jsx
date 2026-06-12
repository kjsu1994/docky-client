import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Eye,
    Filter,
    Heart,
    Image as ImageIcon,
    Megaphone,
    PlusCircle,
    Search,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useBoards } from "../../hooks/useBoards.js";
import { BOARD_SEARCH_MAX_LENGTH, boardAdapter, normalizeBoardSearchValue } from "../../adapters/boardAdapter.js";
import { EmptyState } from "../../components/EmptyState.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { ListSkeleton } from "../../components/Skeleton.jsx";
import { confirmAction } from "../../common/confirmAction.jsx";
import { canManageByOwnerOrAdmin, isAdminUser } from "../../utils/authorization.js";
import {
    formatNumber,
    formatRelativeTime,
    getBoardKindLabel,
    isSafeBoardContentImageUrl,
    resolveAssetUrl,
    stripHtmlTags,
    truncateText,
} from "../../utils/helpers.js";
import { logClientError } from "../../utils/clientDiagnostics.js";
import { notifyError, notifySuccess } from "../../utils/toast.js";

const isBoardNotice = (board) => {
    const kind = board.kind_of_board || board.kindOfBoard;
    return kind === "ADMIN_NOTICE" || board.is_notice === true || board.isNotice === true;
};

export const BoardList = () => {
    const { kind = "FREE_BOARD" } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = isAdminUser(user);

    const [subTab, setSubTab] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("latest");
    const [refreshKey, setRefreshKey] = useState(0);
    const [paging, setPaging] = useState({ page: 1, size: 10 });

    const isFreeBoard = kind === "FREE_BOARD";
    const activeKind = isFreeBoard && subTab === "notice" ? "ADMIN_NOTICE" : kind;
    const shouldFetchPinnedNotices = isFreeBoard && subTab === "all";
    const boardQuery = useMemo(() => ({
        searchType: "ALL",
        searchValue: debouncedSearchTerm,
        sortBy,
    }), [debouncedSearchTerm, sortBy]);

    const { boards, loading, error, pageInfo } = useBoards(activeKind, paging.page, paging.size, refreshKey, boardQuery);
    const { boards: pinnedNotices, pageInfo: pinnedNoticePageInfo } = useBoards("ADMIN_NOTICE", 1, 5, refreshKey, {
        ...boardQuery,
        enabled: shouldFetchPinnedNotices,
    });

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchTerm(normalizeBoardSearchValue(searchTerm));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setPaging((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, [kind, subTab, debouncedSearchTerm, sortBy]);

    const { noticeBoards, regularBoards, filteredCount } = useMemo(() => {
        const activePageNotices = activeKind === "ADMIN_NOTICE" ? boards : [];
        const activePageRegulars = activeKind === "ADMIN_NOTICE" ? [] : boards.filter((board) => !isBoardNotice(board));
        const visibleNotices = shouldFetchPinnedNotices ? pinnedNotices : activePageNotices;
        const totalNotices = shouldFetchPinnedNotices
            ? (pinnedNoticePageInfo?.totalElements || visibleNotices.length)
            : visibleNotices.length;
        const totalRegulars = activeKind === "ADMIN_NOTICE"
            ? 0
            : (pageInfo?.totalElements || activePageRegulars.length);

        return {
            noticeBoards: visibleNotices,
            regularBoards: activePageRegulars,
            filteredCount: activeKind === "ADMIN_NOTICE"
                ? (pageInfo?.totalElements || visibleNotices.length)
                : totalRegulars + totalNotices,
        };
    }, [activeKind, boards, pageInfo?.totalElements, pinnedNoticePageInfo?.totalElements, pinnedNotices, shouldFetchPinnedNotices]);

    const handlePageChange = (newPage) => {
        setPaging((prev) => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSizeChange = (newSize) => {
        setPaging({ page: 1, size: newSize });
    };

    const handleDeleteBoard = async (boardId) => {
        const confirmed = await confirmAction({
            title: "게시글을 삭제할까요?",
            description: "목록에서 즉시 제거되며 되돌릴 수 없습니다.",
            confirmText: "삭제",
        });
        if (!confirmed) return;

        try {
            await boardAdapter.deleteBoard(boardId);
            notifySuccess("삭제되었습니다.");
            setRefreshKey((prev) => prev + 1);
        } catch (error) {
            logClientError("boards.list.delete", error);
            notifyError("게시글 삭제에 실패했습니다.");
        }
    };

    const canWrite = kind !== "ADMIN_NOTICE" || isAdmin;
    const newBoardKind = isFreeBoard && subTab === "notice" ? "ADMIN_NOTICE" : kind;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{getBoardKindLabel(kind)}</h1>
                    <p className="mt-1 text-sm text-slate-500">총 {formatNumber(filteredCount)}개의 게시글</p>
                </div>
                {canWrite && (
                    <button
                        type="button"
                        onClick={() => navigate(`/app/boards/${newBoardKind}/new`)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <PlusCircle className="h-4 w-4" />
                        글쓰기
                    </button>
                )}
            </div>

            {isFreeBoard && (
                <div className="flex gap-8 border-b border-slate-200">
                    {[["all", "전체"], ["notice", "공지"], ["normal", "일반"]].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setSubTab(id)}
                            className={`relative pb-3 text-sm font-bold transition-all ${subTab === id ? "text-primary-600" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            {label}
                            {subTab === id && <div className="absolute bottom-0 left-0 h-0.5 w-full animate-fade-in bg-primary-600" />}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="검색어 입력"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value.slice(0, BOARD_SEARCH_MAX_LENGTH))}
                        maxLength={BOARD_SEARCH_MAX_LENGTH}
                        className="input-base w-full pl-9"
                    />
                    <div className="mt-1 text-right text-xs font-medium text-slate-400">
                        검색어 {searchTerm.length}/{BOARD_SEARCH_MAX_LENGTH}자
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="input-base text-sm">
                        <option value="latest">최신순</option>
                        <option value="popular">조회순</option>
                        <option value="likes">좋아요순</option>
                    </select>
                    <select value={paging.size} onChange={(event) => handleSizeChange(Number(event.target.value))} className="input-base text-sm">
                        {[10, 20, 50].map((size) => <option key={size} value={size}>{size}개씩</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <ListSkeleton count={5} />
            ) : error ? (
                <div className="space-y-3">
                    <ErrorMessage message={error} />
                    <button type="button" className="btn-secondary" onClick={() => setRefreshKey((prev) => prev + 1)}>
                        다시 시도
                    </button>
                </div>
            ) : filteredCount === 0 ? (
                <div className="space-y-4">
                    <EmptyState message="게시글이 없습니다." subMessage="새로운 이야기를 시작해 보세요." />
                    {canWrite && (
                        <button type="button" className="btn-primary" onClick={() => navigate(`/app/boards/${newBoardKind}/new`)}>
                            첫 글 작성하기
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {noticeBoards.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                                <Megaphone className="h-4 w-4" />
                                필독 공지사항
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {noticeBoards.map((board, index) => (
                                    <div key={board.board_id || board.boardId} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                                        <NoticeBoardCard
                                            board={board}
                                            user={user}
                                            onDelete={handleDeleteBoard}
                                            onOpen={() => navigate(`/app/boards/${board.kind_of_board || board.kindOfBoard || kind}/${board.board_id || board.boardId}`)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {regularBoards.length > 0 && (
                        <div className="mt-4 space-y-3">
                            {subTab === "all" && noticeBoards.length > 0 && (
                                <div className="mb-2 flex items-center gap-2 border-t pt-4 text-sm font-semibold text-slate-700">
                                    <ImageIcon className="h-4 w-4" />
                                    일반 게시글
                                </div>
                            )}
                            {regularBoards.map((board, index) => (
                                <div key={board.board_id || board.boardId} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                                    <BoardCard
                                        board={board}
                                        user={user}
                                        onDelete={handleDeleteBoard}
                                        onOpen={() => navigate(`/app/boards/${board.kind_of_board || board.kindOfBoard || kind}/${board.board_id || board.boardId}`)}
                                        onEdit={() => navigate(`/app/boards/${board.kind_of_board || board.kindOfBoard || kind}/${board.board_id || board.boardId}/edit`)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {pageInfo?.totalPages > 1 && (
                        <div className="py-4">
                            <Pagination currentPage={paging.page} totalPages={pageInfo.totalPages} onPageChange={handlePageChange} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const BoardCard = ({ board, user, onDelete, onOpen, onEdit }) => {
    const canManage = canManageByOwnerOrAdmin(user, board.member, {
        ownerName: board.board_creator || board.boardCreator,
        userName: user?.name,
    });
    const contentHtml = board.contents || board.content || "";
    const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    const resolvedThumbnailUrl = imgMatch ? resolveAssetUrl(imgMatch[1]) : null;
    const thumbnailUrl = resolvedThumbnailUrl && isSafeBoardContentImageUrl(resolvedThumbnailUrl) ? resolvedThumbnailUrl : null;
    const [imgError, setImgError] = useState(false);

    return (
        <div onClick={onOpen} className="card group flex min-h-[120px] cursor-pointer items-stretch overflow-hidden transition-all hover:shadow-lg">
            {thumbnailUrl && !imgError && (
                <div className="relative w-32 flex-shrink-0 border-r bg-slate-100 sm:w-40">
                    <img
                        src={thumbnailUrl}
                        alt="게시글 이미지"
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={() => setImgError(true)}
                    />
                </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5">
                <div>
                    <div className="mb-1 flex items-start justify-between">
                        <h3 className="line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-primary-600 sm:text-lg">{board.title}</h3>
                        {canManage && (
                            <div className="ml-2 flex shrink-0 gap-1">
                                <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">수정</button>
                                <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(board.board_id || board.boardId); }} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">삭제</button>
                            </div>
                        )}
                    </div>
                    <p className="mb-3 line-clamp-2 text-sm text-slate-500">{truncateText(stripHtmlTags(contentHtml), 150)}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="font-medium text-slate-600">{board.board_creator || board.boardCreator || "익명"}</span>
                    <span>{formatRelativeTime(new Date(board.created_at || board.createdAt))}</span>
                    <div className="ml-auto flex gap-3">
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatNumber(board.view_count || board.viewCount || 0)}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatNumber(board.like_count || board.likeCount || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const NoticeBoardCard = ({ board, onDelete, onOpen, user }) => {
    const canManage = canManageByOwnerOrAdmin(user, board.member, {
        ownerName: board.board_creator || board.boardCreator,
        userName: user?.name,
    });

    return (
        <div onClick={onOpen} className="relative cursor-pointer overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 transition-all hover:shadow-md">
            <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-amber-600">
                <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" />공지</span>
                {canManage && (
                    <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(board.board_id || board.boardId); }} className="rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-50">
                        삭제
                    </button>
                )}
            </div>
            <h3 className="line-clamp-1 text-sm font-bold text-slate-900">{board.title}</h3>
            <p className="mt-1 line-clamp-1 text-xs text-slate-600 opacity-80">{truncateText(stripHtmlTags(board.contents || board.content || ""), 80)}</p>
        </div>
    );
};
