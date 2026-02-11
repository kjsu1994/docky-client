import { useEffect, useState } from "react";
import http from "../api/http";

export default function Mypage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const memberId = localStorage.getItem("memberId");
        if (!memberId) {
            setError("memberId가 없습니다. 로그인 응답에서 member_id 저장을 확인하세요.");
            return;
        }

        (async () => {
            try {
                setError("");
                const res = await http.get(`/members`); //url호출부분
                setData(res.data);
            } catch (e) {
                setError(e?.response?.data?.message || e.message);
            }
        })();
    }, []);

    return (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold text-slate-900">마이페이지</div>

            {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {!data ? (
                <div className="mt-4 text-sm text-slate-600">불러오는 중...</div>
            ) : (
                <pre className="mt-4 text-xs rounded-xl bg-slate-900 text-slate-100 p-4 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
            )}
        </div>
    );
}
