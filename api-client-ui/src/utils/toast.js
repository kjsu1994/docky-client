export const loadToast = () => import("react-hot-toast").then((module) => module.default);

const dispatchToast = (handler) => {
    loadToast()
        .then(handler)
        .catch(() => {});
};

export const notifySuccess = (message, options) => {
    dispatchToast((toast) => toast.success(message, options));
};

export const notifyError = (message, options) => {
    dispatchToast((toast) => toast.error(message, options));
};

export const notifyLoading = async (message, options) => {
    try {
        const toast = await loadToast();
        const id = toast.loading(message, options);
        return {
            id,
            dismiss: () => toast.dismiss(id),
            success: (nextMessage, nextOptions) => toast.success(nextMessage, { ...(nextOptions || {}), id }),
            error: (nextMessage, nextOptions) => toast.error(nextMessage, { ...(nextOptions || {}), id }),
        };
    } catch {
        return {
            id: null,
            dismiss: () => {},
            success: (nextMessage, nextOptions) => notifySuccess(nextMessage, nextOptions),
            error: (nextMessage, nextOptions) => notifyError(nextMessage, nextOptions),
        };
    }
};

export const notify = (message, options) => {
    dispatchToast((toast) => toast(message, options));
};
