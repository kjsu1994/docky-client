import { useState, useEffect } from "react";
import api from "../utils/api.js";

const getBodyData = (response) => response?.data?.data ?? response?.data;

// 서버가 페이지 메타를 내려주지 않는 경우를 대비해 전체 목록을 페이지 단위로 수집한다.
const fetchAllBoardsWithoutMeta = async (kind) => {
    const collected = [];
    const fetchSize = 100;
    const maxPages = 200;

    for (let index = 0; index < maxPages; index += 1) {
        const response = await api.get("/boards", {
            params: { kind, page: index, size: fetchSize },
        });
        const pageItems = getBodyData(response);
        const safeItems = Array.isArray(pageItems) ? pageItems : [];
        collected.push(...safeItems);

        if (safeItems.length < fetchSize) {
            break;
        }
    }

    return collected;
};

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
                const safePage = Math.max(page || 1, 1);
                const safeSize = Math.max(size || 10, 1);
                const apiPage = safePage - 1;

                const response = await api.get("/boards", {
                    params: { kind, page: apiPage, size: safeSize },
                });

                const data = getBodyData(response);

                // 페이지 메타가 포함된 표준 응답(Page 객체)을 우선 처리한다.
                if (data && typeof data === "object" && Array.isArray(data.content)) {
                    setBoards(data.content);
                    const serverPage = typeof data.number === "number" ? data.number + 1 : safePage;
                    setPageInfo({
                        totalPages: data.totalPages || 1,
                        totalElements: data.totalElements || data.content.length || 0,
                        currentPage: serverPage,
                    });
                    return;
                }

                // 페이지 메타가 없는 배열 응답은 전체 목록을 조회해 클라이언트에서 페이징한다.
                if (Array.isArray(data)) {
                    const allBoards = await fetchAllBoardsWithoutMeta(kind);
                    const totalElements = allBoards.length;
                    const totalPages = Math.max(1, Math.ceil(totalElements / safeSize));
                    const clampedPage = Math.min(safePage, totalPages);
                    const startIndex = (clampedPage - 1) * safeSize;
                    const pageItems = allBoards.slice(startIndex, startIndex + safeSize);

                    setBoards(pageItems);
                    setPageInfo({
                        totalPages,
                        totalElements,
                        currentPage: clampedPage,
                    });
                    return;
                }

                setBoards([]);
                setPageInfo({
                    totalPages: 1,
                    totalElements: 0,
                    currentPage: safePage,
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
