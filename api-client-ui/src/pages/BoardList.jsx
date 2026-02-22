import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import { ErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import { ListSkeleton } from "../components/Skeleton";
import {
    getBoardKindLabel,
    formatRelativeTime,
    truncateText,
    formatNumber,
    stripHtmlTags,
} from "../utils/helpers";
import { canManageByOwnerOrAdmin, isAdminUser } from "../utils/authorization";

// ── 유틸리티 함수 ──────────────────────────────────────────
const toPublicUrl = (url) => {
    if (!url) return null;
    return url.replace("http://host.docker.internal:9000", "http://localhost:9000").replace("http://minio:9000", "http://localhost:9000");
};

const isBoardNotice = (board) => {
    const bKind = board.kind_of_board || board.kindOfBoard;
    // 주입된 kind_of_board 값을 기반으로 판별
    return bKind === "ADMIN_NOTICE" || board.is_notice === true || board.isNotice === true;
};

// ── 메인 컴포넌트 ──────────────────────────────────────────
export const BoardList = () => {
    const { kind = "FREE_BOARD" } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = isAdminUser(user);

    const [subTab, setSubTab] = useState("all"); // all, notice, normal
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("latest");
    const [refreshKey, setRefreshKey] = useState(0);
    const [paging, setPaging] = useState({ page: 1, size: 10 });

    // 자유게시판인 경우 공지사항(ADMIN_NOTICE)과 일반글(FREE_BOARD)을 함께 가져옴
    const fetchKind = kind === "FREE_BOARD" ? ["FREE_BOARD", "ADMIN_NOTICE"] : kind;
    const { boards, loading, error, pageInfo } = useBoards(fetchKind, paging.page, paging.size, refreshKey);

    // ── 데이터 처리 (useMemo) ──────────────────────────
    const { noticeBoards, regularBoards, filteredCount } = useMemo(() => {
        // 1. 공지사항 여부에 따른 분류
        const notices = boards.filter(isBoardNotice);
        const regulars = boards.filter(b => !isBoardNotice(b));

        // 2. 검색어 필터링 함수
        const applySearch = (list) => {
            if (!searchTerm) return list;
            const lower = searchTerm.toLowerCase();
            return list.filter(b => 
                b.title?.toLowerCase().includes(lower) || 
                stripHtmlTags(b.contents || b.content || "").toLowerCase().includes(lower) ||
                (b.board_creator || b.boardCreator || "").toLowerCase().includes(lower)
            );
        };

        // 3. 현재 탭 상태에 따라 노출할 데이터 결정
        let finalNotices = [];
        let finalRegulars = [];

        if (subTab === "all") {
            finalNotices = applySearch(notices);
            finalRegulars = applySearch(regulars);
        } else if (subTab === "notice") {
            finalNotices = applySearch(notices);
            finalRegulars = [];
        } else if (subTab === "normal") {
            finalNotices = [];
            finalRegulars = applySearch(regulars);
        }

        // 정렬 로직
        const sortFn = (a, b) => {
            if (sortBy === "popular") return (b.view_count || b.viewCount || 0) - (a.view_count || a.viewCount || 0);
            if (sortBy === "likes") return (b.like_count || b.likeCount || 0) - (a.like_count || a.likeCount || 0);
            return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);
        };

        finalNotices.sort(sortFn);
        finalRegulars.sort(sortFn);

        return { 
            noticeBoards: finalNotices, 
            regularBoards: finalRegulars,
            filteredCount: finalNotices.length + finalRegulars.length
        };
    }, [boards, subTab, searchTerm, sortBy]);

    const handlePageChange = (newPage) => {
        setPaging(prev => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSizeChange = (newSize) => {
        setPaging({ page: 1, size: newSize });
    };

    const handleDeleteBoard = async (boardId) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/boards/${boardId}`);
            toast.success("삭제되었습니다.");
            setRefreshKey(prev => prev + 1);
        } catch (err) { toast.error("삭제 실패"); }
    };

    const canWrite = kind !== "ADMIN_NOTICE" || isAdmin;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{getBoardKindLabel(kind)}</h1>
                    <p className="text-sm text-slate-500 mt-1">총 {formatNumber(filteredCount)}개의 게시글</p>
                </div>
                {canWrite && (
                    <button 
                        onClick={() => {
                            const targetKind = (kind === "FREE_BOARD" && subTab === "notice") ? "ADMIN_NOTICE" : kind;
                            navigate(`/app/boards/${targetKind}/new`);
                        }} 
                        className="btn-primary flex items-center gap-2"
                    >
                        <PlusCircle className="h-4 w-4" />글쓰기
                    </button>
                )}
            </div>

            {kind === "FREE_BOARD" && (
                <div className="flex border-b border-slate-200 gap-8">
                    {[["all", "전체"], ["notice", "공지"], ["normal", "일반"]].map(([id, label]) => (
                        <button key={id} onClick={() => setSubTab(id)} className={`pb-3 text-sm font-bold transition-all relative ${subTab === id ? "text-primary-600" : "text-slate-400 hover:text-slate-600"}`}>
                            {label}
                            {subTab === id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600 animate-fade-in" />}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-base pl-9 w-full" />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-base text-sm">
                        <option value="latest">최신순</option>
                        <option value="popular">조회순</option>
                        <option value="likes">좋아요순</option>
                    </select>
                    <select value={paging.size} onChange={(e) => handleSizeChange(Number(e.target.value))} className="input-base text-sm">
                        {[10, 20, 50].map(s => <option key={s} value={s}>{s}개씩</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <ListSkeleton count={5} />
            ) : error ? (
                <ErrorMessage message={error} />
            ) : (filteredCount === 0) ? (
                <EmptyState message="게시글이 없습니다." subMessage="새로운 이야기를 시작해보세요!" />
            ) : (
                <>
                    {/* 1. 공지사항 섹션 */}
                    {noticeBoards.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><Megaphone className="h-4 w-4" />필독 공지사항</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {noticeBoards.map((b, idx) => (
                                    <div key={b.board_id || b.boardId} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                                        <NoticeBoardCard 
                                            board={b} 
                                            user={user} 
                                            onDelete={handleDeleteBoard} 
                                            onOpen={() => navigate(`/app/boards/${b.kind_of_board || kind}/${b.board_id || b.boardId}`)} 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. 일반 게시글 섹션 */}
                    {regularBoards.length > 0 && (
                        <div className="space-y-3 mt-4">
                            {subTab === "all" && noticeBoards.length > 0 && (
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2 border-t pt-4">
                                    <ImageIcon className="h-4 w-4" />일반 게시글
                                </div>
                            )}
                            {regularBoards.map((b, idx) => (
                                <div key={b.board_id || b.boardId} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                                    <BoardCard 
                                        board={b} 
                                        user={user} 
                                        onDelete={handleDeleteBoard} 
                                        onOpen={() => navigate(`/app/boards/${b.kind_of_board || kind}/${b.board_id || b.boardId}`)} 
                                        onEdit={() => navigate(`/app/boards/${b.kind_of_board || kind}/${b.board_id || b.boardId}/edit`)} 
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {pageInfo?.totalPages > 1 && <div className="py-4"><Pagination currentPage={paging.page} totalPages={pageInfo.totalPages} onPageChange={handlePageChange} /></div>}
                </>
            )}
        </div>
    );
};

const BoardCard = ({ board, user, onDelete, onOpen, onEdit }) => {
    const canManage = canManageByOwnerOrAdmin(user, board.member, { ownerName: board.board_creator || board.boardCreator, userName: user?.name });
    const contentHtml = board.contents || board.content || "";
    const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    const thumbnailUrl = imgMatch ? toPublicUrl(imgMatch[1]) : null;
    const [imgError, setImgError] = useState(false);

    return (
        <div onClick={onOpen} className="card hover:shadow-lg transition-all group overflow-hidden cursor-pointer flex items-stretch min-h-[120px]">
            {thumbnailUrl && !imgError && (
                <div className="w-32 sm:w-40 flex-shrink-0 bg-slate-100 border-r relative">
                    <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                </div>
            )}
            <div className="flex-1 p-4 sm:p-5 min-w-0 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors line-clamp-1 text-base sm:text-lg">{board.title}</h3>
                        {canManage && (
                            <div className="flex gap-1 ml-2 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50">수정</button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(board.board_id || board.boardId); }} className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50">삭제</button>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{truncateText(stripHtmlTags(contentHtml), 150)}</p>
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
    const canManage = canManageByOwnerOrAdmin(user, board.member, { ownerName: board.board_creator || board.boardCreator, userName: user?.name });
    return (
        <div onClick={onOpen} className="p-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
            <div className="flex items-center justify-between mb-1 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" />Notice</span>
                {canManage && <button onClick={(e) => { e.stopPropagation(); onDelete(board.board_id || board.boardId); }} className="text-[11px] px-2 py-0.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 font-bold">삭제</button>}
            </div>
            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{board.title}</h3>
            <p className="text-xs text-slate-600 mt-1 line-clamp-1 opacity-80">{truncateText(stripHtmlTags(board.contents || board.content || ""), 80)}</p>
        </div>
    );
};
