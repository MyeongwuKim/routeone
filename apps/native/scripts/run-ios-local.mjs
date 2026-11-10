/** 로컬 시뮬레이터의 WebView 번들, Xcode, Metro에 `apps/native/.env`를 적용한다. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.mjs";

const nativeRoot = fileURLToPath(new URL("../", import.meta.url));
const envFileName = ".env";
const envFilePath = fileURLToPath(new URL(`../${envFileName}`, import.meta.url));

if (!existsSync(envFilePath)) {
  console.error(`[env] apps/native/${envFileName} 파일이 없습니다.`);
  process.exit(1);
}

loadEnvFile(envFilePath);
const commandEnv = {
  ...process.env,
  EXPO_NO_DOTENV: "1",
  ROUTEONE_ENV_FILE: envFileName,
  ROUTEONE_BUILD_PLATFORM: "ios",
  APP_VARIANT: "none",
  EXPO_PUBLIC_APP_VARIANT: "none",
};

const expoArgs = process.argv.slice(2);
// 사용 가능한 포트에 새 Metro를 띄워 기존 서버의 환경값이 재사용되지 않게 한다.
const portArgs = expoArgs.some((arg) => /^(--no-bundler|--port|-p)(=|$)/.test(arg))
  ? []
  : ["--port", "0"];
const steps = [
  { command: "pnpm", args: ["run", "prebuild:ios:local"] },
  { command: process.execPath, args: ["scripts/sync-xcode-env.mjs", envFileName, "none"] },
  { command: "pnpm", args: ["run", "build:webview"] },
  { command: "pnpm", args: ["exec", "expo", "run:ios", ...portArgs, ...expoArgs] },
];

for (const { command, args } of steps) {
  const result = spawnSync(command, args, {
    cwd: nativeRoot,
    env: commandEnv,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
