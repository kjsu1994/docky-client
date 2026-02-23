import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Eye,
    Heart,
    Download,
    Edit,
    Trash2,
    FileText,
    Flag
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { Comments } from "../components/Comments"; // ?볤? 而댄룷?뚰듃 寃쎈줈 ?뺤씤
import {
    getBoardKindLabel,
    formatRelativeTime,
    formatNumber,
    normalizeContentImageUrls
} from "../utils/helpers";
import { canManageByOwnerOrAdmin } from "../utils/authorization";
import { normalizeProfileImageUrl } from "../utils/profileImage";

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
            // 寃뚯떆湲 ?뺣낫瑜?媛?몄삱 ?? ?쒕쾭 ?묐떟 援ъ“??留욎떠 data 異붿텧
            const response = await api.get(`/boards/${boardId}`);
            const data = response.data?.data || response.data;
            setBoard(data);
        } catch (err) {
            console.error("Failed to fetch board:", err);
            setError(err.response?.data?.message || "寃뚯떆湲??遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.");
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
                // ?쒕쾭媛 snake_case? camelCase 以?臾댁뾿??二쇰뱺 ???
                like_count: updatedData.like_count !== undefined ? updatedData.like_count : updatedData.likeCount,
                likeCount: updatedData.like_count !== undefined ? updatedData.like_count : updatedData.likeCount
            }));
            toast.success("醫뗭븘???곹깭媛 諛섏쁺?섏뿀?듬땲??");
        } catch (error) {
            toast.error(error.response?.data?.message || "醫뗭븘??泥섎━???ㅽ뙣?덉뒿?덈떎.");
        } finally {
            setLiking(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("?뺣쭚 ??젣?섏떆寃좎뒿?덇퉴?")) return;
        try {
            await api.delete(`/boards/${boardId}`);
            toast.success("寃뚯떆湲????젣?섏뿀?듬땲??");
            navigate(`/app/boards/${kind}`);
        } catch (error) {
            toast.error("寃뚯떆湲 ??젣???ㅽ뙣?덉뒿?덈떎.");
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
            toast.error("?뚯씪 ?ㅼ슫濡쒕뱶???ㅽ뙣?덉뒿?덈떎.");
        }
    };

    const handleReportBoard = async () => {
        const reason = window.prompt("신고 사유를 입력해주세요", "부적절한 게시물");
        if (!reason) return;
        const detail = window.prompt("?곸꽭 ?댁슜???낅젰?섏꽭?? (?좏깮)", "") || "";

        try {
            await api.post("/reports", {
                targetType: "BOARD",
                targetId: Number(boardId),
                reason,
                detail,
            });
            toast.success("?좉퀬媛 ?묒닔?섏뿀?듬땲??");
        } catch (reportError) {
            toast.error(reportError.response?.data?.message || "?좉퀬 ?묒닔???ㅽ뙣?덉뒿?덈떎.");
        }
    };

    if (loading) return <LoadingSpinner text="寃뚯떆湲 濡쒕뵫 以?.." />;
    if (error) return <div className="p-6"><ErrorMessage message={error} /></div>;
    if (!board) return <div className="p-6 text-center">寃뚯떆湲???놁뒿?덈떎.</div>;

    const boardCreatorName = board.board_creator || board.boardCreator || "";
    const currentUserName = user?.name || "";
    const canManageBoard = canManageByOwnerOrAdmin(user, board.member, {
        ownerName: boardCreatorName,
        userName: currentUserName,
    });

    const files = board.uploadDto || board.upload_dto || [];
    // ?쒕쾭 ?묐떟 ?꾨뱶紐????
    const currentLikeCount = board.like_count ?? board.likeCount ?? 0;
    const currentViewCount = board.view_count ?? board.viewCount ?? 0;
    const authorProfileImageUrl = normalizeProfileImageUrl(board.member?.profile_url || board.member?.profileUrl || "");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> 紐⑸줉?쇰줈
                </button>

                {canManageBoard && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/app/boards/${kind}/${boardId}/edit`)} className="btn-secondary flex items-center gap-2">
                            <Edit className="h-4 w-4" /> ?섏젙
                        </button>
                        <button onClick={handleDelete} className="btn-secondary text-red-600 flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> ??젣
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
                            <div className="text-sm font-semibold text-slate-900">{board.member?.name || board.board_creator || "?듬챸"}</div>
                            <div className="text-xs text-slate-500">{formatRelativeTime(new Date(board.created_at || board.createdAt))}</div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div
                        className="prose prose-slate max-w-none min-h-[200px] board-contents"
                        dangerouslySetInnerHTML={{
                            __html: normalizeContentImageUrls(board.contents || board.content || "")
                        }}
                    />

                    {files.length > 0 && (
                        <div className="mt-8 pt-6 border-t">
                            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4" /> 泥⑤??뚯씪 ({files.length})
                            </h3>
                            <div className="grid gap-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                        <span className="text-sm truncate mr-4">{file.file_name || file.fileName}</span>
                                        <button
                                            onClick={() => handleDownload(file.file_id || file.fileId, file.file_name || file.fileName)}
                                            className="btn-primary py-1 px-3 text-xs"
                                        >
                                            <Download className="h-3 w-3 mr-1" /> ?ㅼ슫濡쒕뱶
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50/30">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={handleLike} disabled={liking} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50">
                            <Heart className={`h-4 w-4 mr-2 ${liking ? 'animate-ping' : ''}`} />
                            醫뗭븘??{formatNumber(currentLikeCount)}
                        </button>
                        <button onClick={handleReportBoard} className="btn-secondary text-amber-700 border-amber-200 hover:bg-amber-50">
                            <Flag className="h-4 w-4 mr-2" /> 寃뚯떆湲 ?좉퀬
                        </button>
                    </div>
                </div>
            </div>

            {/* ?볤? 而댄룷?뚰듃: boardId ?꾨떖 諛?媛깆떊 ?⑥닔 ?곌껐 */}
            <Comments
                boardId={boardId}
                onUpdate={fetchBoard}
            />
        </div>
    );
};


