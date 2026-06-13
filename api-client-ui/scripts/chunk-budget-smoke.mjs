import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distAssetsDir = path.resolve(__dirname, "../dist/assets");

const kb = (bytes) => bytes / 1024;
const formatKb = (bytes) => `${kb(bytes).toFixed(2)}KB`;

const assert = (condition, message) => {
  if (!condition) throw new Error(`chunk-budget-smoke: ${message}`);
};

assert(existsSync(distAssetsDir), "dist/assets is missing; run npm.cmd run build:bundle first");

const files = readdirSync(distAssetsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => {
    const fullPath = path.join(distAssetsDir, file);
    const source = readFileSync(fullPath);
    return {
      file,
      rawBytes: source.length,
      gzipBytes: gzipSync(source).length,
    };
  });

assert(files.length > 0, "no JavaScript chunks found in dist/assets");

const expectedChunks = [
  { label: "TabletopGame", pattern: /^TabletopGame-.*\.js$/, maxRawKb: 80, maxGzipKb: 25 },
  { label: "CatanBoard", pattern: /^CatanBoard-.*\.js$/, maxRawKb: 230, maxGzipKb: 60 },
  { label: "BlokusBoard", pattern: /^BlokusBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "DalmutiBoard", pattern: /^DalmutiBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "SixNimmtBoard", pattern: /^SixNimmtBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "TelestrationsBoard", pattern: /^TelestrationsBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "MafiaBoard", pattern: /^MafiaBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "MaheBoard", pattern: /^MaheBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "PokerBoard", pattern: /^PokerBoard-.*\.js$/, maxRawKb: 90, maxGzipKb: 25 },
  { label: "GamesHub", pattern: /^GamesHub-.*\.js$/, maxRawKb: 75, maxGzipKb: 24 },
];

const checked = [];
for (const budget of expectedChunks) {
  const matches = files.filter((file) => budget.pattern.test(file.file));
  assert(matches.length === 1, `${budget.label} expected one chunk, found ${matches.length}`);
  const chunk = matches[0];
  assert(kb(chunk.rawBytes) <= budget.maxRawKb, `${chunk.file} raw ${formatKb(chunk.rawBytes)} exceeds ${budget.maxRawKb}KB`);
  assert(kb(chunk.gzipBytes) <= budget.maxGzipKb, `${chunk.file} gzip ${formatKb(chunk.gzipBytes)} exceeds ${budget.maxGzipKb}KB`);
  checked.push(`${budget.label} ${formatKb(chunk.rawBytes)} raw / ${formatKb(chunk.gzipBytes)} gzip`);
}

const oversized = files.filter((file) => kb(file.rawBytes) > 500);
assert(oversized.length === 0, `Vite warning-sized chunks found: ${oversized.map((file) => `${file.file} ${formatKb(file.rawBytes)}`).join(", ")}`);

console.log(`chunk-budget-smoke ok (${checked.join("; ")})`);
