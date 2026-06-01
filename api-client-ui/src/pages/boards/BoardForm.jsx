import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Bold,
    FileText,
    Image as ImageIcon,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Quote,
    Underline,
    Upload,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
    BOARD_ATTACHMENT_LIMITS,
    boardAdapter,
    boardErrorMessage,
    validateBoardAttachmentSelection,
} from "../../adapters/boardAdapter.js";
import { promptAction } from "../../common/promptAction.jsx";
import { canManageByOwnerOrAdmin } from "../../utils/authorization.js";
import { formatFileSize, isImageFile, normalizeContentImageUrls, sanitizeBoardContentHtml } from "../../utils/helpers.js";

const hasRole = (roles, roleName) => {
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes(roleName);
    return String(roles).includes(roleName);
};

const getFileIdValue = (file) =>
    file?.file_id ??
    file?.fileId ??
    file?.upload_id ??
    file?.uploadId ??
    file?.id ??
    null;

const isHeicLikeFile = (file) => {
    const type = (file?.type || "").toLowerCase();
    const name = (file?.name || "").toLowerCase();
    return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
};

const escapeAttribute = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

export const BoardForm = () => {
    const { kind, boardId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEdit = Boolean(boardId);
    const isAdmin =
        hasRole(user?.roles, "ROLE_ADMIN") ||
        hasRole(user?.role, "ROLE_ADMIN") ||
        hasRole(user?.member?.roles, "ROLE_ADMIN");

    const [title, setTitle] = useState("");
    const [attachFiles, setAttachFiles] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [deletedExistingFileIds, setDeletedExistingFileIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loadingBoard, setLoadingBoard] = useState(isEdit);

    const editorRef = useRef(null);
    const imageInputRef = useRef(null);
    const loadedBoardIdRef = useRef(null);

    useEffect(() => {
        if (kind === "ADMIN_NOTICE" && !isAdmin) {
            toast.error("공지사항은 관리자만 작성할 수 있습니다.");
            navigate(`/app/boards/${kind}`, { replace: true });
        }
    }, [kind, isAdmin, navigate]);

    useEffect(() => {
        if (!isEdit || !boardId || loadedBoardIdRef.current === boardId) return;

        let mounted = true;
        setLoadingBoard(true);

        boardAdapter.fetchBoardDetail(boardId, { trackView: false })
            .then((board) => {
                if (!mounted) return;
                const canManage = canManageByOwnerOrAdmin(user, board.member, {
                    ownerName: board.board_creator || board.boardCreator || "",
                    userName: user?.name || "",
                });
                if (!canManage) {
                    toast.error("수정 권한이 없습니다.");
                    navigate(`/app/boards/${kind}/${boardId}`, { replace: true });
                    return;
                }

                setTitle(board.title || "");
                const files = board.uploadDto || board.upload_dto || [];
                setExistingFiles(Array.isArray(files) ? files : []);
                setDeletedExistingFileIds([]);
                if (editorRef.current) {
                    editorRef.current.innerHTML = sanitizeBoardContentHtml(normalizeContentImageUrls(board.contents || board.content || ""));
                }
                loadedBoardIdRef.current = boardId;
            })
            .catch((error) => {
                console.error("Failed to load board for edit:", error);
                toast.error(boardErrorMessage(error, "게시글 로딩 실패"));
            })
            .finally(() => {
                if (mounted) setLoadingBoard(false);
            });

        return () => {
            mounted = false;
        };
    }, [isEdit, boardId, user, kind, navigate]);

    const focusEditor = () => {
        editorRef.current?.focus();
    };

    const runCommand = (command, value = null) => {
        focusEditor();
        document.execCommand(command, false, value);
    };

    const insertHtml = (html) => {
        focusEditor();
        document.execCommand("insertHTML", false, html);
    };

    const insertLink = async () => {
        const rawUrl = await promptAction({
            title: "링크 삽입",
            label: "URL",
            placeholder: "https://example.com",
            confirmText: "삽입",
            required: true,
            maxLength: 500,
        });
        if (!rawUrl) return;

        const trimmed = rawUrl.trim();
        const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        runCommand("createLink", href);
    };

    const uploadImageToServer = async (file) => {
        if (isHeicLikeFile(file)) {
            toast.error("HEIC/HEIF 이미지는 JPG 또는 PNG로 변경 후 업로드해주세요.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("이미지 크기는 5MB 이하여야 합니다.");
            return;
        }

        const toastId = toast.loading("이미지 업로드 중...");
        try {
            const imageUrl = await boardAdapter.uploadContentImage(file);
            if (!imageUrl) throw new Error("uploaded image url missing");

            insertHtml(`<img src="${escapeAttribute(imageUrl)}" alt="본문 이미지" />`);
            toast.success("이미지 삽입 완료", { id: toastId });
        } catch (error) {
            console.error("Image upload failed:", error);
            toast.error(boardErrorMessage(error, "이미지 업로드 실패"), { id: toastId });
        }
    };

    const handleToolbarImageChange = async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        for (const file of files) {
            await uploadImageToServer(file);
        }
    };

    const handlePaste = async (event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter((item) => item.type.startsWith("image/"));
        if (imageItems.length === 0) return;

        event.preventDefault();
        for (const item of imageItems) {
            const file = item.getAsFile();
            if (file) await uploadImageToServer(file);
        }
    };

    const handleDrop = async (event) => {
        const imageFiles = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
        if (imageFiles.length === 0) return;

        event.preventDefault();
        for (const file of imageFiles) {
            await uploadImageToServer(file);
        }
    };

    const handleFileChange = (event) => {
        const nextFiles = Array.from(event.target.files || []);
        const validation = validateBoardAttachmentSelection({
            existingFiles,
            attachFiles,
            incomingFiles: nextFiles,
        });
        if (!validation.valid) {
            toast.error(validation.message);
            event.target.value = "";
            return;
        }

        setAttachFiles((prev) => [...prev, ...nextFiles]);
        event.target.value = "";
    };

    const removeFile = (index) => {
        setAttachFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    };

    const removeExistingFile = (file) => {
        const fileId = getFileIdValue(file);
        if (!fileId) return;

        setExistingFiles((prev) => prev.filter((item) => getFileIdValue(item) !== fileId));
        setDeletedExistingFileIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
    };

    const buildSubmitFormData = () => {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("contents", sanitizeBoardContentHtml(editorRef.current?.innerHTML || ""));
        attachFiles.forEach((file) => formData.append("files", file));

        if (isAdmin) {
            formData.append("isNotice", "true");
            formData.append("notice", "true");
            formData.append("adminPost", "true");
        }
        return formData;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!title.trim()) {
            toast.error("제목을 입력해주세요.");
            return;
        }
        if (!editorRef.current?.innerText.trim()) {
            toast.error("내용을 입력해주세요.");
            return;
        }

        setSaving(true);
        try {
            if (isEdit) {
                await Promise.all(deletedExistingFileIds.map((fileId) => boardAdapter.deleteBoardFile(boardId, fileId)));
                await boardAdapter.updateBoard(boardId, buildSubmitFormData());
                toast.success("게시글이 수정되었습니다.");
            } else {
                await boardAdapter.createBoard(kind, buildSubmitFormData());
                toast.success("게시글이 등록되었습니다.");
            }

            navigate(`/app/boards/${kind}`);
        } catch (error) {
            console.error("Failed to save board:", error);
            toast.error(boardErrorMessage(error, "저장 실패"));
        } finally {
            setSaving(false);
        }
    };

    const editorDisabled = saving || loadingBoard;
    const attachmentCount = existingFiles.length + attachFiles.length;
    const attachmentLimitReached = attachmentCount >= BOARD_ATTACHMENT_LIMITS.maxFiles;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">
                    {isEdit ? "게시글 수정" : "게시글 작성"}
                </h1>
                <button type="button" onClick={() => navigate(`/app/boards/${kind}`)} className="btn-secondary">
                    <ArrowLeft className="mr-2 inline h-4 w-4" />
                    목록으로
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="card space-y-6 p-8">
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="input-base"
                            placeholder="제목을 입력하세요"
                            disabled={editorDisabled}
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                            내용
                            <span className="ml-2 text-xs font-normal text-slate-400">
                                이미지 복사-붙여넣기 / 드래그앤드롭 지원 (최대 5MB)
                            </span>
                        </label>

                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
                                <ToolbarButton label="굵게" icon={<Bold className="h-4 w-4" />} onClick={() => runCommand("bold")} disabled={editorDisabled} />
                                <ToolbarButton label="기울임" icon={<Italic className="h-4 w-4" />} onClick={() => runCommand("italic")} disabled={editorDisabled} />
                                <ToolbarButton label="밑줄" icon={<Underline className="h-4 w-4" />} onClick={() => runCommand("underline")} disabled={editorDisabled} />
                                <ToolbarButton label="번호 목록" icon={<ListOrdered className="h-4 w-4" />} onClick={() => runCommand("insertOrderedList")} disabled={editorDisabled} />
                                <ToolbarButton label="글머리 목록" icon={<List className="h-4 w-4" />} onClick={() => runCommand("insertUnorderedList")} disabled={editorDisabled} />
                                <ToolbarButton label="인용" icon={<Quote className="h-4 w-4" />} onClick={() => runCommand("formatBlock", "blockquote")} disabled={editorDisabled} />
                                <ToolbarButton label="링크" icon={<LinkIcon className="h-4 w-4" />} onClick={insertLink} disabled={editorDisabled} />
                                <ToolbarButton label="이미지" icon={<ImageIcon className="h-4 w-4" />} onClick={() => imageInputRef.current?.click()} disabled={editorDisabled} />
                            </div>
                            <div
                                ref={editorRef}
                                contentEditable={!editorDisabled}
                                suppressContentEditableWarning
                                data-placeholder={loadingBoard ? "게시글을 불러오는 중..." : "내용을 입력하세요."}
                                className="rich-board-editor min-h-[300px] px-4 py-3 leading-7 outline-none"
                                onPaste={handlePaste}
                                onDrop={handleDrop}
                                onDragOver={(event) => event.preventDefault()}
                            />
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleToolbarImageChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                            첨부파일
                            <span className="ml-2 text-xs font-normal text-slate-400">
                                (본문 외 추가 첨부, 최대 {BOARD_ATTACHMENT_LIMITS.maxFiles}개 / 파일당 20MB)
                            </span>
                        </label>
                        <div className="space-y-3">
                            {isEdit && existingFiles.length > 0 && (
                                <FileList
                                    title="기존 첨부파일"
                                    files={existingFiles}
                                    tone="amber"
                                    onRemove={removeExistingFile}
                                />
                            )}

                            <label
                                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all ${
                                    editorDisabled || attachmentLimitReached
                                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                                        : "cursor-pointer border-slate-300 hover:border-primary-500 hover:bg-primary-50"
                                }`}
                            >
                                <Upload className="h-5 w-5 text-slate-400" />
                                <span className="text-sm text-slate-500">
                                    {attachmentLimitReached ? "첨부파일 최대 개수 도달" : "클릭하여 파일 선택"}
                                </span>
                                <input type="file" multiple onChange={handleFileChange} className="hidden" disabled={editorDisabled || attachmentLimitReached} />
                            </label>

                            {attachFiles.length > 0 && (
                                <FileList
                                    files={attachFiles}
                                    onRemove={(_, index) => removeFile(index)}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate(`/app/boards/${kind}`)} className="btn-secondary" disabled={saving} aria-busy={saving}>
                        취소
                    </button>
                    <button type="submit" className="btn-primary min-w-[100px]" disabled={editorDisabled} aria-busy={saving}>
                        {saving ? "저장 중..." : isEdit ? "수정 완료" : "등록하기"}
                    </button>
                </div>
            </form>

            <style>{`
                .rich-board-editor:empty::before {
                    content: attr(data-placeholder);
                    color: #94a3b8;
                }
                .rich-board-editor img {
                    max-width: 320px;
                    max-height: 240px;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border-radius: 0.5rem;
                    margin: 8px 0;
                }
                .rich-board-editor blockquote {
                    border-left: 4px solid #cbd5e1;
                    margin: 0.75rem 0;
                    padding-left: 1rem;
                    color: #475569;
                }
                .rich-board-editor ul,
                .rich-board-editor ol {
                    padding-left: 1.25rem;
                }
            `}</style>
        </div>
    );
};

const ToolbarButton = ({ label, icon, onClick, disabled }) => (
    <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
    >
        {icon}
    </button>
);

const FileList = ({ title, files, tone = "slate", onRemove }) => (
    <div className="space-y-2">
        {title ? <div className="text-sm font-semibold text-slate-700">{title}</div> : null}
        {files.map((file, index) => {
            const fileName = file.name || file.file_name || file.fileName || "첨부파일";
            const fileId = getFileIdValue(file);
            const isExisting = Boolean(fileId);
            const rowClass = tone === "amber"
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-50";
            const iconClass = tone === "amber" ? "text-amber-600" : "text-slate-400";

            return (
                <div key={fileId || `${fileName}-${index}`} className={`flex items-center justify-between rounded-lg border p-3 ${rowClass}`}>
                    <div className="flex min-w-0 items-center gap-2">
                        {isImageFile(fileName)
                            ? <ImageIcon className={`h-4 w-4 flex-shrink-0 ${iconClass}`} />
                            : <FileText className={`h-4 w-4 flex-shrink-0 ${iconClass}`} />
                        }
                        <span className="truncate text-sm">{fileName}</span>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                            {isExisting ? "기존 파일" : formatFileSize(file.size || 0)}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemove(file, index)}
                        className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label={`${fileName} 제거`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            );
        })}
    </div>
);
