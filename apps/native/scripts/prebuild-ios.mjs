/**
 * dev는 `.env.development`, prod는 `.env.production`에서 Native 환경값을 읽는다.
 * 웹뷰 번들 생성, Expo prebuild, iOS 권한 동기화와 Xcode Archive에 같은 파일을 적용한다.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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
  { command: "pnpm", args: ["run", "sync:ios-version"] },
  {
    command: process.execPath,
    args: ["scripts/sync-xcode-env.mjs", envFileName, appVariant],
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
