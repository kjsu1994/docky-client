export class PipeCdp {
    constructor(chrome, { debug = false } = {}) {
        this.chrome = chrome;
        this.debug = debug;
        this.nextMessageId = 900000;
        this.buffer = Buffer.alloc(0);
        this.pending = new Map();
        this.sessionHandlers = new Map();

        chrome.stdio[4].on("data", (chunk) => this.handleData(chunk));
        chrome.once("exit", (code) => {
            const error = new Error(`Chrome exited before CDP command completed${code === null ? "" : `: ${code}`}`);
            for (const waiter of this.pending.values()) {
                clearTimeout(waiter.timeoutId);
                waiter.reject(error);
            }
            this.pending.clear();
        });
    }

    send(method, params = {}, timeoutMs = 10000) {
        const id = this.nextMessageId++;
        const message = { id, method, params };
        if (this.debug) console.log("cdp send", id, method, "browser");
        this.chrome.stdio[3].write(`${JSON.stringify(message)}\0`);
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`${method}: timed out waiting for Chrome DevTools response`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, method, timeoutId });
        });
    }

    createSessionSocket(sessionId) {
        if (!this.sessionHandlers.has(sessionId)) {
            this.sessionHandlers.set(sessionId, []);
        }

        return {
            addEventListener: (type, handler, options = {}) => {
                if (type === "open") {
                    setTimeout(handler, 0);
                    return;
                }
                if (type !== "message") return;
                const handlers = this.sessionHandlers.get(sessionId);
                const wrapped = options.once
                    ? (event) => {
                        handler(event);
                        const index = handlers.indexOf(wrapped);
                        if (index >= 0) handlers.splice(index, 1);
                    }
                    : handler;
                handlers.push(wrapped);
            },
            send: (raw) => {
                const message = JSON.parse(raw);
                if (this.debug) console.log("cdp send", message.id || message.method, message.method, sessionId);
                this.chrome.stdio[3].write(`${JSON.stringify({ ...message, sessionId })}\0`);
            },
        };
    }

    handleData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        let frameEnd = this.buffer.indexOf(0);
        while (frameEnd !== -1) {
            const raw = this.buffer.subarray(0, frameEnd).toString("utf8");
            this.buffer = this.buffer.subarray(frameEnd + 1);
            frameEnd = this.buffer.indexOf(0);
            if (!raw) continue;

            const message = JSON.parse(raw);
            if (this.debug) console.log("cdp recv", message.id || message.method, message.sessionId || "browser");
            if (message.sessionId && this.sessionHandlers.has(message.sessionId)) {
                const handlers = this.sessionHandlers.get(message.sessionId);
                const { sessionId, ...payload } = message;
                for (const handler of [...handlers]) {
                    handler({ data: JSON.stringify(payload) });
                }
                continue;
            }

            if (message.id && this.pending.has(message.id)) {
                const waiter = this.pending.get(message.id);
                this.pending.delete(message.id);
                clearTimeout(waiter.timeoutId);
                if (message.error) {
                    waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
                } else {
                    waiter.resolve(message);
                }
            }
        }
    }
}

export async function createPipeSession(chrome, { debug = false, testName = "smoke test" } = {}) {
    const cdp = new PipeCdp(chrome, { debug });
    await cdp.send("Browser.getVersion");
    const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
    const targetId = targetResponse.result?.targetId;
    if (!targetId) {
        throw new Error(`Could not create Chrome target for ${testName}.`);
    }
    const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = attachResponse.result?.sessionId;
    if (!sessionId) {
        throw new Error(`Could not attach to Chrome target for ${testName}.`);
    }
    return cdp.createSessionSocket(sessionId);
}
