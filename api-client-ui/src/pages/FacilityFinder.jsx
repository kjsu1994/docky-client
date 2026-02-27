import { useState } from "react";
import { Car, Bath } from "lucide-react";
import { ParkingFinder } from "./ParkingFinder";
import { RestroomFinder } from "./RestroomFinder";

export const FacilityFinder = () => {
    const [activeTab, setActiveTab] = useState("parking");

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-black text-slate-900">편의시설 찾기</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">주차장/화장실을 같은 화면에서 탭으로 전환해 검색할 수 있습니다.</p>
                <div className="mt-4 inline-flex rounded-2xl bg-slate-100 p-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab("parking")}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${activeTab === "parking" ? "bg-white text-primary-700 shadow" : "text-slate-500"}`}
                    >
                        <Car className="h-4 w-4" /> 주차장
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("restroom")}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${activeTab === "restroom" ? "bg-white text-cyan-700 shadow" : "text-slate-500"}`}
                    >
                        <Bath className="h-4 w-4" /> 화장실
                    </button>
                </div>
            </div>

            {activeTab === "parking" ? <ParkingFinder /> : <RestroomFinder />}
        </div>
    );
};
