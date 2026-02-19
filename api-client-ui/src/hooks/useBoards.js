import { useState, useEffect, useRef } from "react";
import api from "../utils/api.js";

const getBodyData = (response) => response?.data?.data ?? response?.data;

const fetchAllBoardsWithoutMeta = async (kind) => {
    const collected = [];
    const fetchSize = 100;
    const targetKind = Array.isArray(kind) ? kind[0] : kind;
    
    for (let index = 0; index < 3; index += 1) {
        try {
            const response = await api.get("/boards", {
                params: { kind: targetKind, page: index, size: fetchSize }
            });
            const data = getBodyData(response);
            const items = Array.isArray(data) ? data : (data?.content || []);
            
            // 데이터 주입 (단일 조회 시에도 보장)
            const taggedItems = items.map(item => ({
                ...item,
                kind_of_board: item.kind_of_board || item.kindOfBoard || targetKind
            }));
            
            collected.push(...taggedItems);
            if (items.length < fetchSize) break;
        } catch (err) {
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

    const lastFetchKeyRef = useRef("");

    useEffect(() => {
        let isMounted = true;
        const safePage = Math.max(Number(page) || 1, 1);
        const safeSize = Math.max(Number(size) || 10, 1);
        const apiPage = safePage - 1;
        
        const kindKey = Array.isArray(kind) ? kind.join(",") : kind;
        const fetchKey = `${kindKey}-${apiPage}-${safeSize}-${reloadKey}`;

        if (lastFetchKeyRef.current === fetchKey && boards.length > 0) {
            setLoading(false);
            return;
        }

        const fetchBoards = async () => {
            setLoading(true);
            setError(null);

            try {
                let allFetchedBoards = [];
                let totalElements = 0;
                let totalPages = 0;

                if (Array.isArray(kind)) {
                    // 다중 카테고리 조회
                    const results = await Promise.allSettled(
                        kind.map(k => api.get("/boards", { params: { kind: k, page: 0, size: 50 } }))
                    );
                    
                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            const data = getBodyData(result.value);
                            const items = Array.isArray(data) ? data : (data?.content || []);
                            
                            // [핵심] 서버 응답에 종류가 없어도 요청한 카테고리명(k)을 강제로 주입
                            const taggedItems = items.map(item => ({
                                ...item,
                                kind_of_board: item.kind_of_board || item.kindOfBoard || kind[index]
                            }));
                            allFetchedBoards.push(...taggedItems);
                        }
                    });

                    allFetchedBoards.sort((a, b) => {
                        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
                        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
                        return dateB - dateA;
                    });
                    
                    totalElements = allFetchedBoards.length;
                    totalPages = Math.ceil(totalElements / safeSize) || 1;
                    const startIndex = (safePage - 1) * safeSize;
                    allFetchedBoards = allFetchedBoards.slice(startIndex, startIndex + safeSize);
                } else {
                    // 단일 카테고리 조회
                    const response = await api.get("/boards", {
                        params: { kind, page: apiPage, size: safeSize }
                    });

                    const data = getBodyData(response);
                    let rawItems = [];
                    if (data && typeof data === "object" && Array.isArray(data.content)) {
                        rawItems = data.content;
                        totalElements = data.totalElements;
                        totalPages = data.totalPages;
                    } else if (Array.isArray(data)) {
                        rawItems = data;
                        totalElements = data.length;
                        totalPages = Math.ceil(totalElements / safeSize);
                    } else {
                        const fallbackData = await fetchAllBoardsWithoutMeta(kind);
                        rawItems = fallbackData;
                        totalElements = fallbackData.length;
                        totalPages = Math.ceil(totalElements / safeSize);
                        const startIndex = (safePage - 1) * safeSize;
                        rawItems = fallbackData.slice(startIndex, startIndex + safeSize);
                    }

                    // 단일 조회 시에도 kind 보장
                    allFetchedBoards = rawItems.map(item => ({
                        ...item,
                        kind_of_board: item.kind_of_board || item.kindOfBoard || kind
                    }));
                }

                if (!isMounted) return;

                lastFetchKeyRef.current = fetchKey;
                setBoards(allFetchedBoards);
                setPageInfo({
                    totalPages: totalPages || 1,
                    totalElements: totalElements || allFetchedBoards.length,
                    currentPage: safePage,
                });

            } catch (err) {
                if (isMounted) {
                    console.error("[useBoards] Fetch Error:", err);
                    setError(err.response?.data?.message || "데이터 로딩 실패");
                    setBoards([]);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBoards();
        return () => { isMounted = false; };
    }, [kind, page, size, reloadKey]);

    return { boards, loading, error, pageInfo };
};
