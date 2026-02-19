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
            senderName: msg.senderName || msg.sender_name || "익명",
            message: msg.message || msg.content || "",
            type: msg.type || msg.messageType || "TALK",
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

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

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
            setRooms(safeData);
            return safeData;
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
            
            // 시간순 정렬 (과거 -> 최신)
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
        if (!isAuthenticated) return;
        const socket = new SockJS("/ws/chat");
        const client = new Client({
            webSocketFactory: () => socket,
            connectHeaders: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });
        client.onConnect = (frame) => {
            stompClientRef.current = client;
            setIsConnected(true);
        };
        client.onDisconnect = () => { setIsConnected(false); };
        client.activate();
        return () => { if (client) client.deactivate(); };
    }, [isAuthenticated]);

    useEffect(() => {
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!client || !isConnected || !roomId) return;

        fetchMessages(roomId);
        fetchCurrentMembers(roomId);

        const markAsRead = async () => {
            try {
                await api.patch(`/chat/room/${roomId}/read`);
                setRooms(prev => prev.map(r => 
                    getRoomId(r) === roomId ? { ...r, unread_count: 0, unreadCount: 0 } : r
                ));
            } catch (err) {
                console.error("Read mark failed:", err);
            }
        };
        markAsRead();

        const subscription = client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
            const receivedMessage = JSON.parse(message.body);
            const normalized = normalizeMessage(receivedMessage);
            if (normalized) {
                setMessages((prev) => {
                    // 1. 서버가 준 실제 ID로 이미 목록에 있는지 확인
                    const existsById = prev.find(m => m.id === normalized.id && !String(m.id).startsWith('temp-'));
                    if (existsById) return prev;

                    // 2. 본인이 보낸 중복 메시지(낙관적 업데이트) 교체 로직
                    const myId = user.member_id || user.memberId;
                    const isMyMessage = Number(normalized.senderId) === Number(myId);
                    
                    if (isMyMessage) {
                        const optimisticMatch = prev.find(m => 
                            String(m.id).startsWith('temp-') && 
                            m.message === normalized.message
                        );
                        if (optimisticMatch) {
                            return prev.map(m => m.id === optimisticMatch.id ? normalized : m);
                        }
                    }

                    // 3. 단순 중복 체크 (키 기준)
                    const isDuplicate = prev.some(m => m.key === normalized.key);
                    if (isDuplicate) return prev;

                    return [...prev, normalized];
                });
            }
        });

        return () => { subscription.unsubscribe(); };
    }, [isConnected, currentRoom, user]);

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        const myId = user.member_id || user.memberId;
        const text = newMessage.trim();
        if (!text || !client || !isConnected || !roomId) return;

        const tempId = `temp-${Date.now()}`;
        const messagePayload = { 
            roomId: Number(roomId), 
            chatRoomId: Number(roomId), 
            senderId: Number(myId), 
            message: text, 
            type: "TALK",
            tempId: tempId 
        };

        try {
            const optimisticMsg = normalizeMessage({ 
                ...messagePayload, 
                id: tempId,
                senderName: user.name || "나", 
                createdAt: new Date().toISOString() 
            });
            setMessages(prev => [...prev, optimisticMsg]);

            client.publish({ 
                destination: "/pub/chat/message", 
                body: JSON.stringify(messagePayload), 
                headers: { "content-type": "application/json" } 
            });
            setNewMessage("");
        } catch (err) {
            toast.error("메시지 전송 실패");
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!file || !roomId || !client || !isConnected) return;
        const formData = new FormData();
        formData.append("file", file);
        try {
            const response = await uploadFiles(`/chat/room/${roomId}/file`, formData);
            const fileUrl = response.data?.url || response.data;
            const messagePayload = { roomId: Number(roomId), senderId: Number(user.member_id || user.memberId), message: fileUrl, type: "FILE" };
            client.publish({ destination: "/pub/chat/message", body: JSON.stringify(messagePayload), headers: { "content-type": "application/json" } });
        } catch (error) {
            toast.error("파일 업로드 실패");
        }
    };

    const leaveRoom = async (roomId) => {
        if (!roomId || !window.confirm("정말 이 채팅방에서 나가시겠습니까?")) return;
        try {
            await api.delete(`/chat/room/${roomId}/leave`);
            toast.success("채팅방에서 퇴장했습니다.");
            if (getRoomId(currentRoom) === roomId) setCurrentRoom(null);
            fetchRooms();
        } catch (error) {
            toast.error("채팅방 나가기 실패");
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
        if (!newRoomTitle.trim()) { toast.error("방 제목을 입력하세요."); return; }
        try {
            const myId = user.member_id || user.memberId;
            const memberIds = selectedMembers.map(m => m.member_id || m.memberId);
            if (myId && !memberIds.includes(myId)) memberIds.push(myId);
            const payload = { title: newRoomTitle, type: newRoomType, memberIds: memberIds };
            const response = await api.post("/chat/room", payload);
            const createdData = response.data?.data || response.data;
            toast.success("방이 생성되었습니다.");
            setShowCreateModal(false);
            resetMemberSelection();
            const updatedRooms = await fetchRooms();
            const createdId = getRoomId(createdData);
            if (createdId) {
                const found = updatedRooms.find(r => getRoomId(r) === createdId);
                setCurrentRoom(found || createdData);
            }
        } catch (error) {
            toast.error("방 생성 실패");
        }
    };

    const inviteMembers = async () => {
        const roomId = getRoomId(currentRoom);
        if (selectedMembers.length === 0 || !roomId) return;
        try {
            const memberIds = selectedMembers.map(m => m.member_id || m.memberId);
            await api.post(`/chat/room/${roomId}/invite`, memberIds);
            toast.success("멤버를 초대했습니다.");
            setShowInviteModal(false);
            resetMemberSelection();
            fetchRooms(); 
            fetchCurrentMembers(roomId);
        } catch (error) {
            toast.error("멤버 초대 실패");
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
                setFoundMembers(safeList.filter(m => (m.member_id || m.memberId) !== (user?.member_id || user?.memberId)));
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
        const mId = member.member_id || member.memberId;
        setSelectedMembers(prev => prev.find(m => (m.member_id || m.memberId) === mId) 
            ? prev.filter(m => (m.member_id || m.memberId) !== mId) : [...prev, member]);
    };

    const resetMemberSelection = () => {
        setMemberSearch(""); setFoundMembers([]); setSelectedMembers([]); setNewRoomTitle("");
    };

    const membersToList = currentMembers.length > 0 ? currentMembers : getMembers(currentRoom);
    const displayedMembers = memberSearch.trim().length > 0 ? foundMembers : recommendedMembers;

    if (!isAuthenticated) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none text-slate-900">
            {isOpen && (
                <div className={`pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? "h-14 w-72" : "h-[550px] w-[400px] max-w-[calc(100vw-48px)]"}`}>
                    <div className="bg-primary-600 p-3 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-2 overflow-hidden">
                            {currentRoom ? (
                                <>
                                    <button onClick={() => setCurrentRoom(null)} className="p-1 hover:bg-white/20 rounded-lg"><ArrowLeft className="h-4 w-4" /></button>
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                        {currentRoom.type === "PERSONAL" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                    </div>
                                    <span className="font-bold text-sm truncate">{currentRoom.title}</span>
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="h-5 w-5" />
                                    <span className="font-bold text-sm">실시간 채팅</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/20 rounded-lg">{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</button>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="h-4 w-4" /></button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <div className="flex-1 flex flex-col min-h-0 bg-white">
                            {!currentRoom ? (
                                <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                                    <div className="p-3 border-b bg-white flex items-center justify-between">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <input type="text" placeholder="방 검색..." className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-xs" />
                                        </div>
                                        <button onClick={() => { resetMemberSelection(); setShowCreateModal(true); }} className="ml-2 p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100"><Plus className="h-4 w-4" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {loadingRooms ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : rooms.length > 0 ? (
                                            rooms.map((room) => {
                                                const roomId = getRoomId(room);
                                                const isActive = getRoomId(currentRoom) === roomId;
                                                return (
                                                    <button key={roomId || Math.random()} onClick={() => { setCurrentRoom(room); setMessages([]); }}
                                                        onContextMenu={(e) => handleContextMenu(e, roomId)}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all text-slate-700 ${isActive ? 'bg-white shadow-sm' : ''}`}>
                                                        <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                                                            {room.type === "PERSONAL" ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                                        </div>
                                                        <div className="flex-1 text-left min-w-0">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <span className="font-bold text-sm truncate">{room.title}</span>
                                                                {(room.unread_count > 0 || room.unreadCount > 0) && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500 text-white">{room.unread_count || room.unreadCount}</span>}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate">{room.last_message || room.lastMessage || "대화 내용이 없습니다."}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : <div className="p-8 text-center text-slate-400 text-xs">참여 중인 방이 없습니다.</div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col min-h-0 relative">
                                    <div className="p-2 border-b bg-white flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pl-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></span>
                                            {isConnected ? "실시간" : "연결끊김"}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setShowMemberList(!showMemberList)} className="p-1 hover:bg-slate-100 rounded text-slate-500 flex items-center gap-1"><Users className="h-3.5 w-3.5" /><span className="text-[10px]">{membersToList.length}</span></button>
                                            {currentRoom.type === "GROUP" && <button onClick={() => { resetMemberSelection(); setShowInviteModal(true); }} className="p-1 hover:bg-slate-100 rounded text-slate-500"><UserPlus className="h-3.5 w-3.5" /></button>}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                                        {loadingMessages ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : messages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-40"><MessageSquare className="h-8 w-8" /><p className="text-[10px]">대화를 시작해보세요!</p></div>
                                        ) : messages.map((msg, idx) => {
                                            const normalized = normalizeMessage(msg);
                                            const isMe = Number(normalized.senderId) === Number(user.member_id || user.memberId);
                                            return (
                                                <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                    <div className={`flex max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-1.5`}>
                                                        {!isMe && <div className="w-7 h-7 rounded-lg bg-slate-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-600">{normalized.senderName?.charAt(0).toUpperCase()}</div>}
                                                        <div className="flex flex-col">
                                                            {!isMe && <span className="text-[9px] text-slate-500 mb-0.5 ml-0.5">{normalized.senderName}</span>}
                                                            <div className={`px-3 py-1.5 rounded-xl text-xs shadow-sm ${isMe ? "bg-primary-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"}`}>
                                                                {normalized.type === "FILE" ? <img src={normalized.message} alt="파일" className="max-w-[180px] rounded-lg cursor-pointer" onClick={() => window.open(normalized.message)} /> : normalized.message}
                                                            </div>
                                                        </div>
                                                        <span className="text-[8px] text-slate-400 pb-0.5 shrink-0">{formatRelativeTime(new Date(normalized.createdAt))}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                    <div className="p-2 border-t shrink-0 bg-white">
                                        <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
                                            <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><ImageIcon className="h-4 w-4" /></button>
                                            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                                            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="메시지 입력..." className="flex-1 bg-slate-100 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary-500" />
                                            <button type="submit" disabled={!newMessage.trim() || !isConnected} className="p-2 bg-primary-600 text-white rounded-xl disabled:bg-slate-200 transition-colors"><Send className="h-3.5 w-3.5" /></button>
                                        </form>
                                    </div>
                                    {showMemberList && (
                                        <div className="absolute inset-0 bg-white z-20 flex flex-col animate-fade-in">
                                            <div className="p-3 border-b flex items-center justify-between bg-slate-50 shrink-0">
                                                <h4 className="font-bold text-xs">참여자 ({membersToList.length})</h4>
                                                <button onClick={() => setShowMemberList(false)} className="p-1 hover:bg-slate-200 rounded-lg"><X className="h-3.5 w-3.5" /></button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2">
                                                {membersToList.map(m => (
                                                    <div key={m.member_id || m.memberId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600">{m.name?.charAt(0).toUpperCase()}</div>
                                                        <div className="min-w-0 flex-1"><div className="text-xs font-bold truncate flex items-center gap-1">{m.name}{(m.member_id || m.memberId) === (user?.member_id || user?.memberId) && <span className="text-[8px] px-1 py-0.5 bg-primary-100 text-primary-600 rounded">나</span>}</div><div className="text-[9px] text-slate-400 truncate">{m.email}</div></div>
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
                <div className="fixed z-[200] bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-32 pointer-events-auto animate-fade-in" style={{ left: contextMenu.x, top: contextMenu.y }}>
                    <button onClick={() => leaveRoom(contextMenu.roomId)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="h-3.5 w-3.5" />방 나가기
                    </button>
                </div>
            )}

            <button onClick={() => { if (isMinimized) { setIsMinimized(false); } else { setIsOpen(!isOpen); } }}
                className={`pointer-events-auto w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${isOpen && !isMinimized ? "bg-white text-primary-600 rotate-90" : "bg-primary-600 text-white hover:scale-110"}`}>
                {isOpen && !isMinimized ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
                {rooms.some(r => (r.unread_count || r.unreadCount) > 0) && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>

            {(showCreateModal || showInviteModal) && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm pointer-events-auto">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up">
                        <div className="p-4 border-b flex items-center justify-between bg-primary-600 text-white">
                            <h3 className="font-bold text-sm">{showCreateModal ? "새 채팅방" : "멤버 초대"}</h3>
                            <button onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                            {showCreateModal && (<div><label className="block text-xs font-bold text-slate-700 mb-1.5">방 제목</label><input type="text" value={newRoomTitle} onChange={(e) => setNewRoomTitle(e.target.value)} placeholder="제목 입력" className="input-base text-sm py-2" /></div>)}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between items-center">멤버 선택{memberSearch.trim().length === 0 && <span className="text-[9px] text-amber-500 flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400" /> 추천</span>}</label>
                                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><input type="text" value={memberSearch} onChange={handleSearchChange} placeholder="이름/이메일 검색" className="input-base pl-9 text-sm py-2" /></div>
                                <div className="mt-2 space-y-1 text-slate-700">
                                    {displayedMembers.map(m => {
                                        const mId = m.member_id || m.memberId;
                                        const isSelected = selectedMembers.find(sm => (sm.member_id || sm.memberId) === mId);
                                        return (
                                            <button key={mId} onClick={() => toggleMemberSelection(m)} className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all ${isSelected ? "bg-primary-50 text-primary-700 border-primary-200" : "hover:bg-slate-50 border-transparent"} border`}>
                                                <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold">{m.name?.charAt(0)}</div><div className="text-left min-w-0 flex-1"><div className="font-bold truncate">{m.name}</div><div className="text-[9px] opacity-60 truncate">{m.email}</div></div></div>
                                                {isSelected && <Check className="h-3.5 w-3.5 text-primary-600" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2 shrink-0">
                            <button onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold">취소</button>
                            <button onClick={showCreateModal ? createRoom : inviteMembers} disabled={selectedMembers.length === 0} className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold disabled:bg-slate-300">{showCreateModal ? "방 만들기" : "초대하기"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};