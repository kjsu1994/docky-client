import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
    ["run", "smoke:text-quality"],
    ["run", "smoke:page-guides"],
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
