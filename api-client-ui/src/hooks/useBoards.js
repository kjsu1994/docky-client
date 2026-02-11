import { useState, useEffect } from "react";
import api from "../utils/api.js";

export const useBoards = (kind, page = 1, size = 10) => {
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
                const response = await api.get("/boards", {
                    params: { kind, page, size },
                });

                const data = response.data.data || response.data;
                setBoards(data.content || data);
                setPageInfo({
                    totalPages: data.totalPages || 1,
                    totalElements: data.totalElements || 0,
                    currentPage: data.number || page,
                });
            } catch (err) {
                setError(err.response?.data?.message || "게시글 로딩 실패");
            } finally {
                setLoading(false);
            }
        };

        fetchBoards();
    }, [kind, page, size]);

    return { boards, loading, error, pageInfo };
};

export const useBoardDetail = (boardId) => {
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchBoard = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.get(`/boards/${boardId}`);
            setBoard(response.data.data || response.data);
        } catch (err) {
            setError(err.response?.data?.message || "게시글 로딩 실패");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (boardId) {
            fetchBoard();
        }
    }, [boardId]);

    return { board, loading, error, refetch: fetchBoard };
};