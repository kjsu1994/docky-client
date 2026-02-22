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
            
            // ── 채팅방 목록 정렬 (최신 생성순으로 위로 정렬) ──
            const sortedData = [...safeData].sort((a, b) => {
                const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
                const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
                if (timeA !== timeB) return timeB - timeA;

                const idA = Number(getRoomId(a) || 0);
                const idB = Number(getRoomId(b) || 0);
                return idB - idA;
            });

            setRooms(sortedData);
            return sortedData;
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
        const myId = Number(user.member_id || user.memberId || user.id);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const response = await uploadFiles(`/chat/room/${roomId}/file`, formData);
            const fileUrl = response.data?.url || response.data;
            const messagePayload = { roomId: Number(roomId), senderId: myId, message: fileUrl, type: "FILE" };
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
            // 방 생성 시 본인(방장)만 멤버로 포함하여 생성 프로세스 간소화
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
            
            toast.success("방이 생성되었습니다. 멤버를 초대해보세요!");
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
            toast.error(error.response?.data?.message || "방 생성 실패");
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
            toast.success("멤버를 초대했습니다.");
            setShowInviteModal(false);
            resetMemberSelection();
            fetchRooms(); 
            fetchCurrentMembers(roomId);
        } catch (error) {
            console.error("Invitation failed:", error);
            toast.error(error.response?.data?.message || "멤버 초대 실패");
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

    if (!isAuthenticated) return null;

    return (
        <div className="fixed bottom-28 right-6 lg:bottom-6 z-[100] flex flex-col items-end gap-4 pointer-events-none text-slate-900">
            {isOpen && (
                <div className={`pointer-events-auto bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden transition-all duration-500 ${isMinimized ? "h-16 w-72" : "h-[600px] w-[400px] max-w-[calc(100vw-48px)]"}`}>
                    <div className="bg-gradient-to-r from-primary-600 to-primary-500 p-4 flex items-center justify-between text-white shrink-0">
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
                                        <div className="text-[10px] font-bold text-primary-100 uppercase tracking-widest">v2.0 Beta</div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="h-4 w-4" /></button>
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
                                                    <button key={roomId || Math.random()} onClick={() => { setCurrentRoom(room); setMessages([]); }}
                                                        onContextMenu={(e) => handleContextMenu(e, roomId)}
                                                        className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all text-slate-700 hover:shadow-xl hover:-translate-y-0.5 ${isActive ? 'bg-white shadow-xl ring-2 ring-primary-100' : 'bg-white/50 border border-slate-100'}`}>
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 flex items-center justify-center font-black shrink-0 shadow-sm">
                                                            {room.type === "PERSONAL" ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                                        </div>
                                                        <div className="flex-1 text-left min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-black text-sm truncate text-slate-900">{room.title}</span>
                                                                {(room.unread_count > 0 || room.unreadCount > 0) && <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-primary-600 text-white shadow-lg shadow-primary-200">{room.unread_count || room.unreadCount}</span>}
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
                                                                {normalized.type === "FILE" ? <img src={normalized.message} alt="파일" className="max-w-[200px] rounded-xl cursor-pointer" onClick={() => window.open(normalized.message)} /> : normalized.message}
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

            <button onClick={() => { if (isMinimized) { setIsMinimized(false); } else { setIsOpen(!isOpen); } }}
                className={`pointer-events-auto w-16 h-16 rounded-[2rem] shadow-2xl flex items-center justify-center transition-all duration-500 active:scale-90 ${isOpen && !isMinimized ? "bg-white text-primary-600 rotate-90 scale-90" : "bg-primary-600 text-white hover:scale-110 shadow-primary-200"}`}>
                {isOpen && !isMinimized ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
                {rooms.some(r => (r.unread_count || r.unreadCount) > 0) && <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 rounded-full border-4 border-white shadow-lg animate-bounce"></span>}
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