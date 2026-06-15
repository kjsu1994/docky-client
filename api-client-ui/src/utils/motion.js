let gsapLoader = null;

export const prefersReducedMotion = () => (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
);

const normalizeTargets = (targets) => {
    if (!targets) return [];
    if (typeof Element !== "undefined" && targets instanceof Element) return [targets];
    if (typeof SVGElement !== "undefined" && targets instanceof SVGElement) return [targets];
    if (typeof targets === "string") return Array.from(document.querySelectorAll(targets));
    if (Array.isArray(targets)) return targets.filter(Boolean);
    if (typeof targets.length === "number") return Array.from(targets).filter(Boolean);
    return [];
};

export const loadGsap = async () => {
    if (!gsapLoader) {
        gsapLoader = import("gsap").then((module) => module.gsap || module.default || module);
    }
    return gsapLoader;
};

export const animateWithGsap = async (targets, vars = {}) => {
    if (prefersReducedMotion()) return null;
    const targetList = normalizeTargets(targets);
    if (!targetList.length) return null;
    const gsap = await loadGsap();
    return gsap.to(targetList, { overwrite: "auto", ...vars });
};

export const animateFromToWithGsap = async (targets, fromVars = {}, toVars = {}) => {
    if (prefersReducedMotion()) return null;
    const targetList = normalizeTargets(targets);
    if (!targetList.length) return null;
    const gsap = await loadGsap();
    return gsap.fromTo(targetList, fromVars, { overwrite: "auto", ...toVars });
};
