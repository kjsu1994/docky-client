import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import api, { uploadFiles } from "../utils/api";
import toast from "react-hot-toast";
import { isImageFile } from "../utils/helpers";

export const BoardForm = () => {
    const { kind, boardId } = useParams();
    const navigate = useNavigate();
    const isEdit = !!boardId;

    const [formData, setFormData] = useState({
        title: "",
        contents: "",
    });
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEdit) {
            const fetchBoard = async () => {
                try {
                    const response = await api.get(`/boards/${boardId}`);
                    const board = response.data.data || response.data;
                    setFormData({
                        title: board.title,
                        contents: board.contents || board.content,
                    });
                } catch (error) {
                    toast.error("게시글 로딩 실패");
                }
            };
            fetchBoard();
        }
    }, [isEdit, boardId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...selectedFiles]);
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            toast.error("제목을 입력해주세요");
            return;
        }

        if (!formData.contents.trim()) {
            toast.error("내용을 입력해주세요");
            return;
        }

        setLoading(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append("title", formData.title);
            formDataToSend.append("contents", formData.contents);

            files.forEach((file) => {
                formDataToSend.append("files", file);
            });

            if (isEdit) {
                await uploadFiles(`/boards/${boardId}?kind=${kind}`, formDataToSend);
                toast.success("게시글이 수정되었습니다");
            } else {
                await uploadFiles(`/boards?kind=${kind}`, formDataToSend);
                toast.success("게시글이 등록되었습니다");
            }

            navigate(`/app/boards/${kind}`);
        } catch (error) {
            toast.error(error.response?.data?.message || "저장 실패");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">
                    {isEdit ? "게시글 수정" : "게시글 작성"}
                </h1>
                <button
                    onClick={() => navigate(`/app/boards/${kind}`)}
                    className="btn-secondary"
                >
                    <ArrowLeft className="h-4 w-4 inline mr-2" />
                    목록으로
                </button>
            </div>

            {/* 폼 */}
            <form onSubmit={handleSubmit} className="card p-8 space-y-6">
                {/* 제목 */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        제목
                    </label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className="input-base"
                        placeholder="제목을 입력하세요"
                        required
                    />
                </div>

                {/* 내용 */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        내용
                    </label>
                    <textarea
                        name="contents"
                        value={formData.contents}
                        onChange={handleChange}
                        className="input-base resize-none"
                        rows="12"
                        placeholder="내용을 입력하세요"
                        required
                    />
                </div>

                {/* 파일 업로드 */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        첨부파일
                    </label>
                    <div className="space-y-3">
                        {/* 업로드 버튼 */}
                        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 cursor-pointer transition-all">
                            <Upload className="h-5 w-5 text-slate-400" />
                            <span className="text-sm font-medium text-slate-600">
                파일 선택 (이미지, 문서 등)
              </span>
                            <input
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            />
                        </label>

                        {/* 선택된 파일 목록 */}
                        {files.length > 0 && (
                            <div className="space-y-2">
                                {files.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50"
                                    >
                                        {isImageFile(file.name) ? (
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
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {(file.size / 1024).toFixed(2)} KB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 제출 버튼 */}
                <div className="flex items-center gap-3 pt-6 border-t">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary flex-1"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                <div className="loading-spinner" />
                                {isEdit ? "수정 중..." : "등록 중..."}
              </span>
                        ) : isEdit ? (
                            "수정하기"
                        ) : (
                            "등록하기"
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/app/boards/${kind}`)}
                        className="btn-secondary"
                        disabled={loading}
                    >
                        취소
                    </button>
                </div>
            </form>
        </div>
    );
};