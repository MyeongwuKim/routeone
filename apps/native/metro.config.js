const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

if (process.env.ROUTEONE_ENV_FILE === ".env" && process.env.EXPO_NO_DOTENV === "1") {
  // Expo의 개발 번들은 감시 중인 env 파일을 다시 합친다. 로컬 실행에서는
  // 파일을 번들에서 제외하고 실행 스크립트가 전달한 환경값을 사용한다.
  const nativeRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  config.resolver.blockList = [
    ...[config.resolver.blockList].flat().filter(Boolean),
    new RegExp(`^${nativeRoot}/\\.env(?:\\.[^/]+)?$`),
  ];
}

module.exports = config;
