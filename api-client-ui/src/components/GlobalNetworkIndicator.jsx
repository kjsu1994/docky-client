import { useEffect, useState } from "react";
import { subscribeNetworkActivity } from "../utils/networkActivity";

export const GlobalNetworkIndicator = () => {
    const [activeRequests, setActiveRequests] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => subscribeNetworkActivity(setActiveRequests), []);

    useEffect(() => {
        let timerId;
        if (activeRequests > 0) {
            timerId = window.setTimeout(() => setVisible(true), 120);
        } else {
            setVisible(false);
        }
        return () => {
            if (timerId) window.clearTimeout(timerId);
        };
    }, [activeRequests]);

    if (!visible) return null;

    return (
        <div className="network-indicator" aria-live="polite" aria-label="요청 처리 중">
            <div className="network-indicator__bar" />
        </div>
    );
};
