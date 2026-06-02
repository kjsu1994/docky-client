import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    addDays,
    addMonths,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    parseISO,
    startOfMonth,
    startOfWeek,
    subMonths,
} from "date-fns";
import {
    CalendarDays,
    CalendarRange,
    Check,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from "lucide-react";
import { todoAdapter, todoErrorMessage, TODO_STATUS } from "../../adapters/todoAdapter.js";
import { EmptyState } from "../../components/EmptyState.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { confirmAction } from "../../common/confirmAction.jsx";
import { logClientError } from "../../utils/clientDiagnostics.js";
import { notifyError, notifySuccess } from "../../utils/toast.js";

const VIEW_MODE = {
    WEEK: "week",
    MONTH: "month",
    DAY: "day",
};

const TODO_ACTION = {
    TOGGLE: "toggle",
    DELETE: "delete",
    SAVE: "save",
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const TODO_TITLE_MAX_LENGTH = 200;

const toDateOnly = (value) => format(typeof value === "string" ? parseISO(value) : value, "yyyy-MM-dd");

const sortTodos = (items) =>
    [...items].sort((left, right) => {
        const leftDone = left.status === TODO_STATUS.DONE;
        const rightDone = right.status === TODO_STATUS.DONE;
        if (leftDone !== rightDone) return leftDone ? 1 : -1;
        const createdCompare = new Date(left.created_at || left.createdAt || 0).getTime()
            - new Date(right.created_at || right.createdAt || 0).getTime();
        if (createdCompare !== 0) return createdCompare;
        return Number(getTodoId(left) || 0) - Number(getTodoId(right) || 0);
    });

const buildWeekDays = (anchorDate) => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

const buildMonthGrid = (anchorDate) => {
    const monthStart = startOfMonth(anchorDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
};

const getRangeByView = (viewMode, anchorDate) => {
    if (viewMode === VIEW_MODE.MONTH) {
        return {
            from: startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 }),
            to: endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 }),
        };
    }
    if (viewMode === VIEW_MODE.DAY) {
        return { from: anchorDate, to: anchorDate };
    }
    return {
        from: startOfWeek(anchorDate, { weekStartsOn: 0 }),
        to: endOfWeek(anchorDate, { weekStartsOn: 0 }),
    };
};

const formatPeriodLabel = (viewMode, anchorDate) => {
    if (viewMode === VIEW_MODE.MONTH) return format(anchorDate, "yyyy년 M월");
    if (viewMode === VIEW_MODE.DAY) return format(anchorDate, "yyyy년 M월 d일");
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 0 });
    return `${format(weekStart, "yyyy.MM.dd")} - ${format(weekEnd, "MM.dd")}`;
};

const moveAnchorDate = (anchorDate, viewMode, direction) => {
    if (viewMode === VIEW_MODE.MONTH) {
        return direction < 0 ? subMonths(anchorDate, 1) : addMonths(anchorDate, 1);
    }
    if (viewMode === VIEW_MODE.DAY) {
        return addDays(anchorDate, direction);
    }
    return addDays(anchorDate, direction * 7);
};

const getTodoId = (todo) => todo?.todo_id ?? todo?.todoId;

const toTodoActionKey = (todoId, actionType) => `${String(todoId ?? "")}:${actionType}`;
const toTodoActionPrefix = (todoId) => `${String(todoId ?? "")}:`;

const isTodoInRange = (todo, period) => {
    if (!todo?.due_date) return false;
    const dueDate = parseISO(todo.due_date);
    return dueDate >= period.from && dueDate <= period.to;
};

