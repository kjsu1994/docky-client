import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adapterSource = readFileSync(path.join(rootDir, "src", "adapters", "queueAdapter.js"), "utf8");
const queuePageSource = readFileSync(path.join(rootDir, "src", "pages", "access", "Queue.jsx"), "utf8");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

assert(adapterSource.includes("ctfmon.queue.clientId"), "queueAdapter must persist a browser queue id");
assert(adapterSource.includes("X-Queue-User"), "queueAdapter must send the anonymous queue id header");
assert(adapterSource.includes("randomUUID") || adapterSource.includes("Math.random"), "queueAdapter must generate a queue id");
assert(queuePageSource.includes("대기 정보가 유지됩니다"), "Queue page must describe browser queue persistence");
assert(!queuePageSource.includes("초기화될 수 있습니다"), "Queue page must not warn that refresh resets the queue");

console.log("queue-ui-smoke ok (browser queue identity checks)");
