import { useState } from "react";
import { Bath, Car, Library, Shield } from "lucide-react";
import { ParkingFinder } from "./ParkingFinder";
import { RestroomFinder } from "./RestroomFinder";
import { LibraryFinder } from "./LibraryFinder";
import { BunkerFinder } from "./BunkerFinder";

export const FacilityFinder = () => {
    const [activeTab, setActiveTab] = useState("parking");

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-black text-slate-900">편의시설 찾기</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">주차장, 화장실, 도서관, 대피소를 같은 화면에서 탭으로 전환해 검색할 수 있습니다.</p>
                <div className="mt-4 inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
                    <button type="button" onClick={() => setActiveTab("parking")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${activeTab === "parking" ? "bg-white text-primary-700 shadow" : "text-slate-500"}`}>
                        <Car className="h-4 w-4" /> 주차장
                    </button>
                    <button type="button" onClick={() => setActiveTab("restroom")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${activeTab === "restroom" ? "bg-white text-cyan-700 shadow" : "text-slate-500"}`}>
                        <Bath className="h-4 w-4" /> 화장실
                    </button>
                    <button type="button" onClick={() => setActiveTab("library")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${activeTab === "library" ? "bg-white text-emerald-700 shadow" : "text-slate-500"}`}>
                        <Library className="h-4 w-4" /> 도서관
                    </button>
                    <button type="button" onClick={() => setActiveTab("bunker")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${activeTab === "bunker" ? "bg-white text-teal-700 shadow" : "text-slate-500"}`}>
                        <Shield className="h-4 w-4" /> 대피소
                    </button>
                </div>
            </div>

            {activeTab === "parking" && <ParkingFinder />}
            {activeTab === "restroom" && <RestroomFinder />}
            {activeTab === "library" && <LibraryFinder />}
            {activeTab === "bunker" && <BunkerFinder />}
        </div>
    );
};
