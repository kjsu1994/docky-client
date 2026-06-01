import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Download,
    Edit,
    Eye,
    FileText,
    Flag,
    Heart,
    Trash2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { Comments } from "../../components/Comments.jsx";
import {
    getBoardKindLabel,
    formatRelativeTime,
    formatNumber,
    normalizeContentImageUrls,
    sanitizeBoardContentHtml
} from "../../utils/helpers.js";
import { canManageByOwnerOrAdmin } from "../../utils/authorization.js";
import { confirmAction } from "../../common/confirmAction.jsx";
import { normalizeProfileImageUrl } from "../../utils/profileImage.js";
import { boardAdapter, boardErrorMessage, getBoardLikeCount } from "../../adapters/boardAdapter.js";
import { ReportDialog } from "../../common/ReportDialog.jsx";

const BoardBody = memo(({ html, files, downloadingFileIds, onDownload }) => (
    <div className="p-6">
        <div
            className="prose prose-slate max-w-none min-h-[200px] board-contents"
            dangerouslySetInnerHTML={{ __html: html }}
        />

        {files.length > 0 && (
            <div className="mt-8 pt-6 border-t">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> 첨부파일 ({files.length})
                </h3>
                <div className="grid gap-2">
                    {files.map((file, idx) => {
                        const fileId = file.file_id || file.fileId;
                        const fileName = file.file_name || file.fileName || "attachment";
                        const downloading = Boolean(downloadingFileIds[fileId]);

                        return (
                            <div key={fileId || idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                <span className="text-sm truncate mr-4">{fileName}</span>
                                <button
                                    onClick={() => onDownload(fileId, fileName)}
                                    disabled={downloading}
                                    aria-busy={downloading}
                                    data-busy-indicator="true"
                                    className="btn-primary py-1 px-3 text-xs disabled:opacity-60"
                                >
                                    <Download className="h-3 w-3 mr-1" /> {downloading ? "준비 중..." : "다운로드"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
    </div>
));

BoardBody.displayName = "BoardBody";

export const BoardDetail = () => {
    const { kind, boardId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [liking, setLiking] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloadingFileIds, setDownloadingFileIds] = useState({});
    const [reportOpen, setReportOpen] = useState(false);
    const [reporting, setReporting] = useState(false);
    const fetchedBoardIdRef = useRef(null);
    const downloadingFileIdsRef = useRef({});

    const fetchBoard = async ({ trackView = true, silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError("");
        try {
            const nextBoard = await boardAdapter.fetchBoardDetail(boardId, { trackView });
            setBoard(nextBoard);
        } catch (err) {
            console.error("Failed to fetch board:", err);
            const message = boardErrorMessage(err, "게시글을 불러오는데 실패했습니다.");
            if (silent) {
                toast.error(message);
            } else {
                setError(message);
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (boardId && fetchedBoardIdRef.current !== boardId) {
            fetchBoard();
            fetchedBoardIdRef.current = boardId;
        }
    }, [boardId]);

    const handleLike = async () => {
        if (liking || !board) return;
        setLiking(true);
        const prevLikeCount = getBoardLikeCount(board);

        setBoard((prev) => ({
            ...prev,
            like_count: prevLikeCount + 1,
            likeCount: prevLikeCount + 1,
        }));

        try {
            const updatedData = await boardAdapter.likeBoard(boardId) || {};
            const nextLikeCount = getBoardLikeCount(updatedData);

            setBoard((prev) => ({
                ...prev,
                like_count: nextLikeCount,
                likeCount: nextLikeCount,
            }));
            toast.success("좋아요 상태가 반영되었습니다.");
        } catch (likeError) {
            setBoard((prev) => ({
                ...prev,
                like_count: prevLikeCount,
                likeCount: prevLikeCount,
            }));
            toast.error(boardErrorMessage(likeError, "좋아요 처리에 실패했습니다."));
        } finally {
            setLiking(false);
        }
    };

    const handleDelete = async () => {
        if (deleting) return;
        const confirmed = await confirmAction({
            title: "게시글을 삭제할까요?",
            description: "본문, 첨부파일, 댓글 정보가 함께 정리될 수 있습니다.",
            confirmText: "삭제",
        });
        if (!confirmed) return;
        setDeleting(true);
        try {
            await boardAdapter.deleteBoard(boardId);
            toast.success("게시글이 삭제되었습니다.");
            navigate(`/app/boards/${kind}`);
        } catch (deleteError) {
            toast.error(boardErrorMessage(deleteError, "게시글 삭제에 실패했습니다."));
            setDeleting(false);
        }
    };

    const handleDownload = useCallback(async (fileId, fileName) => {
        if (!fileId || downloadingFileIdsRef.current[fileId]) return;
        downloadingFileIdsRef.current = { ...downloadingFileIdsRef.current, [fileId]: true };
        setDownloadingFileIds(downloadingFileIdsRef.current);
        try {
            const blob = await boardAdapter.fetchBoardFile(fileId);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (downloadError) {
            toast.error(boardErrorMessage(downloadError, "파일 다운로드에 실패했습니다."));
        } finally {
            const next = { ...downloadingFileIdsRef.current };
            delete next[fileId];
            downloadingFileIdsRef.current = next;
            setDownloadingFileIds(next);
        }
    }, []);

    const handleReportBoard = async ({ reason, detail }) => {
        if (reporting) return;
        setReporting(true);
        try {
            await boardAdapter.reportBoard(boardId, { reason, detail });
            toast.success("신고가 접수되었습니다.");
            setReportOpen(false);
        } catch (reportError) {
            toast.error(boardErrorMessage(reportError, "신고 접수에 실패했습니다."));
        } finally {
            setReporting(false);
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
    const boardBodyHtml = sanitizeBoardContentHtml(normalizeContentImageUrls(board.contents || board.content || ""));
    const currentLikeCount = getBoardLikeCount(board);
    const currentViewCount = board.view_count ?? board.viewCount ?? 0;
    const authorProfileImageUrl = normalizeProfileImageUrl(board.member?.profile_url || board.member?.profileUrl || "");

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
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            aria-busy={deleting}
                            data-busy-indicator="true"
                            className="btn-secondary text-red-600 flex items-center gap-2 disabled:opacity-60"
                        >
                            <Trash2 className="h-4 w-4" /> {deleting ? "삭제 중..." : "삭제"}
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
                            <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {formatNumber(currentViewCount)}</span>
                            <span className="flex items-center gap-1"><Heart className="h-4 w-4" /> {formatNumber(currentLikeCount)}</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{board.title}</h1>

                    <div className="flex items-center gap-3 mt-4">
                        {authorProfileImageUrl ? (
                            <img
                                src={authorProfileImageUrl}
                                alt="author profile"
                                className="w-10 h-10 rounded-full object-cover border"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                                {(board.member?.name || board.board_creator || "U").charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div className="text-sm font-semibold text-slate-900">{board.member?.name || board.board_creator || "익명"}</div>
                            <div className="text-xs text-slate-500">{formatRelativeTime(new Date(board.created_at || board.createdAt))}</div>
                        </div>
                    </div>
                </div>

                <BoardBody
                    html={boardBodyHtml}
                    files={files}
                    downloadingFileIds={downloadingFileIds}
                    onDownload={handleDownload}
                />

                <div className="p-6 border-t bg-slate-50/30">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={handleLike} disabled={liking} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50">
                            <Heart className={`h-4 w-4 mr-2 ${liking ? "animate-ping" : ""}`} />
                            좋아요 {formatNumber(currentLikeCount)}
                        </button>
                        <button onClick={() => setReportOpen(true)} className="btn-secondary text-amber-700 border-amber-200 hover:bg-amber-50">
                            <Flag className="h-4 w-4 mr-2" /> 게시글 신고
                        </button>
                    </div>
                </div>
            </div>

            <Comments
                boardId={boardId}
                onUpdate={() => fetchBoard({ trackView: false, silent: true })}
            />

            <ReportDialog
                open={reportOpen}
                targetLabel="게시글"
                defaultReason="부적절한 게시물"
                submitting={reporting}
                onClose={() => setReportOpen(false)}
                onSubmit={handleReportBoard}
            />
        </div>
    );
};
