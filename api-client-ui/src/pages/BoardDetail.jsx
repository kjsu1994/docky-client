import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import http from "../api/http";

export default function BoardDetail() {
    const params = useParams();
    const { boardId, kind } = params;
    const navigate = useNavigate();
    const [board, setBoard] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchBoard = async () => {
            if (!boardId) {
                setError("게시글 ID가 없습니다.");
                return;
            }

            try {
                console.log(`Fetching board: /boards/${boardId}`);
                const res = await http.get(`/boards/${boardId}`);
                if (mounted) setBoard(res.data);
            } catch (err) {
                console.error("Board fetch error:", err);

                if (err.status === 401 || err.status === 403) {
                    setError("게시글을 조회할 권한이 없습니다.");
                    return;
                }

                if (err.status === 404) {
                    setError("게시글을 찾을 수 없습니다.");
                    setTimeout(() => {
                        navigate(`/app/boards/${kind || 'main'}`, { replace: true });
                    }, 2000);
                    return;
                }

                if (err.status === 500) {
                    setError("서버에서 오류가 발생했습니다.");
                    return;
                }

                setError(`오류 발생: ${err.message}`);
            }
        };

        fetchBoard();
        return () => {
            mounted = false;
        };
    }, [boardId, kind, navigate]);

    // 파일 확장자로 이미지 여부 판단
    const isImageFile = (filename) => {
        if (!filename) return false;
        const ext = filename.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    };

    // 파일명 추출 (URL에서)
    const getFileName = (url) => {
        if (!url) return '파일';
        try {
            return decodeURIComponent(url.split('/').pop().split('?')[0]);
        } catch {
            return url.split('/').pop();
        }
    };

    if (error) {
        return (
            <div className="p-6">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                    <div className="font-semibold mb-2">⚠️ 오류 발생</div>
                    <div className="mb-4">{error}</div>
                </div>

                <button
                    onClick={() => navigate(`/app/boards/${kind || 'main'}`)}
                    className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                    ← 목록으로 돌아가기
                </button>
            </div>
        );
    }

    if (!board) {
        return (
            <div className="p-6">
                <div className="text-lg mb-2">로딩중...</div>
                <div className="text-sm text-slate-500">
                    게시글 #{boardId}를 불러오는 중입니다.
                </div>
            </div>
        );
    }

    // uploadFiles 배열 가져오기
    const uploadFiles = board.upload_files || board.uploadFiles || [];

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* 상단 버튼 */}
            <button
                onClick={() => navigate(`/app/boards/${kind || 'main'}`)}
                className="mb-4 text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
                ← 목록으로
            </button>

            {/* 제목 & 메타 정보 */}
            <div className="border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold mb-3">{board.title}</h1>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="font-medium">
                        {board.board_creator || board.boardCreator || '익명'}
                    </span>
                    <span>•</span>
                    <span>조회 {board.view_count || board.viewCount || 0}</span>
                    <span>•</span>
                    <span>좋아요 {board.like_count || board.likeCount || 0}</span>
                    {board.created_at && (
                        <>
                            <span>•</span>
                            <span>{new Date(board.created_at).toLocaleDateString()}</span>
                        </>
                    )}
                </div>
            </div>

            {/* 본문 */}
            <div className="prose max-w-none mb-8">
                <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                    {board.contents || board.content || '내용이 없습니다.'}
                </div>
            </div>

            {/* 첨부 이미지들 미리보기 */}
            {uploadFiles.length > 0 && (
                <div className="border-t pt-6 mb-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                        📎 첨부파일 ({uploadFiles.length})
                    </h3>

                    <div className="space-y-4">
                        {uploadFiles.map((file, idx) => {
                            const filename = file.file_name || file.fileName || getFileName(file.image_path || file.imagePath);
                            const filepath = file.image_path || file.imagePath;
                            const isImage = isImageFile(filename) || isImageFile(filepath);

                            return (
                                <div key={idx} className="border rounded-lg p-4 bg-slate-50">
                                    {isImage ? (
                                        // 이미지 파일 - 미리보기
                                        <div>
                                            <div className="mb-2 text-sm text-slate-600">
                                                🖼️ {filename}
                                            </div>
                                            <a
                                                href={filepath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                            >
                                                <img
                                                    src={filepath}
                                                    alt={filename}
                                                    className="max-w-full h-auto rounded border hover:opacity-90 transition-opacity cursor-pointer"
                                                    onError={(e) => {
                                                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f1f5f9" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8"%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E';
                                                    }}
                                                />
                                            </a>
                                            <div className="mt-2">
                                                <a
                                                    href={filepath}
                                                    download={filename}
                                                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                                                >
                                                    ⬇️ 다운로드
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        // 일반 파일 - 다운로드 링크만
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <span>📄</span>
                                                <span className="font-medium">{filename}</span>
                                            </div>
                                            <a
                                                href={filepath}
                                                download={filename}
                                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                                            >
                                                ⬇️ 다운로드
                                            </a>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 하단 액션 버튼들 */}
            <div className="border-t pt-6 flex gap-3">
                <button
                    onClick={() => navigate(`/app/boards/${kind || 'main'}`)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    목록
                </button>

                {/* 추가 기능 버튼들 (나중에 구현) */}
                {/* <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    수정
                </button>
                <button className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                    삭제
                </button> */}
            </div>
        </div>
    );
}
