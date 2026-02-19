import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Eye,
    Heart,
    Download,
    Edit,
    Trash2,
    FileText
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { Comments } from "../components/Comments"; // 댓글 컴포넌트 경로 확인
import {
    getBoardKindLabel,
    formatRelativeTime,
    formatNumber
} from "../utils/helpers";
import { canManageByOwnerOrAdmin } from "../utils/authorization";

export const BoardDetail = () => {
    const { kind, boardId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [liking, setLiking] = useState(false);
    const fetchedRef = useRef(false);

    const fetchBoard = async () => {
        setLoading(true);
        setError("");
        try {
            // 게시글 정보를 가져올 때, 서버 응답 구조에 맞춰 data 추출
            const response = await api.get(`/boards/${boardId}`);
            const data = response.data?.data || response.data;
            setBoard(data);
        } catch (err) {
            console.error("Failed to fetch board:", err);
            setError(err.response?.data?.message || "게시글을 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (boardId && !fetchedRef.current) {
            fetchBoard();
            fetchedRef.current = true;
        }
    }, [boardId]);

    const handleLike = async () => {
        if (liking) return;
        setLiking(true);
        try {
            const response = await api.post(`/boards/${boardId}/Like`);
            const updatedData = response.data?.data || response.data;

            setBoard(prev => ({
                ...prev,
                // 서버가 snake_case와 camelCase 중 무엇을 주든 대응
                like_count: updatedData.like_count !== undefined ? updatedData.like_count : updatedData.likeCount,
                likeCount: updatedData.like_count !== undefined ? updatedData.like_count : updatedData.likeCount
            }));
            toast.success("좋아요 상태가 반영되었습니다!");
        } catch (error) {
            toast.error(error.response?.data?.message || "좋아요 처리에 실패했습니다.");
        } finally {
            setLiking(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/boards/${boardId}`);
            toast.success("게시글이 삭제되었습니다.");
            navigate(`/app/boards/${kind}`);
        } catch (error) {
            toast.error("게시글 삭제에 실패했습니다.");
        }
    };

    const handleDownload = async (fileId, fileName) => {
        try {
            const response = await api.get(`/file/${fileId}`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error("파일 다운로드에 실패했습니다.");
        }
    };

    if (loading) return <LoadingSpinner text="게시글 로딩 중..." />;
    if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
    if (!board) return <div className="p-6 text-center">게시글이 없습니다.</div>;

    const boardCreatorName = board.board_creator || board.boardCreator || "";
    const currentUserName = user?.name || "";
    const canManageBoard = canManageByOwnerOrAdmin(user, board.member, {
        ownerName: boardCreatorName,
        userName: currentUserName,
    });

    const files = board.uploadDto || board.upload_dto || [];
    // 서버 응답 필드명 대응
    const currentLikeCount = board.like_count ?? board.likeCount ?? 0;
    const currentViewCount = board.view_count ?? board.viewCount ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> 목록으로
                </button>

                {canManageBoard && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/app/boards/${kind}/${boardId}/edit`)} className="btn-secondary flex items-center gap-2">
                            <Edit className="h-4 w-4" /> 수정
                        </button>
                        <button onClick={handleDelete} className="btn-secondary text-red-600 flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> 삭제
                        </button>
                    </div>
                )}
            </div>

            <div className="card overflow-hidden">
                <div className="p-6 border-b bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="badge-primary">
                            {getBoardKindLabel(board.kind_of_board || board.kindOfBoard || kind)}
                        </span>
                        <div className="flex items-center gap-3 text-sm text-slate-500 ml-2">
                            <span className="flex items-center gap-1"><Eye className="h-4 w-4"/> {formatNumber(currentViewCount)}</span>
                            <span className="flex items-center gap-1"><Heart className="h-4 w-4"/> {formatNumber(currentLikeCount)}</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{board.title}</h1>

                    <div className="flex items-center gap-3 mt-4">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                            {(board.member?.name || board.board_creator || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">{board.member?.name || board.board_creator || "익명"}</div>
                            <div className="text-xs text-slate-500">{formatRelativeTime(new Date(board.created_at || board.createdAt))}</div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div
                        className="prose prose-slate max-w-none min-h-[200px] board-contents"
                        dangerouslySetInnerHTML={{
                            __html: board.contents || board.content || ""
                        }}
                    />

                    {files.length > 0 && (
                        <div className="mt-8 pt-6 border-t">
                            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4" /> 첨부파일 ({files.length})
                            </h3>
                            <div className="grid gap-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                        <span className="text-sm truncate mr-4">{file.file_name || file.fileName}</span>
                                        <button
                                            onClick={() => handleDownload(file.file_id || file.fileId, file.file_name || file.fileName)}
                                            className="btn-primary py-1 px-3 text-xs"
                                        >
                                            <Download className="h-3 w-3 mr-1" /> 다운로드
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50/30">
                    <button onClick={handleLike} disabled={liking} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50">
                        <Heart className={`h-4 w-4 mr-2 ${liking ? 'animate-ping' : ''}`} />
                        좋아요 {formatNumber(currentLikeCount)}
                    </button>
                </div>
            </div>

            {/* 댓글 컴포넌트: boardId 전달 및 갱신 함수 연결 */}
            <Comments
                boardId={boardId}
                onUpdate={fetchBoard}
            />
        </div>
    );
};
