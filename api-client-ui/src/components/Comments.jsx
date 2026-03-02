import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Heart, Edit2, Trash2, Send, Flag } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import api from "../utils/api.js";
import toast from "react-hot-toast";
import { formatRelativeTime } from "../utils/helpers.js";
import { canManageByOwnerOrAdmin } from "../utils/authorization.js";
import { normalizeProfileImageUrl } from "../utils/profileImage.js";

export const Comments = ({ boardId, onUpdate }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [fetchError, setFetchError] = useState("");
    const [newComment, setNewComment] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [likingCommentIds, setLikingCommentIds] = useState({});
    const lastFetchedIdRef = useRef(null);

    // 해당 게시글의 댓글 목록을 서버에서 불러온다.
    const fetchComments = useCallback(async (force = false) => {
        if (!boardId) return;
        if (!force && lastFetchedIdRef.current === boardId) return;

        try {
            setFetching(true);
            setFetchError("");
            const response = await api.get("/comments", {
                params: {
                    boardId,
                    page: 1,
                    size: 100,
                },
            });

            lastFetchedIdRef.current = boardId;

            const data = response.data?.data || response.data;
            const content = Array.isArray(data)
                ? data
                : Array.isArray(data?.content)
                    ? data.content
                    : [];
            setComments(content);
        } catch (error) {
            console.error("Failed to fetch comments:", error);
            setFetchError(error?.response?.data?.message || "댓글을 불러오지 못했습니다.");
        } finally {
            setFetching(false);
        }
    }, [boardId]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        const content = newComment.trim();
        if (!content) {
            toast.error("댓글 내용을 입력해주세요.");
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const optimisticComment = {
            comment_id: tempId,
            contents: content,
            created_at: new Date().toISOString(),
            like_count: 0,
            member: {
                name: user?.name || "익명",
                profile_url: user?.profile_url || user?.profileUrl || "",
                profileUrl: user?.profileUrl || user?.profile_url || "",
            },
        };

        setComments((prev) => [optimisticComment, ...prev]);
        setNewComment("");
        setLoading(true);

        try {
            await api.post("/comments", {
                boardId,
                contents: content,
            });
            toast.success("댓글이 작성되었습니다.");
            fetchComments(true);
            if (onUpdate) onUpdate();
        } catch (error) {
            setComments((prev) => prev.filter((comment) => (comment.comment_id || comment.commentId) !== tempId));
            console.error("Failed to create comment:", error);
            toast.error(error.response?.data?.message || "댓글 작성에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (comment) => {
        setEditingId(comment.comment_id || comment.commentId);
        setEditContent(comment.contents);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditContent("");
    };

    const handleUpdateComment = async (commentId) => {
        const nextContent = editContent.trim();
        if (!nextContent) {
            toast.error("댓글 내용을 입력해주세요.");
            return;
        }

        try {
            await api.patch(`/comments/${commentId}`, {
                contents: nextContent,
            });

            setComments((prev) =>
                prev.map((comment) =>
                    (comment.comment_id || comment.commentId) === commentId
                        ? { ...comment, contents: nextContent }
                        : comment
                )
            );
            setEditingId(null);
            setEditContent("");
            toast.success("댓글이 수정되었습니다.");
            fetchComments(true);
        } catch (error) {
            console.error("Failed to update comment:", error);
            toast.error(error.response?.data?.message || "댓글 수정에 실패했습니다.");
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;

        const existing = comments.find((comment) => (comment.comment_id || comment.commentId) === commentId);
        if (!existing) return;

        setComments((prev) => prev.filter((comment) => (comment.comment_id || comment.commentId) !== commentId));

        try {
            await api.delete(`/comments/${commentId}`);
            toast.success("댓글이 삭제되었습니다.");
            if (onUpdate) onUpdate();
        } catch (error) {
            setComments((prev) => [existing, ...prev]);
            console.error("Failed to delete comment:", error);
            toast.error(error.response?.data?.message || "댓글 삭제에 실패했습니다.");
        }
    };

    const handleLikeComment = async (commentId) => {
        if (!commentId) return;
        if (likingCommentIds[commentId]) return;

        const target = comments.find((comment) => (comment.comment_id || comment.commentId) === commentId);
        if (!target) return;

        const prevLikeCount = target.like_count ?? target.likeCount ?? 0;

        setLikingCommentIds((prev) => ({ ...prev, [commentId]: true }));
        setComments((prev) =>
            prev.map((comment) =>
                (comment.comment_id || comment.commentId) === commentId
                    ? { ...comment, like_count: prevLikeCount + 1, likeCount: prevLikeCount + 1 }
                    : comment
            )
        );

        try {
            const response = await api.post(`/comments/${commentId}/Like`);
            const updatedData = response.data?.data || response.data || {};
            const nextLikeCount = updatedData.like_count !== undefined ? updatedData.like_count : updatedData.likeCount;

            setComments((prev) =>
                prev.map((comment) =>
                    (comment.comment_id || comment.commentId) === commentId
                        ? {
                            ...comment,
                            like_count: nextLikeCount !== undefined ? nextLikeCount : prevLikeCount + 1,
                            likeCount: nextLikeCount !== undefined ? nextLikeCount : prevLikeCount + 1,
                        }
                        : comment
                )
            );
            toast.success("좋아요 상태가 반영되었습니다.");
        } catch (error) {
            setComments((prev) =>
                prev.map((comment) =>
                    (comment.comment_id || comment.commentId) === commentId
                        ? { ...comment, like_count: prevLikeCount, likeCount: prevLikeCount }
                        : comment
                )
            );
            console.error("Failed to like comment:", error);
            toast.error(error.response?.data?.message || "좋아요 처리에 실패했습니다.");
        } finally {
            setLikingCommentIds((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
        }
    };

    const handleReportComment = async (commentId) => {
        const reason = window.prompt("신고 사유를 입력해주세요", "부적절한 댓글");
        if (!reason) return;
        const detail = window.prompt("상세 내용을 입력해주세요 (선택)", "") || "";

        try {
            await api.post("/reports", {
                targetType: "COMMENT",
                targetId: Number(commentId),
                reason,
                detail,
            });
            toast.success("신고가 접수되었습니다.");
        } catch (reportError) {
            toast.error(reportError.response?.data?.message || "신고 접수에 실패했습니다.");
        }
    };

    if (fetching) return <div className="text-center py-4 text-slate-500">댓글 로딩 중...</div>;

    return (
        <div className="space-y-6">
            {fetchError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <div className="font-semibold">{fetchError}</div>
                    <button type="button" onClick={() => fetchComments(true)} className="mt-2 btn-secondary py-1.5 px-3 text-xs">
                        다시 시도
                    </button>
                </div>
            )}

            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    댓글 {comments.length}개
                </h3>

                <form onSubmit={handleSubmitComment} className="space-y-3">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="댓글을 입력해주세요..."
                        className="input-base w-full min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                    />
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || !newComment.trim()}
                            aria-busy={loading}
                            data-busy-indicator="true"
                            className="btn-primary flex items-center gap-2"
                        >
                            <Send className="h-4 w-4" />
                            {loading ? "작성 중..." : "댓글 작성"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                {comments.length === 0 ? (
                    <div className="card p-12 text-center border-dashed border-2">
                        <MessageCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-600">첫 댓글을 작성해보세요.</p>
                    </div>
                ) : (
                    comments.map((comment) => {
                        const commentId = comment.comment_id || comment.commentId;
                        const isEditing = editingId === commentId;
                        const profileImageUrl = normalizeProfileImageUrl(comment.member?.profile_url || comment.member?.profileUrl || "");
                        const canManageComment = canManageByOwnerOrAdmin(user, comment.member);

                        return (
                            <div key={commentId} className="card p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="flex-shrink-0">
                                        {profileImageUrl ? (
                                            <img
                                                src={profileImageUrl}
                                                alt="프로필"
                                                className="w-10 h-10 rounded-full object-cover border"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
                                                {(comment.member?.name || "U").charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <span className="font-semibold text-slate-900">
                                                {comment.member?.name || "익명"}
                                            </span>
                                            {(comment.creator_level !== undefined || comment.creatorLevel !== undefined) && (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                                    Lv.{comment.creator_level ?? comment.creatorLevel}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-400">
                                                {formatRelativeTime(new Date(comment.created_at || comment.createdAt))}
                                            </span>
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-2 mt-2">
                                                <textarea
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="input-base w-full min-h-[80px] resize-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => handleUpdateComment(commentId)} className="btn-primary text-sm px-4 py-2">
                                                        저장
                                                    </button>
                                                    <button type="button" onClick={cancelEdit} className="btn-secondary text-sm px-4 py-2">
                                                        취소
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                {comment.contents}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {!isEditing && (
                                    <div className="flex items-center gap-4 ml-14">
                                        <button
                                            type="button"
                                            onClick={() => handleLikeComment(commentId)}
                                            disabled={Boolean(likingCommentIds[commentId])}
                                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition-colors group"
                                        >
                                            <Heart className="h-4 w-4 group-hover:fill-red-500" />
                                            <span>{comment.like_count ?? comment.likeCount ?? 0}</span>
                                        </button>

                                        {user && (
                                            <button
                                                type="button"
                                                onClick={() => handleReportComment(commentId)}
                                                className="flex items-center gap-1 text-sm text-slate-500 hover:text-amber-600"
                                            >
                                                <Flag className="h-3.5 w-3.5" /> 신고
                                            </button>
                                        )}

                                        {canManageComment && (
                                            <div className="flex gap-3 border-l pl-4">
                                                <button type="button" onClick={() => startEdit(comment)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
                                                    <Edit2 className="h-3.5 w-3.5" /> 수정
                                                </button>
                                                <button type="button" onClick={() => handleDeleteComment(commentId)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" /> 삭제
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
