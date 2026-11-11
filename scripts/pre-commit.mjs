/** 커밋에 들어갈 파일만 임시 폴더에 복원해 변경 영역의 타입과 대표 테스트를 검사한다. */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();

/** 실패한 검사 이름과 원래 진단을 함께 Git 클라이언트에 전달한다. */
function check(label, command, args, cwd = root) {
  console.log(`[pre-commit] ${label}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
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
function verifyStagedChanges() {
  check("스테이징한 변경의 공백·충돌 표시 검사", "git", ["diff", "--cached", "--check"]);
  const paths = execFileSync("git", ["diff", "--cached", "--name-only", "--no-renames", "-z"], {
    encoding: "utf8",
  }).split("\0");
  const dependenciesChanged = paths.some((path) =>
    ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(path),
  );
  const workspaces = ["apps/web", "apps/api", "apps/native"].filter((workspace) =>
    dependenciesChanged || paths.some((path) => path.startsWith(`${workspace}/`) && !path.endsWith(".md")),
  );
  const publishChanged = dependenciesChanged || paths.some((path) =>
    path === ".github/workflows/publish-web-bundle-r2.yml" ||
    /^scripts\/(publish-web-bundle-r2|resolve-web-bundle-version)\./.test(path),
  );
  if (!workspaces.length && !publishChanged) return;

  const snapshot = mkdtempSync(join(realpathSync(tmpdir()), "masil-pre-commit-"));
  try {
    check("커밋 내용 준비", "git", ["checkout-index", "--all", `--prefix=${snapshot}/`]);
    for (const workspace of workspaces) {
      const cwd = join(snapshot, workspace);
      if (realpathSync(cwd) !== cwd) throw new Error(`${workspace} 작업 폴더 경로를 확인하세요.`);
      linkDependencies(snapshot, workspace);
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
        check("웹 추천·일정 저장·찜 테스트", process.execPath, ["--test",
          "tests/homeRecommendations.test.mjs", "tests/routeCheckoutApi.test.mjs", "tests/sharedRouteLike.test.mjs"], cwd);
      }
      if (workspace === "apps/api") {
        check("API 추천 색인·루트 저장 테스트", process.execPath, ["--import", "tsx", "--test",
          "tests/homeTourCourseIndex.test.mjs", "tests/routeTransactions.test.mjs"], cwd);
      }
    }
    if (publishChanged) {
      check("R2 번들 발행 테스트", process.execPath, ["--test",
        "scripts/resolve-web-bundle-version.test.mjs", "scripts/publish-web-bundle-r2.test.mjs"], snapshot);
    }
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}

try {
  verifyStagedChanges();
  console.log("[pre-commit] 통과");
} catch (error) {
  console.error(`[pre-commit] 커밋 중단. ${error.message}`);
  process.exitCode = 1;
}
