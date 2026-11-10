import { config } from "dotenv";

// 서버 모듈을 초기화하기 전에 환경값을 준비한다. dotenv는 먼저 읽은 값을
// 유지하므로 개발 모드에서는 .env.development에 없는 값만 .env에서 채운다.
config({
  path: process.env.ROUTEONE_API_ENV === "development"
    ? [".env.development", ".env"]
    : ".env",
});
