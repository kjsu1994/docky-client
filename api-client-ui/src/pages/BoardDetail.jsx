import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Eye,
    Heart,
    MessageCircle,
    Download,
    FileText,
    Image as ImageIcon,
    Trash2,
    Edit,
    Send,
} from "lucide-react";
import { useBoardDetail } from "../hooks/useBoards";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import {
    formatDate,
    formatNumber,
    isImageFile,
    getBoardKindLabel,
    getBoardKindColor,
} from "../utils/helpers";
import api from "../utils/api";
import toast from "react-hot-toast";

export const BoardDetail = () => {
    const { kind, boardId } = useParams();
    const navigate = useNavigate();
    const { board, loading, error, refetch } = useBoardDetail(boardId);
    const [commentText, setCommentText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleLike = async () => {
        try {
            await api.post(`/boards/${boardId}/like`);
            toast.success("좋아요!");
            refetch();
        } catch (error) {
            toast.error("좋아요 실패");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;

        try {
            await api.delete(`/boards/${boardId}`);
            toast.success("게시글이 삭제되었습니다");
            navigate(`/app/boards/${kind}`);
        } catch (error) {
            toast.error("삭제 실패");
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        setSubmitting(true);
        try {
            await api.post(`/boards/${boardId}/comments`, {
                content: commentText,
            });
            setCommentText("");
            toast.success("댓글이 등록되었습니다");
            refetch();
        } catch (error) {
            toast.error("댓글 등록 실패");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <LoadingSpinner text="게시글을 불러오는 중..." />;
    }

    if (error) {
        return (
            <div className="space-y-4">
                <button
                    onClick={() => navigate(`/app/boards/${kind}`)}
                    className="btn-secondary"
                >
                    <ArrowLeft className="h-4 w-4 inline mr-2" />
                    목록으로
                </button>
                <ErrorMessage message={error} />
            </div>
        );
    }

    if (!board) {
        return <ErrorMessage message="게시글을 찾을 수 없습니다" />;
    }

    const uploadFiles = board.upload_files || board.uploadFiles || [];

    return (
        <div className="space-y-6">
            {/* 상단 액션 */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(`/app/boards/${kind}`)}
                    className="btn-secondary"
                >
                    <ArrowLeft className="h-4 w-4 inline mr-2" />
                    목록으로
                </button>

                <div className="flex items-center gap-2">
                    <button onClick={handleLike} className="btn-secondary">
                        <Heart className="h-4 w-4 inline mr-2" />
                        좋아요 {formatNumber(board.like_count || board.likeCount || 0)}
                    </button>
                    <button
                        onClick={() => navigate(`/app/boards/${kind}/${boardId}/edit`)}
                        className="btn-secondary"
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={handleDelete} className="btn-secondary text-red-600">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* 게시글 내용 */}
            <div className="card p-8">
                {/* 헤더 */}
                <div className="border-b pb-6 mb-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <h1 className="text-3xl font-bold text-slate-900 flex-1">
                            {board.title}
                        </h1>
                        <span
                            className={`badge ${getBoardKindColor(
                                board.board_kind || board.boardKind
                            )} flex-shrink-0`}
                        >
              {getBoardKindLabel(board.board_kind || board.boardKind)}
            </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-slate-900">
              {board.board_creator || board.boardCreator || "익명"}
            </span>
                        <span className="text-slate-500">
              {formatDate(board.created_at)}
            </span>
                        <div className="flex items-center gap-4 text-slate-500">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                  {formatNumber(board.view_count || board.viewCount || 0)}
              </span>
                            <span className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                                {formatNumber(board.comment_count || board.commentCount || 0)}
              </span>
                            <span className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                                {formatNumber(board.like_count || board.likeCount || 0)}
              </span>
                        </div>
                    </div>
                </div>

                {/* 본문 */}
                <div className="prose max-w-none mb-8">
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                        {board.contents || board.content || ""}
                    </div>
                </div>

                {/* 첨부 파일 */}
                {uploadFiles.length > 0 && (
                    <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">
                            첨부파일 ({uploadFiles.length})
                        </h3>
                        <div className="space-y-2">
                            {uploadFiles.map((file, index) => (
                                <FileItem key={index} file={file} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 댓글 섹션 */}
            <div className="card p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-6">
                    댓글 ({formatNumber(board.comment_count || board.commentCount || 0)})
                </h2>

                {/* 댓글 작성 */}
                <form onSubmit={handleCommentSubmit} className="mb-8">
                    <div className="flex gap-3">
            <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="input-base resize-none"
                rows="3"
            />
                        <button
                            type="submit"
                            disabled={!commentText.trim() || submitting}
                            className="btn-primary h-fit"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </form>

                {/* 댓글 목록 */}
                <div className="space-y-4">
                    {(board.comments || []).map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))}
                    {(!board.comments || board.comments.length === 0) && (
                        <p className="text-center text-sm text-slate-500 py-8">
                            첫 댓글을 작성해보세요!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const FileItem = ({ file }) => {
    const fileName = file.original_name || file.originalName || file.name || "";
    const fileUrl = file.file_url || file.fileUrl || file.url || "";

    return (
        <a
            href={fileUrl}
            download
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
        >
            {isImageFile(fileName) ? (
                <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-5 w-5 text-blue-600" />
                </div>
            ) : (
                <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-slate-600" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                    {fileName}
                </p>
                <p className="text-xs text-slate-500">
                    {file.file_size || file.fileSize || ""}
                </p>
            </div>
            <Download className="h-5 w-5 text-slate-400 group-hover:text-primary-600 flex-shrink-0" />
        </a>
    );
};

const CommentItem = ({ comment }) => {
    return (
        <div className="flex gap-4 p-4 rounded-lg bg-slate-50">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-slate-900">
            {comment.author || comment.creator || "익명"}
          </span>
                    <span className="text-xs text-slate-500">
            {formatDate(comment.created_at || comment.createdAt)}
          </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {comment.content}
                </p>
            </div>
        </div>
    );
};