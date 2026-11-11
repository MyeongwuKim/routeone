/** 스테이징한 소스의 로컬 참조를 역추적해 기존 Node 테스트와 검사 범위를 고른다. */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

export const WORKSPACES = ["apps/web", "apps/api", "apps/native"];
const TEST_FILE = /\.test\.(?:mjs|cjs|ts|tsx|js)$/;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|graphql)$/;
const SWIFT_TEST = "apps/native/tests/routeArrivalNotificationLedger.test.swift";
const SWIFT_SOURCES = ["apps/native/modules/route-arrival-notifications/ios/RouteArrivalNotificationLedger.swift"];

/** 파일이 속한 pnpm 앱을 반환하며 루트 스크립트는 undefined로 구분한다. */
function workspaceOf(path) {
  return WORKSPACES.find((workspace) => path.startsWith(`${workspace}/`));
}

/** 상대 경로, 웹 별칭, Vite SSR 경로와 파일명을 Git 파일 목록 안에서만 해석한다. */
function resolveReferences(file, source, knownFiles) {
  const dependencies = new Set();
  const workspace = workspaceOf(file);
  // import뿐 아니라 ssrLoadModule·readFile·자체 transpile 테스트의 경로 리터럴도 포함한다.
  for (const match of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g)) {
    const value = match[2].replace(/[?#].*$/, "");
    if (value.includes("${")) continue;
    let base;
    if (value.startsWith(".")) base = posix.join(posix.dirname(file), value);
    else if (workspace && value.startsWith("@/")) base = `${workspace}/src/${value.slice(2)}`;
    else if (workspace && value.startsWith("/src/")) base = `${workspace}${value}`;
    else if (workspace && value.startsWith("/")) base = `${workspace}/public${value}`;
    else if (value.startsWith("apps/") || value.startsWith("scripts/") || value.startsWith("infra/")) base = value;
    else if (/^[\w.-]+\.(?:[cm]?[jt]sx?|json|sh)$/.test(value)) base = posix.join(posix.dirname(file), value);
    else continue;
    const candidates = [base, ...[".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"].flatMap((ext) => [
      `${base}${ext}`, `${base}/index${ext}`,
    ])];
    // NodeNext 소스는 .js로 import해도 실제 구현은 .ts일 수 있다.
    if (/\.jsx?$/.test(base)) candidates.push(base.replace(/\.jsx?$/, ".ts"), base.replace(/\.jsx?$/, ".tsx"));
    for (const candidate of candidates) if (knownFiles.has(candidate)) dependencies.add(candidate);
  }
  return dependencies;
}

/** 삭제된 파일까지 시작점으로 삼아 테스트 → 구현 → 공통 모듈 참조를 역방향으로 탐색한다. */
function findAffectedFiles(root, files, changedPaths, tests) {
  const knownFiles = new Set([...files, ...changedPaths]);
  const present = new Set(files);
  const reverse = new Map();
  const visited = new Set();
  const pending = [...tests];
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file) || !present.has(file)) continue;
    visited.add(file);
    if (!SOURCE_FILE.test(file)) continue;
    const references = resolveReferences(file, readFileSync(join(root, file), "utf8"), knownFiles);
    for (const dependency of references) {
      if (!reverse.has(dependency)) reverse.set(dependency, new Set());
      reverse.get(dependency).add(file);
      pending.push(dependency);
    }
  }
  const affected = new Set(changedPaths);
  const queue = [...changedPaths];
  for (let i = 0; i < queue.length; i += 1) {
    for (const caller of reverse.get(queue[i]) ?? []) {
      if (!affected.has(caller)) { affected.add(caller); queue.push(caller); }
    }
  }
  return { affected, referenced: visited };
}

/** 설정 변경은 영역 전체로 넓히고, 일반 변경은 참조 관계와 변경된 테스트 자체로 제한한다. */
export function createVerificationPlan({ root, files, changedPaths, all = false }) {
  const changed = changedPaths.filter(Boolean);
  const allTests = files.filter((file) => TEST_FILE.test(file) && (
    file.startsWith("scripts/") || WORKSPACES.some((workspace) => file.startsWith(`${workspace}/tests/`))
  ));
  const globalChange = all || changed.some((path) => ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(path));
  const toolingChange = changed.some((path) => /^scripts\/(pre-commit|related-tests)(\.|$)/.test(path) || path.startsWith(".githooks/"));
  const contractChange = changed.some((path) => path === "apps/api/src/schema.ts" || path === "apps/api/prisma/schema.prisma");
  const broadWorkspaces = new Set(WORKSPACES.filter((workspace) => globalChange || (contractChange && workspace !== "apps/native") || changed.some((path) =>
    path === `${workspace}/package.json` || path.startsWith(`${workspace}/tsconfig`) ||
    (workspace === "apps/web" && path.startsWith("apps/web/") && path.endsWith(".graphql")) ||
    (workspace === "apps/web" && (/^apps\/web\/(vite|eslint)\.config\./.test(path) || path === "apps/web/codegen.ts")) ||
    (workspace === "apps/native" && /^apps\/native\/(app|metro|babel)\.config\./.test(path)),
  )));
  const { affected, referenced } = findAffectedFiles(root, files, changed, allTests);
  const selected = allTests.filter((file) => affected.has(file) || broadWorkspaces.has(workspaceOf(file)) ||
    (file.startsWith("scripts/") && (globalChange || toolingChange || changed.some((path) => path.startsWith("scripts/") || path.startsWith(".github/workflows/")))));
  const groups = { web: [], api: [], native: [], scripts: [] };
  const skippedIntegration = [];
  for (const file of selected.sort()) {
    // 실제 DB를 쓰는 통합 테스트는 커밋 훅에서 실행하지 않는다. 테스트 DB를 지정해 별도로 실행한다.
    if (/\.integration\.test\./.test(file)) { skippedIntegration.push(file); continue; }
    groups[workspaceOf(file)?.slice(5) ?? "scripts"].push(file);
  }
  const workspaces = WORKSPACES.filter((workspace) => broadWorkspaces.has(workspace) || groups[workspace.slice(5)].length ||
    changed.some((path) => path.startsWith(`${workspace}/`) && !path.endsWith(".md")));
  const swift = files.includes(SWIFT_TEST) && (globalChange || broadWorkspaces.has("apps/native") ||
    changed.some((path) => path === SWIFT_TEST || path.startsWith("apps/native/modules/route-arrival-notifications/")))
    ? { test: SWIFT_TEST, sources: SWIFT_SOURCES } : null;
  const uncoveredPaths = changed.filter((path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path) &&
    (workspaceOf(path) || path.startsWith("scripts/")) && !referenced.has(path) && !broadWorkspaces.has(workspaceOf(path)));
  return { workspaces, groups, swift, skippedIntegration, uncoveredPaths };
}
