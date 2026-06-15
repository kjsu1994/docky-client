import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, Heart, Award, Crown, Medal, Star } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { EmptyState } from "../../components/EmptyState.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { formatNumber } from "../../utils/helpers.js";
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
            <div className="surface-card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-ink sm:text-3xl">랭킹</h1>
                            <p className="text-sm font-medium text-ink-muted">커뮤니티 인기 게시글과 활발한 멤버를 확인하세요.</p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-control px-3 py-2 text-sm font-bold text-ink-muted">
                        {activeLabel} {currentRanks.length ? `${currentRanks.length}건` : "조회 중"}
                    </div>
                </div>
            </div>

            <div className="surface-card p-2">
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
                <div className="surface-card p-3">
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
                <div className="surface-card overflow-hidden">
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
            active ? "bg-ink text-ink-inverse shadow-lg" : "bg-control text-ink-muted hover:bg-control-hover"
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
            active ? "border-amber-500 bg-amber-50 text-amber-800" : "border-line bg-surface text-ink-muted hover:bg-control"
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
                : "bg-control text-ink-muted";
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
        <div className="divide-y divide-line">
            {ranks.map((board, index) => (
                <Link
                    key={board.id}
                    to={`/app/boards/${board.kind}/${board.id}`}
                    className={`block p-5 transition-colors ${index < 3 ? "bg-amber-50/40" : "hover:bg-control"}`}
                >
                    <div className="flex items-start gap-4">
                        <RankBadge rank={index + 1} />
                        <div className="min-w-0 flex-1">
                            <h3 className="mb-2 line-clamp-2 text-lg font-bold text-ink">{board.title}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
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
        <div className="divide-y divide-line">
            {ranks.map((member, index) => (
                <MemberRankRow
                    key={member.id}
                    rank={index + 1}
                    name={member.name}
                    profileUrl={member.profileUrl}
                    level={member.level}
                    rewardTier={member.rewardTier}
                    frameCode={member.frameCode}
                    title={`Lv. ${member.level}${member.tierName || member.frameLabel ? ` · ${member.tierName || member.frameLabel}` : ""}`}
                    detail={`누적 경험치 ${formatNumber(member.totalExp)}`}
                    progress={member.progressPercent}
                />
            ))}
        </div>
    );
};

const MemberRankRow = ({ rank, name, profileUrl, level, rewardTier, frameCode, title, detail, progress }) => {
    return (
        <div className={`p-5 transition-colors ${rank <= 3 ? "bg-control" : "hover:bg-control"}`}>
            <div className="flex items-center gap-4">
                <RankBadge rank={rank} />
                <UserAvatar
                    name={name}
                    profileUrl={profileUrl}
                    level={level}
                    rewardTier={rewardTier}
                    frameCode={frameCode}
                    size="lg"
                    showLevelBadge
                />
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-ink">{name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                        <span className="font-semibold text-ink">{title}</span>
                        <span>{detail}</span>
                    </div>
                    {Number.isFinite(progress) && progress > 0 ? (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-control">
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
