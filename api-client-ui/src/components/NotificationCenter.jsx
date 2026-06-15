import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { notificationAdapter, notificationErrorMessage } from "../adapters/notificationAdapter.js";
import { formatRelativeTime } from "../utils/helpers.js";
import { notifyError } from "../utils/toast.js";

const normalizeNotification = (item) => ({
    id: Number(item?.notificationId ?? item?.notification_id ?? item?.id),
    type: item?.notificationType ?? item?.notification_type ?? "SYSTEM",
    severity: item?.severity ?? "INFO",
    title: item?.title ?? "알림",
    message: item?.message ?? "",
    linkUrl: item?.linkUrl ?? item?.link_url ?? "",
    read: Boolean(item?.readYn ?? item?.read_yn),
    createdAt: item?.createdAt ?? item?.created_at ?? null,
});

const isInternalAppLink = (value) => typeof value === "string" && value.startsWith("/app");

export const NotificationCenter = ({ initialOpen = false }) => {
    const [open, setOpen] = useState(initialOpen);
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [busyKey, setBusyKey] = useState("");
    const panelRef = useRef(null);
    const buttonRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    const visibleCount = useMemo(() => (unreadCount > 99 ? "99+" : unreadCount), [unreadCount]);

    const fetchUnreadCount = useCallback(async () => {
        try {
            setUnreadCount(await notificationAdapter.fetchUnreadCount());
        } catch {
            setUnreadCount(0);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const payload = await notificationAdapter.fetchNotifications({ page: 1, size: 12 });
            setItems((payload?.items || []).map(normalizeNotification));
            setUnreadCount(Number(payload?.unreadCount ?? payload?.unread_count ?? 0));
        } catch (error) {
            notifyError(notificationErrorMessage(error, "알림을 불러오지 못했습니다."));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        const intervalId = window.setInterval(fetchUnreadCount, 60000);
        return () => window.clearInterval(intervalId);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [fetchNotifications, open]);

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event) => {
            if (
                panelRef.current?.contains(event.target) ||
                buttonRef.current?.contains(event.target)
            ) {
                return;
            }
            setOpen(false);
        };
        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    const markRead = async (notificationId) => {
        if (!notificationId || busyKey) return;
        setBusyKey(`read:${notificationId}`);
        try {
            await notificationAdapter.markRead(notificationId, true);
            setItems((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            notifyError(notificationErrorMessage(error, "알림을 읽음 처리하지 못했습니다."));
        } finally {
            setBusyKey("");
        }
    };

    const markAllRead = async () => {
        if (busyKey || unreadCount <= 0) return;
        setBusyKey("all");
        try {
            await notificationAdapter.markAllRead();
            setItems((prev) => prev.map((item) => ({ ...item, read: true })));
            setUnreadCount(0);
        } catch (error) {
            notifyError(notificationErrorMessage(error, "알림을 모두 읽음 처리하지 못했습니다."));
        } finally {
            setBusyKey("");
        }
    };

    const openLink = async (item) => {
        if (!item.read) {
            await markRead(item.id);
        }
        if (isInternalAppLink(item.linkUrl)) {
            navigate(item.linkUrl);
            setOpen(false);
        }
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="icon-button relative"
                title="알림"
                aria-label="알림"
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-black text-white">
                        {visibleCount}
                    </span>
                ) : null}
            </button>

            {open ? (
                <section
                    ref={panelRef}
                    className="surface-panel motion-panel-in absolute right-0 top-12 z-[70] w-[min(23rem,calc(100vw-2rem))] overflow-hidden"
                    role="dialog"
                    aria-label="알림 센터"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-line p-4">
                        <div>
                            <h2 className="text-sm font-black text-ink">알림</h2>
                            <p className="text-xs font-semibold text-ink-muted">{unreadCount}개 미확인</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={fetchNotifications}
                                disabled={loading || Boolean(busyKey)}
                                className="icon-button h-9 w-9 disabled:opacity-60"
                                title="새로고침"
                                aria-label="새로고침"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            </button>
                            <button
                                type="button"
                                onClick={markAllRead}
                                disabled={unreadCount <= 0 || loading || Boolean(busyKey)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-ink text-ink-inverse transition hover:bg-primary-700 disabled:opacity-60"
                                title="모두 읽음"
                                aria-label="모두 읽음"
                            >
                                <CheckCheck className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto p-2">
                        {loading ? (
                            <div className="p-6 text-center text-sm font-bold text-ink-muted">알림을 불러오는 중입니다...</div>
                        ) : !items.length ? (
                            <div className="p-6 text-center text-sm font-bold text-ink-muted">표시할 알림이 없습니다.</div>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <article
                                        key={item.id || `${item.type}-${item.createdAt}`}
                                        className={`rounded-card border p-3 ${
                                            item.read ? "border-line bg-control" : "border-sky-200 bg-sky-50/60"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-black text-ink">{item.title}</span>
                                                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-black text-ink-muted">
                                                        {item.severity}
                                                    </span>
                                                </div>
                                                {item.message ? (
                                                    <p className="mt-1 break-words text-xs font-semibold leading-5 text-ink-muted">
                                                        {item.message}
                                                    </p>
                                                ) : null}
                                                <p className="mt-2 text-xs font-semibold text-ink-subtle">
                                                    {formatRelativeTime(item.createdAt) || "-"}
                                                </p>
                                            </div>
                                            {!item.read ? (
                                                <button
                                                    type="button"
                                                    onClick={() => markRead(item.id)}
                                                    disabled={Boolean(busyKey)}
                                                    className="shrink-0 rounded-lg bg-surface px-2 py-1 text-xs font-black text-ink-muted hover:bg-control-hover disabled:opacity-60"
                                                >
                                                    읽음
                                                </button>
                                            ) : null}
                                        </div>
                                        {isInternalAppLink(item.linkUrl) ? (
                                            <button
                                                type="button"
                                                onClick={() => openLink(item)}
                                                className="mt-3 w-full rounded-lg bg-surface px-3 py-2 text-left text-xs font-black text-sky-700 hover:bg-sky-100"
                                            >
                                                관련 화면 열기
                                            </button>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            ) : null}
        </div>
    );
};

export default NotificationCenter;
