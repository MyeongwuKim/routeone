import { copyFile, mkdir } from "node:fs/promises";

// Cloud Build에는 apps/api만 전달되므로 API에 포함된 경계 데이터를 빌드 결과에 복사한다.
const destination = new URL("../dist/assets/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  new URL("../src/assets/service-region-boundary.json", import.meta.url),
  new URL("service-region-boundary.json", destination)
);
