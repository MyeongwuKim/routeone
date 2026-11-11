/** 커밋에 들어갈 파일만 임시 폴더에 복원해 타입·lint와 변경에 연결된 테스트를 검사한다. */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

/** 실패한 검사 이름과 원래 진단을 함께 Git 클라이언트에 전달한다. */
function check(label, command, args, cwd = root, env = process.env) {
  console.log(`[pre-commit] ${label}`);
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} 실패${result.error ? ` (${result.error.message})` : ""}`);
  }
}

/** 설치된 패키지만 빌려 쓰고 컴파일러와 테스트의 캐시는 임시 폴더에 둔다. */
function linkDependencies(snapshot, workspace) {
  const source = join(root, workspace, "node_modules");
  const target = join(snapshot, workspace, "node_modules");
  if (!existsSync(source)) {
    throw new Error(`${workspace} 의존성이 없습니다. 저장소에서 pnpm install을 실행하세요.`);
  }
  mkdirSync(target);
  for (const name of readdirSync(source)) {
    if (!name.startsWith(".")) symlinkSync(join(source, name), join(target, name));
  }
}

/** Git 인덱스와 작업 폴더를 수정하지 않고 검사한다. */
async function verifyStagedChanges() {
  check("스테이징한 변경의 공백·충돌 표시 검사", "git", ["diff", "--cached", "--check"]);
  const paths = execFileSync("git", ["diff", "--cached", "--name-only", "--no-renames", "-z"], {
    encoding: "utf8",
  }).split("\0").filter(Boolean);
  const files = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const all = process.argv.includes("--all");
  if (!paths.length && !all) return;

  const snapshot = mkdtempSync(join(realpathSync(tmpdir()), "masil-pre-commit-"));
  try {
    check("커밋 내용 준비", "git", ["checkout-index", "--all", `--prefix=${snapshot}/`]);
    // 선택 규칙도 커밋할 버전을 읽어 스테이징하지 않은 수정이 검사 결과에 섞이지 않게 한다.
    const { createVerificationPlan } = await import(pathToFileURL(join(snapshot, "scripts/related-tests.mjs")).href);
    const plan = createVerificationPlan({ root: snapshot, files, changedPaths: paths, all });
    if (process.argv.includes("--plan")) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    for (const path of plan.uncoveredPaths) console.log(`[pre-commit] 연결된 자동 테스트 없음: ${path}`);
    for (const path of plan.skippedIntegration) console.log(`[pre-commit] 별도 테스트 DB가 필요한 통합 테스트 제외: ${path}`);

    const dependencyWorkspaces = new Set(plan.workspaces);
    if (plan.groups.native.length) dependencyWorkspaces.add("apps/web");
    if (plan.groups.web.some((path) => /\.tsx?$/.test(path))) dependencyWorkspaces.add("apps/api");
    for (const workspace of dependencyWorkspaces) {
      const cwd = join(snapshot, workspace);
      if (realpathSync(cwd) !== cwd) throw new Error(`${workspace} 작업 폴더 경로를 확인하세요.`);
      linkDependencies(snapshot, workspace);
    }
    for (const workspace of plan.workspaces) {
      const cwd = join(snapshot, workspace);
      if (workspace === "apps/native") {
        const bundle = "apps/native/src/generated/webBundle.ts";
        if (!existsSync(resolve(root, bundle))) {
          throw new Error("iOS WebView 번들이 없습니다. pnpm native:build:webview로 생성하세요.");
        }
        const sourceDirectory = join(cwd, "src");
        if (realpathSync(sourceDirectory) !== sourceDirectory) throw new Error("네이티브 소스 경로를 확인하세요.");
        const generatedDirectory = join(sourceDirectory, "generated");
        if (!existsSync(generatedDirectory)) mkdirSync(generatedDirectory);
        if (realpathSync(generatedDirectory) !== generatedDirectory) throw new Error("네이티브 번들 경로를 확인하세요.");
        if (!existsSync(join(snapshot, bundle))) symlinkSync(resolve(root, bundle), join(snapshot, bundle));
      }

      const typeArgs = workspace === "apps/web" ? ["-b", "--noEmit"] : ["--noEmit"];
      check(`${workspace} 타입 검사`, process.execPath, ["node_modules/typescript/bin/tsc", ...typeArgs], cwd);
      if (workspace === "apps/web") {
        const lintFiles = all || paths.some((path) => path === "apps/web/eslint.config.js")
          ? files.filter((path) => path.startsWith("apps/web/") && /\.tsx?$/.test(path))
          : paths.filter((path) => path.startsWith("apps/web/") && /\.tsx?$/.test(path) && files.includes(path));
        if (lintFiles.length) check("변경한 웹 파일 ESLint 검사", process.execPath, [
          "node_modules/eslint/bin/eslint.js", "--no-warn-ignored", ...lintFiles.map((path) => path.slice("apps/web/".length)),
        ], cwd);
      }
    }

    for (const [group, tests] of Object.entries(plan.groups)) {
      if (!tests.length) continue;
      const workspace = group === "scripts" ? "" : `apps/${group}`;
      const args = [];
      const env = { ...process.env };
      if (group === "api") args.push("--import", "tsx");
      if (group === "api") env.TSX_TSCONFIG_PATH = join(snapshot, workspace, "tsconfig.json");
      if (group === "web" && tests.some((path) => /\.tsx?$/.test(path))) {
        args.push("--import", join(snapshot, "apps/api/node_modules/tsx/dist/loader.mjs"));
        env.TSX_TSCONFIG_PATH = join(snapshot, workspace, "tsconfig.app.json");
      }
      console.log(`[pre-commit] 선택한 테스트:\n${tests.map((path) => `  ${path}`).join("\n")}`);
      check(`${group} 관련 테스트 ${tests.length}개 파일`, process.execPath, [
        ...args, "--test", "--test-concurrency=2", ...tests.map((path) => workspace ? path.slice(workspace.length + 1) : path),
      ], join(snapshot, workspace), env);
    }
    if (plan.swift) {
      const output = join(snapshot, "arrival-notification-tests");
      check("iOS 알림 Swift 테스트 컴파일", "swiftc", [
        "-module-cache-path", join(snapshot, "swift-module-cache"), ...plan.swift.sources, plan.swift.test, "-o", output,
      ], snapshot);
      check("iOS 알림 Swift 테스트", output, [], snapshot);
    }
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}

try {
  await verifyStagedChanges();
  console.log("[pre-commit] 통과");
} catch (error) {
  console.error(`[pre-commit] 커밋 중단. ${error.message}`);
  process.exitCode = 1;
}
