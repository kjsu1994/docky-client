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
    MessageCircle,
    File as FileIcon,
    Download,
    ArrowLeft,
    X,
    Check,
    Star,
    Minimize2,
    Maximize2,
    LogOut
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { formatRelativeTime, debounce, resolveChatAttachmentUrl, formatFileSize } from "../utils/helpers";
import { LoadingSpinner } from "./LoadingSpinner";
import { confirmAction } from "../common/confirmAction.jsx";
import { useBottomNavVisibility } from "../hooks/useBottomNavVisibility.js";
import { logClientError } from "../utils/clientDiagnostics.js";
import { trapFocus } from "../utils/focusTrap.js";
import { notifyError, notifySuccess } from "../utils/toast.js";
import {
    buildFilePayload,
    buildTalkPayload,
    CHAT_MESSAGE_MAX_LENGTH,
    chatAdapter,
    compareMessagesByChronology,
    extractChatErrorMessage,
    getAttachmentTypeLabel,
    getLastMessagePreview,
    getMemberId,
    getMembers,
    getRoomId,
    getRoomKey,
    getRoomPreviewText,
    getUnreadCount,
    MEMBER_SEARCH_KEYWORD_MAX_LENGTH,
    normalizeMessage,
    isAiRoom,
} from "../adapters/chatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../adapters/realtimeAdapter.js";

const CHAT_ROOM_READ_EVENT = "chat-room-read";
const MESSAGE_PAGE_SIZE = 20;

const getFabSize = () => {
    if (typeof window === "undefined") return 64;
    return window.innerWidth >= 1024 ? 64 : 48;
};

const getFabBottomOffset = () => {
    if (typeof window === "undefined") return 24;
    return window.innerWidth >= 1024 ? 24 : 96;
};

const getFabRightOffset = () => {
    if (typeof window === "undefined") return 24;
    return window.innerWidth >= 1024 ? 24 : 16;
};

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

