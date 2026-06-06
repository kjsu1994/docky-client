import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const includeRuntimeChecks = process.env.SMOKE_RUNTIME === "1";
const checks = [
    ["run", "smoke:text-quality"],
    ["run", "smoke:api-errors"],
    ["run", "smoke:toast-runtime"],
    ["run", "smoke:page-guides"],
    ["run", "smoke:navigation-routes"],
    ["run", "smoke:auth-ui"],
    ["run", "smoke:home-ui"],
    ["run", "smoke:hub-ui"],
    ...(includeRuntimeChecks ? [["run", "smoke:home-runtime"], ["run", "smoke:home-assets"], ["run", "smoke:home-performance"], ["run", "smoke:auth-performance"], ["run", "smoke:home-api-load"]] : []),
    ["run", "smoke:boards-ui"],
    ["run", "smoke:mypage-ui"],
    ["run", "smoke:chat-ui"],
    ["run", "smoke:news-ui"],
    ["run", "smoke:ranks-ui"],
    ["run", "smoke:streaming-ui"],
    ["run", "smoke:admin-streaming-ui"],
    ["run", "smoke:admin-command-center-ui"],
    ["run", "smoke:admin-anomalies-ui"],
    ["run", "smoke:admin-operations-ui"],
    ["run", "smoke:plinko-ui"],
    ["run", "smoke:no-thanks-ui"],
    ["run", "smoke:las-vegas-ui"],
    ["run", "smoke:facility-ui"],
    ["run", "smoke:optimizer-ui"],
    ["run", "smoke:invest-ui"],
    ["run", "smoke:stats-ui"],
    ["run", "smoke:todo-ui"],
    ["run", "smoke:tabletop-ui"],
];

const run = (args) => new Promise((resolve, reject) => {
    const command = process.platform === "win32"
        ? (process.env.ComSpec || "cmd.exe")
        : npmCommand;
    const commandArgs = process.platform === "win32"
        ? ["/d", "/s", "/c", ["npm", ...args].join(" ")]
        : args;
    const child = spawn(command, commandArgs, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
        if (code === 0) {
            resolve();
            return;
        }
        reject(new Error(`${npmCommand} ${args.join(" ")} failed with exit code ${code}`));
    });
});

for (const args of checks) {
    await run(args);
}
