let activeRequestCount = 0;
const listeners = new Set();

const notify = () => {
    const snapshot = activeRequestCount;
    listeners.forEach((listener) => listener(snapshot));
};

export const beginNetworkActivity = () => {
    activeRequestCount += 1;
    notify();
};

export const endNetworkActivity = () => {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    notify();
};

export const subscribeNetworkActivity = (listener) => {
    listeners.add(listener);
    listener(activeRequestCount);
    return () => listeners.delete(listener);
};

