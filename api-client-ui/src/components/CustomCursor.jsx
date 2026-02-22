import { useEffect, useState } from "react";

export const CustomCursor = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [isClicked, setIsClicked] = useState(false);

    useEffect(() => {
        const moveCursor = (e) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseOver = (e) => {
            // 버튼, 링크, 입력창 등 인터랙티브 요소에 호버 시
            if (e.target.closest("button, a, input, select, textarea, .spotlight-card")) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        const handleMouseDown = () => setIsClicked(true);
        const handleMouseUp = () => setIsClicked(false);

        window.addEventListener("mousemove", moveCursor);
        window.addEventListener("mouseover", handleMouseOver);
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", moveCursor);
            window.removeEventListener("mouseover", handleMouseOver);
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    return (
        <>
            {/* 중앙 점 */}
            <div
                className="cursor-dot hidden lg:block"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%) scale(${isClicked ? 0.8 : 1})`,
                }}
            />
            {/* 외곽 원 */}
            <div
                className={`cursor-outline hidden lg:block ${isHovering ? "cursor-hover" : ""}`}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%) scale(${isClicked ? 1.2 : 1})`,
                }}
            />
        </>
    );
};
