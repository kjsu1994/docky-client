import { Link } from "react-router-dom";
import { ArrowRight, Dices, Sparkles } from "lucide-react";

const games = [
    {
        title: "플링코",
        description: "혼자 플레이하는 캐쥬얼 게임",
        to: "/app/plinko",
        tone: "from-emerald-500 via-teal-500 to-cyan-500",
    },
    {
        title: "라스베거스",
        description: "2~6인 실시간 방 입장형 보드게임",
        to: "/app/games/las-vegas",
        tone: "from-amber-500 via-orange-500 to-rose-500",
    },
];

export const GamesHub = () => {
    return (
        <div className="animate-fade-in space-y-8">
            <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/60">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-100 blur-3xl" />
                <div className="absolute -bottom-20 left-0 h-48 w-48 rounded-full bg-amber-100 blur-3xl" />
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                        <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                        Game Select
                    </div>
                    <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">게임을 선택하세요</h1>
                    <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
                        원하는 게임을 선택해서 바로 이동할 수 있습니다.
                    </p>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {games.map((game) => (
                    <Link
                        key={game.to}
                        to={game.to}
                        className={`group relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${game.tone} p-[1px] shadow-2xl transition-transform duration-300 hover:-translate-y-1`}
                    >
                        <div className="h-full rounded-[calc(2.5rem-1px)] bg-white/95 p-7 backdrop-blur">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-slate-900 text-white shadow-lg">
                                <Dices className="h-7 w-7" />
                            </div>
                            <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900">{game.title}</h2>
                            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">{game.description}</p>
                            <div className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition-all group-hover:bg-primary-600">
                                입장하기
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </div>
                    </Link>
                ))}
            </section>
        </div>
    );
};

export default GamesHub;
