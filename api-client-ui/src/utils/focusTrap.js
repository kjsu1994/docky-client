const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "details:not([disabled]) > summary:first-of-type",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])",
].join(", ");

const isFocusableElement = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    if (element.closest("[aria-hidden='true'], [inert]")) return false;
    if ("disabled" in element && element.disabled) return false;
    return element.getClientRects().length > 0;
};

export const getFocusableElements = (container) => {
    if (!container || typeof HTMLElement === "undefined") return [];

    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
        return isFocusableElement(element);
    });
};

const resolveFocusableElements = (target) => {
    if (Array.isArray(target)) {
        return target.filter((element) => {
            return element && typeof HTMLElement !== "undefined" && isFocusableElement(element);
        });
    }
    return getFocusableElements(target);
};

export const trapFocus = (event, target) => {
    if (event.key !== "Tab") return;

    const focusableElements = resolveFocusableElements(target);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
};
