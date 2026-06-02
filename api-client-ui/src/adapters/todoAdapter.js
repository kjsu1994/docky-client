import api, { getApiErrorMessage } from "../utils/api.js";

export const TODO_STATUS = {
    TODO: "TODO",
    DONE: "DONE",
};

const unwrapTodoData = (response) => response?.data?.data ?? response?.data ?? null;

const toSnakePayload = (payload = {}) => {
    const next = {};
    if (payload.title !== undefined) next.title = payload.title;
    if (payload.dueDate !== undefined) next.due_date = payload.dueDate;
    if (payload.status !== undefined) next.status = payload.status;
    return next;
};

export const normalizeTodo = (item = {}) => ({
    todo_id: item.todo_id ?? item.todoId,
    todoId: item.todo_id ?? item.todoId,
    title: item.title ?? "",
    status: item.status ?? TODO_STATUS.TODO,
    due_date: item.due_date ?? item.dueDate,
    dueDate: item.due_date ?? item.dueDate,
    completed_at: item.completed_at ?? item.completedAt,
    completedAt: item.completed_at ?? item.completedAt,
    created_at: item.created_at ?? item.createdAt,
    createdAt: item.created_at ?? item.createdAt,
    modified_at: item.modified_at ?? item.modifiedAt,
    modifiedAt: item.modified_at ?? item.modifiedAt,
});

const normalizeRangeResponse = (data, fallback) => {
    const items = Array.isArray(data?.items) ? data.items.map(normalizeTodo) : [];
    const itemLimit = Number(data?.item_limit ?? data?.itemLimit ?? items.length);
    return {
        fromDate: data?.from_date ?? data?.fromDate ?? fallback.fromDate,
        toDate: data?.to_date ?? data?.toDate ?? fallback.toDate,
        items,
        truncated: Boolean(data?.truncated),
        itemLimit: Number.isFinite(itemLimit) && itemLimit > 0 ? itemLimit : items.length,
    };
};

export const todoErrorMessage = (error, fallbackMessage) => {
    if (Number(error?.response?.status) === 403) {
        return "할 일 목록을 볼 권한이 없습니다.";
    }
    return getApiErrorMessage(error, fallbackMessage);
};

export const todoAdapter = {
    async fetchTodos({ fromDate, toDate }) {
        const response = await api.get("/todos", {
            params: {
                from_date: fromDate,
                to_date: toDate,
            },
        });
        return normalizeRangeResponse(unwrapTodoData(response), { fromDate, toDate });
    },

    async createTodo({ title, dueDate }) {
        const response = await api.post("/todos", toSnakePayload({ title, dueDate }));
        return normalizeTodo(unwrapTodoData(response));
    },

    async updateTodo(todoId, payload) {
        const response = await api.patch(`/todos/${todoId}`, toSnakePayload(payload));
        return normalizeTodo(unwrapTodoData(response));
    },

    async deleteTodo(todoId) {
        await api.delete(`/todos/${todoId}`);
    },
};
