import { lazy, Suspense, useState } from "react";
import { Bath, Car, Library, Shield, Stethoscope } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";

const ParkingFinder = lazy(() => import("./ParkingFinder.jsx").then((module) => ({ default: module.ParkingFinder })));
const RestroomFinder = lazy(() => import("./RestroomFinder.jsx").then((module) => ({ default: module.RestroomFinder })));
const LibraryFinder = lazy(() => import("./LibraryFinder.jsx").then((module) => ({ default: module.LibraryFinder })));
const BunkerFinder = lazy(() => import("./BunkerFinder.jsx").then((module) => ({ default: module.BunkerFinder })));
const MedicalFinder = lazy(() => import("./MedicalFinder.jsx").then((module) => ({ default: module.MedicalFinder })));

export const FacilityFinder = () => {
    const [activeTab, setActiveTab] = useState("parking");

    return (
        <div className="space-y-6 pb-10">
            <div className="surface-panel p-5 sm:p-6">
                <h1 className="text-2xl font-black text-slate-900">주변 찾기</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">다양한 편의시설들을 같은 화면에서 전환하며 검색할 수 있습니다.</p>
                <div className="mt-4 grid gap-1 rounded-control bg-control p-1 sm:inline-grid sm:grid-cols-5">
                    <button type="button" onClick={() => setActiveTab("parking")} className={`flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-black transition-all ${activeTab === "parking" ? "bg-surface text-primary-700 shadow-card" : "text-slate-500 hover:bg-control-hover"}`}>
                        <Car className="h-4 w-4" /> 주차장
                    </button>
                    <button type="button" onClick={() => setActiveTab("restroom")} className={`flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-black transition-all ${activeTab === "restroom" ? "bg-surface text-cyan-700 shadow-card" : "text-slate-500 hover:bg-control-hover"}`}>
                        <Bath className="h-4 w-4" /> 화장실
                    </button>
                    <button type="button" onClick={() => setActiveTab("library")} className={`flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-black transition-all ${activeTab === "library" ? "bg-surface text-emerald-700 shadow-card" : "text-slate-500 hover:bg-control-hover"}`}>
                        <Library className="h-4 w-4" /> 도서관
                    </button>
                    <button type="button" onClick={() => setActiveTab("bunker")} className={`flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-black transition-all ${activeTab === "bunker" ? "bg-surface text-teal-700 shadow-card" : "text-slate-500 hover:bg-control-hover"}`}>
                        <Shield className="h-4 w-4" /> 대피소
                    </button>
                    <button type="button" onClick={() => setActiveTab("medical")} className={`flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-black transition-all ${activeTab === "medical" ? "bg-surface text-rose-700 shadow-card" : "text-slate-500 hover:bg-control-hover"}`}>
                        <Stethoscope className="h-4 w-4" /> 의료시설
                    </button>
                </div>
            </div>

            <Suspense fallback={<div className="surface-panel p-10"><LoadingSpinner /></div>}>
                {activeTab === "parking" && <ParkingFinder />}
                {activeTab === "restroom" && <RestroomFinder />}
                {activeTab === "library" && <LibraryFinder />}
                {activeTab === "bunker" && <BunkerFinder />}
                {activeTab === "medical" && <MedicalFinder />}
            </Suspense>
        </div>
    );
};
