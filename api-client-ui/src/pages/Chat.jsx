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
    RefreshCw
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useAuth } from "../contexts/AuthContext";
import api, { uploadFiles } from "../utils/api";
import toast from "react-hot-toast";
import { formatRelativeTime, debounce } from "../utils/helpers";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const Chat = () => {
    const { user } = useAuth();
    
    // 채팅방 ID 추출 유틸리티
    const getRoomId = (room) => {
        if (!room) return null;
        return room.chat_room_id || room.roomId || room.room_id || room.id || room.chatRoomId;
    };

    // 메시지 데이터 정규화
    const normalizeMessage = (msg) => {
        if (!msg) return null;
        return {
            id: msg.id || msg.messageId || Math.random().toString(36).substr(2, 9),
            senderId: msg.senderId || msg.sender_id,
            senderName: msg.senderName || msg.sender_name || "익명",
            message: msg.message || msg.content || "",
            type: msg.type || msg.messageType || "TALK",
            createdAt: msg.createdAt || msg.created_at || new Date().toISOString()
        };
    };

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const stompClientRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
        if (!loadingMessages) {
            scrollToBottom();
        }
    }, [messages, loadingMessages]);

    // 채팅방 목록 가져오기
    const fetchRooms = async () => {
        setLoadingRooms(true);
        try {
            const response = await api.get("/chat/rooms");
            const rawData = response.data?.data || response.data;
            const safeData = Array.isArray(rawData) ? rawData : [];
            setRooms(safeData);
            return safeData;
        } catch (error) {
            console.error("Failed to fetch chat rooms:", error);
            return [];
        } finally {
            setLoadingRooms(false);
        }
    };

    // 특정 방의 멤버 조회 (새로 추가된 API 반영)
    const fetchCurrentMembers = async (roomId) => {
        if (!roomId) return;
        setLoadingMembers(true);
        try {
            console.log(`Fetching members for room ${roomId}...`);
            const response = await api.get(`/chat/room/${roomId}/members`);
            const data = response.data?.data || response.data;
            const safeMembers = Array.isArray(data) ? data : (data?.content || []);
            setCurrentMembers(safeMembers);
        } catch (error) {
            console.error("Failed to fetch members:", error);
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
            const response = await api.get(`/chat/room/${roomId}/messages`);
            const data = response.data?.data || response.data;
            const safeMessages = Array.isArray(data) ? data : (data?.content || []);
            setMessages(safeMessages.map(normalizeMessage).filter(Boolean));
        } catch (error) {
            console.error("Failed to fetch messages:", error);
            setMessages([]);
        } finally {
            setLoadingMessages(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    // 추천 멤버 가져오기 (0-based page)
    const fetchRecommendations = async () => {
        try {
            const response = await api.get("/members/list", { params: { page: 0, size: 20 } });
            const memberList = response.data?.data || [];
            const filtered = (Array.isArray(memberList) ? memberList : []).filter(m => 
                (m.member_id || m.memberId) !== (user?.member_id || user?.memberId)
            );
            setRecommendedMembers(filtered);
        } catch (error) {
            console.error("Failed to fetch recommendations", error);
        }
    };

    useEffect(() => {
        if (showCreateModal || showInviteModal) fetchRecommendations();
    }, [showCreateModal, showInviteModal]);

    // WebSocket 연결 설정
    useEffect(() => {
        const socket = new SockJS("/ws/chat");
        const client = new Client({
            webSocketFactory: () => socket,
            connectHeaders: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
            debug: (str) => { console.log("[STOMP Debug]", str); },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = (frame) => {
            console.log("STOMP Connected");
            stompClientRef.current = client;
            setIsConnected(true);
        };

        client.onDisconnect = () => {
            console.log("STOMP Disconnected");
            setIsConnected(false);
        };

        client.activate();
        return () => { if (client) client.deactivate(); };
    }, []);

    // 특정 채팅방 구독 및 데이터 로드
    useEffect(() => {
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!client || !isConnected || !roomId) return;

        // 과거 내역 및 멤버 목록 불러오기
        fetchMessages(roomId);
        fetchCurrentMembers(roomId);

        const subscription = client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
            const receivedMessage = JSON.parse(message.body);
            const normalized = normalizeMessage(receivedMessage);
            if (normalized) {
                setMessages((prev) => {
                    if (prev.find(m => m.id === normalized.id)) return prev;
                    return [...prev, normalized];
                });
            }
        });

        api.patch(`/chat/room/${roomId}/read`).catch(console.error);
        return () => { subscription.unsubscribe(); };
    }, [isConnected, currentRoom]);

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        const myId = user.member_id || user.memberId;
        const text = newMessage.trim();
        
        if (!text || !client || !isConnected || !roomId) {
            if (!isConnected) toast.error("채팅 서버와 연결이 끊겼습니다.");
            return;
        }

        const messagePayload = {
            roomId: Number(roomId),
            senderId: Number(myId),
            message: text,
            type: "TALK"
        };

        try {
            // Optimistic Update
            const optimisticMsg = normalizeMessage({
                ...messagePayload,
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
            console.error("Send failed", err);
            toast.error("메시지 전송 실패");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        const client = stompClientRef.current;
        const roomId = getRoomId(currentRoom);
        if (!file || !roomId || !client || !isConnected) return;

        const myId = user.member_id || user.memberId;
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await uploadFiles(`/chat/room/${roomId}/file`, formData);
            const fileUrl = response.data?.url || response.data;
            const messagePayload = {
                roomId: Number(roomId),
                senderId: Number(myId),
                message: fileUrl,
                type: "FILE"
            };
            client.publish({
                destination: "/pub/chat/message",
                body: JSON.stringify(messagePayload)
            });
        } catch (error) {
            toast.error("파일 업로드 실패");
        }
    };

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
            fetchCurrentMembers(roomId); // 멤버 목록 즉시 갱신
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

    const displayedMembers = memberSearch.trim().length > 0 ? foundMembers : recommendedMembers;

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* 사이드바 */}
            <div className={`${isSidebarOpen ? "w-80" : "w-0"} transition-all duration-300 border-r flex flex-col bg-slate-50`}>
                <div className="p-4 border-b bg-white flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary-600" />채팅방</h2>
                    <div className="flex gap-1">
                        <button onClick={fetchRooms} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><RefreshCw className={`h-4 w-4 ${loadingRooms ? 'animate-spin' : ''}`} /></button>
                        <button onClick={() => { resetMemberSelection(); setShowCreateModal(true); }} className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"><Plus className="h-5 w-5" /></button>
                    </div>
                </div>
                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input type="text" placeholder="방 이름 검색..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingRooms ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : (rooms && rooms.length > 0) ? (
                        <div className="space-y-1 p-2">
                            {rooms.map((room) => {
                                const roomId = getRoomId(room);
                                const isActive = getRoomId(currentRoom) === roomId;
                                return (
                                    <button key={roomId || Math.random()} onClick={() => { setCurrentRoom(room); setMessages([]); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? "bg-primary-600 text-white shadow-md" : "hover:bg-white hover:shadow-sm text-slate-700"}`}>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${isActive ? "bg-white/20" : "bg-primary-100 text-primary-700"}`}>
                                            {room.type === "PERSONAL" ? <User className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="font-bold truncate">{room.title}</span>
                                                {(room.unread_count > 0 || room.unreadCount > 0) && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white text-primary-600" : "bg-red-500 text-white"}`}>{room.unread_count || room.unreadCount}</span>}
                                            </div>
                                            <div className={`text-xs truncate ${isActive ? "text-white/80" : "text-slate-500"}`}>{room.last_message || room.lastMessage || "대화 내용이 없습니다."}</div>
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
                                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
                                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                                    {currentRoom.type === "PERSONAL" ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{currentRoom.title}</h3>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></span>{isConnected ? "실시간 연결됨" : "연결 끊김"}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowMemberList(!showMemberList)} className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-bold ${showMemberList ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                                    <Users className="h-4 w-4" /><span className="hidden sm:inline">{currentMembers.length}</span>
                                </button>
                                {currentRoom.type === "GROUP" && (
                                    <button onClick={() => { resetMemberSelection(); setShowInviteModal(true); }} className="p-2 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 flex items-center gap-1.5 text-sm font-bold">
                                        <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">초대</span>
                                    </button>
                                )}
                                <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><MoreVertical className="h-5 w-5" /></button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden relative">
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                                    {loadingMessages ? <div className="h-full flex items-center justify-center"><LoadingSpinner text="메시지 로드 중..." /></div> : messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2"><MessageSquare className="h-12 w-12 opacity-20" /><p className="text-sm font-medium">대화를 시작해보세요!</p></div>
                                    ) : messages.map((msg, idx) => {
                                        const normalized = normalizeMessage(msg);
                                        const isMe = Number(normalized.senderId) === Number(user.member_id || user.memberId);
                                        return (
                                            <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                <div className={`flex max-w-[80%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
                                                    {!isMe && <div className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-600">{normalized.senderName?.charAt(0).toUpperCase()}</div>}
                                                    <div className="flex flex-col">
                                                        {!isMe && <span className="text-[10px] text-slate-500 mb-1 ml-1">{normalized.senderName}</span>}
                                                        <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? "bg-primary-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"}`}>
                                                            {normalized.type === "FILE" ? <img src={normalized.message} alt="파일" className="max-w-xs rounded-lg cursor-pointer" onClick={() => window.open(normalized.message)} /> : normalized.message}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 pb-1">{formatRelativeTime(new Date(normalized.createdAt))}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="p-4 border-t bg-white">
                                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><ImageIcon className="h-5 w-5" /></button>
                                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                                        <div className="flex-1 relative">
                                            <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="메시지를 입력하세요..." className="w-full pl-4 pr-12 py-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 resize-none max-h-32" rows="1" />
                                            <button type="submit" disabled={!newMessage.trim() || !isConnected} className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all ${ (newMessage.trim() && isConnected) ? "bg-primary-600 text-white shadow-md" : "bg-slate-200 text-slate-400" }`}><Send className="h-4 w-4" /></button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            {showMemberList && (
                                <div className="w-64 border-l bg-white flex flex-col animate-slide-in-right">
                                    <div className="p-4 border-b flex items-center justify-between bg-slate-50"><h4 className="font-bold text-sm text-slate-900">참여자 ({currentMembers.length})</h4><button onClick={() => setShowMemberList(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors"><X className="h-4 w-4" /></button></div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {loadingMembers ? <div className="p-8 flex justify-center"><LoadingSpinner size="sm" /></div> : currentMembers.length === 0 ? <div className="p-4 text-center text-xs text-slate-400">참여자 정보가 없습니다.</div> : currentMembers.map(m => {
                                            const isMe = (m.member_id || m.memberId) === (user?.member_id || user?.memberId);
                                            return (
                                                <div key={m.member_id || m.memberId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">{m.name?.charAt(0).toUpperCase()}</div>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-6 border-b flex items-center justify-between bg-primary-600 text-white">
                            <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-white/20">{showCreateModal ? <MessageSquare className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}</div><h3 className="text-xl font-bold">{showCreateModal ? "새 채팅방 만들기" : "멤버 초대하기"}</h3></div>
                            <button onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            {showCreateModal && (<div><label className="block text-sm font-bold text-slate-700 mb-2">채팅방 제목</label><input type="text" value={newRoomTitle} onChange={(e) => setNewRoomTitle(e.target.value)} placeholder="예: 개발팀 회의실" className="input-base" /></div>)}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">멤버 선택{memberSearch.trim().length === 0 && <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 전체 멤버 목록</span>}</label>
                                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input type="text" value={memberSearch} onChange={handleSearchChange} placeholder="이름 또는 이메일 검색..." className="input-base pl-10" /></div>
                                <div className="mt-3 max-h-56 overflow-y-auto space-y-1 border rounded-2xl p-1 bg-slate-50/50">
                                    {searching ? <div className="p-8 text-center"><LoadingSpinner size="sm" text="검색 중..." /></div> : displayedMembers.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">{memberSearch.trim().length > 0 ? "검색 결과가 없습니다." : "불러올 수 있는 멤버가 없습니다."}</div> : displayedMembers.map(m => {
                                        const mId = m.member_id || m.memberId;
                                        const isSelected = selectedMembers.find(sm => (sm.member_id || sm.memberId) === mId);
                                        return (
                                            <button key={mId} onClick={() => toggleMemberSelection(m)} className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition-all ${isSelected ? "bg-primary-600 text-white shadow-md" : "hover:bg-white hover:shadow-sm"}`}>
                                                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isSelected ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>{m.name?.charAt(0).toUpperCase()}</div><div className="text-left"><div className="font-bold">{m.name}</div><div className={`text-[10px] ${isSelected ? "text-white/70" : "text-slate-400"}`}>{m.email}</div></div></div>
                                                {isSelected && <Check className="h-5 w-5" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {selectedMembers.length > 0 && (<div className="space-y-2"><div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">선택됨 ({selectedMembers.length})</div><div className="flex flex-wrap gap-2">{selectedMembers.map(m => (<div key={m.member_id || m.memberId} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-xl text-xs font-bold animate-fade-in"><span>{m.name}</span><button onClick={() => toggleMemberSelection(m)} className="p-0.5 hover:bg-primary-200 rounded-lg transition-colors"><X className="h-3.5 w-3.5" /></button></div>))}</div></div>)}
                        </div>
                        <div className="p-6 bg-slate-50 flex gap-3">
                            <button onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors">취소</button>
                            <button onClick={showCreateModal ? createRoom : inviteMembers} disabled={selectedMembers.length === 0} className={`flex-1 px-4 py-3 rounded-2xl font-bold transition-all shadow-lg ${selectedMembers.length > 0 ? "bg-primary-600 text-white hover:bg-primary-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>{showCreateModal ? "채팅방 생성" : "멤버 초대"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
