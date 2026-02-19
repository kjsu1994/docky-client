import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    Sparkles,
    TreePine,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { formatNumber, stripHtmlTags } from "../utils/helpers";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";

// API 응답에서 실제 데이터를 추출하는 헬퍼 함수
const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

// API 응답의 게시글 데이터를 정규화하는 함수
const normalizeBoards = (response) => {
    const data = unwrapData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.content)) return data.content;
    return [];
};

// 게시글 객체에서 게시판 종류를 식별하는 함수
const toBoardKind = (board) =>
    board?.kind_of_board || board?.kindOfBoard || board?.kind || "FREE_BOARD";

// 홈 페이지 컴포넌트
export const Home = () => {
    const { user } = useAuth();
    const [recentBoards, setRecentBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // 컴포넌트 마운트 시 최신 게시글 데이터를 가져오는 효과
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                // 여러 게시판의 최신 게시글을 동시에 가져옴
                const [freeRes, noticeRes, qaRes] = await Promise.all([
                    api.get("/boards", { params: { kind: "FREE_BOARD", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "ADMIN_NOTICE", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "QUESTION_ANSWER", page: 0, size: 3 } }),
                ]);

                // 가져온 게시글들을 최신순으로 정렬
                const boardItems = [
                    ...normalizeBoards(freeRes),
                    ...normalizeBoards(noticeRes),
                    ...normalizeBoards(qaRes),
                ].sort((a, b) => {
                    const aDate = new Date(a?.created_at || a?.createdAt || 0).getTime();
                    const bDate = new Date(b?.created_at || b?.createdAt || 0).getTime();
                    return bDate - aDate;
                });

                setRecentBoards(boardItems.slice(0, 6));
            } catch (fetchError) {
                console.error("Failed to fetch home data:", fetchError);
                setError(fetchError?.response?.data?.message || "홈 데이터를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <LoadingSpinner text="홈 데이터 로딩 중..." />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div className="space-y-8">
            {/* 환영 메시지 카드 */}
            <div className="card p-8 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">
                        환영합니다, {user?.name || user?.email}님!
                    </h1>
                </div>
                <p className="text-primary-100 text-lg">
                    커뮤니티 활동을 통해 포인트를 쌓고 레벨을 올려보세요.
                </p>
            </div>

            {/* 바로가기 링크 섹션 */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                    바로가기
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <QuickLink to="/app/boards/FREE_BOARD" title="자유게시판" description="자유롭게 이야기를 나눠요" color="blue" />
                    <QuickLink to="/app/boards/QUESTION_ANSWER" title="Q&A 게시판" description="질문과 답변을 자유롭게 나눠요" color="green" />
                    <QuickLink to="/app/plinko" title="럭키플링코" description="행운의 주사위와 플링코 게임" color="emerald" />
                    <QuickLink to="/app/gpt" title="GPT 질문" description="AI 기반 똑똑한 답변 받기" color="teal" />
                </div>
            </div>

            {/* 최신 게시글 목록 섹션 */}
            {recentBoards.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900">최근 게시글</h2>
                        <Link
                            to="/app/boards/FREE_BOARD"
                            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                            전체보기
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recentBoards.map((board) => (
                            <Link
                                key={board.board_id || board.boardId}
                                to={`/app/boards/${toBoardKind(board)}/${board.board_id || board.boardId}`}
                                className="card p-5 hover:shadow-lg transition-all"
                            >
                                <h3 className="font-semibold text-slate-900 mb-2 line-clamp-1">
                                    {board.title}
                                </h3>
                                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                    {stripHtmlTags(board.contents || board.content || "")}
                                </p>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{board.board_creator || board.boardCreator || "익명"}</span>
                                    <span>조회 {formatNumber(board.view_count || board.viewCount || 0)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// 바로가기 링크 카드 컴포넌트
const QuickLink = ({ to, title, description, color }) => {
    const colors = {
        blue: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
        green: "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
        emerald: "from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
        teal: "from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700",
    };

    return (
        <Link
            to={to}
            className={`card p-6 bg-gradient-to-br ${colors[color]} text-white hover:shadow-lg transition-all group`}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">{title}</h3>
                {title === "녹색활동" && <TreePine className="h-5 w-5 text-white/90" />}
            </div>
            <p className="text-sm text-white/90 mb-4">{description}</p>
            <div className="flex items-center gap-2 text-sm font-medium">
                바로가기
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
        </Link>
    );
};

export default Home;
