import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, Heart, Award, Crown, Medal, Star } from "lucide-react";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatNumber } from "../utils/helpers";

export const Ranks = () => {
    const [activeTab, setActiveTab] = useState("boards"); // boards, level, donation
    const [boardRankType, setBoardRankType] = useState("FREE_BOARD");
    const [boardRanks, setBoardRanks] = useState([]);
    const [levelRanks, setLevelRanks] = useState([]);
    const [donationRanks, setDonationRanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // 게시판 랭킹 불러오기
    useEffect(() => {
        if (activeTab !== "boards") return;

        const fetchBoardRanks = async () => {
            setLoading(true);
            setError("");
            try {
                let endpoint = "";
                switch (boardRankType) {
                    case "FREE_BOARD":
                        endpoint = "/boards/rankFreeBoards";
                        break;
                    case "ECO_REVIEW":
                        endpoint = "/boards/rankEcoBoards";
                        break;
                    case "GREEN_ACTIVE":
                        endpoint = "/boards/rankGreenBoards";
                        break;
                }
                const response = await api.get(endpoint);
                setBoardRanks(response.data?.data || response.data || []);
            } catch (err) {
                console.error("Failed to fetch board ranks:", err);
                setError("게시판 랭킹을 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchBoardRanks();
    }, [activeTab, boardRankType]);

    // 레벨 랭킹 불러오기
    useEffect(() => {
        if (activeTab !== "level") return;

        const fetchLevelRanks = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await api.get("/members/levelRanks");
                setLevelRanks(response.data?.data || response.data || []);
            } catch (err) {
                console.error("Failed to fetch level ranks:", err);
                setError("레벨 랭킹을 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchLevelRanks();
    }, [activeTab]);

    // 기부 랭킹 불러오기
    useEffect(() => {
        if (activeTab !== "donation") return;

        const fetchDonationRanks = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await api.get("/members/donationRanks");
                setDonationRanks(response.data?.data || response.data || []);
            } catch (err) {
                console.error("Failed to fetch donation ranks:", err);
                setError("기부 랭킹을 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchDonationRanks();
    }, [activeTab]);

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
            {/* 헤더 */}
            <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <Trophy className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">랭킹</h1>
                </div>
                <p className="text-purple-100">커뮤니티 TOP 멤버와 인기 게시글을 확인하세요</p>
            </div>

            {/* 탭 메뉴 */}
            <div className="card p-2">
                <div className="flex gap-2">
                    <TabButton
                        active={activeTab === "boards"}
                        onClick={() => setActiveTab("boards")}
                        icon={TrendingUp}
                    >
                        게시판 랭킹
                    </TabButton>
                    <TabButton
                        active={activeTab === "level"}
                        onClick={() => setActiveTab("level")}
                        icon={Award}
                    >
                        레벨 랭킹
                    </TabButton>
                    <TabButton
                        active={activeTab === "donation"}
                        onClick={() => setActiveTab("donation")}
                        icon={Heart}
                    >
                        기부 랭킹
                    </TabButton>
                </div>
            </div>

            {/* 게시판 서브 탭 */}
            {activeTab === "boards" && (
                <div className="card p-4">
                    <div className="flex gap-2">
                        <BoardTypeButton
                            active={boardRankType === "FREE_BOARD"}
                            onClick={() => setBoardRankType("FREE_BOARD")}
                        >
                            자유게시판
                        </BoardTypeButton>
                        <BoardTypeButton
                            active={boardRankType === "ECO_REVIEW"}
                            onClick={() => setBoardRankType("ECO_REVIEW")}
                        >
                            Q&A 게시판
                        </BoardTypeButton>
                        <BoardTypeButton
                            active={boardRankType === "GREEN_ACTIVE"}
                            onClick={() => setBoardRankType("GREEN_ACTIVE")}
                        >
                            녹색활동
                        </BoardTypeButton>
                    </div>
                </div>
            )}

            {/* 로딩 및 에러 처리 */}
            {loading && <LoadingSpinner text="랭킹 데이터 로딩 중..." />}
            {error && <ErrorMessage message={error} />}

            {/* 랭킹 리스트 */}
            {!loading && !error && (
                <div className="card overflow-hidden">
                    {activeTab === "boards" && (
                        <BoardRankList ranks={boardRanks} getRankIcon={getRankIcon} getRankBadgeColor={getRankBadgeColor} />
                    )}
                    {activeTab === "level" && (
                        <LevelRankList ranks={levelRanks} getRankIcon={getRankIcon} getRankBadgeColor={getRankBadgeColor} />
                    )}
                    {activeTab === "donation" && (
                        <DonationRankList ranks={donationRanks} getRankIcon={getRankIcon} getRankBadgeColor={getRankBadgeColor} />
                    )}
                </div>
            )}
        </div>
    );
};

// 탭 버튼 컴포넌트
const TabButton = ({ active, onClick, icon: Icon, children }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
            active
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
    >
        <Icon className="h-5 w-5" />
        <span className="hidden sm:inline">{children}</span>
    </button>
);

// 게시판 타입 버튼
const BoardTypeButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            active
                ? "bg-purple-100 text-purple-700 border-2 border-purple-600"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
        }`}
    >
        {children}
    </button>
);

// 게시판 랭킹 리스트
const BoardRankList = ({ ranks, getRankIcon, getRankBadgeColor }) => {
    if (ranks.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500">
                아직 랭킹 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="divide-y">
            {ranks.map((board, index) => {
                const rank = index + 1;
                return (
                    <Link
                        key={board.board_id || board.boardId}
                        to={`/app/boards/${board.kind_of_board || board.kindOfBoard || "FREE_BOARD"}/${board.board_id || board.boardId}`}
                        className={`p-6 transition-colors ${
                            rank <= 3 ? "bg-gradient-to-r from-slate-50 to-transparent" : "hover:bg-slate-50"
                        } block`}
                    >
                        <div className="flex items-start gap-4">
                            {/* 순위 */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getRankBadgeColor(rank)} flex items-center justify-center font-bold text-lg shadow-md`}>
                                {rank <= 3 ? getRankIcon(rank) : rank}
                            </div>

                            {/* 게시글 정보 */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2">
                                    {board.title}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-1">
                                        <Heart className="h-4 w-4 text-red-500" />
                                        <span className="font-semibold">{formatNumber(board.like_count || board.likeCount)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <TrendingUp className="h-4 w-4 text-blue-500" />
                                        <span>{formatNumber(board.view_count || board.viewCount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
};

// 레벨 랭킹 리스트
const LevelRankList = ({ ranks, getRankIcon, getRankBadgeColor }) => {
    if (ranks.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500">
                아직 랭킹 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="divide-y">
            {ranks.map((item, index) => {
                const rank = index + 1;
                return (
                    <div
                        key={item.member?.member_id || item.member?.memberId || index}
                        className={`p-6 transition-colors ${
                            rank <= 3 ? "bg-gradient-to-r from-slate-50 to-transparent" : "hover:bg-slate-50"
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            {/* 순위 */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getRankBadgeColor(rank)} flex items-center justify-center font-bold text-lg shadow-md`}>
                                {rank <= 3 ? getRankIcon(rank) : rank}
                            </div>

                            {/* 프로필 이미지 */}
                            <div className="flex-shrink-0">
                                {item.member?.profile_url || item.member?.profileUrl ? (
                                    <img
                                        src={item.member.profile_url || item.member.profileUrl}
                                        alt={item.member?.name || "프로필"}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                        {(item.member?.name || "U").charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* 회원 정보 */}
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 text-lg mb-1">
                                    {item.member?.name || "익명"}
                                </h3>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                        <Award className="h-4 w-4 text-purple-500" />
                                        <span className="font-semibold text-purple-700">Lv. {item.level}</span>
                                    </div>
                                    <div className="text-slate-600">
                                        총 경험치: <span className="font-semibold">{formatNumber(item.total_exp || item.totalExp)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// 기부 랭킹 리스트
const DonationRankList = ({ ranks, getRankIcon, getRankBadgeColor }) => {
    if (ranks.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500">
                아직 랭킹 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="divide-y">
            {ranks.map((member, index) => {
                const rank = index + 1;
                return (
                    <div
                        key={member.member_id || member.memberId}
                        className={`p-6 transition-colors ${
                            rank <= 3 ? "bg-gradient-to-r from-green-50 to-transparent" : "hover:bg-slate-50"
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            {/* 순위 */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${getRankBadgeColor(rank)} flex items-center justify-center font-bold text-lg shadow-md`}>
                                {rank <= 3 ? getRankIcon(rank) : rank}
                            </div>

                            {/* 프로필 이미지 */}
                            <div className="flex-shrink-0">
                                {member.profile_url || member.profileUrl ? (
                                    <img
                                        src={member.profile_url || member.profileUrl}
                                        alt={member.name || "프로필"}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                                        {(member.name || "U").charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* 회원 정보 */}
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 text-lg mb-1">
                                    {member.name || "익명"}
                                </h3>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                        <Heart className="h-4 w-4 text-green-500 fill-green-500" />
                                        <span className="font-semibold text-green-700">
                                            나무 {formatNumber(member.tree_count || member.treeCount)}그루
                                        </span>
                                    </div>
                                    <div className="text-slate-600">
                                        포인트: <span className="font-semibold">{formatNumber(member.point)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
