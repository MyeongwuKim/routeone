/**
 * 용도:
 * Native의 production 환경값으로 배포용 iOS Xcode 프로젝트를 준비한다.
 *
 * 동작 방식:
 * `.env.production`만 읽어 prod 환경을 구성한 뒤 버전 확인, 웹뷰 번들 생성,
 * Expo prebuild, iOS 권한 동기화를 같은 환경에서 순서대로 실행한다.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./env-file.mjs";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const envFileName = ".env.production";
const envFilePath = path.join(nativeRoot, envFileName);
const shouldClean = process.argv.includes("--clean");

if (!existsSync(envFilePath)) {
  console.error(
    `[env] ${envFileName} 파일이 없습니다. prod 빌드 전에 파일을 생성해주세요.`
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
  APP_VARIANT: "prod",
  EXPO_PUBLIC_APP_VARIANT: "prod",
};

const steps = [
  { command: "pnpm", args: ["run", "confirm:app-version"] },
  { command: "pnpm", args: ["run", "build:webview"] },
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
  {
    command: process.execPath,
    args: ["scripts/sync-xcode-env.mjs", envFileName, "prod"],
  },
  { command: "pnpm", args: ["run", "sync:ios-permissions"] },
];

console.log(`[env] ${envFileName} 파일만 사용합니다.`);

for (const { command, args } of steps) {
  const result = spawnSync(command, args, {
    cwd: nativeRoot,
    env: commandEnv,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
