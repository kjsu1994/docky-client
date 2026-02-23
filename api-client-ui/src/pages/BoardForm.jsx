import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import api, { uploadFiles } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { isImageFile } from "../utils/helpers";
import { canManageByOwnerOrAdmin } from "../utils/authorization";

// ?? Quill CDN 濡쒕뱶 ??????????????????????????????????????????????
const loadQuill = () =>
    new Promise((resolve) => {
        if (window.Quill) return resolve(window.Quill);

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js";
        script.onload = () => resolve(window.Quill);
        document.head.appendChild(script);
    });

const BOARD_CATEGORY_PATH = {
    FREE_BOARD: "free",
    ADMIN_NOTICE: "notice",
    QUESTION_ANSWER: "eco",
};

const cloneFormData = (source) => {
    const copied = new FormData();
    for (const [key, value] of source.entries()) {
        copied.append(key, value);
    }
    return copied;
};

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

export const BoardForm = () => {
    const { kind, boardId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEdit = !!boardId;
    const boardCategoryPath = BOARD_CATEGORY_PATH[kind] || "free";
    const isAdmin =
        hasRole(user?.roles, "ROLE_ADMIN") ||
        hasRole(user?.role, "ROLE_ADMIN") ||
        hasRole(user?.member?.roles, "ROLE_ADMIN");

    // 怨듭??ы빆 沅뚰븳 泥댄겕 (而댄룷?뚰듃 吏꾩엯 ??
    useEffect(() => {
        if (kind === "ADMIN_NOTICE" && !isAdmin) {
            toast.error("怨듭??ы빆? 愿由ъ옄留??묒꽦?????덉뒿?덈떎.");
            navigate(`/app/boards/${kind}`, { replace: true });
        }
    }, [kind, isAdmin, navigate]);

    const [title, setTitle] = useState("");
    const [attachFiles, setAttachFiles] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [deletedExistingFileIds, setDeletedExistingFileIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editorReady, setEditorReady] = useState(false);

    const editorRef = useRef(null);
    const quillRef = useRef(null);

    // ?? Quill 珥덇린??????????????????????????????????????????????
    useEffect(() => {
        loadQuill().then((Quill) => {
            if (!editorRef.current || quillRef.current) return;

            const quill = new Quill(editorRef.current, {
                theme: "snow",
                placeholder: "?댁슜???낅젰?섏꽭?? ?대?吏??蹂듭궗-遺숈뿬?ｊ린 ?먮뒗 ?쒕옒洹몄븻?쒕∼?쇰줈 諛붾줈 ?쎌엯 媛?ν빀?덈떎.",
                modules: {
                    toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ color: [] }, { background: [] }],
                        [{ list: "ordered" }, { list: "bullet" }],
                        [{ align: [] }],
                        ["link", "image"],
                        ["blockquote", "code-block"],
                        ["clean"],
                    ],
                },
            });

            quillRef.current = quill;
            setEditorReady(true);

            // ?? ?대컮 ?대?吏 踰꾪듉 ???뚯씪 ?좏깮 ??????????????????
            quill.getModule("toolbar").addHandler("image", () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.multiple = true;
                input.onchange = async (e) => {
                    for (const file of Array.from(e.target.files)) {
                        await uploadImageToServer(quill, file);
                    }
                };
                input.click();
            });

            // ?? 遺숈뿬?ｊ린 ?대?吏 泥섎━ ???????????????????????????
            quill.root.addEventListener("paste", async (e) => {
                const items = Array.from(e.clipboardData?.items || []);
                const imageItems = items.filter((i) => i.type.startsWith("image/"));
                if (imageItems.length === 0) return;

                e.preventDefault();
                for (const item of imageItems) {
                    const file = item.getAsFile();
                    if (file) await uploadImageToServer(quill, file);
                }
            });

            // ?? ?쒕옒洹몄븻?쒕∼ ?대?吏 泥섎━ ??????????????????????
            quill.root.addEventListener("drop", async (e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
                    f.type.startsWith("image/")
                );
                for (const file of files) {
                    await uploadImageToServer(quill, file);
                }
            });
            quill.root.addEventListener("dragover", (e) => e.preventDefault());
        });

        return () => { quillRef.current = null; };
    }, []);

    // ?? ?대?吏 ??/image/upload ??MinIO URL ???먮뵒???쎌엯 ???????
    const uploadImageToServer = async (quill, file) => {
        // 5MB ?꾨줎???ъ쟾 寃利?
        if (file.size > 5 * 1024 * 1024) {
            toast.error("?대?吏 ?ш린??5MB ?댄븯?ъ빞 ?⑸땲??");
            return;
        }

        const toastId = toast.loading("?대?吏 ?낅줈??以?..");
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await api.post("/image/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const imageUrl = response.data?.url || response.data;
            if (!imageUrl) throw new Error("URL ?놁쓬");

            // ?꾩옱 而ㅼ꽌 ?꾩튂???대?吏 ?쎌엯
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", imageUrl);
            quill.setSelection(range.index + 1);

            toast.success("?대?吏 ?쎌엯 ?꾨즺", { id: toastId });
        } catch (err) {
            console.error("?대?吏 ?낅줈???ㅽ뙣:", err);
            toast.error(err.response?.data?.message || "?대?吏 ?낅줈???ㅽ뙣", { id: toastId });
        }
    };

    // ?? ?섏젙 紐⑤뱶: 湲곗〈 ?댁슜 濡쒕뱶 ???????????????????????????????
    useEffect(() => {
        if (!isEdit || !editorReady) return;

        api.get(`/boards/${boardId}`)
            .then((res) => {
                const board = res.data.data || res.data;
                const canManage = canManageByOwnerOrAdmin(user, board.member, {
                    ownerName: board.board_creator || board.boardCreator || "",
                    userName: user?.name || "",
                });
                if (!canManage) {
                    toast.error("?섏젙 沅뚰븳???놁뒿?덈떎.");
                    navigate(`/app/boards/${kind}/${boardId}`, { replace: true });
                    return;
                }
                setTitle(board.title || "");
                const files = board.uploadDto || board.upload_dto || [];
                setExistingFiles(Array.isArray(files) ? files : []);
                setDeletedExistingFileIds([]);
                if (quillRef.current) {
                    quillRef.current.root.innerHTML = board.contents || board.content || "";
                }
            })
            .catch(() => toast.error("寃뚯떆湲 濡쒕뵫 ?ㅽ뙣"));
    }, [isEdit, boardId, editorReady, user, kind, navigate]);

    // ?? 泥⑤??뚯씪 泥섎━ ???????????????????????????????????????????
    const handleFileChange = (e) => {
        setAttachFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    };

    const removeFile = (index) => {
        setAttachFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const removeExistingFile = (file) => {
        const fileId = getFileIdValue(file);
        if (!fileId) return;

        setExistingFiles((prev) =>
            prev.filter((it) => getFileIdValue(it) !== fileId)
        );
        setDeletedExistingFileIds((prev) =>
            prev.includes(fileId) ? prev : [...prev, fileId]
        );
    };

    const buildSubmitFormData = ({ includeNewFiles = true } = {}) => {
        const formDataToSend = new FormData();
        const quill = quillRef.current;
        const htmlContents = quill?.root?.innerHTML || "";

        formDataToSend.append("title", title);
        formDataToSend.append("contents", htmlContents);

        if (includeNewFiles) {
            attachFiles.forEach((file) => formDataToSend.append("files", file));
        }
        if (isAdmin) {
            formDataToSend.append("isNotice", "true");
            formDataToSend.append("notice", "true");
            formDataToSend.append("adminPost", "true");
        }
        return formDataToSend;
    };

    // ?? ?쒖텧 ????????????????????????????????????????????????????
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) { toast.error("?쒕ぉ???낅젰?댁＜?몄슂"); return; }

        const quill = quillRef.current;
        if (!quill) return;

        if (!quill.getText().trim()) { toast.error("?댁슜???낅젰?댁＜?몄슂"); return; }

        setLoading(true);
        try {
            if (isEdit) {
                if (deletedExistingFileIds.length > 0) {
                    // API 紐낆꽭: DELETE /boards/{board-id}/files/{file-id}
                    await Promise.all(
                        deletedExistingFileIds.map((fileId) =>
                            api.delete(`/boards/${boardId}/files/${fileId}`)
                        )
                    );
                }

                const formDataToSend = buildSubmitFormData({ includeNewFiles: true });
                await uploadFiles(`/boards/${boardId}`, formDataToSend, "patch");
                toast.success("Post updated.");
            } else {
                const formDataToSend = buildSubmitFormData({ includeNewFiles: true });
                const createEndpoints = [
                    `/boards/${boardCategoryPath}`,
                    `/boards/${kind}`,
                    `/boards?kind=${kind}`,
                    "/boards",
                ];

                let createSuccess = false;
                let lastError = null;

                for (const endpoint of createEndpoints) {
                    try {
                        const formDataForTry = cloneFormData(formDataToSend);
                        if (endpoint === "/boards") {
                            formDataForTry.append("kind", kind);
                        }
                        await uploadFiles(endpoint, formDataForTry, "post");
                        createSuccess = true;
                        break;
                    } catch (err) {
                        lastError = err;
                    }
                }

                if (!createSuccess && lastError) {
                    throw lastError;
                }
                toast.success("Post created.");
            }

            navigate(`/app/boards/${kind}`);
        } catch (error) {
            toast.error(error.response?.data?.message || "????ㅽ뙣");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ?ㅻ뜑 */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">
                    {isEdit ? "寃뚯떆湲 ?섏젙" : "寃뚯떆湲 ?묒꽦"}
                </h1>
                <button type="button" onClick={() => navigate(`/app/boards/${kind}`)} className="btn-secondary">
                    <ArrowLeft className="h-4 w-4 inline mr-2" />紐⑸줉?쇰줈
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="card p-8 space-y-6">

                    {/* ?쒕ぉ */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">?쒕ぉ</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input-base"
                            placeholder="Enter title"
                            required
                        />
                    </div>

                    {/* ?먮뵒??*/}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            ?댁슜
                            <span className="ml-2 text-xs font-normal text-slate-400">
                                ?대?吏 蹂듭궗-遺숈뿬?ｊ린 / ?쒕옒洹몄븻?쒕∼ 吏??(理쒕? 5MB)
                            </span>
                        </label>

                        {!editorReady && (
                            <div className="border border-slate-200 rounded-xl h-64 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
                                ?먮뵒??濡쒕뵫 以?..
                            </div>
                        )}

                        <div className={`quill-wrapper ${editorReady ? "" : "hidden"}`}>
                            <div ref={editorRef} />
                        </div>
                    </div>

                    {/* 泥⑤??뚯씪 */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            泥⑤??뚯씪
                            <span className="ml-2 text-xs font-normal text-slate-400">(蹂몃Ц ??異붽? 泥⑤?)</span>
                        </label>
                        <div className="space-y-3">
                            {isEdit && existingFiles.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-sm font-semibold text-slate-700">湲곗〈 泥⑤??뚯씪</div>
                                    {existingFiles.map((file, index) => (
                                        <div key={`existing-${getFileIdValue(file) || index}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isImageFile(file.file_name || file.fileName)
                                                    ? <ImageIcon className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                                    : <FileText className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                                }
                                                <span className="text-sm truncate">{file.file_name || file.fileName}</span>
                                                <span className="text-xs text-amber-700 flex-shrink-0">湲곗〈 ?뚯씪</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeExistingFile(file)}
                                                className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 cursor-pointer transition-all">
                                <Upload className="h-5 w-5 text-slate-400" />
                                <span className="text-sm text-slate-500">?대┃?섏뿬 ?뚯씪 ?좏깮</span>
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>

                            {attachFiles.length > 0 && (
                                <div className="space-y-2">
                                    {attachFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isImageFile(file.name)
                                                    ? <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                    : <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                }
                                                <span className="text-sm truncate">{file.name}</span>
                                                <span className="text-xs text-slate-400 flex-shrink-0">
                                                    ({(file.size / 1024).toFixed(0)}KB)
                                                </span>
                                            </div>
                                            <button type="button" onClick={() => removeFile(index)}
                                                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 踰꾪듉 */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate(`/app/boards/${kind}`)}
                            className="btn-secondary" disabled={loading} aria-busy={loading}>痍⑥냼</button>
                    <button type="submit" className="btn-primary min-w-[100px]"
                            disabled={loading || !editorReady} aria-busy={loading}>
                        {loading ? "???以?.." : isEdit ? "?섏젙 ?꾨즺" : "?깅줉?섍린"}
                    </button>
                </div>
            </form>

            {/* Quill ?ㅽ???*/}
            <style>{`
                .quill-wrapper .ql-toolbar {
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                    background: #f8fafc;
                    border-color: #e2e8f0;
                }
                .quill-wrapper .ql-container {
                    font-size: 15px;
                    font-family: inherit;
                    border-bottom-left-radius: 0.75rem;
                    border-bottom-right-radius: 0.75rem;
                    border-color: #e2e8f0;
                    min-height: 280px;
                }
                .quill-wrapper .ql-editor {
                    min-height: 280px;
                    line-height: 1.7;
                }
                .quill-wrapper .ql-editor img {
                    max-width: 320px;
                    max-height: 240px;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border-radius: 0.5rem;
                    margin: 8px 0;
                    cursor: pointer;
                }
                .quill-wrapper .ql-editor.ql-blank::before {
                    color: #94a3b8;
                    font-style: normal;
                }
            `}</style>
        </div>
    );
};
