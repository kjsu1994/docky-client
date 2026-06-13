import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const sourceDir = path.resolve(projectRoot, "dist");
const targetRoot = path.resolve(process.env.STATIC_DEPLOY_ROOT || "C:/compose/minio-data/client");
const releasesDir = path.join(targetRoot, "releases");
const currentDir = path.join(targetRoot, "current");
const releaseRetention = Number.parseInt(process.env.STATIC_RELEASE_RETENTION || "1", 10);

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const previousReleaseDir = path.join(releasesDir, `${stamp}-${process.pid}-previous`);
const nextCurrentDir = path.join(targetRoot, `.current-next-${stamp}-${process.pid}`);

const requiredFiles = ["index.html", "sw.js"];

const assertBuildOutput = (dir) => {
  for (const file of requiredFiles) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required build file: ${filePath}`);
    }
  }
  const assetsDir = path.join(dir, "assets");
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    throw new Error(`Missing build assets directory: ${assetsDir}`);
  }
};

const removeIfExists = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

const copyBuild = (from, to) => {
  removeIfExists(to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};

const rotateCurrent = () => {
  const previousDir = path.join(targetRoot, `.current-previous-${stamp}-${process.pid}`);
  copyBuild(sourceDir, nextCurrentDir);
  assertBuildOutput(nextCurrentDir);

  if (fs.existsSync(currentDir)) {
    removeIfExists(previousDir);
    fs.renameSync(currentDir, previousDir);
  }

  try {
    fs.renameSync(nextCurrentDir, currentDir);
  } catch (error) {
    if (fs.existsSync(previousDir) && !fs.existsSync(currentDir)) {
      fs.renameSync(previousDir, currentDir);
    }
    removeIfExists(nextCurrentDir);
    throw error;
  }

  if (fs.existsSync(previousDir)) {
    fs.mkdirSync(releasesDir, { recursive: true });
    removeIfExists(previousReleaseDir);
    fs.renameSync(previousDir, previousReleaseDir);
    assertBuildOutput(previousReleaseDir);
  }
};

const pruneOldReleases = () => {
  if (!Number.isFinite(releaseRetention) || releaseRetention <= 0 || !fs.existsSync(releasesDir)) {
    return;
  }

  const releases = fs.readdirSync(releasesDir)
    .map((name) => ({
      name,
      path: path.join(releasesDir, name),
    }))
    .filter((entry) => fs.statSync(entry.path).isDirectory())
    .sort((left, right) => right.name.localeCompare(left.name));

  for (const release of releases.slice(releaseRetention)) {
    removeIfExists(release.path);
  }
};

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Build output not found: ${sourceDir}`);
}

assertBuildOutput(sourceDir);

if (!fs.existsSync(targetRoot)) {
  console.warn(`[deploy-static] skipped: target root does not exist: ${targetRoot}`);
  process.exit(0);
}

rotateCurrent();
pruneOldReleases();

console.log(`[deploy-static] published ${sourceDir} -> ${currentDir}; previous retained in ${releasesDir}`);
