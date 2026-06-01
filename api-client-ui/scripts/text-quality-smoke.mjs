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
const scriptExtensions = new Set([".js", ".jsx", ".mjs"]);
const textExtensions = new Set([".css", ".md"]);
const badTextPattern = /[\u3400-\u9fff\uf900-\ufaff\ufffd]/u;
const commonMojibakePattern = /(?:\u00ec|\u00eb|\u00ea|\u00ed|\u00c3|\u00c2|\u00e2\u20ac|\u00e2\u20ac\u2122|\u00e2\u20ac\u0153|\u00e2\u20ac\ufffd)/u;
const repeatedQuestionPattern = /\?{2,}/u;
const escapedKoreanPattern = /\\u(?:[aA][c-fC-F][0-9a-fA-F]{2}|[bB-cC][0-9a-fA-F]{3}|[dD][0-7][0-9a-fA-F]{2})/u;
const blockedPhrases = [
    "text-fixed",
    "AUTHENTICATING",
    "CONTINUE SIGN IN",
    "LOG IN WITH GOOGLE",
    "Request Release",
    "Account Locked",
    "No XP history yet",
    "Loading XP history",
    "AdSense client",
    "AdSense slot ID",
    "e.g. login.attempt",
    "v2/v3 issue",
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

const lineNumberAt = (source, index) => source.slice(0, index).split("\n").length;

const patternLine = (source, pattern) => {
    const index = source.search(pattern);
    return index >= 0 ? lineNumberAt(source, index) : null;
};

const skipExpression = (source, startIndex) => {
    let depth = 1;
    let index = startIndex;

    while (index < source.length && depth > 0) {
        const char = source[index];

        if (char === "'" || char === "\"" || char === "`") {
            index = skipString(source, index, true).endIndex;
            continue;
        }
        if (char === "{") {
            depth += 1;
        } else if (char === "}") {
            depth -= 1;
        }

        index += 1;
    }

    return index;
};

const skipString = (source, startIndex, expressionMode = false) => {
    const quote = source[startIndex];
    let index = startIndex + 1;
    const segments = [];
    let segmentStart = index;

    while (index < source.length) {
        const char = source[index];

        if (char === "\\") {
            index += 2;
            continue;
        }
        if (quote !== "`" && (char === "\n" || char === "\r")) {
            break;
        }
        if (quote === "`" && char === "$" && source[index + 1] === "{") {
            if (!expressionMode && segmentStart < index) {
                segments.push({ start: segmentStart, text: source.slice(segmentStart, index) });
            }
            index = skipExpression(source, index + 2);
            segmentStart = index;
            continue;
        }
        if (char === quote) {
            if (!expressionMode && segmentStart < index) {
                segments.push({ start: segmentStart, text: source.slice(segmentStart, index) });
            }
            index += 1;
            break;
        }

        index += 1;
    }

    return { endIndex: index, segments };
};

const extractStringSegments = (source) => {
    const segments = [];
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        if (char === "/" && source[index + 1] === "/") {
            const endIndex = source.indexOf("\n", index + 2);
            index = endIndex >= 0 ? endIndex + 1 : source.length;
            continue;
        }
        if (char === "/" && source[index + 1] === "*") {
            const endIndex = source.indexOf("*/", index + 2);
            index = endIndex >= 0 ? endIndex + 2 : source.length;
            continue;
        }
        if (char === "'" || char === "\"" || char === "`") {
            const literal = skipString(source, index);
            segments.push(...literal.segments);
            index = literal.endIndex;
            continue;
        }

        index += 1;
    }

    return segments;
};

const failures = [];

for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    const normalizedFile = file.split(path.sep).join("/");
    const extension = path.extname(file);

    if (badTextPattern.test(source)) {
        failures.push(`${file}:${patternLine(source, badTextPattern)}: mojibake-like text`);
    }
    if (commonMojibakePattern.test(source)) {
        failures.push(`${file}:${patternLine(source, commonMojibakePattern)}: common UTF-8 mojibake pattern`);
    }

    if (normalizedFile === "scripts/text-quality-smoke.mjs") {
        continue;
    }

    if (escapedKoreanPattern.test(source)) {
        failures.push(`${file}:${patternLine(source, escapedKoreanPattern)}: escaped Korean text`);
    }

    if (scriptExtensions.has(extension)) {
        for (const segment of extractStringSegments(source)) {
            const index = segment.text.search(repeatedQuestionPattern);
            if (index >= 0) {
                failures.push(`${file}:${lineNumberAt(source, segment.start + index)}: suspicious repeated question marks in text literal`);
            }
        }
    } else if (textExtensions.has(extension) && repeatedQuestionPattern.test(source)) {
        failures.push(`${file}:${patternLine(source, repeatedQuestionPattern)}: suspicious repeated question marks in text`);
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
