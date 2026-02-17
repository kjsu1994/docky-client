import { useState, useEffect } from "react";
import api from "../utils/api.js";

export const useBoards = (kind, page = 1, size = 10, reloadKey = 0) => {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pageInfo, setPageInfo] = useState({
        totalPages: 0,
        totalElements: 0,
        currentPage: page,
    });

    useEffect(() => {
        const fetchBoards = async () => {
            setLoading(true);
            setError(null);

            try {
                const apiPage = Math.max((page || 1) - 1, 0);
                const response = await api.get("/boards", {
                    params: { kind, page: apiPage, size },
                });

                const data = response.data.data || response.data;
                setBoards(data.content || data);
                const serverPage = typeof data.number === "number" ? data.number + 1 : page;
                setPageInfo({
                    totalPages: data.totalPages || 1,
                    totalElements: data.totalElements || 0,
                    currentPage: serverPage,
                });
            } catch (err) {
                setError(err.response?.data?.message || "게시글 로딩 실패");
            } finally {
                setLoading(false);
            }
        };

        fetchBoards();
    }, [kind, page, size, reloadKey]);

    return { boards, loading, error, pageInfo };
};
