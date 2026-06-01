import { useCallback, useEffect, useState } from "react";
import { Edit2, Flag, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext.jsx";
import { COMMENT_CONTENT_MAX_LENGTH, commentAdapter, commentErrorMessage } from "../adapters/commentAdapter.js";
import { confirmAction } from "../common/confirmAction.jsx";
import { ReportDialog } from "../common/ReportDialog.jsx";
import { canManageByOwnerOrAdmin } from "../utils/authorization.js";
import { formatNumber, formatRelativeTime } from "../utils/helpers.js";
import { normalizeProfileImageUrl } from "../utils/profileImage.js";

const COMMENT_PAGE_SIZE = 20;

const getCommentId = (comment) => comment?.comment_id ?? comment?.commentId;

const mergeComments = (prev, next) => {
    const seen = new Set(prev.map(getCommentId));
    return [...prev, ...next.filter((comment) => !seen.has(getCommentId(comment)))];
};

export const Comments = ({ boardId, onUpdate }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [pageInfo, setPageInfo] = useState({
        currentPage: 1,
        size: COMMENT_PAGE_SIZE,
        totalElements: 0,
        totalPages: 1,
    });
    const [fetchError, setFetchError] = useState("");
    const [newComment, setNewComment] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [updatingCommentIds, setUpdatingCommentIds] = useState({});
    const [deletingCommentIds, setDeletingCommentIds] = useState({});
    const [likingCommentIds, setLikingCommentIds] = useState({});
    const [reportCommentId, setReportCommentId] = useState(null);
    const [reporting, setReporting] = useState(false);

    const fetchComments = useCallback(async (page = 1, { append = false } = {}) => {
        if (!boardId) return;

        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setFetching(true);
            }
            setFetchError("");
            const result = await commentAdapter.fetchComments(boardId, {
                page,
                size: COMMENT_PAGE_SIZE,
            });

            setComments((prev) => (append ? mergeComments(prev, result.comments) : result.comments));
            setPageInfo(result.pageInfo);
        } catch (error) {
            console.error("Failed to fetch comments:", error);
            setFetchError(commentErrorMessage(error, "댓글을 불러오지 못했습니다."));
            if (!append) setComments([]);
        } finally {
            setFetching(false);
            setLoadingMore(false);
        }
    }, [boardId]);

    useEffect(() => {
        fetchComments(1);
    }, [fetchComments]);

    const handleSubmitComment = async (event) => {
        event.preventDefault();
        if (submitting) return;
        const content = newComment.trim();
        if (!content) {
            toast.error("댓글 내용을 입력해주세요.");
            return;
        }
        if (content.length > COMMENT_CONTENT_MAX_LENGTH) {
            toast.error(`댓글은 ${formatNumber(COMMENT_CONTENT_MAX_LENGTH)}자 이하로 입력해주세요.`);
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
        setPageInfo((prev) => ({ ...prev, totalElements: prev.totalElements + 1 }));
        setNewComment("");
        setSubmitting(true);

        try {
            await commentAdapter.createComment(boardId, content);
            toast.success("댓글이 작성되었습니다.");
            await fetchComments(1);
            onUpdate?.();
        } catch (error) {
            setComments((prev) => prev.filter((comment) => getCommentId(comment) !== tempId));
            setPageInfo((prev) => ({ ...prev, totalElements: Math.max(0, prev.totalElements - 1) }));
            console.error("Failed to create comment:", error);
            toast.error(commentErrorMessage(error, "댓글 작성에 실패했습니다."));
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (comment) => {
        setEditingId(getCommentId(comment));
        setEditContent(comment.contents || "");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditContent("");
    };

    const handleUpdateComment = async (commentId) => {
        if (!commentId || updatingCommentIds[commentId]) return;
        const nextContent = editContent.trim();
        if (!nextContent) {
            toast.error("댓글 내용을 입력해주세요.");
            return;
        }
        if (nextContent.length > COMMENT_CONTENT_MAX_LENGTH) {
            toast.error(`댓글은 ${formatNumber(COMMENT_CONTENT_MAX_LENGTH)}자 이하로 입력해주세요.`);
            return;
        }

        setUpdatingCommentIds((prev) => ({ ...prev, [commentId]: true }));
        try {
            const updated = await commentAdapter.updateComment(commentId, nextContent);
            setComments((prev) =>
                prev.map((comment) =>
                    getCommentId(comment) === commentId
                        ? { ...comment, ...updated, contents: updated?.contents || nextContent }
                        : comment
                )
            );
            setEditingId(null);
            setEditContent("");
            toast.success("댓글이 수정되었습니다.");
        } catch (error) {
            console.error("Failed to update comment:", error);
            toast.error(commentErrorMessage(error, "댓글 수정에 실패했습니다."));
        } finally {
            setUpdatingCommentIds((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!commentId || deletingCommentIds[commentId]) return;
        const confirmed = await confirmAction({
            title: "댓글을 삭제할까요?",
            description: "삭제한 댓글은 되돌릴 수 없습니다.",
            confirmText: "삭제",
        });
        if (!confirmed) return;

        const existing = comments.find((comment) => getCommentId(comment) === commentId);
        if (!existing) return;

        setDeletingCommentIds((prev) => ({ ...prev, [commentId]: true }));
        setComments((prev) => prev.filter((comment) => getCommentId(comment) !== commentId));
        setPageInfo((prev) => ({ ...prev, totalElements: Math.max(0, prev.totalElements - 1) }));

        try {
            await commentAdapter.deleteComment(commentId);
            toast.success("댓글이 삭제되었습니다.");
            onUpdate?.();
        } catch (error) {
            setComments((prev) => [existing, ...prev]);
            setPageInfo((prev) => ({ ...prev, totalElements: prev.totalElements + 1 }));
            console.error("Failed to delete comment:", error);
            toast.error(commentErrorMessage(error, "댓글 삭제에 실패했습니다."));
        } finally {
            setDeletingCommentIds((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
        }
    };

    const handleLikeComment = async (commentId) => {
        if (!Number.isFinite(Number(commentId)) || likingCommentIds[commentId]) return;

        const target = comments.find((comment) => getCommentId(comment) === commentId);
        if (!target) return;

        const prevLikeCount = target.like_count ?? target.likeCount ?? 0;

        setLikingCommentIds((prev) => ({ ...prev, [commentId]: true }));
        setComments((prev) =>
            prev.map((comment) =>
                getCommentId(comment) === commentId
                    ? { ...comment, like_count: prevLikeCount + 1, likeCount: prevLikeCount + 1 }
                    : comment
            )
        );

        try {
            const updated = await commentAdapter.likeComment(commentId);
            const nextLikeCount = updated.like_count ?? updated.likeCount;

            setComments((prev) =>
                prev.map((comment) =>
                    getCommentId(comment) === commentId
                        ? {
                            ...comment,
                            like_count: nextLikeCount ?? prevLikeCount + 1,
                            likeCount: nextLikeCount ?? prevLikeCount + 1,
                        }
                        : comment
                )
            );
            toast.success("좋아요 상태가 반영되었습니다.");
        } catch (error) {
            setComments((prev) =>
                prev.map((comment) =>
                    getCommentId(comment) === commentId
                        ? { ...comment, like_count: prevLikeCount, likeCount: prevLikeCount }
                        : comment
                )
            );
            console.error("Failed to like comment:", error);
            toast.error(commentErrorMessage(error, "좋아요 처리에 실패했습니다."));
        } finally {
            setLikingCommentIds((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
        }
    };

    const handleReportComment = async ({ reason, detail }) => {
        if (!reportCommentId || reporting) return;
        setReporting(true);
        try {
            await commentAdapter.reportComment(reportCommentId, { reason, detail });
            toast.success("신고가 접수되었습니다.");
            setReportCommentId(null);
        } catch (error) {
            toast.error(commentErrorMessage(error, "신고 접수에 실패했습니다."));
        } finally {
            setReporting(false);
        }
    };

    const canLoadMore = pageInfo.currentPage < pageInfo.totalPages;
    const visibleTotal = pageInfo.totalElements || comments.length;
    const newCommentLength = newComment.length;
    const editContentLength = editContent.length;

    if (fetching) {
        return <div className="py-4 text-center text-slate-500">댓글 로딩 중...</div>;
    }

    return (
        <div className="space-y-6">
            {fetchError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <div className="font-semibold">{fetchError}</div>
                    <button type="button" onClick={() => fetchComments(1)} className="mt-2 btn-secondary px-3 py-1.5 text-xs">
                        다시 시도
                    </button>
                </div>
            )}

            <div className="card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    댓글 {formatNumber(visibleTotal)}개
                </h3>

                <form onSubmit={handleSubmitComment} className="space-y-3">
                    <textarea
                        value={newComment}
                        onChange={(event) => setNewComment(event.target.value)}
                        placeholder="댓글을 입력해주세요..."
                        className="input-base min-h-[100px] w-full resize-none focus:ring-2 focus:ring-blue-500"
                        maxLength={COMMENT_CONTENT_MAX_LENGTH}
                        disabled={submitting}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                            {formatNumber(newCommentLength)} / {formatNumber(COMMENT_CONTENT_MAX_LENGTH)}
                        </span>
                        <button
                            type="submit"
                            disabled={submitting || !newComment.trim()}
                            aria-busy={submitting}
                            data-busy-indicator="true"
                            className="btn-primary flex items-center gap-2"
                        >
                            <Send className="h-4 w-4" />
                            {submitting ? "작성 중..." : "댓글 작성"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                {comments.length === 0 ? (
                    <div className="card border-2 border-dashed p-12 text-center">
                        <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                        <p className="text-slate-600">첫 댓글을 작성해보세요.</p>
                    </div>
                ) : (
                    comments.map((comment) => {
                        const commentId = getCommentId(comment);
                        const canLikeComment = Number.isFinite(Number(commentId));
                        const canReportComment = Number.isFinite(Number(commentId));
                        const isEditing = editingId === commentId;
                        const profileImageUrl = normalizeProfileImageUrl(comment.member?.profile_url || comment.member?.profileUrl || "");
                        const canManageComment = canManageByOwnerOrAdmin(user, comment.member);

                        return (
                            <div key={commentId} className="card p-6 transition-shadow hover:shadow-md">
                                <div className="mb-4 flex items-start gap-4">
                                    <div className="flex-shrink-0">
                                        {profileImageUrl ? (
                                            <img
                                                src={profileImageUrl}
                                                alt="프로필"
                                                className="h-10 w-10 rounded-full border object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 font-bold text-white shadow-sm">
                                                {(comment.member?.name || "U").charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-slate-900">
                                                {comment.member?.name || "익명"}
                                            </span>
                                            {(comment.creator_level !== undefined || comment.creatorLevel !== undefined) && (
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                                                    Lv.{comment.creator_level ?? comment.creatorLevel}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-400">
                                                {formatRelativeTime(new Date(comment.created_at || comment.createdAt))}
                                            </span>
                                        </div>

                                        {isEditing ? (
                                            <div className="mt-2 space-y-2">
                                                <textarea
                                                    value={editContent}
                                                    onChange={(event) => setEditContent(event.target.value)}
                                                    className="input-base min-h-[80px] w-full resize-none"
                                                    maxLength={COMMENT_CONTENT_MAX_LENGTH}
                                                    disabled={Boolean(updatingCommentIds[commentId])}
                                                />
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <span className="text-xs text-slate-400">
                                                        {formatNumber(editContentLength)} / {formatNumber(COMMENT_CONTENT_MAX_LENGTH)}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateComment(commentId)}
                                                            disabled={Boolean(updatingCommentIds[commentId]) || !editContent.trim()}
                                                            aria-busy={Boolean(updatingCommentIds[commentId])}
                                                            data-busy-indicator="true"
                                                            className="btn-primary px-4 py-2 text-sm"
                                                        >
                                                            {updatingCommentIds[commentId] ? "저장 중..." : "저장"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelEdit}
                                                            disabled={Boolean(updatingCommentIds[commentId])}
                                                            className="btn-secondary px-4 py-2 text-sm"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                                                {comment.contents}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {!isEditing && (
                                    <div className="ml-14 flex flex-wrap items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => handleLikeComment(commentId)}
                                            disabled={!canLikeComment || Boolean(likingCommentIds[commentId])}
                                            className="group flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-red-500"
                                        >
                                            <Heart className="h-4 w-4 group-hover:fill-red-500" />
                                            <span>{comment.like_count ?? comment.likeCount ?? 0}</span>
                                        </button>

                                        {user && canReportComment && (
                                            <button
                                                type="button"
                                                onClick={() => setReportCommentId(commentId)}
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
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteComment(commentId)}
                                                    disabled={Boolean(deletingCommentIds[commentId])}
                                                    aria-busy={Boolean(deletingCommentIds[commentId])}
                                                    data-busy-indicator="true"
                                                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> {deletingCommentIds[commentId] ? "삭제 중..." : "삭제"}
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

            {canLoadMore && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        className="btn-secondary"
                        disabled={loadingMore}
                        aria-busy={loadingMore}
                        data-busy-indicator="true"
                        onClick={() => fetchComments(pageInfo.currentPage + 1, { append: true })}
                    >
                        {loadingMore ? "불러오는 중..." : `댓글 더 보기 (${formatNumber(comments.length)} / ${formatNumber(visibleTotal)})`}
                    </button>
                </div>
            )}

            <ReportDialog
                open={reportCommentId !== null}
                targetLabel="댓글"
                defaultReason="부적절한 댓글"
                submitting={reporting}
                onClose={() => setReportCommentId(null)}
                onSubmit={handleReportComment}
            />
        </div>
    );
};
