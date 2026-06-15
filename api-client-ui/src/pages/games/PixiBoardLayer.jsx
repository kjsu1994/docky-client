import { useEffect, useRef, useState } from "react";

const playerColors = [0x38bdf8, 0xf59e0b, 0x22c55e, 0xa855f7, 0xfb7185, 0x14b8a6, 0xeab308];

const numberOr = (value, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
};

const moneyValue = (card) => numberOr(card?.amount ?? card?.value ?? card?.money ?? card, 0);

const makeText = (Pixi, text, { x = 0, y = 0, size = 12, fill = 0xffffff, weight = "800" } = {}) => {
    let node;
    try {
        node = new Pixi.Text({
            text: String(text),
            style: { fill, fontFamily: "Arial, sans-serif", fontSize: size, fontWeight: weight, align: "center" },
        });
    } catch {
        node = new Pixi.Text(String(text), { fill, fontFamily: "Arial, sans-serif", fontSize: size, fontWeight: weight, align: "center" });
    }
    node.anchor?.set?.(0.5);
    node.x = x;
    node.y = y;
    return node;
};

const clearStage = (app) => {
    const children = app.stage.removeChildren();
    children.forEach((child) => {
        child.destroy?.({ children: true });
    });
};

const drawLasVegas = ({ app, Pixi, width, height, props }) => {
    const {
        casinos = [],
        currentRollCountByFace = {},
        hotCasinoNo,
        lastPlacedCasinoNo,
    } = props;
    const g = new Pixi.Graphics();
    g.roundRect(0, 0, width, height, 20).fill(0x08111f);
    g.roundRect(1, 1, width - 2, height - 2, 20).stroke({ color: 0x38bdf8, alpha: 0.28, width: 1 });
    app.stage.addChild(g);

    const safeCasinos = casinos.length ? casinos.slice(0, 6) : [1, 2, 3, 4, 5, 6].map((casinoNo) => ({ casinoNo }));
    const cols = width < 540 ? 2 : 3;
    const gap = width < 420 ? 8 : 12;
    const rows = Math.ceil(safeCasinos.length / cols);
    const cardW = Math.max(92, (width - gap * (cols + 1)) / cols);
    const cardH = Math.max(62, (height - gap * (rows + 1)) / rows);
    let objectCount = 0;

    safeCasinos.forEach((casino, index) => {
        const casinoNo = numberOr(casino.casinoNo ?? casino.casino_no, index + 1);
        const x = gap + (index % cols) * (cardW + gap);
        const y = gap + Math.floor(index / cols) * (cardH + gap);
        const diceByPlayer = casino.diceByPlayer || casino.dice_by_player || {};
        const diceEntries = Object.entries(diceByPlayer)
            .map(([memberId, count], playerIndex) => ({ memberId, count: numberOr(count, 0), playerIndex }))
            .filter((entry) => entry.count > 0);
        const moneyCards = Array.isArray(casino.moneyCards || casino.money_cards) ? (casino.moneyCards || casino.money_cards) : [];
        const totalMoney = numberOr(casino.totalMoney ?? casino.total_money, moneyCards.reduce((sum, card) => sum + moneyValue(card), 0));
        const rollCount = numberOr(currentRollCountByFace[casinoNo] ?? currentRollCountByFace[String(casinoNo)], 0);
        const active = Number(hotCasinoNo) === casinoNo || Number(lastPlacedCasinoNo) === casinoNo || rollCount > 0;

        const card = new Pixi.Graphics();
        card.roundRect(x, y, cardW, cardH, 16).fill(active ? 0x0e7490 : 0x12203a);
        card.roundRect(x + 1, y + 1, cardW - 2, cardH - 2, 15).stroke({ color: active ? 0xfacc15 : 0x38bdf8, alpha: active ? 0.86 : 0.28, width: active ? 2 : 1 });
        app.stage.addChild(card);

        const badge = new Pixi.Graphics();
        badge.circle(x + 24, y + 24, 17).fill(active ? 0xfacc15 : 0x38bdf8);
        app.stage.addChild(badge);
        app.stage.addChild(makeText(Pixi, casinoNo, { x: x + 24, y: y + 25, size: 16, fill: 0x07111f, weight: "900" }));
        app.stage.addChild(makeText(Pixi, totalMoney ? `${Math.round(totalMoney / 10000)}만` : "대기", { x: x + cardW - 34, y: y + 23, size: 12, fill: 0xe0f2fe, weight: "900" }));

        moneyCards.slice(0, 3).forEach((moneyCard, moneyIndex) => {
            const chip = new Pixi.Graphics();
            chip.roundRect(x + 12 + moneyIndex * 28, y + cardH - 25, 24, 12, 5).fill([0x22c55e, 0xf59e0b, 0xa855f7][moneyIndex % 3]);
            chip.stroke({ color: 0xffffff, alpha: 0.22, width: 1 });
            app.stage.addChild(chip);
            objectCount += 1;
        });

        diceEntries.slice(0, 5).forEach((entry, diceIndex) => {
            const dice = new Pixi.Graphics();
            const dx = x + 58 + diceIndex * 22;
            const dy = y + Math.max(34, cardH * 0.55);
            dice.roundRect(dx, dy, 18, 18, 5).fill(playerColors[entry.playerIndex % playerColors.length]);
            dice.stroke({ color: 0xffffff, alpha: 0.4, width: 1 });
            dice.circle(dx + 9, dy + 9, 2.6).fill(0x0f172a);
            app.stage.addChild(dice);
            app.stage.addChild(makeText(Pixi, entry.count, { x: dx + 9, y: dy + 30, size: 10, fill: 0xe2e8f0, weight: "900" }));
            objectCount += 1;
        });

        if (rollCount > 0) {
            app.stage.addChild(makeText(Pixi, `굴림 ${rollCount}`, { x: x + cardW / 2, y: y + cardH - 10, size: 11, fill: 0xfef3c7, weight: "900" }));
        }
        objectCount += 1;
    });

    return objectCount;
};

