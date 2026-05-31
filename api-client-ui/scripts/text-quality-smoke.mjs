import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = [
    "src",
    "scripts",
    "README.md",
    "docs/SCREEN_API_MAPPING.md",
];

const ignoredDirs = new Set(["node_modules", "dist", ".git"]);
const checkedExtensions = new Set([".js", ".jsx", ".mjs", ".css", ".md"]);
const badTextPattern = /[\u3400-\u9fff\uf900-\ufaff\ufffd]/u;
const commonMojibakePattern = /(?:\u00ec|\u00eb|\u00ea|\u00ed|\u00c3|\u00c2|\u00e2\u20ac|\u00e2\u20ac\u2122|\u00e2\u20ac\u0153|\u00e2\u20ac\ufffd)/u;
const blockedPhrases = [
    "text-fixed",
    "AUTHENTICATING",
    "CONTINUE SIGN IN",
    "LOG IN WITH GOOGLE",
    "Request Release",
    "Account Locked",
    "No XP history yet",
    "Loading XP history",
];

const files = [];

const walk = async (relativePath) => {
    const absolutePath = path.join(root, relativePath);
    const info = await stat(absolutePath);

    if (info.isDirectory()) {
        if (ignoredDirs.has(path.basename(relativePath))) return;
        const entries = await readdir(absolutePath);
        await Promise.all(entries.map((entry) => walk(path.join(relativePath, entry))));
        return;
    }

    if (checkedExtensions.has(path.extname(relativePath))) {
        files.push(relativePath);
    }
};

await Promise.all(scanRoots.map(walk));

const failures = [];

for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    const normalizedFile = file.split(path.sep).join("/");

    if (badTextPattern.test(source)) {
        failures.push(`${file}: mojibake-like text`);
    }
    if (commonMojibakePattern.test(source)) {
        failures.push(`${file}: common UTF-8 mojibake pattern`);
    }

    if (normalizedFile === "scripts/text-quality-smoke.mjs") {
        continue;
    }

    if (normalizedFile.startsWith("src/") && /console\.(log|debug|info)\s*\(/.test(source)) {
        failures.push(`${file}: production console log/debug/info`);
    }
    if (normalizedFile.startsWith("src/") && /window\.(alert|confirm)\s*\(/.test(source)) {
        failures.push(`${file}: blocking browser dialog`);
    }

    for (const phrase of blockedPhrases) {
        if (source.includes(phrase)) {
            failures.push(`${file}: blocked phrase "${phrase}"`);
        }
    }
}

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log(`text-quality-smoke ok (${files.length} files)`);
