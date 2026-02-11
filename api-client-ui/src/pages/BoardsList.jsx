import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

export default function BoardsList() {
    const { kind } = useParams();
    const [boards, setBoards] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchBoards = async () => {
            try {
                const res = await http.get("/boards", {
                    params: { kind },
                });
                if (mounted) setBoards(res.data);
            } catch (err) {
                if (err.status === 401 || err.status === 403) {
                    setError("게시글 목록을 불러올 수 없습니다.");
                    return;
                }
            }
        };

        fetchBoards();
        return () => {
            mounted = false;
        };
    }, [kind]);

    if (error) {
        return <div className="p-6 text-slate-600">{error}</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-lg font-bold mb-4">게시판 목록</h1>

            <div className="space-y-3">
                {boards.map((b) => (
                    <Link
                        key={b.board_id}
                        to={`/app/boards/${kind}/${b.board_id}`}
                        className="block border rounded-xl p-4 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex gap-4">
                            {/* 썸네일 이미지 (있는 경우만) */}
                            {b.delegate_image_path && (
                                <div className="flex-shrink-0">
                                    <img
                                        src={b.delegate_image_path}
                                        alt={b.title}
                                        className="w-20 h-20 object-cover rounded-lg border"
                                        onError={(e) => {
                                            // 이미지 로드 실패 시 대체 아이콘
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}

                            {/* 게시글 정보 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold text-slate-900 hover:text-blue-600 truncate">
                                        {b.title}
                                    </h3>

                                    {/* 첨부파일 아이콘 */}
                                    {b.delegate_image_path && (
                                        <span className="flex-shrink-0 text-slate-400" title="첨부파일 있음">
                                            📎
                                        </span>
                                    )}
                                </div>

                                <div className="mt-1 text-sm text-slate-600 line-clamp-2">
                                    {b.contents}
                                </div>

                                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                    <span>{b.board_creator || '익명'}</span>
                                    <span>•</span>
                                    <span>조회 {b.view_count || 0}</span>
                                    <span>•</span>
                                    <span>좋아요 {b.like_count || 0}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {boards.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    게시글이 없습니다.
                </div>
            )}
        </div>
    );
}