const drawMahe = ({ app, Pixi, width, height, props }) => {
    const {
        turtles = [],
        stacks = [],
        scores = [],
        activeSeatNo,
        projectedDestination,
        trackSize = 21,
        currentEgg,
        dice = [],
        diceSum = 0,
    } = props;
    const g = new Pixi.Graphics();
    g.roundRect(0, 0, width, height, 20).fill(0x052e2b);
    g.roundRect(1, 1, width - 2, height - 2, 20).stroke({ color: 0x34d399, alpha: 0.3, width: 1 });
    app.stage.addChild(g);

    const centerX = width / 2;
    const centerY = height * 0.48;
    const radius = Math.max(50, Math.min(width * 0.4, height * 0.34));
    const safeTrackSize = Math.max(2, numberOr(trackSize, 21));
    const stackByPosition = new Map();
    stacks.forEach((stack) => {
        const position = numberOr(stack.position, 0);
        const seatNos = Array.isArray(stack.seatNos || stack.seat_nos) ? (stack.seatNos || stack.seat_nos) : [];
        stackByPosition.set(position, seatNos.map(Number).filter(Boolean));
    });
    const scoreBySeat = new Map(scores.map((score) => [numberOr(score.seatNo ?? score.seat_no, 0), numberOr(score.score, 0)]));
    let objectCount = 0;

    const track = new Pixi.Graphics();
    track.circle(centerX, centerY, radius + 14).fill(0x064e3b);
    track.circle(centerX, centerY, radius - 16).fill(0x0f766e);
    app.stage.addChild(track);
    app.stage.addChild(makeText(Pixi, currentEgg ?? "-", { x: centerX, y: centerY + 5, size: 28, fill: 0xfacc15, weight: "900" }));

    for (let position = 0; position < safeTrackSize; position += 1) {
        const angle = (position / safeTrackSize) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const active = position === numberOr(projectedDestination, -1);
        const space = new Pixi.Graphics();
        space.circle(x, y, active ? 8 : 6).fill(active ? 0xfacc15 : 0xccfbf1);
        space.stroke({ color: active ? 0xf59e0b : 0x14b8a6, alpha: 0.8, width: active ? 2 : 1 });
        app.stage.addChild(space);
    }

    turtles.forEach((turtle, index) => {
        const seatNo = numberOr(turtle.seatNo ?? turtle.seat_no, index + 1);
        const position = Math.max(0, numberOr(turtle.position, 0)) % safeTrackSize;
        const angle = (position / safeTrackSize) * Math.PI * 2 - Math.PI / 2;
        const stackSeatNos = stackByPosition.get(position) || [seatNo];
        const stackIndex = Math.max(0, stackSeatNos.indexOf(seatNo));
        const x = centerX + Math.cos(angle) * (radius + 1) + stackIndex * 6;
        const y = centerY + Math.sin(angle) * (radius + 1) - stackIndex * 6;
        const active = Number(activeSeatNo) === seatNo;
        const color = playerColors[index % playerColors.length];
        const token = new Pixi.Graphics();
        token.ellipse(x, y, active ? 16 : 13, active ? 11 : 9).fill(color);
        token.stroke({ color: active ? 0xfacc15 : 0xffffff, alpha: active ? 0.9 : 0.42, width: active ? 3 : 1 });
        token.circle(x + 14, y - 1, active ? 6 : 5).fill(color);
        app.stage.addChild(token);
        app.stage.addChild(makeText(Pixi, seatNo, { x, y: y + 2, size: 10, fill: 0x052e2b, weight: "900" }));
        const score = scoreBySeat.get(seatNo);
        if (score) {
            app.stage.addChild(makeText(Pixi, `${score}점`, { x, y: y + 24, size: 10, fill: 0xecfeff, weight: "900" }));
        }
        objectCount += 1;
    });

    dice.slice(0, 3).forEach((face, index) => {
        const x = 18 + index * 34;
        const y = height - 40;
        const die = new Pixi.Graphics();
        die.roundRect(x, y, 28, 28, 7).fill(0xf8fafc);
        die.stroke({ color: 0x14b8a6, alpha: 0.72, width: 2 });
        app.stage.addChild(die);
        app.stage.addChild(makeText(Pixi, face, { x: x + 14, y: y + 15, size: 14, fill: 0x0f172a, weight: "900" }));
        objectCount += 1;
    });
    app.stage.addChild(makeText(Pixi, `합계 ${diceSum || 0}`, { x: width - 56, y: height - 24, size: 13, fill: 0xecfeff, weight: "900" }));

    return objectCount;
};

