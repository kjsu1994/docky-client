import { useState, useEffect, useId, useRef, useCallback, useMemo } from "react";
import {
    Send,
    Plus,
    Bot,
    User,
    Users,
    UserPlus,
    Search,
    MessageSquare,
    File as FileIcon,
    Download,
    ArrowLeft,
    X,
    Check,
    Star,
    RefreshCw
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatRelativeTime, debounce, resolveChatAttachmentUrl, formatFileSize } from "../../utils/helpers.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import {
    buildFilePayload,
    buildTalkPayload,
    CHAT_MESSAGE_MAX_LENGTH,
    chatAdapter,
    compareMessagesByChronology,
    extractChatErrorMessage,
    getAttachmentTypeLabel,
    getMemberId,
    getRoomId,
    getRoomKey,
    hasPersistentMessageId,
    isMatchingOptimisticMessage,
    isSamePersistentMessage,
    MEMBER_SEARCH_KEYWORD_MAX_LENGTH,
    normalizeMessage,
    isAiRoom,
} from "../../adapters/chatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import { logClientError } from "../../utils/clientDiagnostics.js";
import { trapFocus } from "../../utils/focusTrap.js";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import UserAvatar from "../../common/UserAvatar.jsx";
import AuthenticatedAttachmentImage from "../../components/AuthenticatedAttachmentImage.jsx";

const MESSAGE_PAGE_SIZE = 20;

const createEmptyMessagePageInfo = () => ({
    currentPage: 1,
    size: MESSAGE_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasMore: false,
});

const hasOlderMessages = (pageInfo) =>
    Number(pageInfo?.totalPages || 0) > Number(pageInfo?.currentPage || 1);

const mergeMessagePages = (olderMessages, currentMessages) => {
    const seen = new Set();
    return [...olderMessages, ...currentMessages].reduce((acc, message) => {
        const normalized = normalizeMessage(message);
        if (!normalized) return acc;
        const key = normalized.messageId || normalized.id || normalized.key;
        if (seen.has(key)) return acc;
        seen.add(key);
        acc.push(normalized);
        return acc;
    }, []).sort(compareMessagesByChronology);
};

