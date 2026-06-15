import { useEffect } from "react";
import { animateFromToWithGsap } from "../utils/motion.js";

const DEFAULT_FROM = { opacity: 0.82, y: 8, scale: 0.985 };
const DEFAULT_TO = { opacity: 1, y: 0, scale: 1, duration: 0.28, stagger: 0.025, ease: "power2.out" };

export const useGameGsapMotion = ({
    scopeRef,
    signal,
    selectors = [],
    from = DEFAULT_FROM,
    to = DEFAULT_TO,
} = {}) => {
    useEffect(() => {
        const scope = scopeRef?.current;
        if (!scope || !selectors.length) return undefined;

        const targets = selectors.flatMap((selector) => Array.from(scope.querySelectorAll(selector)));
        if (!targets.length) return undefined;

        let cancelled = false;
        animateFromToWithGsap(
            targets,
            { transformOrigin: "50% 50%", ...from },
            {
                transformOrigin: "50% 50%",
                ...to,
                onComplete: () => {
                    if (cancelled) return;
                    targets.forEach((target) => {
                        target.style.removeProperty("transform");
                    });
                },
            },
        ).catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [from, scopeRef, selectors, signal, to]);
};

export default useGameGsapMotion;