export const PixiBoardLayer = ({ game, dataSmoke, label, className = "", height = 184, ...props }) => {
    const rootRef = useRef(null);
    const mountRef = useRef(null);
    const appRef = useRef(null);
    const pixiRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height });
    const [readyTick, setReadyTick] = useState(0);
    const motionKey = props["data-gsap"];

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;
        const update = () => {
            const rect = root.getBoundingClientRect();
            setSize({
                width: Math.max(1, Math.round(rect.width || root.clientWidth || 1)),
                height: Math.max(120, Math.round(rect.height || height)),
            });
        };
        update();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
        observer?.observe(root);
        window.addEventListener("resize", update);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", update);
        };
    }, [height]);

    useEffect(() => {
        let disposed = false;
        const mount = mountRef.current;
        const root = rootRef.current;
        if (!mount || !root) return undefined;

        import("pixi.js").then(async (Pixi) => {
            if (disposed) return;
            const app = new Pixi.Application();
            await app.init({
                width: Math.max(1, size.width),
                height: Math.max(120, size.height),
                backgroundAlpha: 0,
                antialias: true,
                autoDensity: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                preserveDrawingBuffer: true,
                powerPreference: "high-performance",
            });
            if (disposed) {
                app.destroy(true);
                return;
            }
            app.ticker.maxFPS = 30;
            const canvas = app.canvas || app.view;
            canvas.setAttribute("aria-hidden", "true");
            mount.appendChild(canvas);
            app.ticker.add(() => {
                if (rootRef.current) {
                    rootRef.current.dataset.pixiFps = String(Math.round(app.ticker.FPS || 0));
                }
            });
            appRef.current = app;
            pixiRef.current = Pixi;
            root.dataset.pixiReady = "true";
            setReadyTick((value) => value + 1);
        }).catch((error) => {
            if (rootRef.current) {
                rootRef.current.dataset.pixiReady = "false";
                rootRef.current.dataset.pixiError = error?.message || "pixi-load-failed";
            }
        });

        return () => {
            disposed = true;
            const app = appRef.current;
            appRef.current = null;
            pixiRef.current = null;
            if (app) {
                app.destroy(true, { children: true, texture: true, textureSource: true });
            }
            if (mount) mount.replaceChildren();
        };
    }, []);

    useEffect(() => {
        const app = appRef.current;
        const Pixi = pixiRef.current;
        const root = rootRef.current;
        if (!app || !Pixi || !root || !size.width || !size.height) return;

        app.renderer.resize(size.width, size.height);
        clearStage(app);
        const objectCount = game === "mahe"
            ? drawMahe({ app, Pixi, width: size.width, height: size.height, props })
            : drawLasVegas({ app, Pixi, width: size.width, height: size.height, props });
        app.render();
        root.dataset.pixiReady = "true";
        root.dataset.pixiObjectCount = String(objectCount);
        root.dataset.pixiMemoryMb = String(Math.round((performance?.memory?.usedJSHeapSize || 0) / 1024 / 1024));
    }, [game, props, readyTick, size.height, size.width]);

    return (
        <div
            ref={rootRef}
            className={`pixi-board-layer overflow-hidden rounded-[1.35rem] border border-white/15 bg-slate-950/40 shadow-inner ${className}`}
            style={{ minHeight: height }}
            data-smoke={dataSmoke}
            data-gsap={motionKey}
            data-pixi-game={game}
            data-pixi-ready="false"
            data-pixi-object-count="0"
            data-pixi-fps="0"
            data-pixi-memory-mb="0"
            role="img"
            aria-label={label}
        >
            <div ref={mountRef} className="h-full w-full" />
        </div>
    );
};

export default PixiBoardLayer;