export const Chat = () => {
    const { user } = useAuth();

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const [messagePageInfo, setMessagePageInfo] = useState(createEmptyMessagePageInfo);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const stompClientRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showMemberList, setShowMemberList] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [uploadingFileName, setUploadingFileName] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [roomSearchQuery, setRoomSearchQuery] = useState("");
    
    const [newRoomTitle, setNewRoomTitle] = useState("");
    const [newRoomType, setNewRoomType] = useState("GROUP");
    
    const [memberSearch, setMemberSearch] = useState("");
    const [foundMembers, setFoundMembers] = useState([]);
    const [recommendedMembers, setRecommendedMembers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searching, setSearching] = useState(false);
    const modalTitleId = useId();
    const modalDescriptionId = useId();
    const roomTitleInputId = useId();
    const memberSearchInputId = useId();

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const skipNextAutoScrollRef = useRef(false);
    const modalPanelRef = useRef(null);
    const modalCloseButtonRef = useRef(null);

    const handleDownloadAttachment = useCallback(async (fileUrl, fileName) => {
        try {
            await chatAdapter.downloadAttachment(fileUrl, fileName || "attachment");
        } catch (error) {
            logClientError("chat.attachment.download", error);
            notifyError(extractChatErrorMessage(error, "첨부파일을 다운로드할 수 없습니다."));
        }
    }, []);

    const closeMemberModal = useCallback(() => {
        setShowCreateModal(false);
        setShowInviteModal(false);
    }, []);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        if (skipNextAutoScrollRef.current) {
            skipNextAutoScrollRef.current = false;
            return;
        }
        if (!loadingMessages) {
            scrollToBottom();
        }
    }, [messages, loadingMessages]);

    // 채팅방 목록 가져오기
    const fetchRooms = async () => {
        setLoadingRooms(true);
        try {
            const nextRooms = await chatAdapter.fetchRooms();
            setRooms(nextRooms);
            return nextRooms;
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "채팅방 목록을 불러오지 못했습니다."));
            return [];
        } finally {
            setLoadingRooms(false);
        }
    };

    // 현재 방의 멤버 조회
    const fetchCurrentMembers = async (roomId) => {
        if (!roomId) return;
        setLoadingMembers(true);
        try {
            setCurrentMembers(await chatAdapter.fetchRoomMembers(roomId));
        } catch (error) {
            setCurrentMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    };

    // 과거 대화 내역 조회
    const fetchMessages = async (roomId) => {
        if (!roomId) return;
        setLoadingMessages(true);
        try {
            const result = await chatAdapter.fetchRoomMessagesPage(roomId, {
                page: 1,
                size: MESSAGE_PAGE_SIZE,
            });
            setMessages(result.items);
            setMessagePageInfo(result.pageInfo);
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "대화 내역을 불러오지 못했습니다."));
            setMessages([]);
            setMessagePageInfo(createEmptyMessagePageInfo());
        } finally {
            setLoadingMessages(false);
        }
    };

    const fetchOlderMessages = async () => {
        const roomId = getRoomId(currentRoom);
        if (!roomId || loadingOlderMessages || !hasOlderMessages(messagePageInfo)) return;

        setLoadingOlderMessages(true);
        skipNextAutoScrollRef.current = true;
        try {
            const result = await chatAdapter.fetchRoomMessagesPage(roomId, {
                page: Number(messagePageInfo.currentPage || 1) + 1,
                size: Number(messagePageInfo.size || MESSAGE_PAGE_SIZE),
            });
            setMessages((prev) => mergeMessagePages(result.items, prev));
            setMessagePageInfo(result.pageInfo);
        } catch (error) {
            skipNextAutoScrollRef.current = false;
            notifyError(extractChatErrorMessage(error, "이전 메시지를 불러오지 못했습니다."));
        } finally {
            setLoadingOlderMessages(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    // 추천 멤버 가져오기 (0-based page)
    const fetchRecommendations = async () => {
        try {
            setRecommendedMembers(await chatAdapter.fetchMembers({
                page: 0,
                size: 20,
                excludeMemberId: getMemberId(user),
            }));
        } catch (error) {
            setRecommendedMembers([]);
        }
    };

    useEffect(() => {
        if (showCreateModal || showInviteModal) fetchRecommendations();
    }, [showCreateModal, showInviteModal]);

    useEffect(() => {
        if (!showCreateModal && !showInviteModal) return undefined;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeMemberModal();
                return;
            }
            trapFocus(event, modalPanelRef.current);
        };

        window.setTimeout(() => modalCloseButtonRef.current?.focus(), 0);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (previousFocus?.isConnected) {
                previousFocus.focus();
            }
        };
    }, [closeMemberModal, showCreateModal, showInviteModal]);

    // WebSocket 연결 설정
    useEffect(() => {
        let cancelled = false;
        let client;
        const connectHeaders = buildStompConnectHeaders();
        if (!connectHeaders.Authorization) {
            setIsConnected(false);
            return undefined;
        }
        createStompClient({
            connectHeaders,
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        }).then((nextClient) => {
            if (cancelled) {
                nextClient.deactivate();
                return;
            }
            client = nextClient;

            client.onConnect = () => {
                stompClientRef.current = client;
                setIsConnected(true);
            };

            client.onDisconnect = () => {
                setIsConnected(false);
            };

            client.onStompError = (frame) => {
                setIsConnected(false);
                void notifyRealtimeError({
                    scope: "chat",
                    error: frame,
                    fallbackMessage: "채팅 연결 인증이 만료되었습니다. 다시 로그인해 주세요.",
                });
            };

            client.activate();
        }).catch(() => {
            if (!cancelled) {
                setIsConnected(false);
                notifyError("채팅 연결을 준비하지 못했습니다.");
            }
        });
        return () => {
            cancelled = true;
            stompClientRef.current = null;
            if (client) client.deactivate();
        };
    }, []);

    useEffect(() => {
        const roomId = getRoomId(currentRoom);
        if (!roomId) {
            setMessages([]);
            setCurrentMembers([]);
            setMessagePageInfo(createEmptyMessagePageInfo());
            return;
        }

        fetchMessages(roomId);
        fetchCurrentMembers(roomId);
        chatAdapter.markRoomRead(roomId).catch(() => undefined);
    }, [currentRoom]);

    // 특정 채팅방의 신규 실시간 메시지만 구독한다.
    useEffect(() => {
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!client || !isConnected || !roomId) return;

        const subscription = client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
            const receivedMessage = JSON.parse(message.body);
            const normalized = normalizeMessage(receivedMessage);
            if (normalized) {
                setMessages((prev) => {
                    if (prev.some((message) => isSamePersistentMessage(message, normalized))) return prev;
                    const optimisticMatch = prev.find((message) => isMatchingOptimisticMessage(message, normalized));
                    if (optimisticMatch) {
                        return prev
                            .map((message) => message.id === optimisticMatch.id ? normalized : message)
                            .sort(compareMessagesByChronology);
                    }
                    if (!hasPersistentMessageId(normalized) && prev.some((m) => m.key && m.key === normalized.key)) return prev;

                    const hasSameFile = !hasPersistentMessageId(normalized) && normalized.type === "FILE" && prev.find((m) =>
                        m.type === "FILE" &&
                        Number(m.senderId) === Number(normalized.senderId) &&
                        String(m.fileUrl || m.message) === String(normalized.fileUrl || normalized.message)
                    );
                    if (hasSameFile) return prev;

                    return [...prev, normalized].sort(compareMessagesByChronology);
                });
            }
        });

        return () => { subscription.unsubscribe(); };
    }, [isConnected, currentRoom]);

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        const myId = getMemberId(user);
        const text = newMessage.trim();

        if (!text) return;
        if (!roomId) {
            notifyError("채팅방을 선택한 뒤 메시지를 보내 주세요.");
            return;
        }
        if (!client || !isConnected) {
            notifyError("채팅 연결이 아직 준비되지 않았습니다. 잠시 후 다시 보내 주세요.");
            return;
        }
        if (text.length > CHAT_MESSAGE_MAX_LENGTH) {
            notifyError(`메시지는 ${CHAT_MESSAGE_MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 입력해 주세요.`);
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const messagePayload = buildTalkPayload({ roomId, senderId: myId, message: text, tempId });

        try {
            const optimisticMsg = normalizeMessage({
                ...messagePayload,
                id: tempId,
                senderProfileUrl: user?.profileUrl || user?.profile_url || "",
                senderName: user.name || "익명",
                createdAt: new Date().toISOString()
            });
            setMessages(prev => [...prev, optimisticMsg].sort(compareMessagesByChronology));

            client.publish({
                destination: "/pub/chat/message",
                body: JSON.stringify(messagePayload),
                headers: { "content-type": "application/json" }
            });
            setNewMessage("");
        } catch (err) {
            logClientError("chat.send", err);
            setMessages((prev) => prev.filter((message) => message.id !== tempId));
            notifyError("메시지를 전송하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!file || !roomId || !client || !isConnected) return;

        const myId = getMemberId(user);
        const formData = new FormData();
        formData.append("file", file);
        const tempId = `temp-file-${Date.now()}`;

        try {
            setUploadingFileName(file.name);
            setUploadProgress(0);

            const attachment = await chatAdapter.uploadRoomFile(roomId, formData, {
                onUploadProgress: (event) => {
                    if (!event?.total) return;
                    setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
                },
            });
            const messagePayload = buildFilePayload({ roomId, senderId: myId, attachment });

            const optimisticMsg = normalizeMessage({
                ...messagePayload,
                id: tempId,
                senderProfileUrl: user?.profileUrl || user?.profile_url || "",
                senderName: user.name || "익명",
                createdAt: new Date().toISOString()
            });
            setMessages((prev) => [...prev, optimisticMsg].sort(compareMessagesByChronology));

            client.publish({
                destination: "/pub/chat/message",
                body: JSON.stringify(messagePayload),
                headers: { "content-type": "application/json" }
            });
            if (isAiRoom(currentRoom) && attachment.fileImage) {
                notifySuccess("이미지를 첨부했습니다. 이어서 질문을 보내면 AI가 함께 봅니다.");
            }
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "파일 업로드에 실패했습니다."));
        } finally {
            setUploadingFileName("");
            setUploadProgress(0);
            e.target.value = "";
        }
    };

    const createRoom = async () => {
        if (!newRoomTitle.trim()) { notifyError("방 제목을 입력해 주세요."); return; }
        try {
            // 방 생성 시에는 본인만 멤버로 등록해 생성한다.
            const myId = Number(getMemberId(user));
            const memberIds = [myId];

            const createdRoom = await chatAdapter.createRoom({ title: newRoomTitle, type: newRoomType, memberIds });
            notifySuccess("방이 생성되었습니다. 멤버를 초대해 보세요.");
            setShowCreateModal(false);
            resetMemberSelection();

            const updatedRooms = await fetchRooms();
            const createdId = getRoomId(createdRoom);
            if (createdId) {
                const found = updatedRooms.find(r => getRoomId(r) === createdId);
                setCurrentRoom(found || createdRoom);
            }
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "방 생성에 실패했습니다."));
        }
    };

    const openAiRoom = async () => {
        try {
            const roomId = await chatAdapter.openAiRoom();
            const updatedRooms = await fetchRooms();
            const found = updatedRooms.find((room) => String(getRoomId(room)) === String(roomId));
            setCurrentRoom(found || null);
            if (!found) {
                notifySuccess("AI 채팅방을 열었습니다.");
            }
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "AI 채팅방을 열지 못했습니다."));
        }
    };

    const inviteMembers = async () => {
        const roomId = getRoomId(currentRoom);
        if (selectedMembers.length === 0 || !roomId) return;
        try {
            // 초대할 멤버들의 ID를 안전하게 추출
            const memberIds = selectedMembers
                .map(m => Number(getMemberId(m)))
                .filter(id => !isNaN(id) && id > 0);

            if (memberIds.length === 0) return;

            await chatAdapter.inviteMembers(roomId, memberIds);
            notifySuccess("멤버를 초대했습니다.");
            setShowInviteModal(false);
            resetMemberSelection();
            fetchRooms();
            fetchCurrentMembers(roomId); // 멤버 목록 즉시 갱신
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "멤버 초대에 실패했습니다."));
        }
    };

    const performSearch = useCallback(
        debounce(async (query) => {
            if (!query.trim()) { setFoundMembers([]); setSearching(false); return; }
            setSearching(true);
            try {
                setFoundMembers(await chatAdapter.fetchMembers({
                    keyword: query,
                    page: 0,
                    size: 20,
                    excludeMemberId: getMemberId(user),
                }));
            } catch (error) {
                setFoundMembers([]);
            } finally { setSearching(false); }
        }, 300),
        [user]
    );

    const handleSearchChange = (e) => {
        const query = e.target.value.slice(0, MEMBER_SEARCH_KEYWORD_MAX_LENGTH);
        setMemberSearch(query);
        performSearch(query);
    };

    const toggleMemberSelection = (member) => {
        const mId = getMemberId(member);
        if (!mId) return;

        setSelectedMembers(prev => {
            const isSelected = prev.some(m => getMemberId(m) === mId);
            if (isSelected) {
                return prev.filter(m => getMemberId(m) !== mId);
            } else {
                return [...prev, member];
            }
        });
    };

    const resetMemberSelection = () => {
        setMemberSearch(""); setFoundMembers([]); setSelectedMembers([]); setNewRoomTitle("");
    };

    const displayedMembers = memberSearch.trim().length > 0 ? foundMembers : recommendedMembers;
    const canLoadOlderMessages = hasOlderMessages(messagePageInfo);
    const filteredRooms = useMemo(() => {
        const query = roomSearchQuery.trim().toLowerCase();
        if (!query) return rooms;

        return rooms.filter((room) => {
            const title = String(room?.title || "").toLowerCase();
            const lastMessage = String(room?.lastMessage || "").toLowerCase();
            return title.includes(query) || lastMessage.includes(query);
        });
    }, [roomSearchQuery, rooms]);

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* 사이드바 */}
            <div className={`${isSidebarOpen ? "w-80" : "w-0"} transition-all duration-300 border-r flex flex-col bg-slate-50`}>
                <div className="p-4 border-b bg-white flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary-600" />채팅방</h2>
                    <div className="flex gap-1">
                        <button type="button" aria-label="채팅방 목록 새로고침" onClick={fetchRooms} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><RefreshCw className={`h-4 w-4 ${loadingRooms ? 'animate-spin' : ''}`} /></button>
                        <button type="button" aria-label="AI 채팅방 열기" onClick={openAiRoom} className="p-1.5 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors"><Bot className="h-5 w-5" /></button>
                        <button type="button" aria-label="새 채팅방 만들기" onClick={() => { resetMemberSelection(); setShowCreateModal(true); }} className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"><Plus className="h-5 w-5" /></button>
                    </div>
                </div>
                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                aria-label="채팅방 검색"
                                type="text"
                                value={roomSearchQuery}
                            onChange={(event) => setRoomSearchQuery(event.target.value)}
                            placeholder="방 이름 또는 최근 메시지 검색"
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingRooms ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : (rooms && rooms.length > 0) ? (
                        <div className="space-y-1 p-2">
                            {filteredRooms.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">검색 결과가 없습니다.</div>
                            ) : filteredRooms.map((room, idx) => {
                                const roomId = getRoomId(room);
                                const isActive = getRoomId(currentRoom) === roomId;
                                return (
                                    <button key={getRoomKey(room, idx)} onClick={() => { setCurrentRoom(room); setMessages([]); setMessagePageInfo(createEmptyMessagePageInfo()); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? "bg-primary-600 text-white shadow-md" : "hover:bg-white hover:shadow-sm text-slate-700"}`}>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${isActive ? "bg-white/20" : "bg-primary-100 text-primary-700"}`}>
                                            {room.type === "AI" ? <Bot className="h-6 w-6" /> : room.type === "PERSONAL" ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="font-bold truncate">{room.title}</span>
                                                {room.unreadCount > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white text-primary-600" : "bg-red-500 text-white"}`}>{room.unreadCount}</span>}
                                            </div>
                                            <div className={`text-xs truncate ${isActive ? "text-white/80" : "text-slate-500"}`}>{room.lastMessage || "대화 내용이 없습니다."}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : <div className="p-8 text-center text-slate-500 text-sm">참여 중인 방이 없습니다.</div>}
                </div>
            </div>

            {/* 메인 */}
            <div className="flex-1 flex flex-col bg-white">
                {currentRoom ? (
                    <>
                        <div className="p-4 border-b flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <button type="button" aria-label="채팅방 목록 열기" onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
                                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                                    {currentRoom.type === "AI" ? <Bot className="h-5 w-5" /> : currentRoom.type === "PERSONAL" ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{currentRoom.title}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-amber-400"}`}></span>{isConnected ? "실시간 연결" : "실시간 연결 대기"}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" aria-label={showMemberList ? "참여자 목록 닫기" : "참여자 목록 열기"} onClick={() => setShowMemberList(!showMemberList)} className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-bold ${showMemberList ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                                    <Users className="h-4 w-4" /><span className="hidden sm:inline">{currentMembers.length}</span>
                                </button>
                                {currentRoom.type === "GROUP" && (
                                    <button type="button" aria-label="멤버 초대" onClick={() => { resetMemberSelection(); setShowInviteModal(true); }} className="p-2 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 flex items-center gap-1.5 text-sm font-bold">
                                        <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">초대</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden relative">
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                                    {loadingMessages ? <div className="h-full flex items-center justify-center"><LoadingSpinner text="메시지 로드 중..." /></div> : messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2"><MessageSquare className="h-12 w-12 opacity-20" /><p className="text-sm font-medium">대화를 시작해보세요!</p></div>
                                    ) : (
                                        <>
                                            {canLoadOlderMessages && (
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={fetchOlderMessages}
                                                        disabled={loadingOlderMessages}
                                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                                                    >
                                                        {loadingOlderMessages ? "불러오는 중..." : "이전 메시지 더 보기"}
                                                    </button>
                                                </div>
                                            )}
                                            {messages.map((msg, idx) => {
                                        const normalized = normalizeMessage(msg);
                                        const isMe = Number(normalized.senderId) === Number(getMemberId(user));
                                        const messageFileUrl = normalized.type === "FILE"
                                            ? resolveChatAttachmentUrl(normalized.fileUrl || normalized.message, normalized.fileName || normalized.message)
                                            : "";
                                        return (
                                            <div key={normalized.key || normalized.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                <div className={`flex max-w-[80%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
                                                    {!isMe && <UserAvatar name={normalized.senderName} profileUrl={normalized.senderProfileUrl} size="sm" className="rounded-lg border-slate-100" />}
                                                    <div className="flex flex-col">
                                                        {!isMe && <span className="text-[10px] text-slate-500 mb-1 ml-1">{normalized.senderName}</span>}
                                                        <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? "bg-primary-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"}`}>
                                                            {normalized.type === "FILE" ? (
                                                                !messageFileUrl ? (
                                                                    <div
                                                                        className={`flex min-w-[220px] items-center gap-3 rounded-xl ${isMe ? "bg-white/10" : "bg-slate-50"} px-3 py-3`}
                                                                        aria-label="표시할 수 없는 첨부파일"
                                                                    >
                                                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isMe ? "bg-white/15" : "bg-slate-200 text-slate-500"}`}>
                                                                            <FileIcon className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-sm font-bold">{normalized.fileName || normalized.message || "첨부파일"}</div>
                                                                            <div className={`mt-1 text-[11px] font-bold ${isMe ? "text-white/70" : "text-slate-500"}`}>
                                                                                첨부파일을 표시할 수 없습니다.
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : normalized.fileImage ? (
                                                                    <div className="space-y-2">
                                                                        <AuthenticatedAttachmentImage
                                                                            src={messageFileUrl}
                                                                            alt={normalized.fileName || "이미지"}
                                                                            className="max-w-xs rounded-xl cursor-pointer"
                                                                        />
                                                                        {!!(normalized.fileName || normalized.message) && (
                                                                            <div className={`text-[11px] ${isMe ? "text-white/80" : "text-slate-500"}`}>
                                                                                {normalized.fileName || normalized.message}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadAttachment(messageFileUrl, normalized.fileName || normalized.message)}
                                                                        className={`flex min-w-[220px] items-center gap-3 rounded-xl ${isMe ? "bg-white/10" : "bg-slate-50"} px-3 py-3 text-left transition-colors hover:opacity-90`}
                                                                    >
                                                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isMe ? "bg-white/15" : "bg-primary-50 text-primary-600"}`}>
                                                                            <Download className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-sm font-bold">{normalized.fileName || normalized.message || "첨부파일"}</div>
                                                                            <div className={`mt-1 flex items-center gap-2 text-[11px] ${isMe ? "text-white/80" : "text-slate-500"}`}>
                                                                                <span>{formatFileSize(Number(normalized.fileSize || 0))}</span>
                                                                                <span className={`rounded-full px-2 py-0.5 font-bold ${isMe ? "bg-white/10 text-white" : "bg-white text-primary-600"}`}>
                                                                                    {getAttachmentTypeLabel(normalized.fileName, normalized.fileContentType)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                )
                                                            ) : normalized.message}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 pb-1">{formatRelativeTime(new Date(normalized.createdAt))}</span>
                                                </div>
                                            </div>
                                        );
                                            })}
                                        </>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 border-t bg-white">
                                    {uploadingFileName && (
                                        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-primary-50 px-4 py-2 text-xs font-bold text-primary-700">
                                            <span className="truncate">업로드 중: {uploadingFileName}</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                    )}
                                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                        <button type="button" aria-label="파일 첨부" onClick={() => fileInputRef.current.click()} className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><FileIcon className="h-5 w-5" /></button>
                                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z" />
                                        <div className="flex-1 relative">
                                            <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={isAiRoom(currentRoom) ? "질문을 입력하세요. 이미지는 먼저 첨부한 뒤 질문하면 됩니다." : "메시지를 입력해 주세요."} maxLength={CHAT_MESSAGE_MAX_LENGTH} className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 resize-none max-h-32" rows="1" />
                                            <button type="submit" aria-label="메시지 보내기" disabled={!newMessage.trim() || !isConnected} className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all ${ (newMessage.trim() && isConnected) ? "bg-primary-600 text-white shadow-md" : "bg-slate-200 text-slate-400" }`}><Send className="h-4 w-4" /></button>
                                            <div className="mt-1 text-right text-[11px] font-bold text-slate-400">
                                                {newMessage.length.toLocaleString("ko-KR")} / {CHAT_MESSAGE_MAX_LENGTH.toLocaleString("ko-KR")}
                                            </div>
                                        </div>
                                    </form>
                                    {isAiRoom(currentRoom) && (
                                        <p className="mt-2 text-xs font-semibold text-slate-400">
                                            AI 방은 서버 기본 모델만 사용합니다. 이미지를 첨부한 뒤 질문을 보내면 최근 첨부 이미지까지 함께 전달합니다.
                                        </p>
                                    )}
                                </div>
                            </div>
                            {showMemberList && (
                                <div className="w-64 border-l bg-white flex flex-col animate-slide-in-right">
                                    <div className="p-4 border-b flex items-center justify-between bg-slate-50"><h4 className="font-bold text-sm text-slate-900">참여자 ({currentMembers.length})</h4><button type="button" aria-label="참여자 목록 닫기" onClick={() => setShowMemberList(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors"><X className="h-4 w-4" /></button></div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {loadingMembers ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : currentMembers.length === 0 ? <div className="p-4 text-center text-xs text-slate-400">참여자 정보가 없습니다.</div> : currentMembers.map(m => {
                                            const isMe = getMemberId(m) === getMemberId(user);
                                            return (
                                                <div key={getMemberId(m)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <UserAvatar name={m.name} profileUrl={m.profileUrl || m.profile_url} size="sm" />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold truncate flex items-center gap-1">{m.name}{isMe && <span className="text-[9px] px-1 py-0.5 bg-primary-100 text-primary-600 rounded">나</span>}</div>
                                                        <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 text-center p-8"><MessageSquare className="h-16 w-16 text-primary-100 mb-4" /><h2 className="text-xl font-bold text-slate-900">대화방을 선택해주세요.</h2></div>}
            </div>

            {/* 모달 */}
            {(showCreateModal || showInviteModal) && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeMemberModal();
                    }}
                >
                    <div
                        ref={modalPanelRef}
                        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={modalTitleId}
                        aria-describedby={modalDescriptionId}
                    >
                        <p id={modalDescriptionId} className="sr-only">
                            {showCreateModal ? "새 채팅방 제목을 입력해 방을 만들 수 있습니다." : "초대할 멤버를 검색하고 선택할 수 있습니다."}
                        </p>
                        <div className="p-6 border-b flex items-center justify-between bg-primary-600 text-white">
                            <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-white/20">{showCreateModal ? <MessageSquare className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}</div><h3 id={modalTitleId} className="text-xl font-bold">{showCreateModal ? "새 채팅방 만들기" : "멤버 초대하기"}</h3></div>
                            <button ref={modalCloseButtonRef} type="button" aria-label="채팅 모달 닫기" onClick={closeMemberModal} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            {showCreateModal ? (
                                <div>
                                    <label htmlFor={roomTitleInputId} className="block text-sm font-bold text-slate-700 mb-2">채팅방 제목</label>
                                    <input
                                        id={roomTitleInputId}
                                        type="text"
                                        value={newRoomTitle} 
                                        onChange={(e) => setNewRoomTitle(e.target.value)} 
                                        placeholder="예: 프로젝트 대화방" 
                                        className="input-base" 
                                        autoFocus
                                    />
                                    <p className="mt-2 text-xs text-slate-400 font-medium">* 방 생성 후 참여자 목록에서 멤버를 초대할 수 있습니다.</p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label htmlFor={memberSearchInputId} className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">멤버 선택{memberSearch.trim().length === 0 && <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 전체 멤버 목록</span>}</label>
                                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input id={memberSearchInputId} type="text" value={memberSearch} onChange={handleSearchChange} maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH} placeholder="이름 또는 이메일 검색..." className="input-base pl-10" /></div>
                                        <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">검색어 {memberSearch.length}/{MEMBER_SEARCH_KEYWORD_MAX_LENGTH}자</p>
                                        <div className="mt-3 max-h-56 overflow-y-auto space-y-1 border rounded-2xl p-1 bg-slate-50/50">
                                            {searching ? <div className="p-8 text-center"><LoadingSpinner size="sm" text="검색 중..." /></div> : displayedMembers.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">{memberSearch.trim().length > 0 ? "검색 결과가 없습니다." : "불러올 수 있는 멤버가 없습니다."}</div> : displayedMembers.map(m => {
                                                const mId = getMemberId(m);
                                                const isSelected = selectedMembers.find(sm => getMemberId(sm) === mId);
                                                return (
                                                    <button key={mId} type="button" aria-pressed={Boolean(isSelected)} onClick={() => toggleMemberSelection(m)} className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition-all ${isSelected ? "bg-primary-600 text-white shadow-md" : "hover:bg-white hover:shadow-sm"}`}>
                                                        <div className="flex items-center gap-3"><UserAvatar name={m.name} profileUrl={m.profileUrl || m.profile_url} size="md" className={isSelected ? "border-white/30 bg-white/20 text-white" : ""} /><div className="text-left"><div className="font-bold">{m.name}</div><div className={`text-[10px] ${isSelected ? "text-white/70" : "text-slate-400"}`}>{m.email}</div></div></div>
                                                        {isSelected && <Check className="h-5 w-5" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {selectedMembers.length > 0 && (<div className="space-y-2"><div className="text-[11px] font-bold text-slate-500">선택됨 ({selectedMembers.length})</div><div className="flex flex-wrap gap-2">{selectedMembers.map(m => (<div key={getMemberId(m)} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-xl text-xs font-bold animate-fade-in"><span>{m.name}</span><button type="button" aria-label={`${m.name} 선택 해제`} onClick={() => toggleMemberSelection(m)} className="p-0.5 hover:bg-primary-200 rounded-lg transition-colors"><X className="h-3.5 w-3.5" /></button></div>))}</div></div>)}
                                </>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-3">
                            <button type="button" onClick={closeMemberModal} className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors">취소</button>
                            <button type="button" onClick={showCreateModal ? createRoom : inviteMembers} disabled={showCreateModal ? !newRoomTitle.trim() : selectedMembers.length === 0} className={`flex-1 px-4 py-3 rounded-2xl font-bold transition-all shadow-lg ${ (showCreateModal ? newRoomTitle.trim() : selectedMembers.length > 0) ? "bg-primary-600 text-white hover:bg-primary-700" : "bg-slate-200 text-slate-400 cursor-not-allowed" }`}>{showCreateModal ? "채팅방 생성" : "멤버 초대"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};





