/**
 * 용도:
 * Native 자동화 스크립트에서 사용하는 env 파일을 같은 규칙으로 읽는다.
 *
 * 동작 방식:
 * 주석과 빈 줄을 제외하고 `KEY=VALUE` 값을 객체로 변환하거나,
 * 이미 설정된 실행 환경값을 덮어쓰지 않는 방식으로 process.env에 반영한다.
 */
import { existsSync, readFileSync } from "node:fs";

export function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const normalizedLine = line.startsWith("export ")
          ? line.slice("export ".length).trim()
          : line;
        const separatorIndex = normalizedLine.indexOf("=");

        if (separatorIndex < 0) {
          return null;
        }

        const key = normalizedLine.slice(0, separatorIndex).trim();
        const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");

        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? [key, value] : null;
      })
      .filter(Boolean)
  );
}

export function loadEnvFile(filePath) {
  const env = readEnvFile(filePath);

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return env;
}
