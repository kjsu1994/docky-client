import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const sourceDir = path.resolve(projectRoot, "dist");
const targetRoot = path.resolve(process.env.STATIC_DEPLOY_ROOT || "C:/compose/minio-data/client");
const releasesDir = path.join(targetRoot, "releases");
const currentDir = path.join(targetRoot, "current");
const releaseRetention = Number.parseInt(process.env.STATIC_RELEASE_RETENTION || "1", 10);
const deployConfirmArg = "--confirm-current-switch";
const deployConfirmEnvName = "STATIC_DEPLOY_CONFIRM";
const deployConfirmEnvValue = "final-current-switch";
const preDeployReadinessEvidencePath = process.env.STATIC_PRE_DEPLOY_READINESS_EVIDENCE_PATH || "C:/compose/logs/pre-complete-readiness.json";
const preDeployAssertScript = path.resolve(
  projectRoot,
  process.env.STATIC_PRE_DEPLOY_ASSERT_SCRIPT || "../../compose-safe-repo/scripts/assert-pre-deploy-readiness.ps1"
);
const powershellExecutable = process.env.POWERSHELL_EXE || "powershell.exe";

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const previousReleaseDir = path.join(releasesDir, `${stamp}-${process.pid}-previous`);
const nextCurrentDir = path.join(targetRoot, `.current-next-${stamp}-${process.pid}`);

const requiredFiles = ["index.html", "sw.js"];

const assertDeployConfirmed = () => {
  const confirmedByArg = process.argv.includes(deployConfirmArg);
  const confirmedByEnv = process.env[deployConfirmEnvName] === deployConfirmEnvValue;
  if (confirmedByArg || confirmedByEnv) {
    return;
  }

  console.error(
    `[deploy-static] refused to switch current. Pass ${deployConfirmArg} or set ${deployConfirmEnvName}=${deployConfirmEnvValue}.`
  );
  process.exit(2);
};

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

const normalizePathForCompare = (value) => path.resolve(value).toLowerCase();

const readReadinessEvidence = () => {
  try {
    return JSON.parse(fs.readFileSync(preDeployReadinessEvidencePath, "utf8"));
  } catch (error) {
    throw new Error(`[deploy-static] failed to read readiness evidence: ${error.message}`);
  }
};

const assertPreDeployReadiness = () => {
  if (!fs.existsSync(preDeployAssertScript)) {
    throw new Error(`[deploy-static] pre-deploy readiness assertion script not found: ${preDeployAssertScript}`);
  }

  const result = spawnSync(
    powershellExecutable,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      preDeployAssertScript,
      "-ReadinessEvidencePath",
      preDeployReadinessEvidencePath,
    ],
    { stdio: "inherit" }
  );

  if (result.error) {
    throw new Error(`[deploy-static] pre-deploy readiness assertion failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`[deploy-static] pre-deploy readiness assertion failed with exit code ${result.status}.`);
  }
};

const assertSourceMatchesReadiness = () => {
  const readiness = readReadinessEvidence();
  const manifest = readiness?.candidate_frontend_dist_manifest;
  const index = readiness?.candidate_frontend_dist_index;

  if (!manifest?.path) {
    throw new Error("[deploy-static] readiness evidence missing candidate_frontend_dist_manifest.path.");
  }
  if (!index?.path) {
    throw new Error("[deploy-static] readiness evidence missing candidate_frontend_dist_index.path.");
  }
  if (!manifest?.manifest_sha256 || !manifest?.stamp_manifest_sha256) {
    throw new Error("[deploy-static] readiness evidence missing frontend dist manifest hashes.");
  }

  const expectedDist = normalizePathForCompare(manifest.path);
  const actualDist = normalizePathForCompare(sourceDir);
  if (actualDist !== expectedDist) {
    throw new Error(`[deploy-static] source dist does not match readiness candidate_frontend_dist_manifest.path: ${sourceDir}`);
  }

  const expectedIndex = normalizePathForCompare(index.path);
  const actualIndex = normalizePathForCompare(path.join(sourceDir, "index.html"));
  if (actualIndex !== expectedIndex) {
    throw new Error(`[deploy-static] source index does not match readiness candidate_frontend_dist_index.path: ${actualIndex}`);
  }
};

const removeIfExists = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

const copyBuild = (from, to) => {
  removeIfExists(to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, preserveTimestamps: true });
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

assertDeployConfirmed();

if (!fs.existsSync(targetRoot)) {
  throw new Error(`[deploy-static] target root does not exist: ${targetRoot}`);
}

assertPreDeployReadiness();
assertSourceMatchesReadiness();
rotateCurrent();
pruneOldReleases();

console.log(`[deploy-static] published ${sourceDir} -> ${currentDir}; previous retained in ${releasesDir}`);
