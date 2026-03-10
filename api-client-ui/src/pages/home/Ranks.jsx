import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, Heart, Award, Crown, Medal, Star } from "lucide-react";
import api from "../../utils/api.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { formatNumber } from "../../utils/helpers.js";
import { normalizeProfileImageUrl } from "../../utils/profileImage.js";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

const normalizeList = (response) => {
    const data = unwrapData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.content)) return data.content;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.ranks)) return data.ranks;
    return [];
};

const getErrorMessage = (error, fallbackMessage) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    if (status) {
        return `${fallbackMessage} (HTTP ${status}${message ? `: ${message}` : ""})`;
    }
    return fallbackMessage;
};

const fetchWithFallbackEndpoints = async (endpoints) => {
    let lastError = null;
    for (const endpoint of endpoints) {
        try {
            const response = await api.get(endpoint);
            return normalizeList(response);
        } catch (error) {
            lastError = error;
            const status = error?.response?.status;
            if (status === 404) continue;
            if (endpoints[endpoints.length - 1] !== endpoint) continue;
            throw error;
        }
    }
    if (lastError) throw lastError;
    return [];
};

export const Ranks = () => {
    const [activeTab, setActiveTab] = useState("boards");
    const [boardRankType, setBoardRankType] = useState("FREE_BOARD");
    const [boardRanks, setBoardRanks] = useState([]);
    const [levelRanks, setLevelRanks] = useState([]);
    const [donationRanks, setDonationRanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryKey, setRetryKey] = useState(0);
    
    const lastBoardFetchRef = useRef("");
    const lastLevelFetchRef = useRef(-1);
    const lastDonationFetchRef = useRef(-1);

    useEffect(() => {
        if (activeTab !== "boards") return;
        const currentFetchKey = `${boardRankType}-${retryKey}`;
        if (lastBoardFetchRef.current === currentFetchKey) return;

        const fetchBoardRanks = async () => {
            setLoading(true);
            setError("");
            try {
                try {
                    const response = await api.get("/boards/rankBoards", { params: { kind: boardRankType } });
                    lastBoardFetchRef.current = currentFetchKey;
                    setBoardRanks(normalizeList(response));
                } catch (primaryError) {
                    if (primaryError?.response?.status !== 404) throw primaryError;
                    let fallbackEndpoint = "";
                    switch (boardRankType) {
                        case "FREE_BOARD": fallbackEndpoint = "/boards/rankFreeBoards"; break;
                        case "ADMIN_NOTICE": fallbackEndpoint = "/boards/rankNoticeBoards"; break;
                        case "QUESTION_ANSWER": fallbackEndpoint = "/boards/rankEcoBoards"; break;
                        default: fallbackEndpoint = "/boards/rankFreeBoards"; break;
                    }
                    const fallbackResponse = await api.get(fallbackEndpoint);
                    lastBoardFetchRef.current = currentFetchKey;
                    setBoardRanks(normalizeList(fallbackResponse));
                }
            } catch (err) {
                setError(getErrorMessage(err, "게시판 랭킹 로딩 실패"));
            } finally { setLoading(false); }
        };
        fetchBoardRanks();
    }, [activeTab, boardRankType, retryKey]);

    useEffect(() => {
        if (activeTab !== "level") return;
        if (lastLevelFetchRef.current === retryKey) return;
        const fetchLevelRanks = async () => {
            setLoading(true); setError("");
            try {
                const ranks = await fetchWithFallbackEndpoints(["/members/levelRanks", "/members/level-ranks"]);
                lastLevelFetchRef.current = retryKey;
                setLevelRanks(ranks);
            } catch (err) { setError(getErrorMessage(err, "레벨 랭킹 로딩 실패")); }
            finally { setLoading(false); }
        };
        fetchLevelRanks();
    }, [activeTab, retryKey]);

    useEffect(() => {
        if (activeTab !== "donation") return;
        if (lastDonationFetchRef.current === retryKey) return;
        const fetchDonationRanks = async () => {
            setLoading(true); setError("");
            try {
                const response = await api.get("/members/donationRanks");
                lastDonationFetchRef.current = retryKey;
                setDonationRanks(normalizeList(response));
            } catch (err) { setError(getErrorMessage(err, "기부 랭킹 로딩 실패")); }
            finally { setLoading(false); }
        };
        fetchDonationRanks();
    }, [activeTab, retryKey]);

    const getRankIcon = (rank) => {
        if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
        if (rank === 2) return <Medal className="h-6 w-6 text-slate-400" />;
        if (rank === 3) return <Medal className="h-6 w-6 text-orange-600" />;
        return <Star className="h-5 w-5 text-slate-400" />;
    };

    const getRankBadgeColor = (rank) => {
        if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
        if (rank === 2) return "bg-gradient-to-r from-slate-300 to-slate-500 text-white";
        if (rank === 3) return "bg-gradient-to-r from-orange-400 to-orange-600 text-white";
        return "bg-slate-100 text-slate-700";
    };

    return (
        <div className="space-y-6">
            <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <Trophy className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">랭킹</h1>
                </div>
                <p className="text-purple-100">커뮤니티 TOP 멤버와 인기 게시글을 확인하세요</p>
            </div>

            <div className="card p-2">
                <div className="flex gap-2">
                    <TabButton active={activeTab === "boards"} onClick={() => setActiveTab("boards")} icon={TrendingUp}>게시판 랭킹</TabButton>
                    <TabButton active={activeTab === "level"} onClick={() => setActiveTab("level")} icon={Award}>레벨 랭킹</TabButton>
                    <TabButton active={activeTab === "donation"} onClick={() => setActiveTab("donation")} icon={Heart}>기부 랭킹</TabButton>
                </div>
            </div>

            {activeTab === "boards" && (
                <div className="card p-4">
                    <div className="flex gap-2">
                        <BoardTypeButton active={boardRankType === "FREE_BOARD"} onClick={() => setBoardRankType("FREE_BOARD")}>사용자게시판</BoardTypeButton>
                        <BoardTypeButton active={boardRankType === "ADMIN_NOTICE"} onClick={() => setBoardRankType("ADMIN_NOTICE")}>공지사항</BoardTypeButton>
                        <BoardTypeButton active={boardRankType === "QUESTION_ANSWER"} onClick={() => setBoardRankType("QUESTION_ANSWER")}>Q&A 게시판</BoardTypeButton>
                    </div>
                </div>
            )}

            {loading && <LoadingSpinner text="로딩 중..." />}
            {error && <ErrorMessage message={error} onRetry={() => { setError(""); setRetryKey(prev => prev + 1); }} />}

            {!loading && !error && (
                <div className="card overflow-hidden">
                    {activeTab === "boards" && <BoardRankList ranks={boardRanks} getRankIcon={getRankIcon} getRankBadgeColor={getRankBadgeColor} />}
                    {activeTab === "level" && <LevelRankList ranks={levelRanks} getRankIcon={getRankIcon} getRankBadgeColor={getRankBadgeColor} />}
                    {activeTab === "donation" && <DonationRankList ranks={donationRanks} getRankIcon={getRankIcon} getRankBadgeColor={getRankBadgeColor} />}
                </div>
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, icon: Icon, children }) => (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${active ? "bg-purple-600 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
        <Icon className="h-5 w-5" /><span className="hidden sm:inline">{children}</span>
    </button>
);

const BoardTypeButton = ({ active, onClick, children }) => (
    <button onClick={onClick} className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${active ? "bg-purple-100 text-purple-700 border-2 border-purple-600" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>{children}</button>
);

const BoardRankList = ({ ranks, getRankIcon, getRankBadgeColor }) => {
    if (!ranks?.length) return <div className="p-12 text-center text-slate-500">데이터가 없습니다.</div>;
    return (
        <div className="divide-y">
            {ranks.map((board, index) => (
                <Link key={board.board_id || board.boardId} to={`/app/boards/${board.kind_of_board || board.kindOfBoard || "FREE_BOARD"}/${board.board_id || board.boardId}`} className={`p-6 transition-colors ${index < 3 ? "bg-gradient-to-r from-slate-50 to-transparent" : "hover:bg-slate-50"} block`}>
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getRankBadgeColor(index + 1)} flex items-center justify-center font-bold text-lg shadow-md`}>{index < 3 ? getRankIcon(index + 1) : index + 1}</div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2">{board.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                                <div className="flex items-center gap-1"><Heart className="h-4 w-4 text-red-500" /><span>{formatNumber(board.like_count || board.likeCount)}</span></div>
                                <div className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-blue-500" /><span>{formatNumber(board.view_count || board.viewCount)}</span></div>
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
};

const LevelRankList = ({ ranks, getRankIcon, getRankBadgeColor }) => {
    if (!ranks?.length) return <div className="p-12 text-center text-slate-500">데이터가 없습니다.</div>;
    return (
        <div className="divide-y">
            {ranks.map((item, index) => (
                <div key={index} className={`p-6 transition-colors ${index < 3 ? "bg-gradient-to-r from-slate-50 to-transparent" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getRankBadgeColor(index + 1)} flex items-center justify-center font-bold text-lg shadow-md`}>{index < 3 ? getRankIcon(index + 1) : index + 1}</div>
                        <div className="flex-shrink-0">
                            {normalizeProfileImageUrl(item.member?.profile_url || item.member?.profileUrl || "") ? <img src={normalizeProfileImageUrl(item.member?.profile_url || item.member?.profileUrl || "")} className="w-12 h-12 rounded-full object-cover border-2" /> : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold">{(item.member?.name || "U").charAt(0)}</div>}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 text-lg mb-1">{item.member?.name || "익명"}</h3>
                            <div className="flex items-center gap-4 text-sm"><div className="flex items-center gap-1"><Award className="h-4 w-4 text-purple-500" /><span className="font-semibold text-purple-700">Lv. {item.level}</span></div><div className="text-slate-600">EXP: {formatNumber(item.total_exp || item.totalExp)}</div></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const DonationRankList = ({ ranks, getRankIcon, getRankBadgeColor }) => {
    if (!ranks?.length) return <div className="p-12 text-center text-slate-500">데이터가 없습니다.</div>;
    return (
        <div className="divide-y">
            {ranks.map((member, index) => (
                <div key={index} className={`p-6 transition-colors ${index < 3 ? "bg-gradient-to-r from-green-50 to-transparent" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getRankBadgeColor(index + 1)} flex items-center justify-center font-bold text-lg shadow-md`}>{index < 3 ? getRankIcon(index + 1) : index + 1}</div>
                        <div className="flex-shrink-0">
                            {normalizeProfileImageUrl(member.profile_url || member.profileUrl || "") ? <img src={normalizeProfileImageUrl(member.profile_url || member.profileUrl || "")} className="w-12 h-12 rounded-full object-cover border-2" /> : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold">{(member.name || "U").charAt(0)}</div>}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 text-lg mb-1">{member.name}</h3>
                            <div className="flex items-center gap-4 text-sm"><div className="flex items-center gap-1"><Heart className="h-4 w-4 text-green-500 fill-green-500" /><span className="font-semibold text-green-700">{formatNumber(member.tree_count || member.treeCount)} Trees</span></div><div className="text-slate-600">Points: {formatNumber(member.point)}</div></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
