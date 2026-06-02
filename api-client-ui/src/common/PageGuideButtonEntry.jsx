import { lazy, Suspense } from "react";

const PageGuideButton = lazy(() =>
    import("./PageGuideButton.jsx").then((module) => ({ default: module.PageGuideButton }))
);

export const PageGuideButtonEntry = () => {
    return (
        <Suspense fallback={null}>
            <PageGuideButton />
        </Suspense>
    );
};

export default PageGuideButtonEntry;