export const TodoCalendar = () => {
    const [viewMode, setViewMode] = useState(VIEW_MODE.WEEK);
    const [anchorDate, setAnchorDate] = useState(new Date());
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);
    const [mutatingTodoActionKeys, setMutatingTodoActionKeys] = useState([]);
    const [draftTitle, setDraftTitle] = useState("");
    const [rangeMeta, setRangeMeta] = useState({ truncated: false, itemLimit: 0 });
    const [dateChoice, setDateChoice] = useState("today");
    const [draftDueDate, setDraftDueDate] = useState(toDateOnly(new Date()));
    const [editingTodoId, setEditingTodoId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const fetchSeqRef = useRef(0);
    const loadedOnceRef = useRef(false);
    const mutatingTodoActionKeyRef = useRef(new Set());

    const period = useMemo(() => getRangeByView(viewMode, anchorDate), [viewMode, anchorDate]);
    const selectedDate = useMemo(() => toDateOnly(anchorDate), [anchorDate]);
    const weekDays = useMemo(() => buildWeekDays(anchorDate), [anchorDate]);
    const monthDays = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);

    const todosByDate = useMemo(() => {
        const grouped = new Map();
        todos.forEach((todo) => {
            const key = todo.due_date;
            const bucket = grouped.get(key) || [];
            bucket.push(todo);
            grouped.set(key, bucket);
        });
        grouped.forEach((bucket, key) => grouped.set(key, sortTodos(bucket)));
        return grouped;
    }, [todos]);

    const fetchTodos = useCallback(async ({ silent = loadedOnceRef.current } = {}) => {
        const requestSeq = fetchSeqRef.current + 1;
        fetchSeqRef.current = requestSeq;

        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError("");
        try {
            const result = await todoAdapter.fetchTodos({
                fromDate: toDateOnly(period.from),
                toDate: toDateOnly(period.to),
            });

            if (fetchSeqRef.current !== requestSeq) return;

            setTodos(result.items);
            setRangeMeta({ truncated: Boolean(result.truncated), itemLimit: result.itemLimit || result.items.length });
            loadedOnceRef.current = true;
        } catch (fetchError) {
            if (fetchSeqRef.current !== requestSeq) return;
            logClientError("todo.range.fetch", fetchError);
            const message = todoErrorMessage(fetchError, "할 일 목록을 불러오지 못했습니다.");
            if (silent && loadedOnceRef.current) {
                notifyError(message);
            } else {
                setError(message);
            }
        } finally {
            if (fetchSeqRef.current === requestSeq) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [period.from, period.to]);

    useEffect(() => {
        fetchTodos();
    }, [fetchTodos]);

    useEffect(() => {
        if (dateChoice === "today") {
            setDraftDueDate(toDateOnly(new Date()));
            return;
        }
        if (dateChoice === "tomorrow") {
            setDraftDueDate(toDateOnly(addDays(new Date(), 1)));
        }
    }, [dateChoice]);

    const resetComposer = () => {
        setDraftTitle("");
        setDateChoice("today");
        setDraftDueDate(toDateOnly(new Date()));
    };

    const mergeVisibleTodo = (nextTodo) => {
        if (!isTodoInRange(nextTodo, period)) {
            setTodos((prev) => prev.filter((todo) => getTodoId(todo) !== getTodoId(nextTodo)));
            return;
        }

        setTodos((prev) => {
            const withoutTarget = prev.filter((todo) => getTodoId(todo) !== getTodoId(nextTodo));
            return [...withoutTarget, nextTodo].sort((left, right) => {
                const dateCompare = String(left.due_date || "").localeCompare(String(right.due_date || ""));
                if (dateCompare !== 0) return dateCompare;
                const leftDone = left.status === TODO_STATUS.DONE;
                const rightDone = right.status === TODO_STATUS.DONE;
                if (leftDone !== rightDone) return leftDone ? 1 : -1;
                const createdCompare = new Date(left.created_at || left.createdAt || 0).getTime()
                    - new Date(right.created_at || right.createdAt || 0).getTime();
                if (createdCompare !== 0) return createdCompare;
                return Number(getTodoId(left) || 0) - Number(getTodoId(right) || 0);
            });
        });
    };

    const hasPendingTodoAction = (todoId) => {
        const prefix = toTodoActionPrefix(todoId);
        return mutatingTodoActionKeys.some((key) => key.startsWith(prefix));
    };

    const isTodoActionPending = (todoId, actionType) =>
        mutatingTodoActionKeys.includes(toTodoActionKey(todoId, actionType));

    const beginTodoAction = (todoId, actionType) => {
        if (todoId == null || String(todoId).trim() === "") return false;
        const prefix = toTodoActionPrefix(todoId);
        const hasSameTodoAction = Array.from(mutatingTodoActionKeyRef.current).some((key) => key.startsWith(prefix));
        if (hasSameTodoAction) return false;

        const nextKeys = new Set(mutatingTodoActionKeyRef.current);
        nextKeys.add(toTodoActionKey(todoId, actionType));
        mutatingTodoActionKeyRef.current = nextKeys;
        setMutatingTodoActionKeys(Array.from(nextKeys));
        return true;
    };

    const finishTodoAction = (todoId, actionType) => {
        const nextKeys = new Set(mutatingTodoActionKeyRef.current);
        nextKeys.delete(toTodoActionKey(todoId, actionType));
        mutatingTodoActionKeyRef.current = nextKeys;
        setMutatingTodoActionKeys(Array.from(nextKeys));
    };

    const handleCreateTodo = async () => {
        if (creating) return;
        const trimmedTitle = draftTitle.trim();
        if (!trimmedTitle) {
            notifyError("할 일 제목을 입력해 주세요.");
            return;
        }
        if (!draftDueDate) {
            notifyError("날짜를 선택해 주세요.");
            return;
        }

        setCreating(true);
        try {
            const createdTodo = await todoAdapter.createTodo({
                title: trimmedTitle,
                dueDate: draftDueDate,
            });
            resetComposer();
            const visibleInCurrentRange = isTodoInRange(createdTodo, period);
            mergeVisibleTodo(createdTodo);
            notifySuccess(visibleInCurrentRange
                ? "할 일이 추가되었습니다."
                : "할 일이 추가되었습니다. 선택한 기간 밖에 있어 목록에는 표시되지 않습니다.");
        } catch (createError) {
            logClientError("todo.create", createError);
            notifyError(todoErrorMessage(createError, "할 일을 추가하지 못했습니다."));
        } finally {
            setCreating(false);
        }
    };

    const handleToggleTodo = async (todo) => {
        const todoId = getTodoId(todo);
        if (!beginTodoAction(todoId, TODO_ACTION.TOGGLE)) return;

        const nextStatus = todo.status === TODO_STATUS.DONE ? TODO_STATUS.TODO : TODO_STATUS.DONE;
        const previousTodo = { ...todo };
        const optimisticTodo = {
            ...todo,
            status: nextStatus,
            completed_at: nextStatus === TODO_STATUS.DONE ? new Date().toISOString() : null,
            completedAt: nextStatus === TODO_STATUS.DONE ? new Date().toISOString() : null,
        };

        mergeVisibleTodo(optimisticTodo);
        try {
            const updatedTodo = await todoAdapter.updateTodo(todoId, {
                status: nextStatus,
            });
            mergeVisibleTodo(updatedTodo);
        } catch (toggleError) {
            mergeVisibleTodo(previousTodo);
            logClientError("todo.toggle", toggleError);
            notifyError(todoErrorMessage(toggleError, "완료 상태를 변경하지 못했습니다."));
        } finally {
            finishTodoAction(todoId, TODO_ACTION.TOGGLE);
        }
    };
    const handleDeleteTodo = async (todoId) => {
        if (!beginTodoAction(todoId, TODO_ACTION.DELETE)) return;

        let previousTodo = null;
        try {
            const confirmed = await confirmAction({
                title: "할 일을 삭제할까요?",
                description: "삭제한 할 일은 되돌릴 수 없습니다.",
                confirmText: "삭제",
            });
            if (!confirmed) return;

            previousTodo = todos.find((todo) => getTodoId(todo) === todoId);
            setTodos((prev) => prev.filter((todo) => getTodoId(todo) !== todoId));
            await todoAdapter.deleteTodo(todoId);
            notifySuccess("할 일이 삭제되었습니다.");
        } catch (deleteError) {
            if (previousTodo) mergeVisibleTodo(previousTodo);
            logClientError("todo.delete", deleteError);
            notifyError(todoErrorMessage(deleteError, "할 일을 삭제하지 못했습니다."));
        } finally {
            finishTodoAction(todoId, TODO_ACTION.DELETE);
        }
    };

    const beginEditTodo = (todo) => {
        if (hasPendingTodoAction(getTodoId(todo))) return;
        setEditingTodoId(getTodoId(todo));
        setEditTitle(todo.title);
        setEditDueDate(todo.due_date);
    };

    const cancelEditTodo = () => {
        setEditingTodoId(null);
        setEditTitle("");
        setEditDueDate("");
    };

    const handleSaveTodo = async (todoId) => {
        const trimmedTitle = editTitle.trim();
        if (!trimmedTitle) {
            notifyError("할 일 제목을 입력해 주세요.");
            return;
        }
        if (!editDueDate) {
            notifyError("날짜를 선택해 주세요.");
            return;
        }
        if (!beginTodoAction(todoId, TODO_ACTION.SAVE)) return;

        const previousTodo = todos.find((todo) => getTodoId(todo) === todoId);
        const optimisticTodo = previousTodo
            ? {
                ...previousTodo,
                title: trimmedTitle,
                due_date: editDueDate,
                dueDate: editDueDate,
            }
            : null;
        if (optimisticTodo) mergeVisibleTodo(optimisticTodo);
        try {
            const updatedTodo = await todoAdapter.updateTodo(todoId, {
                title: trimmedTitle,
                dueDate: editDueDate,
            });
            cancelEditTodo();
            mergeVisibleTodo(updatedTodo);
            notifySuccess("할 일이 수정되었습니다.");
        } catch (saveError) {
            if (previousTodo) mergeVisibleTodo(previousTodo);
            logClientError("todo.save", saveError);
            notifyError(todoErrorMessage(saveError, "할 일을 수정하지 못했습니다."));
        } finally {
            finishTodoAction(todoId, TODO_ACTION.SAVE);
        }
    };

    const renderTodoRow = (todo, variant = "default") => {
        const todoId = getTodoId(todo);
        const isEditing = editingTodoId === todoId;
        const isPending = hasPendingTodoAction(todoId);
        const isToggling = isTodoActionPending(todoId, TODO_ACTION.TOGGLE);
        const isDeleting = isTodoActionPending(todoId, TODO_ACTION.DELETE);
        const isSaving = isTodoActionPending(todoId, TODO_ACTION.SAVE);
        const isDone = todo.status === TODO_STATUS.DONE;
        const isCompact = variant === "week";

        return (
            <div
                key={todoId}
                className={`${isCompact ? "rounded-[1.25rem] px-3 py-3" : "rounded-[1.75rem] px-4 py-4"} border transition-all ${
                    isDone
                        ? "border-slate-100 bg-slate-50/80 text-slate-400"
                        : "border-slate-200 bg-white text-slate-800 shadow-sm"
                }`}
            >
                <div className={`flex ${isCompact ? "items-start gap-2.5" : "items-start gap-3"}`}>
                    <button
                        type="button"
                        onClick={() => handleToggleTodo(todo)}
                        disabled={isPending}
                        aria-busy={isPending}
                        className={`${isCompact ? "mt-0.5 h-5 w-5" : "mt-0.5 h-6 w-6"} flex flex-shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed ${
                            isDone
                                ? "border-emerald-400 bg-emerald-500 text-white"
                                : "border-slate-300 bg-white text-transparent hover:border-primary-400"
                        }`}
                        aria-label={isToggling ? "완료 상태 변경 중" : "완료 상태 변경"}
                    >
                        {isToggling
                            ? <RefreshCw className={`${isCompact ? "h-3 w-3" : "h-3.5 w-3.5"} animate-spin`} />
                            : <Check className={isCompact ? "h-3 w-3" : "h-3.5 w-3.5"} />}
                    </button>

                    <div className="min-w-0 flex-1">
                        {isEditing ? (
                            <div className="space-y-3">
                                <input
                                    value={editTitle}
                                    onChange={(event) => setEditTitle(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-primary-400"
                                    placeholder="할 일 제목"
                                    maxLength={TODO_TITLE_MAX_LENGTH}
                                    disabled={isPending}
                                />
                                <div className="text-right text-[11px] font-bold text-slate-400">
                                    {editTitle.length} / {TODO_TITLE_MAX_LENGTH}
                                </div>
                                <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(event) => setEditDueDate(event.target.value)}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-primary-400"
                                    disabled={isPending}
                                />
                            </div>
                        ) : (
                            <>
                                <div className={`${isCompact ? "line-clamp-2 text-[13px] leading-5" : "text-sm sm:text-base"} font-bold break-keep ${isDone ? "line-through" : ""}`}>
                                    {todo.title}
                                </div>
                                {!isCompact && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                            {format(parseISO(todo.due_date), "M월 d일")}
                                        </span>
                                        {isToday(parseISO(todo.due_date)) && (
                                            <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary-700">
                                                오늘
                                            </span>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className={`flex ${isCompact ? "flex-col gap-1" : "items-center gap-1"}`}>
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSaveTodo(todoId)}
                                    disabled={isPending}
                                    aria-busy={isPending}
                                    className={`min-w-[4.5rem] rounded-xl bg-primary-600 ${isCompact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"} font-black text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300`}
                                >
                                    {isSaving ? "저장 중..." : "저장"}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEditTodo}
                                    disabled={isPending}
                                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-slate-700"
                                    aria-label="편집 취소"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => beginEditTodo(todo)}
                                    disabled={isPending}
                                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="할 일 수정"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTodo(todoId)}
                                    disabled={isPending}
                                    aria-busy={isPending}
                                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label={isDeleting ? "할 일 삭제 중" : "할 일 삭제"}
                                >
                                    {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderDailyList = (date, variant = "default") => {
        const items = todosByDate.get(toDateOnly(date)) || [];
        return items.length ? (
            <div className={variant === "week" ? "space-y-2.5" : "space-y-3"}>{items.map((todo) => renderTodoRow(todo, variant))}</div>
        ) : variant === "week" ? (
            <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-center text-xs font-semibold text-slate-400">
                등록된 할 일이 없습니다.
            </div>
        ) : (
            <EmptyState
                message="이 날짜에는 할 일이 없습니다."
                subMessage="이 날짜의 첫 할 일을 추가해보세요."
            />
        );
    };

    if (loading) return <LoadingSpinner text="할 일 목록을 불러오는 중입니다..." />;
    if (error) return <ErrorMessage message={error} onRetry={() => fetchTodos({ silent: false })} />;

    return (
        <div className="animate-fade-in space-y-6 pb-10">
            <section className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),linear-gradient(135deg,#ffffff,_#f8fafc)] p-6 sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white">
                                <CalendarRange className="h-3.5 w-3.5" />
                                할 일
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">할 일 목록</h1>
                            <p className="mt-2 text-sm font-medium text-slate-500">
                                일간, 주간, 월간으로 다양한 목표를 실천하세요.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 px-4 py-3">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">현재 보기</div>
                                <div className="mt-1 text-base font-black text-slate-900">
                                    {viewMode === VIEW_MODE.WEEK ? "주간 리스트" : viewMode === VIEW_MODE.MONTH ? "월간 캘린더" : "일간 리스트"}
                                </div>
                            </div>
                            <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 px-4 py-3">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">남은 할 일</div>
                                <div className="mt-1 text-base font-black text-slate-900">
                                    {todos.filter((todo) => todo.status !== TODO_STATUS.DONE).length} 개
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                            {[
                                { key: VIEW_MODE.WEEK, label: "주간", icon: CalendarRange },
                                { key: VIEW_MODE.MONTH, label: "월간", icon: CalendarDays },
                                { key: VIEW_MODE.DAY, label: "일간", icon: CalendarRange },
                            ].map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setViewMode(key)}
                                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all ${
                                        viewMode === key ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setAnchorDate((current) => moveAnchorDate(current, viewMode, -1))}
                                className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition-colors hover:text-slate-900"
                                aria-label="이전 기간"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnchorDate(new Date())}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition-colors hover:border-primary-200 hover:text-primary-700"
                            >
                                오늘
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnchorDate((current) => moveAnchorDate(current, viewMode, 1))}
                                className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition-colors hover:text-slate-900"
                                aria-label="다음 기간"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <div className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">
                                {formatPeriodLabel(viewMode, anchorDate)}
                            </div>
                            {refreshing && (
                                <div className="rounded-2xl bg-primary-50 px-3 py-2 text-xs font-black text-primary-700" role="status">
                                    동기화 중...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    handleCreateTodo();
                                }
                            }}
                            placeholder="무엇을 해야 하나요?"
                            maxLength={TODO_TITLE_MAX_LENGTH}
                            disabled={creating}
                            className="w-full rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-primary-300 focus:bg-white"
                        />
                        <button
                            type="button"
                            onClick={handleCreateTodo}
                            disabled={creating}
                            aria-busy={creating}
                            className="inline-flex items-center justify-center gap-2 rounded-[1.75rem] bg-primary-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
                        >
                            <Plus className="h-4 w-4" />
                            {creating ? "추가 중..." : "추가"}
                        </button>
                    </div>
                    <div className="-mt-2 text-right text-xs font-bold text-slate-400">
                        {draftTitle.length} / {TODO_TITLE_MAX_LENGTH}
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="inline-flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setDateChoice("today")}
                                className={`rounded-2xl px-4 py-2 text-sm font-black transition-all ${
                                    dateChoice === "today" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                            >
                                오늘
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateChoice("tomorrow")}
                                className={`rounded-2xl px-4 py-2 text-sm font-black transition-all ${
                                    dateChoice === "tomorrow" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                            >
                                내일
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setDateChoice("custom");
                                    setDraftDueDate(selectedDate);
                                }}
                                className={`rounded-2xl px-4 py-2 text-sm font-black transition-all ${
                                    dateChoice === "custom" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                            >
                                날짜 선택
                            </button>
                        </div>

                        <input
                            type="date"
                            value={draftDueDate}
                            onChange={(event) => {
                                setDateChoice("custom");
                                setDraftDueDate(event.target.value);
                            }}
                            disabled={creating}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-primary-300"
                        />
                    </div>
                    {rangeMeta.truncated && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800" role="status">
                            표시 한도 {rangeMeta.itemLimit.toLocaleString()}개까지만 불러왔습니다. 기간을 좁히면 나머지 할 일을 확인할 수 있습니다.
                        </div>
                    )}
                </div>
            </section>

            {viewMode === VIEW_MODE.WEEK && (
                <section className="grid grid-cols-1 gap-4 xl:grid-cols-7 xl:items-start">
                    {weekDays.map((date) => {
                        const isCurrentDay = isToday(date);
                        const items = todosByDate.get(toDateOnly(date)) || [];
                        const isEmptyDay = items.length === 0;
                        return (
                            <div
                                key={date.toISOString()}
                                className={`min-w-0 rounded-[2rem] border bg-white p-4 shadow-sm transition-all ${
                                    isCurrentDay
                                        ? "border-primary-400 ring-2 ring-primary-200 shadow-lg shadow-primary-100/60"
                                        : "border-slate-200"
                                } ${isEmptyDay ? "xl:self-start" : "h-full"}`}
                            >
                                <div className="mb-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                                                {DAY_LABELS[date.getDay()]}
                                            </span>
                                            <span className="whitespace-nowrap text-base font-black tracking-tight text-slate-900">
                                                {format(date, "M월 d일")}
                                            </span>
                                            {isCurrentDay && (
                                                <span className="rounded-full bg-primary-100 px-2 py-1 text-[10px] font-black text-primary-700">
                                                    오늘
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAnchorDate(date);
                                            setViewMode(VIEW_MODE.DAY);
                                        }}
                                        className="flex-shrink-0 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 transition-colors hover:border-primary-200 hover:text-primary-700"
                                    >
                                        하루 보기
                                    </button>
                                </div>
                                {renderDailyList(date, "week")}
                            </div>
                        );
                    })}
                </section>
            )}
            {viewMode === VIEW_MODE.DAY && (
                <section className="rounded-[2.25rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">선택한 날짜</div>
                            <div className="mt-1 text-2xl font-black text-slate-900">{format(anchorDate, "yyyy.MM.dd")}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setViewMode(VIEW_MODE.WEEK)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:border-primary-200 hover:text-primary-700"
                        >
                            주간으로 돌아가기
                        </button>
                    </div>
                    {renderDailyList(anchorDate)}
                </section>
            )}

            {viewMode === VIEW_MODE.MONTH && (
                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                    <div className="rounded-[2.25rem] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 grid grid-cols-7 gap-2 text-center">
                            {DAY_LABELS.map((label) => (
                                <div key={label} className="py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {label}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {monthDays.map((date) => {
                                const key = toDateOnly(date);
                                const items = todosByDate.get(key) || [];
                                const incompleteCount = items.filter((todo) => todo.status !== TODO_STATUS.DONE).length;
                                const hasDone = items.some((todo) => todo.status === TODO_STATUS.DONE);
                                const dayOfWeek = date.getDay();
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                const isSunday = dayOfWeek === 0;
                                const isSaturday = dayOfWeek === 6;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setAnchorDate(date);
                                            setViewMode(VIEW_MODE.DAY);
                                        }}
                                        className={`aspect-square rounded-[1.25rem] border p-2.5 text-left transition-all sm:min-h-[94px] sm:aspect-auto sm:rounded-[1.5rem] sm:p-3 ${
                                            isSameMonth(date, anchorDate)
                                                ? "border-slate-200 bg-white hover:border-primary-300 hover:shadow-sm"
                                                : "border-transparent bg-slate-50/70 text-slate-300"
                                        } ${isToday(date) ? "ring-2 ring-primary-300" : ""}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-sm font-black ${
                                                isSameDay(date, anchorDate)
                                                    ? "text-primary-700"
                                                    : isSunday
                                                        ? "text-rose-500"
                                                        : isSaturday
                                                            ? "text-red-400"
                                                            : isWeekend
                                                                ? "text-rose-400"
                                                                : "text-slate-700"
                                            }`}>
                                                {format(date, "d")}
                                            </span>
                                            {incompleteCount > 0 && (
                                                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-black text-primary-700">
                                                    {incompleteCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 space-y-1">
                                            {items.slice(0, 2).map((todo) => (
                                                <div
                                                    key={getTodoId(todo)}
                                                    className={`truncate rounded-full px-2 py-1 text-[10px] font-bold ${
                                                        todo.status === TODO_STATUS.DONE
                                                            ? "bg-slate-100 text-slate-400 line-through"
                                                            : "bg-slate-900 text-white"
                                                    }`}
                                                >
                                                    {todo.title}
                                                </div>
                                            ))}
                                            {hasDone && !incompleteCount && (
                                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">완료</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-[2.25rem] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">날짜 미리보기</div>
                            <div className="mt-1 text-xl font-black text-slate-900">{format(anchorDate, "M월 d일")}</div>
                            <p className="mt-1 text-sm font-medium text-slate-500">날짜를 누르면 해당 날짜의 일간 보기로 바로 이동합니다.</p>
                        </div>
                        {renderDailyList(anchorDate)}
                    </div>
                </section>
            )}
        </div>
    );
};
