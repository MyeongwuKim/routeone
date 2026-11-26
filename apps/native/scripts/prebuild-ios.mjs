/**
 * dev는 `.env.development`, prod는 `.env.production`에서 Native 환경값을 읽는다.
 * 웹뷰 번들과 iOS 프로젝트를 같은 환경으로 준비한 뒤 해당 워크스페이스를 Xcode에서 다시 연다.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./env-file.mjs";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appVariant = process.argv[2];

if (appVariant !== "dev" && appVariant !== "prod") {
  console.error('[env] 앱 variant로 "dev" 또는 "prod"를 지정해주세요.');
  process.exit(1);
}

const envFileName = appVariant === "dev" ? ".env.development" : ".env.production";
const envFilePath = path.join(nativeRoot, envFileName);
const shouldClean = process.argv.includes("--clean");
const projectName = appVariant === "dev" ? "MasilT" : "Masil";
const iosDirectory = path.join(nativeRoot, "ios");
const workspacePath = path.join(iosDirectory, `${projectName}.xcworkspace`);
const backupDirectory = path.join(nativeRoot, ".expo", "ios-projects");
const lockDirectory = path.join(backupDirectory, "prebuild.lock");
const shouldOpenWorkspace = process.platform === "darwin" &&
  !["1", "true", "yes"].includes(process.env.CI?.trim().toLowerCase());

if (!existsSync(envFilePath)) {
  console.error(
    `[env] ${envFileName} 파일이 없습니다. ${appVariant} 빌드 전에 파일을 생성해주세요.`
  );
  process.exit(1);
}

const commandEnv = {
  ...process.env,
  ...readEnvFile(envFilePath),
  NODE_ENV: "production",
  EXPO_NO_DOTENV: "1",
  ROUTEONE_ENV_FILE: envFileName,
  ROUTEONE_BUILD_PLATFORM: "ios",
  APP_VARIANT: appVariant,
  EXPO_PUBLIC_APP_VARIANT: appVariant,
};

const steps = [
  {
    command: "pnpm",
    args: [
      "exec",
      "expo",
      "prebuild",
      "--platform",
      "ios",
      ...(shouldClean ? ["--clean"] : []),
    ],
  },
  { command: "pnpm", args: ["run", "sync:ios-version"] },
  {
    command: process.execPath,
    args: ["scripts/sync-xcode-env.mjs", envFileName, appVariant],
  },
  { command: "pnpm", args: ["run", "sync:ios-permissions"] },
];

console.log(`[env] ${envFileName} 파일만 사용합니다.`);

function runStep(command, args, env = commandEnv) {
  const result = spawnSync(command, args, {
    cwd: nativeRoot,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    const error = result.error ?? new Error(`${command} ${args.join(" ")} 실행 실패`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function readIosProjectName() {
  if (!existsSync(iosDirectory)) return undefined;

  const projects = readdirSync(iosDirectory).filter((entry) => entry.endsWith(".xcodeproj"));
  return projects.length === 1 ? path.basename(projects[0], ".xcodeproj") : undefined;
}

// Move the entire project so its manual signing settings and local Xcode files travel together.
function backUpIosProject(name) {
  const reusablePath = name && path.join(backupDirectory, name);
  const backupPath = reusablePath && !existsSync(reusablePath)
    ? reusablePath
    : path.join(mkdtempSync(path.join(backupDirectory, "previous-")), "ios");
  renameSync(iosDirectory, backupPath);
  console.log(`[xcode] 이전 iOS 프로젝트 보관: ${path.relative(nativeRoot, backupPath)}`);
  return backupPath;
}

function closeOpenMasilWorkspaces() {
  const result = spawnSync("osascript", ["-", `${iosDirectory}/`], {
    input: `on run argv
  set projectDirectory to item 1 of argv
  if application id "com.apple.dt.Xcode" is running then
    tell application id "com.apple.dt.Xcode"
      repeat with projectDocument in (get workspace documents)
        set projectPath to path of projectDocument
        if projectPath is not missing value and projectPath starts with projectDirectory then
          close projectDocument
        end if
      end repeat
    end tell
  end if
end run
`,
    timeout: 15_000,
  });

  if (result.status !== 0) {
    console.warn("[xcode] 열린 마실 워크스페이스를 닫지 못했습니다. macOS 자동화 권한을 확인해 주세요.");
  }
}

function prepareIosProject() {
  const currentName = readIosProjectName();
  let previousProject;

  try {
    if (existsSync(iosDirectory) && currentName !== projectName) {
      const knownProject = ["Masil", "MasilT"].includes(currentName) ? currentName : undefined;
      previousProject = backUpIosProject(knownProject);
    }

    const savedProject = path.join(backupDirectory, projectName);
    if (!existsSync(iosDirectory) && existsSync(savedProject)) {
      renameSync(savedProject, iosDirectory);
      console.log(`[xcode] 보관한 ${projectName} 프로젝트를 복원했습니다.`);
    }

    for (const { command, args } of steps) runStep(command, args);

    if (readIosProjectName() !== projectName) {
      throw new Error(`${projectName}.xcodeproj가 생성되지 않았습니다.`);
    }
  } catch (error) {
    if (previousProject) {
      if (existsSync(iosDirectory)) backUpIosProject();
      renameSync(previousProject, iosDirectory);
    }
    throw error;
  }
}

try {
  runStep("pnpm", ["run", "confirm:app-version"]);
  mkdirSync(backupDirectory, { recursive: true });
  try {
    mkdirSync(lockDirectory);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(`다른 iOS 준비 작업이 실행 중입니다. 종료 후에도 문제가 계속되면 ${lockDirectory}를 확인해 주세요.`);
  }

  try {
    runStep("pnpm", ["run", "build:webview"]);
    if (shouldOpenWorkspace) closeOpenMasilWorkspaces();
    prepareIosProject();

    if (shouldOpenWorkspace) {
      if (!existsSync(workspacePath)) {
        throw new Error(`${workspacePath}가 없습니다. Expo prebuild의 CocoaPods 설치 결과를 확인해 주세요.`);
      }
      runStep("open", ["-a", "Xcode", workspacePath], process.env);
      console.log(`[xcode] ${projectName}.xcworkspace 열기`);
    }
  } finally {
    rmdirSync(lockDirectory);
  }
} catch (error) {
  console.error(`[ios] ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
}