export const FloatingChat = ({ initialOpen = false } = {}) => {
    const { user, isAuthenticated } = useAuth();
    const bottomNav = useBottomNavVisibility();
    const [isOpen, setIsOpen] = useState(Boolean(initialOpen));
    const [isMinimized, setIsMinimized] = useState(false);
    const [hasChatActivated, setHasChatActivated] = useState(Boolean(initialOpen));
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, roomId: null });

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [roomSearchQuery, setRoomSearchQuery] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const [messagePageInfo, setMessagePageInfo] = useState(createEmptyMessagePageInfo);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const stompClientRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [showMemberList, setShowMemberList] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [newRoomTitle, setNewRoomTitle] = useState("");
    const [newRoomType, setNewRoomType] = useState("GROUP");
    const [memberSearch, setMemberSearch] = useState("");
    const [foundMembers, setFoundMembers] = useState([]);
    const [recommendedMembers, setRecommendedMembers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searching, setSearching] = useState(false);
    const [fabPosition, setFabPosition] = useState(() => {
        if (typeof window === "undefined") return { x: 0, y: 0 };
        const fabSize = getFabSize();
        const right = getFabRightOffset();
        const bottom = getFabBottomOffset();
        return {
            x: Math.max(0, window.innerWidth - fabSize - right),
            y: Math.max(0, window.innerHeight - fabSize - bottom),
        };
    });
    const [dragReady, setDragReady] = useState(false);
    const [isDraggingFab, setIsDraggingFab] = useState(false);
    const [isDraggingPanel, setIsDraggingPanel] = useState(false);
    const [uploadingFileName, setUploadingFileName] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const panelId = useId();
    const panelTitleId = useId();
    const panelDescriptionId = useId();
    const modalTitleId = useId();
    const modalDescriptionId = useId();

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatRootRef = useRef(null);
    const launcherRef = useRef(null);
    const panelRef = useRef(null);
    const panelCloseButtonRef = useRef(null);
    const modalPanelRef = useRef(null);
    const modalCloseButtonRef = useRef(null);
    const roomsRequestRef = useRef(null);
    const lastReadMarkAtRef = useRef(0);
    const roomSubscriptionsRef = useRef([]);
    const modalOpenRef = useRef(false);
    const dragHoldTimerRef = useRef(null);
    const dragStartRef = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });
    const didDragRef = useRef(false);
    const skipNextAutoScrollRef = useRef(false);

    const upsertRoomPreview = (roomId, previewText, createdAt, nextUnreadCount) => {
        if (!roomId) return;
        setRooms((prev) => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex((r) => String(getRoomId(r)) === String(roomId));
            if (idx < 0) return list;

            const current = list[idx];
            const patched = {
                ...current,
                lastMessage: previewText,
                unreadCount: nextUnreadCount,
                updatedAt: createdAt || current.updatedAt || current.updated_at,
            };
            list.splice(idx, 1);
            return [patched, ...list];
        });
    };

    const markRoomAsRead = async (roomId) => {
        if (!roomId) return;
        const now = Date.now();
        if (now - lastReadMarkAtRef.current < 1000) return;
        lastReadMarkAtRef.current = now;
        try {
            await chatAdapter.markRoomRead(roomId);
            setRooms((prev) =>
                (prev || []).map((r) =>
                    String(getRoomId(r)) === String(roomId) ? { ...r, unreadCount: 0 } : r
                )
            );
        } catch (err) {
            logClientError("floatingChat.markRead", err);
        }
    };

    useEffect(() => {
        const handleExternalRead = (event) => {
            const roomId = event?.detail?.roomId;
            if (!roomId) return;
            setRooms((prev) =>
                (prev || []).map((room) =>
                    String(getRoomId(room)) === String(roomId) ? { ...room, unreadCount: 0 } : room
                )
            );
        };

        window.addEventListener(CHAT_ROOM_READ_EVENT, handleExternalRead);
        return () => window.removeEventListener(CHAT_ROOM_READ_EVENT, handleExternalRead);
    }, []);

    
    const applyIncomingToRoom = (roomId, normalized, forceRead = false) => {
        if (!roomId || !normalized) return;
        setRooms((prev) => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex((r) => String(getRoomId(r)) === String(roomId));
            if (idx < 0) return list;

            const base = list[idx];
            const currentUnread = getUnreadCount(base);
            const nextUnread = forceRead ? 0 : Math.min(999, currentUnread + 1);
            const preview = getLastMessagePreview(normalized);
            const patched = {
                ...base,
                lastMessage: preview,
                unreadCount: nextUnread,
                updatedAt: normalized.createdAt || base.updatedAt || base.updated_at,
            };

            list.splice(idx, 1);
            return [patched, ...list];
        });
    };
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
        if (!loadingMessages && isOpen) {
            scrollToBottom();
        }
    }, [messages, loadingMessages, isOpen]);

    const fetchRooms = async ({ force = false } = {}) => {
        if (!isAuthenticated) return;
        if (roomsRequestRef.current && !force) {
            return roomsRequestRef.current;
        }
        setLoadingRooms(true);
        const request = chatAdapter.fetchRooms()
            .then((nextRooms) => {
                if (roomsRequestRef.current === request) {
                    setRooms(nextRooms);
                }
                return nextRooms;
            })
            .catch(() => [])
            .finally(() => {
                if (roomsRequestRef.current === request) {
                    roomsRequestRef.current = null;
                    setLoadingRooms(false);
                }
            });
        roomsRequestRef.current = request;
        return request;
    };

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
        if (hasChatActivated && isOpen && isAuthenticated) {
            fetchRooms();
        }
    }, [hasChatActivated, isOpen, isAuthenticated]);

    useEffect(() => {
        if (showCreateModal || showInviteModal) {
            fetchRecommendations();
        }
    }, [showCreateModal, showInviteModal, user]);

    useEffect(() => {
        modalOpenRef.current = showCreateModal || showInviteModal;
    }, [showCreateModal, showInviteModal]);

    useEffect(() => {
        if (!hasChatActivated || !isAuthenticated || isConnected) return;
        const runFallback = () => {
            if (document.visibilityState === "visible") {
                fetchRooms();
            }
        };
        runFallback();
        const timer = setInterval(runFallback, 60000);
        return () => clearInterval(timer);
    }, [hasChatActivated, isAuthenticated, isConnected]);

    useEffect(() => {
        if (!hasChatActivated || !isAuthenticated) return;
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
                fetchRooms();
            };
            client.onDisconnect = () => {
                setIsConnected(false);
                roomSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
                roomSubscriptionsRef.current = [];
            };
            client.onStompError = (frame) => {
                setIsConnected(false);
                void notifyRealtimeError({
                    scope: "floating-chat",
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
            roomSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
            roomSubscriptionsRef.current = [];
            stompClientRef.current = null;
            if (client) client.deactivate();
        };
    }, [hasChatActivated, isAuthenticated]);

    useEffect(() => {
        const client = stompClientRef.current;
        if (!client || !isConnected) return;

        roomSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
        roomSubscriptionsRef.current = [];

        const currentRoomId = getRoomId(currentRoom);
        const targets = (rooms || [])
            .map((room) => getRoomId(room))
            .filter((roomId) => roomId && String(roomId) !== String(currentRoomId));

        roomSubscriptionsRef.current = targets.map((roomId) =>
            client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
                const receivedMessage = JSON.parse(message.body);
                const normalized = normalizeMessage(receivedMessage);
                if (!normalized) return;

                const isVisibleCurrentRoom =
                    isOpen &&
                    !isMinimized &&
                    document.visibilityState === "visible" &&
                    String(getRoomId(currentRoom)) === String(roomId);

                applyIncomingToRoom(roomId, normalized, isVisibleCurrentRoom);
                if (isVisibleCurrentRoom) {
                    markRoomAsRead(roomId);
                }
            })
        );

        return () => {
            roomSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
            roomSubscriptionsRef.current = [];
        };
    }, [isConnected, rooms, currentRoom, isOpen, isMinimized]);

    useEffect(() => {
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!client || !isConnected || !roomId) return;

        fetchMessages(roomId);
        fetchCurrentMembers(roomId);

        markRoomAsRead(roomId);

        const subscription = client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
            const receivedMessage = JSON.parse(message.body);
            const normalized = normalizeMessage(receivedMessage);
            if (normalized) {
                setMessages((prev) => {
                    // 1. 서버가 내려준 실제 ID가 이미 목록에 있는지 확인한다.
                    const existsById = prev.find(m => m.id === normalized.id && !String(m.id).startsWith('temp-'));
                    if (existsById) return prev;

                    // 2. 내가 보낸 낙관적 메시지는 서버 응답으로 교체한다.
                    const myId = Number(getMemberId(user));
                    const isMyMessage = Number(normalized.senderId) === myId;
                    
                    if (isMyMessage) {
                        const optimisticMatch = prev.find(m => 
                            String(m.id).startsWith('temp-') && 
                            m.message === normalized.message
                        );
                        if (optimisticMatch) {
                            return prev.map(m => m.id === optimisticMatch.id ? normalized : m);
                        }
                    }

                    // 3. 짧은 시간 안에 같은 내용이 중복 도착하면 무시한다.
                    const isDuplicate = prev.some(m => m.key === normalized.key);
                    if (isDuplicate) return prev;

                    return [...prev, normalized].sort(compareMessagesByChronology);
                });
                upsertRoomPreview(roomId, getLastMessagePreview(normalized), normalized.createdAt, 0);
                markRoomAsRead(roomId);
            }
        });

        return () => { subscription.unsubscribe(); };
    }, [isConnected, currentRoom, user]);

    useEffect(() => {
        const roomId = getRoomId(currentRoom);
        if (!roomId || !isOpen || isMinimized) return;
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                markRoomAsRead(roomId);
            }
        };
        const onFocus = () => markRoomAsRead(roomId);
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [currentRoom, isOpen, isMinimized]);

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        const myId = Number(getMemberId(user));
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
                senderName: user.name || "익명", 
                createdAt: new Date().toISOString() 
            });
            setMessages(prev => [...prev, optimisticMsg].sort(compareMessagesByChronology));
            upsertRoomPreview(roomId, text, optimisticMsg.createdAt, 0);

            client.publish({ 
                destination: "/pub/chat/message", 
                body: JSON.stringify(messagePayload), 
                headers: { "content-type": "application/json" } 
            });
            setNewMessage("");
        } catch (err) {
            notifyError("메시지를 전송하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.");
            setMessages((prev) => prev.filter((message) => message.id !== tempId));
            fetchRooms({ force: true });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!file || !roomId || !client || !isConnected) return;
        const myId = Number(getMemberId(user));
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
                senderName: user.name || "익명",
                createdAt: new Date().toISOString()
            });
            setMessages((prev) => [...prev, optimisticMsg].sort(compareMessagesByChronology));
            upsertRoomPreview(roomId, attachment.fileName, optimisticMsg.createdAt, 0);

            client.publish({ destination: "/pub/chat/message", body: JSON.stringify(messagePayload), headers: { "content-type": "application/json" } });
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

    const leaveRoom = async (roomId) => {
        if (!roomId) return;
        const confirmed = await confirmAction({
            title: "채팅방에서 나갈까요?",
            description: "나간 뒤에는 다시 초대받아야 참여할 수 있습니다.",
            confirmText: "나가기",
        });
        if (!confirmed) return;
        try {
            await chatAdapter.leaveRoom(roomId);
            notifySuccess("채팅방에서 나갔습니다.");
            if (getRoomId(currentRoom) === roomId) setCurrentRoom(null);
            fetchRooms({ force: true });
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "채팅방 나가기에 실패했습니다."));
        }
    };

    const handleContextMenu = (e, roomId) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.pageX, y: e.pageY, roomId });
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu({ ...contextMenu, visible: false });
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, [contextMenu]);

    const createRoom = async () => {
        if (!newRoomTitle.trim()) { notifyError("방 제목을 입력해 주세요."); return; }
        try {
            // 방 생성 시 본인만 멤버로 포함하고, 필요한 멤버는 이후 초대한다.
            const myId = Number(getMemberId(user));
            const memberIds = [myId];

            const createdRoom = await chatAdapter.createRoom({ title: newRoomTitle, type: newRoomType, memberIds });

            notifySuccess("방이 생성되었습니다. 멤버를 초대해 보세요.");
            setShowCreateModal(false);
            resetMemberSelection();

            const updatedRooms = await fetchRooms({ force: true });
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
            setHasChatActivated(true);
            const updatedRooms = await fetchRooms({ force: true });
            const found = updatedRooms.find((room) => String(getRoomId(room)) === String(roomId));
            if (found) {
                setCurrentRoom(found);
            }
            setIsOpen(true);
            setIsMinimized(false);
        } catch (error) {
            notifyError(extractChatErrorMessage(error, "AI 채팅방을 열지 못했습니다."));
        }
    };

    const inviteMembers = async () => {
        const roomId = getRoomId(currentRoom);
        if (selectedMembers.length === 0 || !roomId) return;
        try {
            const memberIds = selectedMembers
                .map(m => Number(getMemberId(m)))
                .filter(id => !isNaN(id) && id > 0);

            if (memberIds.length === 0) return;

            await chatAdapter.inviteMembers(roomId, memberIds);
            notifySuccess("멤버를 초대했습니다.");
            setShowInviteModal(false);
            resetMemberSelection();
            fetchRooms({ force: true });
            fetchCurrentMembers(roomId);
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

    const membersToList = currentMembers.length > 0 ? currentMembers : getMembers(currentRoom);
    const displayedMembers = memberSearch.trim().length > 0 ? foundMembers : recommendedMembers;
    const canLoadOlderMessages = hasOlderMessages(messagePageInfo);
    const filteredRooms = useMemo(() => {
        const query = roomSearchQuery.trim().toLowerCase();
        if (!query) return rooms;
        return (rooms || []).filter((room) => {
            const title = String(room?.title || "").toLowerCase();
            const preview = String(room?.lastMessage || getRoomPreviewText(room) || "").toLowerCase();
            return title.includes(query) || preview.includes(query);
        });
    }, [roomSearchQuery, rooms]);
    const totalUnreadCount = rooms.reduce((sum, room) => sum + getUnreadCount(room), 0);
    const hiddenWithBottomNav = bottomNav.enabled && !bottomNav.visible;
    const panelMetrics = useMemo(() => {
        const width = isMinimized ? 288 : Math.min(400, Math.max(280, window.innerWidth - 48));
        const height = isMinimized ? 64 : Math.max(320, Math.min(600, window.innerHeight - 48));
        return { width, height };
    }, [isMinimized]);
    const panelStyle = useMemo(() => {
        const fabSize = getFabSize();
        const gap = 16;
        const viewportPadding = 24;
        const { width, height } = panelMetrics;

        // 기본은 버튼 위/우측 정렬이며, 화면 경계를 넘으면 뷰포트 내부로 자동 보정한다.
        const preferredLeft = fabPosition.x + (fabSize - width);
        const preferredTop = fabPosition.y - gap - height;
        const clampedLeft = Math.min(
            Math.max(viewportPadding, preferredLeft),
            Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
        );
        const clampedTop = Math.min(
            Math.max(viewportPadding, preferredTop),
            Math.max(viewportPadding, window.innerHeight - height - viewportPadding)
        );

        return {
            left: `${clampedLeft - fabPosition.x}px`,
            top: `${clampedTop - fabPosition.y}px`,
            width: `${width}px`,
            height: `${height}px`,
        };
    }, [panelMetrics, fabPosition.x, fabPosition.y]);

    const getDefaultFabPosition = useCallback(() => {
        const fabSize = getFabSize();
        const right = getFabRightOffset();
        const bottom = getFabBottomOffset();
        return {
            x: Math.max(0, window.innerWidth - fabSize - right),
            y: Math.max(0, window.innerHeight - fabSize - bottom),
        };
    }, []);

    const clampFabPosition = useCallback((x, y) => {
        const fabSize = getFabSize();
        const nextX = Math.min(Math.max(0, x), Math.max(0, window.innerWidth - fabSize));
        const nextY = Math.min(Math.max(0, y), Math.max(0, window.innerHeight - fabSize));
        return { x: nextX, y: nextY };
    }, []);

    useEffect(() => {
        setFabPosition(getDefaultFabPosition());
    }, [getDefaultFabPosition]);

    useEffect(() => {
        const handleResize = () => {
            setFabPosition((prev) => {
                const clamped = clampFabPosition(prev.x, prev.y);
                if (clamped.x === prev.x && clamped.y === prev.y) return prev;
                return clamped;
            });
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [clampFabPosition]);

    const clearHoldTimer = () => {
        if (dragHoldTimerRef.current) {
            clearTimeout(dragHoldTimerRef.current);
            dragHoldTimerRef.current = null;
        }
    };

    useEffect(() => () => {
        if (dragHoldTimerRef.current) {
            clearTimeout(dragHoldTimerRef.current);
            dragHoldTimerRef.current = null;
        }
    }, []);

    const handleFabPointerDown = (e) => {
        if ((e.pointerType === "mouse" && e.button !== 0) || isOpen) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        didDragRef.current = false;
        dragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            x: fabPosition.x,
            y: fabPosition.y,
        };
        clearHoldTimer();
        dragHoldTimerRef.current = setTimeout(() => {
            dragHoldTimerRef.current = null;
            setDragReady(true);
            setIsDraggingFab(true);
        }, 260);
    };

    const handleFabPointerMove = (e) => {
        if (!dragReady) return;
        const dx = e.clientX - dragStartRef.current.pointerX;
        const dy = e.clientY - dragStartRef.current.pointerY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            didDragRef.current = true;
        }
        const clamped = clampFabPosition(dragStartRef.current.x + dx, dragStartRef.current.y + dy);
        setFabPosition(clamped);
    };

    const endFabDrag = (e) => {
        e?.currentTarget?.releasePointerCapture?.(e.pointerId);
        clearHoldTimer();
        setDragReady(false);
        setIsDraggingFab(false);
    };

    const closeChat = useCallback(() => {
        setIsOpen(false);
        setIsMinimized(false);
    }, []);

    const closeMemberModal = useCallback(() => {
        setShowCreateModal(false);
        setShowInviteModal(false);
    }, []);

    const toggleChat = () => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        if (isOpen && isMinimized) {
            setHasChatActivated(true);
            setIsMinimized(false);
            return;
        }
        setIsOpen((prev) => {
            const nextOpen = !prev;
            if (nextOpen) {
                setHasChatActivated(true);
            }
            return nextOpen;
        });
    };

    const handlePanelPointerDown = (e) => {
        if (e.target.closest("button, a, input, textarea, select")) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setIsDraggingPanel(true);
        dragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            x: fabPosition.x,
            y: fabPosition.y,
        };
    };

    const handlePanelPointerMove = (e) => {
        if (!isDraggingPanel) return;
        const dx = e.clientX - dragStartRef.current.pointerX;
        const dy = e.clientY - dragStartRef.current.pointerY;
        const clamped = clampFabPosition(dragStartRef.current.x + dx, dragStartRef.current.y + dy);
        setFabPosition(clamped);
    };

    const handlePanelPointerUp = (e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        setIsDraggingPanel(false);
    };

    useEffect(() => {
        if (!isOpen || isMinimized) return undefined;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const handleKeyDown = (event) => {
            if (modalOpenRef.current) return;
            if (event.key === "Escape") {
                event.preventDefault();
                closeChat();
                return;
            }
            trapFocus(event, panelRef.current);
        };

        window.setTimeout(() => panelCloseButtonRef.current?.focus(), 0);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.setTimeout(() => {
                if (previousFocus?.isConnected) {
                    previousFocus.focus();
                } else {
                    launcherRef.current?.focus();
                }
            }, 0);
        };
    }, [closeChat, isMinimized, isOpen]);

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

    useEffect(() => {
        if (!isOpen) return;
        const handleOutsidePointerDown = (e) => {
            const root = chatRootRef.current;
            if (!root) return;
            if (root.contains(e.target)) return;
            closeChat();
        };

        window.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [isOpen]);

    if (!isAuthenticated) return null;

    return (
        <div ref={chatRootRef} className="fixed z-[100] pointer-events-none text-slate-900" style={{ left: `${fabPosition.x}px`, top: `${fabPosition.y}px` }}>
            {isOpen && (
                <div
                    id={panelId}
                    ref={panelRef}
                    style={panelStyle}
                    className="pointer-events-auto absolute rounded-3xl shadow-2xl border border-slate-100 bg-white flex flex-col overflow-hidden transition-all duration-500"
                    role="dialog"
                    aria-labelledby={panelTitleId}
                    aria-describedby={panelDescriptionId}
                    data-floating-chat-panel="true"
                >
                    <p id={panelDescriptionId} className="sr-only">
                        채팅방 목록과 대화 메시지를 확인하고 새 메시지를 보낼 수 있습니다.
                    </p>
                    <div
                        onPointerDown={handlePanelPointerDown}
                        onPointerMove={handlePanelPointerMove}
                        onPointerUp={handlePanelPointerUp}
                        onPointerCancel={handlePanelPointerUp}
                        className={`bg-gradient-to-r from-primary-600 to-primary-500 p-4 flex items-center justify-between text-white shrink-0 touch-none select-none ${isDraggingPanel ? "cursor-grabbing" : "cursor-grab"}`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                            {currentRoom ? (
                                <>
                                    <button type="button" aria-label="채팅방 목록으로 돌아가기" onClick={() => setCurrentRoom(null)} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"><ArrowLeft className="h-4 w-4" /></button>
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                                        {currentRoom.type === "AI" ? <Bot className="h-5 w-5" /> : currentRoom.type === "PERSONAL" ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div id={panelTitleId} className="font-black text-sm truncate leading-tight">{currentRoom.title}</div>
                                        <div className="text-[10px] font-bold text-primary-100">{isConnected ? "실시간 연결" : "오프라인"}</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-2 rounded-xl bg-white/20">
                                        <MessageSquare className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div id={panelTitleId} className="font-black text-sm">채팅방</div>
                                        <div className="text-[10px] font-bold text-primary-100">방을 개설하고 사용자를 초대하여 사용하세요.</div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button type="button" aria-label={isMinimized ? "채팅창 펼치기" : "채팅창 최소화"} onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</button>
                            <button ref={panelCloseButtonRef} type="button" aria-label="채팅창 닫기" onClick={closeChat} className="p-2 rounded-xl text-rose-200 hover:text-rose-100 hover:bg-rose-500/20 transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <div className="flex-1 flex flex-col min-h-0 bg-white">
                            {!currentRoom ? (
                                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                                    <div className="p-4 border-b bg-white/80 backdrop-blur-md flex items-center justify-between">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                            <input
                                                type="text"
                                                value={roomSearchQuery}
                                                onChange={(event) => setRoomSearchQuery(event.target.value)}
                                                placeholder="채팅방 검색"
                                                aria-label="채팅방 검색"
                                                className="input-base py-2 pl-10 pr-4 text-xs font-bold bg-slate-50 border-0"
                                            />
                                        </div>
                                        <button type="button" aria-label="AI 채팅방 열기" onClick={openAiRoom} className="ml-3 p-2.5 rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-100 hover:scale-105 transition-transform"><Bot className="h-5 w-5" /></button>
                                        <button type="button" aria-label="새 채팅방 만들기" onClick={() => { resetMemberSelection(); setShowCreateModal(true); }} className="ml-3 p-2.5 rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-100 hover:scale-105 transition-transform"><Plus className="h-5 w-5" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                        {loadingRooms ? <div className="p-12 flex justify-center"><LoadingSpinner size="sm" /></div> : rooms.length > 0 ? (
                                            filteredRooms.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2 opacity-60 font-bold"><Search className="h-9 w-9" /><span>검색 결과가 없습니다.</span></div>
                                            ) : filteredRooms.map((room, idx) => {
                                                const roomId = getRoomId(room);
                                                const isActive = getRoomId(currentRoom) === roomId;
                                                return (
                                                    <button key={getRoomKey(room, idx)} onClick={() => { setCurrentRoom(room); setMessages([]); setMessagePageInfo(createEmptyMessagePageInfo()); upsertRoomPreview(roomId, getRoomPreviewText(room), room.updatedAt, 0); }}
                                                        onContextMenu={(e) => handleContextMenu(e, roomId)}
                                                        className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all text-slate-700 hover:shadow-xl hover:-translate-y-0.5 ${isActive ? 'bg-white shadow-xl ring-2 ring-primary-100' : 'bg-white/50 border border-slate-100'}`}>
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 flex items-center justify-center font-black shrink-0 shadow-sm">
                                                            {room.type === "AI" ? <Bot className="h-6 w-6" /> : room.type === "PERSONAL" ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                                        </div>
                                                        <div className="flex-1 text-left min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-black text-sm truncate text-slate-900">{room.title}</span>
                                                                {getUnreadCount(room) > 0 && <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-primary-600 text-white shadow-lg shadow-primary-200">{getUnreadCount(room)}</span>}
                                                            </div>
                                                            <div className="text-[11px] font-medium text-slate-400 truncate line-clamp-1">{room.lastMessage || "최근 메시지가 없습니다."}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2 opacity-50 font-bold"><MessageSquare className="h-10 w-10" /><span>활성 채팅방이 없습니다.</span></div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col min-h-0 relative">
                                    <div className="px-4 py-2 border-b bg-white flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 border border-emerald-100">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                                                <span className="text-[9px] font-black text-emerald-700">{isConnected ? "연결됨" : "오프라인"}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button type="button" aria-label={showMemberList ? "참여자 목록 닫기" : "참여자 목록 열기"} onClick={() => setShowMemberList(!showMemberList)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors flex items-center gap-1.5"><Users className="h-4 w-4" /><span className="text-[10px] font-black">{membersToList.length}</span></button>
                                            {currentRoom.type === "GROUP" && <button type="button" aria-label="멤버 초대" onClick={() => { resetMemberSelection(); setShowInviteModal(true); }} className="p-2 hover:bg-primary-50 rounded-xl text-primary-600 transition-colors"><UserPlus className="h-4 w-4" /></button>}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                        {loadingMessages ? <div className="p-12 flex justify-center"><LoadingSpinner size="sm" /></div> : messages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2 opacity-50 font-bold"><MessageSquare className="h-8 w-8" /><p className="text-[11px]">첫 메시지를 보내보세요.</p></div>
                                        ) : (
                                            <>
                                                {canLoadOlderMessages && (
                                                    <div className="flex justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={fetchOlderMessages}
                                                            disabled={loadingOlderMessages}
                                                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
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
                                                <div key={normalized.key || normalized.id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                    <div className={`flex max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
                                                        {!isMe && <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-100 shrink-0 flex items-center justify-center text-[11px] font-black text-primary-600">{normalized.senderName?.charAt(0).toUpperCase()}</div>}
                                                        <div className="flex flex-col">
                                                            {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">{normalized.senderName}</span>}
                                                            <div className={`px-4 py-2.5 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed ${isMe ? "bg-primary-600 text-white rounded-br-none" : "bg-white text-slate-700 border border-slate-100 rounded-bl-none"}`}>
                                                                {normalized.type === "FILE" ? (
                                                                    !messageFileUrl ? (
                                                                        <div
                                                                            className={`flex min-w-[180px] items-center gap-2 rounded-xl ${isMe ? "bg-white/10" : "bg-slate-50"} px-3 py-2.5`}
                                                                            aria-label="표시할 수 없는 첨부파일"
                                                                        >
                                                                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isMe ? "bg-white/15" : "bg-slate-200 text-slate-500"}`}>
                                                                                <FileIcon className="h-4 w-4" />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="truncate text-[12px] font-bold">{normalized.fileName || normalized.message || "첨부파일"}</div>
                                                                                <div className={`mt-1 text-[10px] font-bold ${isMe ? "text-white/70" : "text-slate-400"}`}>
                                                                                    첨부파일을 표시할 수 없습니다.
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ) : normalized.fileImage ? (
                                                                        <div className="space-y-2">
                                                                            <img
                                                                                src={messageFileUrl}
                                                                                alt={normalized.fileName || "이미지"}
                                                                                className="max-w-[200px] rounded-xl cursor-pointer"
                                                                                onClick={() => window.open(messageFileUrl, "_blank", "noopener,noreferrer")}
                                                                            />
                                                                            {!!(normalized.fileName || normalized.message) && (
                                                                                <div className={`text-[10px] font-bold ${isMe ? "text-white/80" : "text-slate-400"}`}>
                                                                                    {normalized.fileName || normalized.message}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <a
                                                                            href={messageFileUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className={`flex min-w-[180px] items-center gap-2 rounded-xl ${isMe ? "bg-white/10" : "bg-slate-50"} px-3 py-2.5`}
                                                                            download={normalized.fileName || undefined}
                                                                        >
                                                                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isMe ? "bg-white/15" : "bg-primary-50 text-primary-600"}`}>
                                                                                <Download className="h-4 w-4" />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="truncate text-[12px] font-bold">{normalized.fileName || normalized.message || "첨부파일"}</div>
                                                                                <div className={`mt-1 flex items-center gap-2 text-[10px] font-bold ${isMe ? "text-white/80" : "text-slate-400"}`}>
                                                                                    <span>{formatFileSize(Number(normalized.fileSize || 0))}</span>
                                                                                    <span className={`rounded-full px-2 py-0.5 ${isMe ? "bg-white/10 text-white" : "bg-white text-primary-600"}`}>
                                                                                        {getAttachmentTypeLabel(normalized.fileName, normalized.fileContentType)}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </a>
                                                                    )
                                                                ) : normalized.message}
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-300 pb-1 shrink-0">{formatRelativeTime(new Date(normalized.createdAt))}</span>
                                                    </div>
                                                </div>
                                            );
                                                })}
                                            </>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                    <div className="p-3 border-t shrink-0 bg-white">
                                        {uploadingFileName && (
                                            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-primary-50 px-3 py-2 text-[10px] font-black text-primary-700">
                                                <span className="truncate">업로드 중: {uploadingFileName}</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                        )}
                                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                            <button type="button" aria-label="파일 첨부" onClick={() => fileInputRef.current.click()} className="p-2.5 text-slate-300 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"><FileIcon className="h-5 w-5" /></button>
                                            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z" />
                                            <div className="min-w-0 flex-1">
                                                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={isAiRoom(currentRoom) ? "질문 입력 후 전송" : "메시지를 입력하세요."} maxLength={CHAT_MESSAGE_MAX_LENGTH} className="input-base h-11 border-0 bg-slate-50 font-medium" />
                                                <div className="mt-1 text-right text-[10px] font-bold text-slate-400">
                                                    {newMessage.length.toLocaleString("ko-KR")} / {CHAT_MESSAGE_MAX_LENGTH.toLocaleString("ko-KR")}
                                                </div>
                                            </div>
                                            <button type="submit" aria-label="메시지 보내기" disabled={!newMessage.trim() || !isConnected} className="p-2.5 bg-primary-600 text-white rounded-xl shadow-lg shadow-primary-100 disabled:opacity-20 transition-all active:scale-90"><Send className="h-5 w-5" /></button>
                                        </form>
                                        {isAiRoom(currentRoom) && (
                                            <p className="mt-2 text-[10px] font-bold text-slate-400">
                                                AI 방은 서버 기본 모델만 사용하며, 최근 첨부 이미지도 함께 전달합니다.
                                            </p>
                                        )}
                                    </div>
                                    {showMemberList && (
                                        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 flex flex-col animate-fade-in p-2">
                                            <div className="p-4 flex items-center justify-between border-b border-slate-50">
                                                <h4 className="font-black text-[11px] text-slate-400">참여자 ({membersToList.length})</h4>
                                                <button type="button" aria-label="참여자 목록 닫기" onClick={() => setShowMemberList(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><X className="h-4 w-4" /></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                {membersToList.map(m => (
                                                    <div key={getMemberId(m)} className="flex items-center gap-3 p-3 rounded-[1.25rem] bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg transition-all">
                                                        <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center font-black text-xs text-primary-600">{m.name?.charAt(0).toUpperCase()}</div>
                                                        <div className="min-w-0 flex-1"><div className="text-sm font-black truncate text-slate-900 flex items-center gap-2">{m.name}{getMemberId(m) === getMemberId(user) && <span className="text-[9px] px-1.5 py-0.5 bg-primary-600 text-white rounded-lg">나</span>}</div><div className="text-[10px] font-bold text-slate-400 truncate">{m.email}</div></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {contextMenu.visible && (
                <div className="fixed z-[200] bg-white border border-slate-100 rounded-2xl shadow-2xl py-2 w-40 pointer-events-auto animate-fade-in" style={{ left: contextMenu.x, top: contextMenu.y }}>
                    <button onClick={() => leaveRoom(contextMenu.roomId)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black text-rose-600 hover:bg-rose-50 transition-colors">
                        <LogOut className="h-4 w-4" />방 나가기
                    </button>
                </div>
            )}

            {(!isOpen || isMinimized) && (
                <button
                    ref={launcherRef}
                    onClick={toggleChat}
                    onPointerDown={handleFabPointerDown}
                    onPointerMove={handleFabPointerMove}
                    onPointerUp={endFabDrag}
                    onPointerCancel={endFabDrag}
                    onPointerLeave={endFabDrag}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-xl shadow-primary-200 transition-all duration-500 hover:scale-110 active:scale-90 touch-none select-none lg:h-16 lg:w-16 lg:rounded-[2rem] lg:shadow-2xl ${
                        hiddenWithBottomNav ? "pointer-events-none translate-y-8 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
                    } ${isDraggingFab ? "cursor-grabbing" : "cursor-grab"}`}
                    aria-label={isMinimized ? "채팅창 펼치기" : "채팅창 열기"}
                    aria-haspopup="dialog"
                    aria-controls={isOpen ? panelId : undefined}
                    aria-expanded={isOpen && !isMinimized}
                    data-floating-chat-launcher="true"
                >
                    <MessageCircle className="h-5 w-5 lg:h-7 lg:w-7" />
                    {totalUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 bg-rose-500 text-white rounded-full border-2 border-white shadow-lg text-[10px] font-black flex items-center justify-center">
                            {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                        </span>
                    )}
                </button>
            )}

            {(showCreateModal || showInviteModal) && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md pointer-events-auto"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeMemberModal();
                    }}
                >
                    <div
                        ref={modalPanelRef}
                        className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-slide-up border border-white/20"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={modalTitleId}
                        aria-describedby={modalDescriptionId}
                    >
                        <div className="p-6 border-b flex items-center justify-between bg-primary-600 text-white">
                            <div>
                                <h3 id={modalTitleId} className="font-black text-lg tracking-tight">{showCreateModal ? "새 채팅방" : "멤버 초대"}</h3>
                                <p id={modalDescriptionId} className="text-[10px] font-bold text-primary-100 tracking-[0.2em]">{showCreateModal ? "대화 시작" : "참여자 추가"}</p>
                            </div>
                            <button ref={modalCloseButtonRef} type="button" aria-label="채팅 모달 닫기" onClick={closeMemberModal} className="p-2.5 hover:bg-white/20 rounded-2xl transition-colors"><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[450px] overflow-y-auto bg-slate-50/30">
                            {showCreateModal ? (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 ml-1">방 제목</label>
                                    <input 
                                        type="text" 
                                        value={newRoomTitle} 
                                        onChange={(e) => setNewRoomTitle(e.target.value)} 
                                        placeholder="예: 프로젝트 회의"
                                        className="input-base h-14 bg-white font-bold" 
                                        autoFocus
                                    />
                                    <p className="mt-3 ml-1 text-[10px] text-slate-400 font-bold">방을 만든 뒤 멤버를 초대할 수 있습니다.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[11px] font-black text-slate-400">멤버 선택</label>
                                        {memberSearch.trim().length === 0 && <span className="text-[9px] text-amber-500 font-black flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg"><Star className="h-3 w-3 fill-amber-400" /> 추천</span>}
                                    </div>
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                        <input type="text" value={memberSearch} onChange={handleSearchChange} maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH} placeholder="이름 또는 이메일 검색" className="input-base pl-11 h-12 bg-white font-bold" />
                                    </div>
                                    <p className="-mt-2 text-right text-[10px] font-bold text-slate-400">검색어 {memberSearch.length}/{MEMBER_SEARCH_KEYWORD_MAX_LENGTH}자</p>
                                    <div className="space-y-2">
                                        {displayedMembers.map(m => {
                                            const mId = getMemberId(m);
                                            const isSelected = selectedMembers.find(sm => getMemberId(sm) === mId);
                                            return (
                                                <button key={mId} onClick={() => toggleMemberSelection(m)} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${isSelected ? "bg-primary-50 text-primary-700 border-primary-200 shadow-sm" : "bg-white hover:bg-slate-50 border-slate-100 shadow-sm"}`}>
                                                    <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs ${isSelected ? "bg-primary-600 text-white shadow-lg shadow-primary-200" : "bg-slate-100 text-slate-400"}`}>{m.name?.charAt(0)}</div><div className="text-left min-w-0 flex-1"><div className="font-black text-sm truncate">{m.name}</div><div className="text-[9px] font-bold opacity-50 truncate">{m.email}</div></div></div>
                                                    {isSelected && <div className="p-1 rounded-lg bg-primary-600 text-white shadow-md"><Check className="h-3.5 w-3.5" /></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-white flex gap-3 shrink-0">
                            <button type="button" onClick={closeMemberModal} className="flex-1 py-4 rounded-2xl bg-slate-50 text-slate-400 text-xs font-black hover:bg-slate-100 transition-colors">취소</button>
                            <button onClick={showCreateModal ? createRoom : inviteMembers} disabled={showCreateModal ? !newRoomTitle.trim() : selectedMembers.length === 0} className="flex-1 py-4 rounded-2xl bg-primary-600 text-white text-xs font-black shadow-xl shadow-primary-200 disabled:opacity-20 transition-all hover:bg-primary-700">{showCreateModal ? "방 만들기" : "멤버 추가"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};












