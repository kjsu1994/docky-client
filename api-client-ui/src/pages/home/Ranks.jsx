import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, Heart, Award, Crown, Medal, Star } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { EmptyState } from "../../components/EmptyState.jsx";
import { formatNumber } from "../../utils/helpers.js";
import { normalizeProfileImageUrl } from "../../utils/profileImage.js";
import { BOARD_RANK_TYPES, rankErrorMessage, ranksAdapter } from "../../adapters/ranksAdapter.js";

const tabs = [
    { key: "boards", label: "게시판 랭킹", icon: TrendingUp },
    { key: "level", label: "레벨 랭킹", icon: Award },
];

export const Ranks = () => {
    const [activeTab, setActiveTab] = useState("boards");
    const [boardRankType, setBoardRankType] = useState("FREE_BOARD");
    const [ranks, setRanks] = useState({ boards: [], level: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const requestSeqRef = useRef(0);

    const activeLabel = useMemo(() => {
        if (activeTab === "boards") {
            return BOARD_RANK_TYPES.find((type) => type.value === boardRankType)?.label || "게시판";
        }
        return tabs.find((tab) => tab.key === activeTab)?.label || "랭킹";
    }, [activeTab, boardRankType]);

    const fetchRanks = useCallback(async () => {
        const requestId = requestSeqRef.current + 1;
        requestSeqRef.current = requestId;
        setLoading(true);
        setError("");
        try {
            if (activeTab === "boards") {
                const items = await ranksAdapter.fetchBoardRanks(boardRankType);
                if (requestSeqRef.current === requestId) {
                    setRanks((current) => ({ ...current, boards: items }));
                }
                return;
            }
            const items = await ranksAdapter.fetchLevelRanks();
            if (requestSeqRef.current === requestId) {
                setRanks((current) => ({ ...current, level: items }));
            }
        } catch (err) {
            if (requestSeqRef.current !== requestId) return;
            const fallback = activeTab === "boards" ? "게시판 랭킹을 불러오지 못했습니다."
                : "레벨 랭킹을 불러오지 못했습니다.";
            setError(rankErrorMessage(err, fallback));
        } finally {
            if (requestSeqRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [activeTab, boardRankType]);

    useEffect(() => {
        fetchRanks();
    }, [fetchRanks]);

    const currentRanks = activeTab === "boards" ? ranks.boards : ranks.level;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">랭킹</h1>
                            <p className="text-sm font-medium text-slate-500">커뮤니티 인기 게시글과 활발한 멤버를 확인하세요.</p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                        {activeLabel} {currentRanks.length ? `${currentRanks.length}건` : "조회 중"}
                    </div>
                </div>
            </div>

            <div className="card p-2">
                <div className="grid grid-cols-2 gap-2">
                    {tabs.map((tab) => (
                        <TabButton
                            key={tab.key}
                            active={activeTab === tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            icon={tab.icon}
                        >
                            {tab.label}
                        </TabButton>
                    ))}
                </div>
            </div>

            {activeTab === "boards" ? (
                <div className="card p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {BOARD_RANK_TYPES.map((type) => (
                            <BoardTypeButton
                                key={type.value}
                                active={boardRankType === type.value}
                                onClick={() => setBoardRankType(type.value)}
                            >
                                {type.label}
                            </BoardTypeButton>
                        ))}
                    </div>
                </div>
            ) : null}

            {loading ? <LoadingSpinner text="랭킹을 불러오는 중..." /> : null}
            {!loading && error ? <ErrorMessage message={error} onRetry={fetchRanks} /> : null}

            {!loading && !error ? (
                <div className="card overflow-hidden">
                    {activeTab === "boards" ? <BoardRankList ranks={ranks.boards} /> : null}
                    {activeTab === "level" ? <LevelRankList ranks={ranks.level} /> : null}
                </div>
            ) : null}
        </div>
    );
};

const TabButton = ({ active, onClick, icon: Icon, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-all sm:gap-2 sm:px-3 sm:text-sm ${
            active ? "bg-slate-900 text-white shadow-lg" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
    >
        <Icon className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
        <span className="truncate">{children}</span>
    </button>
);

const BoardTypeButton = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
            active ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
    >
        {children}
    </button>
);

const RankBadge = ({ rank }) => {
    const icon = rank === 1 ? <Crown className="h-5 w-5" />
        : rank === 2 || rank === 3 ? <Medal className="h-5 w-5" />
            : <Star className="h-4 w-4" />;
    const color = rank === 1 ? "bg-amber-500 text-white"
        : rank === 2 ? "bg-slate-400 text-white"
            : rank === 3 ? "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-700";
    return (
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold shadow-sm ${color}`}>
            {rank <= 3 ? icon : rank}
        </div>
    );
};

const BoardRankList = ({ ranks }) => {
    if (!ranks.length) {
        return <EmptyRank message="랭킹에 표시할 게시글이 없습니다." />;
    }
    return (
        <div className="divide-y divide-slate-100">
            {ranks.map((board, index) => (
                <Link
                    key={board.id}
                    to={`/app/boards/${board.kind}/${board.id}`}
                    className={`block p-5 transition-colors ${index < 3 ? "bg-amber-50/40" : "hover:bg-slate-50"}`}
                >
                    <div className="flex items-start gap-4">
                        <RankBadge rank={index + 1} />
                        <div className="min-w-0 flex-1">
                            <h3 className="mb-2 line-clamp-2 text-lg font-bold text-slate-900">{board.title}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1"><Heart className="h-4 w-4 text-rose-500" />좋아요 {formatNumber(board.likeCount)}</span>
                                <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-blue-500" />조회 {formatNumber(board.viewCount)}</span>
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
};

const LevelRankList = ({ ranks }) => {
    if (!ranks.length) {
        return <EmptyRank message="랭킹에 표시할 레벨 데이터가 없습니다." />;
    }
    return (
        <div className="divide-y divide-slate-100">
            {ranks.map((member, index) => (
                <MemberRankRow
                    key={member.id}
                    rank={index + 1}
                    name={member.name}
                    profileUrl={member.profileUrl}
                    accent="purple"
                    title={`Lv. ${member.level}`}
                    detail={`누적 경험치 ${formatNumber(member.totalExp)}`}
                    progress={member.progressPercent}
                />
            ))}
        </div>
    );
};

const MemberRankRow = ({ rank, name, profileUrl, title, detail, progress, accent }) => {
    const imageUrl = normalizeProfileImageUrl(profileUrl);
    const accentClass = accent === "emerald" ? "from-emerald-400 to-emerald-600" : "from-purple-400 to-purple-600";
    return (
        <div className={`p-5 transition-colors ${rank <= 3 ? "bg-slate-50" : "hover:bg-slate-50"}`}>
            <div className="flex items-center gap-4">
                <RankBadge rank={rank} />
                <div className="flex-shrink-0">
                    {imageUrl ? (
                        <img src={imageUrl} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm" />
                    ) : (
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${accentClass} font-bold text-white`}>
                            {String(name || "익").charAt(0)}
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-slate-900">{name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">{title}</span>
                        <span>{detail}</span>
                    </div>
                    {Number.isFinite(progress) && progress > 0 ? (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-purple-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const EmptyRank = ({ message }) => (
    <div className="p-8">
        <EmptyState message={message} subMessage="활동이 쌓이면 이곳에 자동으로 표시됩니다." />
    </div>
);

export default Ranks;
