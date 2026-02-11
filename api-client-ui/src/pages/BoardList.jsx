import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Search,
    PlusCircle,
    Eye,
    MessageCircle,
    Heart,
    Filter,
    SortAsc,
    Calendar,
} from "lucide-react";
import { useBoards } from "../hooks/useBoards";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import {
    getBoardKindLabel,
    getBoardKindColor,
    formatRelativeTime,
    truncateText,
    formatNumber,
} from "../utils/helpers";

export const BoardList = () => {
    const { kind = "FREE_BOARD" } = useParams();
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("latest");

    const { boards, loading, error, pageInfo } = useBoards(kind, page, 10);

    // 검색 처리
    const filteredBoards = boards.filter((board) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            board.title?.toLowerCase().includes(searchLower) ||
            board.contents?.toLowerCase().includes(searchLower) ||
            board.board_creator?.toLowerCase().includes(searchLower)
        );
    });

    // 정렬 처리
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

    if (loading) {
        return <LoadingSpinner text="게시글을 불러오는 중..." />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {getBoardKindLabel(kind)}
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        총 {formatNumber(pageInfo.totalElements)}개의 게시글
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/app/boards/${kind}/new`)}
                    className="btn-primary"
                >
                    <PlusCircle className="h-4 w-4 inline mr-2" />
                    글쓰기
                </button>
            </div>

            {/* 검색 및 필터 */}
            <div className="card p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 검색 */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="제목, 내용, 작성자 검색..."
                            className="input-base pl-11"
                        />
                    </div>

                    {/* 정렬 */}
                    <div className="relative">
                        <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="input-base pl-11"
                        >
                            <option value="latest">최신순</option>
                            <option value="popular">조회순</option>
                            <option value="likes">좋아요순</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 게시글 목록 */}
            {sortedBoards.length === 0 ? (
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
                <div className="space-y-3">
                    {sortedBoards.map((board) => (
                        <BoardCard
                            key={board.board_id || board.boardId}
                            board={board}
                            kind={kind}
                        />
                    ))}
                </div>
            )}

            {/* 페이지네이션 */}
            {!searchTerm && sortedBoards.length > 0 && (
                <Pagination
                    currentPage={page}
                    totalPages={pageInfo.totalPages}
                    onPageChange={setPage}
                />
            )}
        </div>
    );
};

const BoardCard = ({ board, kind }) => {
    const boardId = board.board_id || board.boardId;
    const hasFiles = (board.upload_files || board.uploadFiles || []).length > 0;

    return (
        <Link
            to={`/app/boards/${kind}/${boardId}`}
            className="card p-5 hover:shadow-lg transition-all block group"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* 제목 */}
                    <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {board.title}
                        {hasFiles && (
                            <span className="ml-2 text-xs text-slate-400">[파일]</span>
                        )}
                    </h3>

                    {/* 내용 미리보기 */}
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {truncateText(board.contents || board.content || "", 150)}
                    </p>

                    {/* 메타 정보 */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              {board.board_creator || board.boardCreator || "익명"}
            </span>
                        <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
                            {formatRelativeTime(board.created_at)}
            </span>
                        <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
                            {formatNumber(board.view_count || board.viewCount || 0)}
            </span>
                        <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
                            {formatNumber(board.comment_count || board.commentCount || 0)}
            </span>
                        <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
                            {formatNumber(board.like_count || board.likeCount || 0)}
            </span>
                    </div>
                </div>

                {/* 카테고리 뱃지 */}
                <span
                    className={`badge ${getBoardKindColor(
                        board.board_kind || board.boardKind
                    )} flex-shrink-0`}
                >
          {getBoardKindLabel(board.board_kind || board.boardKind)}
        </span>
            </div>
        </Link>
    );
};