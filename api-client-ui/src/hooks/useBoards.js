import { useEffect, useRef, useState } from "react";
import { boardAdapter, boardErrorMessage } from "../adapters/boardAdapter.js";

export const useBoards = (kind, page = 1, size = 10, reloadKey = 0, options = {}) => {
    const {
        enabled = true,
        searchType = "ALL",
        searchValue = "",
        sortBy = "latest",
    } = options;

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
        const normalizedSearchValue = String(searchValue || "").trim();
        const requestOptions = {
            searchType,
            searchValue: normalizedSearchValue,
            sortBy,
        };

        const kindKey = Array.isArray(kind) ? kind.join(",") : kind;
        const fetchKey = `${kindKey}-${apiPage}-${safeSize}-${reloadKey}-${searchType}-${normalizedSearchValue}-${sortBy}-${enabled}`;

        if (!enabled || !kindKey) {
            setBoards([]);
            setError(null);
            setLoading(false);
            setPageInfo({
                totalPages: 1,
                totalElements: 0,
                currentPage: safePage,
            });
            lastFetchKeyRef.current = "";
            return () => { isMounted = false; };
        }

        if (lastFetchKeyRef.current === fetchKey) {
            setLoading(false);
            return () => { isMounted = false; };
        }

        const fetchBoards = async () => {
            setLoading(true);
            setError(null);

            try {
                let allFetchedBoards = [];
                let totalElements = 0;
                let totalPages = 0;

                if (Array.isArray(kind)) {
                    const results = await Promise.allSettled(
                        kind.map((item) => boardAdapter.fetchBoardPage({
                            kind: item,
                            page: 0,
                            size: 50,
                            ...requestOptions,
                        }))
                    );

                    results.forEach((result) => {
                        if (result.status === "fulfilled") {
                            allFetchedBoards.push(...result.value.items);
                            totalElements += result.value.pageInfo.totalElements;
                        }
                    });

                    allFetchedBoards.sort((a, b) => {
                        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
                        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
                        return dateB - dateA;
                    });

                    totalElements = totalElements || allFetchedBoards.length;
                    totalPages = Math.ceil(totalElements / safeSize) || 1;
                    const startIndex = (safePage - 1) * safeSize;
                    allFetchedBoards = allFetchedBoards.slice(startIndex, startIndex + safeSize);
                } else {
                    const result = await boardAdapter.fetchBoardPage({
                        kind,
                        page: apiPage,
                        size: safeSize,
                        ...requestOptions,
                    });

                    if (result.recognized) {
                        allFetchedBoards = result.items;
                        totalElements = result.pageInfo.totalElements;
                        totalPages = result.pageInfo.totalPages;
                    } else {
                        const fallbackData = await boardAdapter.fetchBoardFallbackList(kind, requestOptions);
                        totalElements = fallbackData.length;
                        totalPages = Math.ceil(totalElements / safeSize);
                        const startIndex = (safePage - 1) * safeSize;
                        allFetchedBoards = fallbackData.slice(startIndex, startIndex + safeSize);
                    }
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
                    setError(boardErrorMessage(err, "게시글 목록을 불러오지 못했습니다."));
                    setBoards([]);
                    lastFetchKeyRef.current = fetchKey;
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBoards();
        return () => { isMounted = false; };
    }, [kind, page, size, reloadKey, enabled, searchType, searchValue, sortBy]);

    return { boards, loading, error, pageInfo };
};
