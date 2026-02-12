import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Heart, Edit2, Trash2, Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import api from "../utils/api.js";
import toast from "react-hot-toast";
import { formatRelativeTime } from "../utils/helpers.js";

export const Comments = ({ boardId, onUpdate }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // [추가] 해당 게시글의 댓글 목록을 서버에서 불러오는 함수
    const fetchComments = useCallback(async () => {
        try {
            setFetching(true);
            const response = await api.get(`/comments`, {
                params: {
                    boardId: boardId,
                    page: 1,
                    size: 100 // 일단 넉넉하게 가져오거나 페이징 로직 추가 가능
                }
            });
            // MultiResponseDto 구조 대응: response.data.data 또는 response.data
            const data = response.data?.data || response.data;
            setComments(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch comments:", error);
            // toast.error("댓글을 불러오는데 실패했습니다.");
        } finally {
            setFetching(false);
        }
    }, [boardId]);

    // [추가] 컴포넌트 마운트 시 댓글 로드
    useEffect(() => {
        if (boardId) fetchComments();
    }, [boardId, fetchComments]);

    // 댓글 작성
    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) {
            toast.error("댓글 내용을 입력해주세요.");
            return;
        }

        setLoading(true);
        try {
            await api.post(`/comments`, {
                boardId: boardId,
                contents: newComment
            });

            setNewComment("");
            toast.success("댓글이 작성되었습니다.");
            fetchComments(); // 목록 새로고침
            if (onUpdate) onUpdate(); // 부모(BoardDetail)의 게시글 정보(댓글 수 등) 갱신
        } catch (error) {
            console.error("Failed to create comment:", error);
            toast.error(error.response?.data?.message || "댓글 작성에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 댓글 수정 시작
    const startEdit = (comment) => {
        setEditingId(comment.comment_id || comment.commentId);
        setEditContent(comment.contents);
    };

    // 댓글 수정 취소
    const cancelEdit = () => {
        setEditingId(null);
        setEditContent("");
    };

    // 댓글 수정 저장
    const handleUpdateComment = async (commentId) => {
        if (!editContent.trim()) {
            toast.error("댓글 내용을 입력해주세요.");
            return;
        }

        try {
            await api.patch(`/comments/${commentId}`, {
                contents: editContent
            });

            setEditingId(null);
            setEditContent("");
            toast.success("댓글이 수정되었습니다.");
            fetchComments(); // 목록 새로고침
        } catch (error) {
            console.error("Failed to update comment:", error);
            toast.error(error.response?.data?.message || "댓글 수정에 실패했습니다.");
        }
    };

    // 댓글 삭제
    const handleDeleteComment = async (commentId) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;

        try {
            await api.delete(`/comments/${commentId}`);
            toast.success("댓글이 삭제되었습니다.");
            fetchComments(); // 목록 새로고침
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Failed to delete comment:", error);
            toast.error(error.response?.data?.message || "댓글 삭제에 실패했습니다.");
        }
    };

    // 댓글 좋아요
    const handleLikeComment = async (commentId) => {
        try {
            await api.post(`/comments/${commentId}/Like`);

            // 로컬 상태 즉시 반영 (낙관적 업데이트)
            setComments(prev =>
                prev.map(c =>
                    (c.comment_id || c.commentId) === commentId
                        ? { ...c, like_count: (c.like_count || c.likeCount || 0) + 1 }
                        : c
                )
            );
            toast.success("좋아요를 눌렀습니다.");
        } catch (error) {
            console.error("Failed to like comment:", error);
            toast.error(error.response?.data?.message || "좋아요에 실패했습니다.");
        }
    };

    if (fetching) return <div className="text-center py-4 text-slate-500">댓글 로딩 중...</div>;

    return (
        <div className="space-y-6">
            {/* 댓글 작성 폼 */}
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    댓글 {comments.length}개
                </h3>

                <form onSubmit={handleSubmitComment} className="space-y-3">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="댓글을 입력하세요..."
                        className="input-base w-full min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                    />
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || !newComment.trim()}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Send className="h-4 w-4" />
                            {loading ? "작성 중..." : "댓글 작성"}
                        </button>
                    </div>
                </form>
            </div>

            {/* 댓글 리스트 */}
            <div className="space-y-4">
                {comments.length === 0 ? (
                    <div className="card p-12 text-center border-dashed border-2">
                        <MessageCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-600">첫 댓글을 작성해보세요!</p>
                    </div>
                ) : (
                    comments.map((comment) => {
                        const commentId = comment.comment_id || comment.commentId;
                        const isEditing = editingId === commentId;

                        // 작성자 본인 확인 (다양한 필드 대응)
                        const isAuthor = user && (
                            comment.member?.member_id === user.member_id ||
                            comment.member?.memberId === user.memberId ||
                            comment.member?.email === user.email
                        );

                        return (
                            <div key={commentId} className="card p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="flex-shrink-0">
                                        {comment.member?.profile_url || comment.member?.profileUrl ? (
                                            <img
                                                src={comment.member.profile_url || comment.member.profileUrl}
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
                                                    <button onClick={() => handleUpdateComment(commentId)} className="btn-primary text-sm px-4 py-2">저장</button>
                                                    <button onClick={cancelEdit} className="btn-secondary text-sm px-4 py-2">취소</button>
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
                                            onClick={() => handleLikeComment(commentId)}
                                            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition-colors group"
                                        >
                                            <Heart className={`h-4 w-4 group-hover:fill-red-500`} />
                                            <span>{comment.like_count ?? comment.likeCount ?? 0}</span>
                                        </button>

                                        {isAuthor && (
                                            <div className="flex gap-3 border-l pl-4">
                                                <button onClick={() => startEdit(comment)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
                                                    <Edit2 className="h-3.5 w-3.5" /> 수정
                                                </button>
                                                <button onClick={() => handleDeleteComment(commentId)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600">
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