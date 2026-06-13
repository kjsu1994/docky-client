import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFileSync(path.join(rootDir, relativePath), "utf8");
const optionalSource = (relativePath) => {
    const targetPath = path.join(rootDir, relativePath);
    return existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
};

const pageSource = source("src/pages/admin/AdminCommandCenter.jsx");
const protectedRoutesSource = source("src/components/ProtectedRoutes.jsx");
const allMenuSource = source("src/pages/home/AllMenu.jsx");
const guideSource = source("src/common/pageGuides.js");
const anomalyAdapterSource = source("src/adapters/adminAnomaliesAdapter.js");
const packageSource = source("package.json");
const mappingSource = optionalSource("docs/SCREEN_API_MAPPING.md");

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(`admin-command-center-ui-smoke: ${message}`);
    }
};

const requiredPageSnippets = [
    "운영 커맨드 센터",
    "통합 처리 큐",
    "회원 360",
    "데이터 상태",
    "handleIncidentStatus",
    "handleReportStatus",
    "handleReleaseRequest",
    "handleModeration",
    "handleBannerActive",
    "handleInboxImport",
    "handleCreateMemberSanction",
    "handleMemberRoleToggle",
    "promptAction",
    "confirmAction",
    "notifyLoading",
    "adminAnomaliesAdapter.fetchCommandCenter",
    "adminOperationsAdapter.fetchBanners",
    "streamingAdapter.fetchAdminVideos",
    "streamingAdapter.fetchAdminInboxFiles",
    "Promise.allSettled",
    "sourceStatusClass",
    "safeInternalLink",
];

for (const snippet of requiredPageSnippets) {
    assert(pageSource.includes(snippet), `AdminCommandCenter is missing ${snippet}`);
}

assert(!pageSource.includes("from \"react-hot-toast\""), "AdminCommandCenter must use dynamic toast helpers, not static react-hot-toast imports.");
assert(!pageSource.includes("api.get("), "AdminCommandCenter must call APIs through adapters.");
assert(!pageSource.includes("window.confirm(") && !pageSource.includes("window.prompt("), "AdminCommandCenter must not use browser confirm/prompt.");
assert(protectedRoutesSource.includes("AdminCommandCenter") && protectedRoutesSource.includes('path="admin"'), "ProtectedRoutes must expose /app/admin.");
assert(allMenuSource.includes("운영 커맨드 센터") && allMenuSource.includes('to: "/app/admin"'), "AllMenu must expose the command center entry.");
assert(guideSource.includes('path === "/app/admin"') && guideSource.includes("처리 순서") && guideSource.includes("회원 360"), "Page guide must explain the admin command center.");
assert(packageSource.includes('"smoke:admin-command-center-ui"'), "package.json must expose the command center smoke script.");
if (mappingSource) {
    assert(mappingSource.includes("- `/app/admin`") && mappingSource.includes("fetchCommandCenter"), "SCREEN_API_MAPPING must document /app/admin.");
}

const adapterSnippets = [
    "async fetchCommandCenter",
    "commandCenterSection",
    "Promise.all(sectionSpecs.map(commandCenterSection))",
    "skipped: true",
    "마스터 권한에서만 조회됩니다.",
    "/admin/reports",
];

for (const snippet of adapterSnippets) {
    assert(anomalyAdapterSource.includes(snippet), `adminAnomaliesAdapter command center contract is missing ${snippet}`);
}

const badTextPattern = /[\u3400-\u9fff\uf900-\ufaff\ufffd]/u;
const pageTextLiterals = Array.from(pageSource.matchAll(/"([^"]*[가-힣][^"]*)"/g), (match) => match[1]).join("\n");
assert(!badTextPattern.test(pageTextLiterals), "AdminCommandCenter contains corrupted Korean text.");

console.log("admin-command-center-ui-smoke ok");
