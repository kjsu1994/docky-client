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
    RefreshCw,
    MoreVertical,
    Pencil,
    LogOut
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
import { confirmAction } from "../../common/confirmAction.jsx";

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
    const [roomActionTarget, setRoomActionTarget] = useState(null);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameRoomTitle, setRenameRoomTitle] = useState("");
    
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
    const roomLongPressTimerRef = useRef(null);
    const roomLongPressTriggeredRef = useRef(false);

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
        const userLevel = user?.levelDto || user?.level_dto || user?.level || {};

        try {
            const optimisticMsg = normalizeMessage({
                ...messagePayload,
                id: tempId,
                senderProfileUrl: user?.profileUrl || user?.profile_url || "",
                senderName: user.name || "익명",
                senderLevel: userLevel.level,
                senderRewardTier: userLevel.rewardTier || userLevel.reward_tier,
                senderFrameCode: userLevel.frameCode || userLevel.frame_code,
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
            const userLevel = user?.levelDto || user?.level_dto || user?.level || {};

            const optimisticMsg = normalizeMessage({
                ...messagePayload,
                id: tempId,
                senderProfileUrl: user?.profileUrl || user?.profile_url || "",
                senderName: user.name || "익명",
                senderLevel: userLevel.level,
                senderRewardTier: userLevel.rewardTier || userLevel.reward_tier,
                senderFrameCode: userLevel.frameCode || userLevel.frame_code,
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

    const selectRoom = useCallback((room) => {
        setCurrentRoom(room);
        setMessages([]);
        setMessagePageInfo(createEmptyMessagePageInfo());
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    }, []);

    const openRoomActions = useCallback((room) => {
        if (!room) return;
        setRoomActionTarget(room);
        setRenameRoomTitle(room.title || "");
    }, []);

    const closeRoomActions = useCallback(() => {
        setRoomActionTarget(null);
        setShowRenameModal(false);
        setRenameRoomTitle("");
    }, []);

    const beginRoomLongPress = useCallback((room, event) => {
        if (!room || event.pointerType === "mouse") return;
        window.clearTimeout(roomLongPressTimerRef.current);
        roomLongPressTriggeredRef.current = false;
        roomLongPressTimerRef.current = window.setTimeout(() => {
            roomLongPressTriggeredRef.current = true;
            openRoomActions(room);
        }, 520);
    }, [openRoomActions]);

    const clearRoomLongPress = useCallback(() => {
        window.clearTimeout(roomLongPressTimerRef.current);
    }, []);

    useEffect(() => () => window.clearTimeout(roomLongPressTimerRef.current), []);

    const renameRoom = async () => {
        const roomId = getRoomId(roomActionTarget);
        const title = renameRoomTitle.trim();
        if (!roomId || !title) {
            notifyError("채팅방 이름을 입력해 주세요.");
            return;
        }
        try {
            const renamed = await chatAdapter.renameRoom(roomId, title);
            const nextTitle = renamed?.title || title;
            setRooms((prev) => prev.map((room) => String(getRoomId(room)) === String(roomId) ? { ...room, title: nextTitle } : room));
            setCurrentRoom((prev) => String(getRoomId(prev)) === String(roomId) ? { ...prev, title: nextTitle } : prev);
            notifySuccess("채팅방 이름을 변경했습니다.");
            closeRoomActions();
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "채팅방 이름을 변경하지 못했습니다."));
        }
    };

    const leaveSelectedRoom = async () => {
        const roomId = getRoomId(roomActionTarget);
        if (!roomId) return;
        const title = roomActionTarget?.title || "채팅방";
        const confirmed = await confirmAction({
            title: "채팅방 나가기",
            description: `${title}에서 나가시겠습니까?`,
            confirmText: "나가기",
            cancelText: "취소",
            tone: "danger",
        });
        if (!confirmed) return;
        try {
            await chatAdapter.leaveRoom(roomId);
            setRooms((prev) => prev.filter((room) => String(getRoomId(room)) !== String(roomId)));
            if (String(getRoomId(currentRoom)) === String(roomId)) {
                setCurrentRoom(null);
                setMessages([]);
                setMessagePageInfo(createEmptyMessagePageInfo());
                setCurrentMembers([]);
                setIsSidebarOpen(true);
            }
            notifySuccess("채팅방에서 나갔습니다.");
            closeRoomActions();
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "채팅방을 나가지 못했습니다."));
        }
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
        <div className="relative flex h-[calc(100svh-96px)] min-h-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:h-[calc(100vh-120px)]">
            {/* 사이드바 */}
            <div className={`${isSidebarOpen ? "translate-x-0 lg:w-80" : "-translate-x-full lg:w-0"} absolute inset-y-0 left-0 z-30 flex w-full flex-col border-r border-line bg-control transition-all duration-300 lg:relative lg:translate-x-0`}>
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface p-3 sm:p-4">
                    <h2 className="flex items-center gap-2 font-bold text-ink"><MessageSquare className="h-5 w-5 text-primary-600" />채팅방</h2>
                    <div className="flex gap-1">
                        <button type="button" aria-label="채팅방 목록 새로고침" onClick={fetchRooms} className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-control-hover"><RefreshCw className={`h-4 w-4 ${loadingRooms ? 'animate-spin' : ''}`} /></button>
                        <button type="button" aria-label="AI 채팅방 열기" onClick={openAiRoom} className="rounded-lg bg-cyan-500/10 p-1.5 text-cyan-700 transition-colors hover:bg-cyan-500/20"><Bot className="h-5 w-5" /></button>
                        <button type="button" aria-label="새 채팅방 만들기" onClick={() => { resetMemberSelection(); setShowCreateModal(true); }} className="rounded-lg bg-primary-500/10 p-1.5 text-primary-600 transition-colors hover:bg-primary-500/20"><Plus className="h-5 w-5" /></button>
                    </div>
                </div>
                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
                            <input
                                aria-label="채팅방 검색"
                                type="text"
                                value={roomSearchQuery}
                            onChange={(event) => setRoomSearchQuery(event.target.value)}
                            placeholder="방 이름 또는 최근 메시지 검색"
                            className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink-subtle"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingRooms ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : (rooms && rooms.length > 0) ? (
                        <div className="space-y-1 p-2">
                            {filteredRooms.length === 0 ? (
                                <div className="p-8 text-center text-sm text-ink-muted">검색 결과가 없습니다.</div>
                            ) : filteredRooms.map((room, idx) => {
                                const roomId = getRoomId(room);
                                const isActive = getRoomId(currentRoom) === roomId;
                                return (
                                    <div key={getRoomKey(room, idx)}
                                        className={`group flex w-full items-center gap-1 rounded-xl transition-all ${isActive ? "bg-primary-600 text-white shadow-md" : "text-ink-muted hover:bg-surface hover:shadow-sm"}`}>
                                        <button
                                            type="button"
                                            onPointerDown={(event) => beginRoomLongPress(room, event)}
                                            onPointerUp={clearRoomLongPress}
                                            onPointerCancel={clearRoomLongPress}
                                            onPointerLeave={clearRoomLongPress}
                                            onClick={() => {
                                                if (roomLongPressTriggeredRef.current) {
                                                    roomLongPressTriggeredRef.current = false;
                                                    return;
                                                }
                                                selectRoom(room);
                                            }}
                                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ${isActive ? "bg-white/20" : "bg-primary-500/10 text-primary-700"}`}>
                                            {room.type === "AI" ? <Bot className="h-6 w-6" /> : room.type === "PERSONAL" ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="font-bold truncate">{room.title}</span>
                                                {room.unreadCount > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white text-primary-600" : "bg-red-500 text-white"}`}>{room.unreadCount}</span>}
                                            </div>
                                            <div className={`truncate text-xs ${isActive ? "text-white/80" : "text-ink-muted"}`}>{room.lastMessage || "대화 내용이 없습니다."}</div>
                                        </div>
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`${room.title || "채팅방"} 메뉴`}
                                            onClick={() => openRoomActions(room)}
                                            className={`mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${isActive ? "text-white/80 hover:bg-white/15" : "text-ink-subtle hover:bg-control-hover hover:text-ink-muted"}`}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <div className="p-8 text-center text-sm text-ink-muted">참여 중인 방이 없습니다.</div>}
                </div>
            </div>

            {/* 메인 */}
            <div className="flex min-w-0 flex-1 flex-col bg-surface">
                {currentRoom ? (
                    <>
                        <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-2 border-b border-line bg-surface/90 p-3 backdrop-blur-sm sm:p-4">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                <button type="button" aria-label="채팅방 목록 열기" onClick={() => setIsSidebarOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-control-hover lg:hidden"><ArrowLeft className="h-5 w-5" /></button>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 font-bold text-primary-700">
                                    {currentRoom.type === "AI" ? <Bot className="h-5 w-5" /> : currentRoom.type === "PERSONAL" ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="truncate font-bold text-ink">{currentRoom.title}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-ink-muted"><span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-amber-400"}`}></span>{isConnected ? "실시간 연결" : "실시간 연결 대기"}</div>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                                <button type="button" aria-label={showMemberList ? "참여자 목록 닫기" : "참여자 목록 열기"} onClick={() => setShowMemberList(!showMemberList)} className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-colors sm:w-auto sm:px-3 ${showMemberList ? "bg-primary-600 text-white" : "bg-control text-ink-muted hover:bg-control-hover"}`}>
                                    <Users className="h-4 w-4" /><span className="hidden sm:inline">{currentMembers.length}</span>
                                </button>
                                {currentRoom.type === "GROUP" && (
                                    <button type="button" aria-label="멤버 초대" onClick={() => { resetMemberSelection(); setShowInviteModal(true); }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-sm font-bold text-primary-600 hover:bg-primary-500/20 sm:w-auto sm:px-3">
                                        <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">초대</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    aria-label="채팅방 메뉴"
                                    onClick={() => openRoomActions(currentRoom)}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-control-hover hover:text-ink"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden relative">
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 space-y-4 overflow-y-auto bg-control/60 p-3 sm:p-4">
                                    {loadingMessages ? <div className="h-full flex items-center justify-center"><LoadingSpinner text="메시지 로드 중..." /></div> : messages.length === 0 ? (
                                        <div className="flex h-full flex-col items-center justify-center space-y-2 text-ink-subtle"><MessageSquare className="h-12 w-12 opacity-20" /><p className="text-sm font-medium">대화를 시작해보세요!</p></div>
                                    ) : (
                                        <>
                                            {canLoadOlderMessages && (
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={fetchOlderMessages}
                                                        disabled={loadingOlderMessages}
                                                        className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-ink-muted shadow-sm transition-colors hover:bg-control-hover disabled:cursor-wait disabled:opacity-60"
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
                                                <div className={`flex max-w-[88%] sm:max-w-[80%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
                                                    {!isMe && (
                                                        <UserAvatar
                                                            name={normalized.senderName}
                                                            profileUrl={normalized.senderProfileUrl}
                                                            level={normalized.senderLevel}
                                                            rewardTier={normalized.senderRewardTier}
                                                            frameCode={normalized.senderFrameCode}
                                                            size="sm"
                                                            className="rounded-lg border-line"
                                                        />
                                                    )}
                                                    <div className="flex flex-col">
                                                        {!isMe && <span className="mb-1 ml-1 text-[10px] text-ink-muted">{normalized.senderName}</span>}
                                                        <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? "rounded-br-none bg-primary-600 text-white" : "rounded-bl-none border border-line bg-surface text-ink"}`}>
                                                            {normalized.type === "FILE" ? (
                                                                !messageFileUrl ? (
                                                                    <div
                                                                        className={`flex min-w-0 max-w-[74vw] items-center gap-3 rounded-xl ${isMe ? "bg-white/10" : "bg-control"} px-3 py-3 sm:min-w-[220px]`}
                                                                        aria-label="표시할 수 없는 첨부파일"
                                                                    >
                                                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isMe ? "bg-white/15" : "bg-control-hover text-ink-muted"}`}>
                                                                            <FileIcon className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-sm font-bold">{normalized.fileName || normalized.message || "첨부파일"}</div>
                                                                            <div className={`mt-1 text-[11px] font-bold ${isMe ? "text-white/70" : "text-ink-muted"}`}>
                                                                                첨부파일을 표시할 수 없습니다.
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : normalized.fileImage ? (
                                                                    <div className="space-y-2">
                                                                        <AuthenticatedAttachmentImage
                                                                            src={messageFileUrl}
                                                                            alt={normalized.fileName || "이미지"}
                                                                            className="max-w-[min(18rem,78vw)] cursor-pointer rounded-xl sm:max-w-xs"
                                                                        />
                                                                        {!!(normalized.fileName || normalized.message) && (
                                                                            <div className={`text-[11px] ${isMe ? "text-white/80" : "text-ink-muted"}`}>
                                                                                {normalized.fileName || normalized.message}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadAttachment(messageFileUrl, normalized.fileName || normalized.message)}
                                                                        className={`flex min-w-0 max-w-[74vw] items-center gap-3 rounded-xl ${isMe ? "bg-white/10" : "bg-control"} px-3 py-3 text-left transition-colors hover:opacity-90 sm:min-w-[220px]`}
                                                                    >
                                                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isMe ? "bg-white/15" : "bg-primary-500/10 text-primary-600"}`}>
                                                                            <Download className="h-5 w-5" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="truncate text-sm font-bold">{normalized.fileName || normalized.message || "첨부파일"}</div>
                                                                            <div className={`mt-1 flex items-center gap-2 text-[11px] ${isMe ? "text-white/80" : "text-ink-muted"}`}>
                                                                                <span>{formatFileSize(Number(normalized.fileSize || 0))}</span>
                                                                                <span className={`rounded-full px-2 py-0.5 font-bold ${isMe ? "bg-white/10 text-white" : "bg-surface text-primary-600"}`}>
                                                                                    {getAttachmentTypeLabel(normalized.fileName, normalized.fileContentType)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                )
                                                            ) : normalized.message}
                                                        </div>
                                                    </div>
                                                    <span className="pb-1 text-[10px] text-ink-subtle">{formatRelativeTime(new Date(normalized.createdAt))}</span>
                                                </div>
                                            </div>
                                        );
                                            })}
                                        </>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="border-t border-line bg-surface p-3 sm:p-4">
                                    {uploadingFileName && (
                                        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-primary-500/10 px-4 py-2 text-xs font-bold text-primary-700">
                                            <span className="truncate">업로드 중: {uploadingFileName}</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                    )}
                                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                        <button type="button" aria-label="파일 첨부" onClick={() => fileInputRef.current.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-control text-ink-muted transition-colors hover:bg-control-hover"><FileIcon className="h-5 w-5" /></button>
                                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z" />
                                        <div className="relative min-w-0 flex-1">
                                            <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={isAiRoom(currentRoom) ? "질문을 입력하세요. 이미지는 먼저 첨부한 뒤 질문하면 됩니다." : "메시지를 입력해 주세요."} maxLength={CHAT_MESSAGE_MAX_LENGTH} className="max-h-32 min-h-11 w-full resize-none rounded-2xl border-none bg-control py-3 pl-4 pr-12 text-sm text-ink placeholder:text-ink-subtle focus:ring-2 focus:ring-primary-500" rows="1" />
                                            <button type="submit" aria-label="메시지 보내기" disabled={!newMessage.trim() || !isConnected} className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg transition-all ${ (newMessage.trim() && isConnected) ? "bg-primary-600 text-white shadow-md" : "bg-control-hover text-ink-subtle" }`}><Send className="h-4 w-4" /></button>
                                            <div className="mt-1 text-right text-[11px] font-bold text-ink-subtle">
                                                {newMessage.length.toLocaleString("ko-KR")} / {CHAT_MESSAGE_MAX_LENGTH.toLocaleString("ko-KR")}
                                            </div>
                                        </div>
                                    </form>
                                    {isAiRoom(currentRoom) && (
                                        <p className="mt-2 text-xs font-semibold text-ink-subtle">
                                            AI 방은 서버 기본 모델만 사용합니다. 이미지를 첨부한 뒤 질문을 보내면 최근 첨부 이미지까지 함께 전달합니다.
                                        </p>
                                    )}
                                </div>
                            </div>
                            {showMemberList && (
                                <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-xs animate-slide-in-right flex-col border-l border-line bg-surface shadow-2xl lg:relative lg:z-auto lg:w-64 lg:shadow-none">
                                    <div className="flex items-center justify-between border-b border-line bg-control p-4"><h4 className="text-sm font-bold text-ink">참여자 ({currentMembers.length})</h4><button type="button" aria-label="참여자 목록 닫기" onClick={() => setShowMemberList(false)} className="rounded-lg p-1 transition-colors hover:bg-control-hover"><X className="h-4 w-4" /></button></div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {loadingMembers ? <div className="flex justify-center p-8"><LoadingSpinner size="sm" /></div> : currentMembers.length === 0 ? <div className="p-4 text-center text-xs text-ink-subtle">참여자 정보가 없습니다.</div> : currentMembers.map(m => {
                                            const isMe = getMemberId(m) === getMemberId(user);
                                            return (
                                                <div key={getMemberId(m)} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-control">
                                                    <UserAvatar
                                                        name={m.name}
                                                        profileUrl={m.profileUrl || m.profile_url}
                                                        level={m.level}
                                                        rewardTier={m.rewardTier || m.reward_tier}
                                                        frameCode={m.frameCode || m.frame_code}
                                                        size="sm"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1 truncate text-xs font-bold">{m.name}{isMe && <span className="rounded bg-primary-500/10 px-1 py-0.5 text-[9px] text-primary-600">나</span>}</div>
                                                        <div className="truncate text-[10px] text-ink-subtle">{m.email}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : <div className="flex h-full flex-col items-center justify-center bg-control/60 p-8 text-center"><MessageSquare className="mb-4 h-16 w-16 text-primary-100" /><h2 className="text-xl font-bold text-ink">대화방을 선택해주세요.</h2></div>}
            </div>

            {roomActionTarget && !showRenameModal && (
                <div
                    className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/35 p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] backdrop-blur-[1px] sm:items-center sm:pb-3"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeRoomActions();
                    }}
                >
                    <div className="max-h-[calc(100svh-7rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-surface shadow-2xl">
                        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-black text-ink">{roomActionTarget?.title || "채팅방"}</div>
                                <div className="mt-0.5 text-xs font-semibold text-ink-subtle">채팅방 설정</div>
                            </div>
                            <button type="button" aria-label="채팅방 메뉴 닫기" onClick={closeRoomActions} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-subtle hover:bg-control-hover hover:text-ink-muted">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-2">
                            <button
                                type="button"
                                onClick={() => setShowRenameModal(true)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-ink-muted hover:bg-control"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><Pencil className="h-5 w-5" /></span>
                                이름 바꾸기
                            </button>
                            <button
                                type="button"
                                onClick={leaveSelectedRoom}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600"><LogOut className="h-5 w-5" /></span>
                                채팅방 나가기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {roomActionTarget && showRenameModal && (
                <div
                    className="fixed inset-0 z-[111] flex items-end justify-center bg-slate-950/40 p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] backdrop-blur-[1px] sm:items-center sm:pb-3"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeRoomActions();
                    }}
                >
                    <div className="max-h-[calc(100svh-7rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-surface shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="chat-room-rename-title">
                        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                            <h3 id="chat-room-rename-title" className="text-base font-black text-ink">채팅방 이름 바꾸기</h3>
                            <button type="button" aria-label="이름 변경 닫기" onClick={closeRoomActions} className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-subtle hover:bg-control-hover hover:text-ink-muted">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-3 p-4">
                            <label htmlFor="chat-room-rename-input" className="text-sm font-bold text-ink-muted">새 이름</label>
                            <input
                                id="chat-room-rename-input"
                                type="text"
                                value={renameRoomTitle}
                                onChange={(event) => setRenameRoomTitle(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        renameRoom();
                                    }
                                }}
                                maxLength={120}
                                className="input-base"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2 bg-control p-4">
                            <button type="button" onClick={closeRoomActions} className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink-muted hover:bg-control-hover">취소</button>
                            <button type="button" onClick={renameRoom} disabled={!renameRoomTitle.trim()} className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold shadow-sm ${renameRoomTitle.trim() ? "bg-primary-600 text-white hover:bg-primary-700" : "bg-control-hover text-ink-subtle"}`}>저장</button>
                        </div>
                    </div>
                </div>
            )}

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
                        className="w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl"
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
                                    <label htmlFor={roomTitleInputId} className="mb-2 block text-sm font-bold text-ink-muted">채팅방 제목</label>
                                    <input
                                        id={roomTitleInputId}
                                        type="text"
                                        value={newRoomTitle} 
                                        onChange={(e) => setNewRoomTitle(e.target.value)} 
                                        placeholder="예: 프로젝트 대화방" 
                                        className="input-base" 
                                        autoFocus
                                    />
                                    <p className="mt-2 text-xs font-medium text-ink-subtle">* 방 생성 후 참여자 목록에서 멤버를 초대할 수 있습니다.</p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label htmlFor={memberSearchInputId} className="mb-2 flex items-center justify-between text-sm font-bold text-ink-muted">멤버 선택{memberSearch.trim().length === 0 && <span className="flex items-center gap-1 text-[10px] font-normal text-ink-subtle"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 전체 멤버 목록</span>}</label>
                                        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" /><input id={memberSearchInputId} type="text" value={memberSearch} onChange={handleSearchChange} maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH} placeholder="이름 또는 이메일 검색..." className="input-base pl-10" /></div>
                                        <p className="mt-1 text-right text-[11px] font-semibold text-ink-subtle">검색어 {memberSearch.length}/{MEMBER_SEARCH_KEYWORD_MAX_LENGTH}자</p>
                                        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-line bg-control/60 p-1">
                                            {searching ? <div className="p-8 text-center"><LoadingSpinner size="sm" text="검색 중..." /></div> : displayedMembers.length === 0 ? <div className="p-8 text-center text-sm text-ink-subtle">{memberSearch.trim().length > 0 ? "검색 결과가 없습니다." : "불러올 수 있는 멤버가 없습니다."}</div> : displayedMembers.map(m => {
                                                const mId = getMemberId(m);
                                                const isSelected = selectedMembers.find(sm => getMemberId(sm) === mId);
                                                return (
                                                    <button key={mId} type="button" aria-pressed={Boolean(isSelected)} onClick={() => toggleMemberSelection(m)} className={`flex w-full items-center justify-between rounded-xl p-3 text-sm transition-all ${isSelected ? "bg-primary-600 text-white shadow-md" : "hover:bg-surface hover:shadow-sm"}`}>
                                                        <div className="flex items-center gap-3"><UserAvatar name={m.name} profileUrl={m.profileUrl || m.profile_url} level={m.level} rewardTier={m.rewardTier || m.reward_tier} frameCode={m.frameCode || m.frame_code} size="md" className={isSelected ? "border-white/30 bg-white/20 text-white" : ""} /><div className="text-left"><div className="font-bold">{m.name}</div><div className={`text-[10px] ${isSelected ? "text-white/70" : "text-ink-subtle"}`}>{m.email}</div></div></div>
                                                        {isSelected && <Check className="h-5 w-5" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {selectedMembers.length > 0 && (<div className="space-y-2"><div className="text-[11px] font-bold text-ink-muted">선택됨 ({selectedMembers.length})</div><div className="flex flex-wrap gap-2">{selectedMembers.map(m => (<div key={getMemberId(m)} className="flex animate-fade-in items-center gap-1.5 rounded-xl border border-primary-500/20 bg-primary-500/10 py-1 pl-2 pr-1 text-xs font-bold text-primary-700"><span>{m.name}</span><button type="button" aria-label={`${m.name} 선택 해제`} onClick={() => toggleMemberSelection(m)} className="rounded-lg p-0.5 transition-colors hover:bg-primary-500/20"><X className="h-3.5 w-3.5" /></button></div>))}</div></div>)}
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 bg-control p-6">
                            <button type="button" onClick={closeMemberModal} className="flex-1 rounded-2xl border border-line bg-surface px-4 py-3 font-bold text-ink-muted transition-colors hover:bg-control-hover">취소</button>
                            <button type="button" onClick={showCreateModal ? createRoom : inviteMembers} disabled={showCreateModal ? !newRoomTitle.trim() : selectedMembers.length === 0} className={`flex-1 rounded-2xl px-4 py-3 font-bold shadow-lg transition-all ${ (showCreateModal ? newRoomTitle.trim() : selectedMembers.length > 0) ? "bg-primary-600 text-white hover:bg-primary-700" : "cursor-not-allowed bg-control-hover text-ink-subtle" }`}>{showCreateModal ? "채팅방 생성" : "멤버 초대"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};





