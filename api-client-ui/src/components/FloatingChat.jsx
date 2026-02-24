import { useState, useEffect, useRef, useCallback } from "react";
// SockJS/StompJS compatibility for Vite
if (typeof global === 'undefined') {
    window.global = window;
}
import { 
    Send, 
    Plus, 
    Hash, 
    User, 
    Users, 
    UserPlus,
    MoreVertical, 
    Search,
    MessageSquare,
    MessageCircle,
    Image as ImageIcon,
    File as FileIcon,
    ArrowLeft,
    X,
    Check,
    Star,
    RefreshCw,
    Minimize2,
    Maximize2,
    LogOut
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useAuth } from "../contexts/AuthContext";
import api, { uploadFiles } from "../utils/api";
import toast from "react-hot-toast";
import { formatRelativeTime, debounce } from "../utils/helpers";
import { LoadingSpinner } from "./LoadingSpinner";

export const FloatingChat = () => {
    const { user, isAuthenticated } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, roomId: null });

    const getRoomId = (room) => {
        if (!room) return null;
        return room.chat_room_id || room.roomId || room.room_id || room.id || room.chatRoomId;
    };

    const getMembers = (room) => {
        if (!room) return [];
        const members = room.members || room.participants || room.memberList || room.member_list || room.memberResponses || room.member_responses || [];
        if (Array.isArray(members)) return members;
        return [];
    };

    const getMsgKey = (msg) => {
        const time = new Date(msg.createdAt || msg.created_at).getTime();
        const fuzzyTime = Math.floor(time / 2000); 
        const sender = msg.senderId || msg.sender_id;
        const text = msg.message || msg.content || "";
        return `${sender}-${text}-${fuzzyTime}`;
    };

    const normalizeMessage = (msg) => {
        if (!msg) return null;
        const normalized = {
            id: msg.id || msg.messageId || `temp-${Math.random().toString(36).substr(2, 9)}`,
            senderId: msg.senderId || msg.sender_id,
            senderName: msg.senderName || msg.sender_name || "?듬챸",
            message: msg.message || msg.content || "",
            type: msg.type || msg.messageType || "TALK",
            roomId: msg.roomId || msg.chatRoomId || msg.room_id || msg.chat_room_id,
            createdAt: msg.createdAt || msg.created_at || new Date().toISOString()
        };
        normalized.key = getMsgKey(normalized);
        return normalized;
    };

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
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
    const [fabPosition, setFabPosition] = useState({ x: 0, y: 0 });
    const [dragReady, setDragReady] = useState(false);
    const [isDraggingFab, setIsDraggingFab] = useState(false);
    const [isDraggingPanel, setIsDraggingPanel] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const lastReadMarkAtRef = useRef(0);
    const roomSubscriptionsRef = useRef([]);
    const dragHoldTimerRef = useRef(null);
    const dragStartRef = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });
    const didDragRef = useRef(false);

    const getUnreadCount = (room) => {
        const value = Number(room?.unread_count ?? room?.unreadCount ?? 0);
        return Number.isFinite(value) && value > 0 ? value : 0;
    };

    const getLastMessagePreview = (msg) => {
        if (!msg) return "";
        if (msg.type === "FILE") return "?대?吏";
        return String(msg.message || "").trim();
    };

    const getRoomPreviewText = (room) => {
        const direct = room?.last_message || room?.lastMessage || room?.recent_message || room?.recentMessage || "";
        return String(direct || "").trim();
    };

    const hasRoomPreview = (room) => getRoomPreviewText(room).length > 0;

    const upsertRoomPreview = (roomId, previewText, createdAt, nextUnreadCount) => {
        if (!roomId) return;
        setRooms((prev) => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex((r) => String(getRoomId(r)) === String(roomId));
            if (idx < 0) return list;

            const current = list[idx];
            const patched = {
                ...current,
                last_message: previewText,
                lastMessage: previewText,
                unread_count: nextUnreadCount,
                unreadCount: nextUnreadCount,
                updatedAt: createdAt || current.updatedAt || current.updated_at,
                updated_at: createdAt || current.updated_at || current.updatedAt,
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
            await api.patch(`/chat/room/${roomId}/read`);
            setRooms((prev) =>
                (prev || []).map((r) =>
                    String(getRoomId(r)) === String(roomId) ? { ...r, unread_count: 0, unreadCount: 0 } : r
                )
            );
        } catch (err) {
            console.error("Read mark failed:", err);
        }
    };

    
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
                last_message: preview,
                lastMessage: preview,
                unread_count: nextUnread,
                unreadCount: nextUnread,
                updatedAt: normalized.createdAt || base.updatedAt || base.updated_at,
                updated_at: normalized.createdAt || base.updated_at || base.updatedAt,
            };

            list.splice(idx, 1);
            return [patched, ...list];
        });
    };
    const enrichRoomsWithLatestMessage = async (roomList) => {
        const source = Array.isArray(roomList) ? roomList : [];
        const targets = source.filter((room) => getRoomId(room) && !hasRoomPreview(room));
        if (!targets.length) return source;

        const fetched = await Promise.all(
            targets.map(async (room) => {
                const roomId = getRoomId(room);
                try {
                    const response = await api.get(`/chat/room/${roomId}/messages`);
                    const data = response.data?.data || response.data;
                    const safeMessages = Array.isArray(data) ? data : (data?.content || []);
                    const latest = safeMessages
                        .map(normalizeMessage)
                        .filter(Boolean)
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .at(-1);
                    const preview = getLastMessagePreview(latest);
                    if (!preview) return room;
                    return {
                        ...room,
                        last_message: preview,
                        lastMessage: preview,
                        updatedAt: latest?.createdAt || room?.updatedAt || room?.updated_at,
                        updated_at: latest?.createdAt || room?.updated_at || room?.updatedAt,
                    };
                } catch {
                    return room;
                }
            })
        );

        const byId = new Map(fetched.map((room) => [String(getRoomId(room)), room]));
        return source.map((room) => byId.get(String(getRoomId(room))) || room);
    };

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        if (!loadingMessages && isOpen) {
            scrollToBottom();
        }
    }, [messages, loadingMessages, isOpen]);

    const fetchRooms = async () => {
        if (!isAuthenticated) return;
        setLoadingRooms(true);
        try {
            const response = await api.get("/chat/rooms");
            const rawData = response.data?.data || response.data;
            const safeData = Array.isArray(rawData) ? rawData : [];
            
            // ?? 梨꾪똿諛?紐⑸줉 ?뺣젹 (理쒖떊 ?앹꽦?쒖쑝濡??꾨줈 ?뺣젹) ??
            const sortedData = [...safeData].sort((a, b) => {
                const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
                const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
                if (timeA !== timeB) return timeB - timeA;

                const idA = Number(getRoomId(a) || 0);
                const idB = Number(getRoomId(b) || 0);
                return idB - idA;
            });

            const enriched = await enrichRoomsWithLatestMessage(sortedData);
            setRooms(enriched);
            return enriched;
        } catch (error) {
            return [];
        } finally {
            setLoadingRooms(false);
        }
    };

    const fetchCurrentMembers = async (roomId) => {
        if (!roomId) return;
        setLoadingMembers(true);
        try {
            const response = await api.get(`/chat/room/${roomId}/members`);
            const data = response.data?.data || response.data;
            const safeMembers = Array.isArray(data) ? data : (data?.content || []);
            setCurrentMembers(safeMembers);
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
            const response = await api.get(`/chat/room/${roomId}/messages`);
            const data = response.data?.data || response.data;
            const safeMessages = Array.isArray(data) ? data : (data?.content || []);
            
            // ?쒓컙???뺣젹 (怨쇨굅 -> 理쒖떊)
            const sortedMessages = safeMessages
                .map(normalizeMessage)
                .filter(Boolean)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                
            setMessages(sortedMessages);
        } catch (error) {
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    };

    useEffect(() => {
        if (isOpen && isAuthenticated) {
            fetchRooms();
        }
    }, [isOpen, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || isConnected) return;
        const runFallback = () => {
            if (document.visibilityState === "visible") {
                fetchRooms();
            }
        };
        runFallback();
        const timer = setInterval(runFallback, 60000);
        return () => clearInterval(timer);
    }, [isAuthenticated, isConnected]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const socket = new SockJS("/ws/chat");
        const client = new Client({
            webSocketFactory: () => socket,
            connectHeaders: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });
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
        client.activate();
        return () => {
            roomSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
            roomSubscriptionsRef.current = [];
            if (client) client.deactivate();
        };
    }, [isAuthenticated]);

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
                    // 1. ?쒕쾭媛 以 ?ㅼ젣 ID濡??대? 紐⑸줉???덈뒗吏 ?뺤씤
                    const existsById = prev.find(m => m.id === normalized.id && !String(m.id).startsWith('temp-'));
                    if (existsById) return prev;

                    // 2. 蹂몄씤??蹂대궦 以묐났 硫붿떆吏(?숆????낅뜲?댄듃) 援먯껜 濡쒖쭅
                    const myId = Number(user.member_id || user.memberId || user.id);
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

                    // 3. ?⑥닚 以묐났 泥댄겕 (??湲곗?)
                    const isDuplicate = prev.some(m => m.key === normalized.key);
                    if (isDuplicate) return prev;

                    return [...prev, normalized];
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
        const myId = Number(user.member_id || user.memberId || user.id);
        const text = newMessage.trim();
        if (!text || !client || !isConnected || !roomId) return;

        const tempId = `temp-${Date.now()}`;
        const messagePayload = { 
            roomId: Number(roomId), 
            chatRoomId: Number(roomId), 
            senderId: myId, 
            message: text, 
            type: "TALK",
            tempId: tempId 
        };

        try {
            const optimisticMsg = normalizeMessage({ 
                ...messagePayload, 
                id: tempId,
                senderName: user.name || "익명", 
                createdAt: new Date().toISOString() 
            });
            setMessages(prev => [...prev, optimisticMsg]);
            upsertRoomPreview(roomId, text, optimisticMsg.createdAt, 0);

            client.publish({ 
                destination: "/pub/chat/message", 
                body: JSON.stringify(messagePayload), 
                headers: { "content-type": "application/json" } 
            });
            setNewMessage("");
        } catch (err) {
            toast.error("硫붿떆吏 ?꾩넚 ?ㅽ뙣");
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!file || !roomId || !client || !isConnected) return;
        const myId = Number(user.member_id || user.memberId || user.id);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const response = await uploadFiles(`/chat/room/${roomId}/file`, formData);
            const fileUrl = response.data?.url || response.data;
            const messagePayload = { roomId: Number(roomId), senderId: myId, message: fileUrl, type: "FILE" };
            client.publish({ destination: "/pub/chat/message", body: JSON.stringify(messagePayload), headers: { "content-type": "application/json" } });
        } catch (error) {
            toast.error("?뚯씪 ?낅줈???ㅽ뙣");
        }
    };

    const leaveRoom = async (roomId) => {
        if (!roomId || !window.confirm("?뺣쭚 ??梨꾪똿諛⑹뿉???섍??쒓쿋?듬땲源?")) return;
        try {
            await api.delete(`/chat/room/${roomId}/leave`);
            toast.success("梨꾪똿諛⑹뿉???댁옣?덉뒿?덈떎.");
            if (getRoomId(currentRoom) === roomId) setCurrentRoom(null);
            fetchRooms();
        } catch (error) {
            toast.error("梨꾪똿諛??섍?湲??ㅽ뙣");
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
        if (!newRoomTitle.trim()) { toast.error("諛??쒕ぉ???낅젰?섏꽭??"); return; }
        try {
            // 諛??앹꽦 ??蹂몄씤(諛⑹옣)留?硫ㅻ쾭濡??ы븿?섏뿬 ?앹꽦 ?꾨줈?몄뒪 媛꾩냼??
            const myId = Number(user.member_id || user.memberId || user.id);
            const memberIds = [myId];

            const payload = { 
                title: newRoomTitle, 
                type: newRoomType, 
                memberIds: memberIds 
            };
            
            console.log("[FloatingChat] Creating empty room with title:", newRoomTitle);
            
            const response = await api.post("/chat/room", payload);
            const createdData = response.data?.data || response.data;
            
            toast.success("諛⑹씠 ?앹꽦?섏뿀?듬땲?? 硫ㅻ쾭瑜?珥덈??대낫?몄슂!");
            setShowCreateModal(false);
            resetMemberSelection();
            
            const updatedRooms = await fetchRooms();
            const createdId = getRoomId(createdData);
            if (createdId) {
                const found = updatedRooms.find(r => getRoomId(r) === createdId);
                setCurrentRoom(found || createdData);
            }
        } catch (error) {
            console.error("Room creation failed:", error);
            toast.error(error.response?.data?.message || "諛??앹꽦 ?ㅽ뙣");
        }
    };

    const inviteMembers = async () => {
        const roomId = getRoomId(currentRoom);
        if (selectedMembers.length === 0 || !roomId) return;
        try {
            const memberIds = selectedMembers
                .map(m => Number(m.member_id || m.memberId || m.id))
                .filter(id => !isNaN(id) && id > 0);

            if (memberIds.length === 0) return;

            await api.post(`/chat/room/${roomId}/invite`, memberIds);
            toast.success("硫ㅻ쾭瑜?珥덈??덉뒿?덈떎.");
            setShowInviteModal(false);
            resetMemberSelection();
            fetchRooms(); 
            fetchCurrentMembers(roomId);
        } catch (error) {
            console.error("Invitation failed:", error);
            toast.error(error.response?.data?.message || "硫ㅻ쾭 珥덈? ?ㅽ뙣");
        }
    };

    const performSearch = useCallback(
        debounce(async (query) => {
            if (!query.trim()) { setFoundMembers([]); setSearching(false); return; }
            setSearching(true);
            try {
                const response = await api.get("/members/list", { params: { keyword: query, page: 0, size: 20 } });
                const memberList = response.data?.data || [];
                const safeList = Array.isArray(memberList) ? memberList : (memberList.content || []);
                setFoundMembers(safeList.filter(m => Number(m.member_id || m.memberId || m.id) !== Number(user?.member_id || user?.memberId || user?.id)));
            } catch (error) {
                setFoundMembers([]);
            } finally { setSearching(false); }
        }, 300),
        [user]
    );

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setMemberSearch(query);
        performSearch(query);
    };

    const toggleMemberSelection = (member) => {
        const mId = member.member_id || member.memberId || member.id;
        if (!mId) return;

        setSelectedMembers(prev => {
            const isSelected = prev.some(m => (m.member_id || m.memberId || m.id) === mId);
            if (isSelected) {
                return prev.filter(m => (m.member_id || m.memberId || m.id) !== mId);
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
    const totalUnreadCount = rooms.reduce((sum, room) => sum + getUnreadCount(room), 0);

    const getDefaultFabPosition = useCallback(() => {
        const fabSize = 64;
        const right = 24;
        const bottom = window.innerWidth >= 1024 ? 24 : 112;
        return {
            x: Math.max(0, window.innerWidth - fabSize - right),
            y: Math.max(0, window.innerHeight - fabSize - bottom),
        };
    }, []);

    const clampFabPosition = useCallback((x, y) => {
        const fabSize = 64;
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

    const toggleChat = () => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        if (isMinimized) {
            setIsMinimized(false);
            return;
        }
        setIsOpen(!isOpen);
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

    if (!isAuthenticated) return null;

    return (
        <div className="fixed z-[100] flex flex-col items-end gap-4 pointer-events-none text-slate-900" style={{ left: `${fabPosition.x}px`, top: `${fabPosition.y}px` }}>
            {isOpen && (
                <div className={`pointer-events-auto bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden transition-all duration-500 ${isMinimized ? "h-16 w-72" : "h-[600px] w-[400px] max-w-[calc(100vw-48px)]"}`}>
                    <div
                        onPointerDown={handlePanelPointerDown}
                        onPointerMove={handlePanelPointerMove}
                        onPointerUp={handlePanelPointerUp}
                        onPointerCancel={handlePanelPointerUp}
                        className={`bg-gradient-to-r from-primary-600 to-primary-500 p-4 flex items-center justify-between text-white shrink-0 touch-none select-none ${isDraggingPanel ? "cursor-grabbing" : "cursor-grab"}`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                            {currentRoom ? (
                                <>
                                    <button onClick={() => setCurrentRoom(null)} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"><ArrowLeft className="h-4 w-4" /></button>
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                                        {currentRoom.type === "PERSONAL" ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-sm truncate leading-tight">{currentRoom.title}</div>
                                        <div className="text-[10px] font-bold text-primary-100 uppercase tracking-tighter">Live Connection</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-2 rounded-xl bg-white/20">
                                        <MessageSquare className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-black text-sm uppercase tracking-wider">Secure Chat</div>
                                        <div className="text-[10px] font-bold text-primary-100 uppercase tracking-widest">?뚯썝 硫붿떊?</div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</button>
                            <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl text-rose-200 hover:text-rose-100 hover:bg-rose-500/20 transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <div className="flex-1 flex flex-col min-h-0 bg-white">
                            {!currentRoom ? (
                                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                                    <div className="p-4 border-b bg-white/80 backdrop-blur-md flex items-center justify-between">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                            <input type="text" placeholder="Search conversations..." className="input-base py-2 pl-10 pr-4 text-xs font-bold bg-slate-50 border-0" />
                                        </div>
                                        <button onClick={() => { resetMemberSelection(); setShowCreateModal(true); }} className="ml-3 p-2.5 rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-100 hover:scale-105 transition-transform"><Plus className="h-5 w-5" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                        {loadingRooms ? <div className="p-12 flex justify-center"><LoadingSpinner size="sm" /></div> : rooms.length > 0 ? (
                                            rooms.map((room) => {
                                                const roomId = getRoomId(room);
                                                const isActive = getRoomId(currentRoom) === roomId;
                                                return (
                                                    <button key={roomId || Math.random()} onClick={() => { setCurrentRoom(room); setMessages([]); upsertRoomPreview(roomId, room.last_message || room.lastMessage || "", room.updatedAt || room.updated_at, 0); }}
                                                        onContextMenu={(e) => handleContextMenu(e, roomId)}
                                                        className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all text-slate-700 hover:shadow-xl hover:-translate-y-0.5 ${isActive ? 'bg-white shadow-xl ring-2 ring-primary-100' : 'bg-white/50 border border-slate-100'}`}>
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 flex items-center justify-center font-black shrink-0 shadow-sm">
                                                            {room.type === "PERSONAL" ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                                        </div>
                                                        <div className="flex-1 text-left min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-black text-sm truncate text-slate-900">{room.title}</span>
                                                                {getUnreadCount(room) > 0 && <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-primary-600 text-white shadow-lg shadow-primary-200">{getUnreadCount(room)}</span>}
                                                            </div>
                                                            <div className="text-[11px] font-medium text-slate-400 truncate line-clamp-1">{room.last_message || room.lastMessage || "No recent messages."}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2 opacity-50 font-bold italic"><MessageSquare className="h-10 w-10" /><span>No active rooms</span></div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col min-h-0 relative">
                                    <div className="px-4 py-2 border-b bg-white flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 border border-emerald-100">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">{isConnected ? "Live" : "Offline"}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => setShowMemberList(!showMemberList)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors flex items-center gap-1.5"><Users className="h-4 w-4" /><span className="text-[10px] font-black">{membersToList.length}</span></button>
                                            {currentRoom.type === "GROUP" && <button onClick={() => { resetMemberSelection(); setShowInviteModal(true); }} className="p-2 hover:bg-primary-50 rounded-xl text-primary-600 transition-colors"><UserPlus className="h-4 w-4" /></button>}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                        {loadingMessages ? <div className="p-12 flex justify-center"><LoadingSpinner size="sm" /></div> : messages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2 opacity-50 font-bold italic"><MessageSquare className="h-8 w-8" /><p className="text-[11px]">Start a conversation</p></div>
                                        ) : messages.map((msg, idx) => {
                                            const normalized = normalizeMessage(msg);
                                            const isMe = Number(normalized.senderId) === Number(user.member_id || user.memberId);
                                            return (
                                                <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                    <div className={`flex max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
                                                        {!isMe && <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-100 shrink-0 flex items-center justify-center text-[11px] font-black text-primary-600">{normalized.senderName?.charAt(0).toUpperCase()}</div>}
                                                        <div className="flex flex-col">
                                                            {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1 uppercase tracking-tighter">{normalized.senderName}</span>}
                                                            <div className={`px-4 py-2.5 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed ${isMe ? "bg-primary-600 text-white rounded-br-none" : "bg-white text-slate-700 border border-slate-100 rounded-bl-none"}`}>
                                                                {normalized.type === "FILE" ? <img src={normalized.message} alt="?뚯씪" className="max-w-[200px] rounded-xl cursor-pointer" onClick={() => window.open(normalized.message)} /> : normalized.message}
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-300 pb-1 shrink-0 uppercase">{formatRelativeTime(new Date(normalized.createdAt))}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                    <div className="p-3 border-t shrink-0 bg-white">
                                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                            <button type="button" onClick={() => fileInputRef.current.click()} className="p-2.5 text-slate-300 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"><ImageIcon className="h-5 w-5" /></button>
                                            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                                            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Type a message..." className="input-base h-11 border-0 bg-slate-50 font-medium" />
                                            <button type="submit" disabled={!newMessage.trim() || !isConnected} className="p-2.5 bg-primary-600 text-white rounded-xl shadow-lg shadow-primary-100 disabled:opacity-20 transition-all active:scale-90"><Send className="h-5 w-5" /></button>
                                        </form>
                                    </div>
                                    {showMemberList && (
                                        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 flex flex-col animate-fade-in p-2">
                                            <div className="p-4 flex items-center justify-between border-b border-slate-50">
                                                <h4 className="font-black text-[11px] uppercase tracking-widest text-slate-400">Members ({membersToList.length})</h4>
                                                <button onClick={() => setShowMemberList(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"><X className="h-4 w-4" /></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                {membersToList.map(m => (
                                                    <div key={m.member_id || m.memberId} className="flex items-center gap-3 p-3 rounded-[1.25rem] bg-slate-50/50 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg transition-all">
                                                        <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center font-black text-xs text-primary-600">{m.name?.charAt(0).toUpperCase()}</div>
                                                        <div className="min-w-0 flex-1"><div className="text-sm font-black truncate text-slate-900 flex items-center gap-2">{m.name}{(m.member_id || m.memberId) === (user?.member_id || user?.memberId) && <span className="text-[9px] px-1.5 py-0.5 bg-primary-600 text-white rounded-lg">YOU</span>}</div><div className="text-[10px] font-bold text-slate-400 truncate">{m.email}</div></div>
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
                    <button onClick={() => leaveRoom(contextMenu.roomId)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black text-rose-600 hover:bg-rose-50 transition-colors uppercase tracking-widest">
                        <LogOut className="h-4 w-4" />Leave Room
                    </button>
                </div>
            )}

            <button
                onClick={toggleChat}
                onPointerDown={handleFabPointerDown}
                onPointerMove={handleFabPointerMove}
                onPointerUp={endFabDrag}
                onPointerCancel={endFabDrag}
                onPointerLeave={endFabDrag}
                className={`pointer-events-auto w-16 h-16 rounded-[2rem] shadow-2xl flex items-center justify-center transition-all duration-500 active:scale-90 touch-none select-none ${isDraggingFab ? "cursor-grabbing" : "cursor-grab"} ${isOpen && !isMinimized ? "bg-white text-primary-600 rotate-90 scale-90" : "bg-primary-600 text-white hover:scale-110 shadow-primary-200"}`}>
                {isOpen && !isMinimized ? <X className="h-7 w-7 text-rose-500" /> : <MessageCircle className="h-7 w-7" />}
                {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 bg-rose-500 text-white rounded-full border-2 border-white shadow-lg text-[10px] font-black flex items-center justify-center">
                        {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                    </span>
                )}
            </button>

            {(showCreateModal || showInviteModal) && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md pointer-events-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-slide-up border border-white/20">
                        <div className="p-6 border-b flex items-center justify-between bg-primary-600 text-white">
                            <div>
                                <h3 className="font-black text-lg tracking-tight uppercase">{showCreateModal ? "New Room" : "Invite Members"}</h3>
                                <p className="text-[10px] font-bold text-primary-100 uppercase tracking-[0.2em]">{showCreateModal ? "Start conversation" : "Add collaborators"}</p>
                            </div>
                            <button onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="p-2.5 hover:bg-white/20 rounded-2xl transition-colors"><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[450px] overflow-y-auto bg-slate-50/30">
                            {showCreateModal ? (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Room Title</label>
                                    <input 
                                        type="text" 
                                        value={newRoomTitle} 
                                        onChange={(e) => setNewRoomTitle(e.target.value)} 
                                        placeholder="e.g. Project Discussion" 
                                        className="input-base h-14 bg-white font-bold" 
                                        autoFocus
                                    />
                                    <p className="mt-3 ml-1 text-[10px] text-slate-400 font-bold italic">* You can invite members after creating the room.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Members</label>
                                        {memberSearch.trim().length === 0 && <span className="text-[9px] text-amber-500 font-black uppercase flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg"><Star className="h-3 w-3 fill-amber-400" /> Recommended</span>}
                                    </div>
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                        <input type="text" value={memberSearch} onChange={handleSearchChange} placeholder="Search by name or email..." className="input-base pl-11 h-12 bg-white font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        {displayedMembers.map(m => {
                                            const mId = m.member_id || m.memberId || m.id;
                                            const isSelected = selectedMembers.find(sm => (sm.member_id || sm.memberId || sm.id) === mId);
                                            return (
                                                <button key={mId} onClick={() => toggleMemberSelection(m)} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${isSelected ? "bg-primary-50 text-primary-700 border-primary-200 shadow-sm" : "bg-white hover:bg-slate-50 border-slate-100 shadow-sm"}`}>
                                                    <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs ${isSelected ? "bg-primary-600 text-white shadow-lg shadow-primary-200" : "bg-slate-100 text-slate-400"}`}>{m.name?.charAt(0)}</div><div className="text-left min-w-0 flex-1"><div className="font-black text-sm truncate">{m.name}</div><div className="text-[9px] font-bold opacity-50 truncate uppercase tracking-tighter">{m.email}</div></div></div>
                                                    {isSelected && <div className="p-1 rounded-lg bg-primary-600 text-white shadow-md"><Check className="h-3.5 w-3.5" /></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-white flex gap-3 shrink-0">
                            <button onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="flex-1 py-4 rounded-2xl bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">Cancel</button>
                            <button onClick={showCreateModal ? createRoom : inviteMembers} disabled={showCreateModal ? !newRoomTitle.trim() : selectedMembers.length === 0} className="flex-1 py-4 rounded-2xl bg-primary-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-200 disabled:opacity-20 transition-all hover:bg-primary-700">{showCreateModal ? "Create Room" : "Add Members"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};







