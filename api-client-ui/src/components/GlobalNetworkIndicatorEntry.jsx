import { lazy, Suspense, useEffect, useState } from "react";
import { subscribeNetworkActivity } from "../utils/networkActivity.js";

const GlobalNetworkIndicator = lazy(() =>
    import("./GlobalNetworkIndicator.jsx").then((module) => ({ default: module.GlobalNetworkIndicator }))
);

export const GlobalNetworkIndicatorEntry = () => {
    const [activated, setActivated] = useState(false);

    useEffect(() => subscribeNetworkActivity((activeRequests) => {
        if (activeRequests > 0) {
            setActivated(true);
        }
    }), []);

    if (!activated) return null;

    return (
        <Suspense fallback={null}>
            <GlobalNetworkIndicator />
        </Suspense>
    );
};

export default GlobalNetworkIndicatorEntry;
