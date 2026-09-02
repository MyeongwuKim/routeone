import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let getVisitPhotoVerificationStatus;
let VisitCompletionPopup;
let server;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ getVisitPhotoVerificationStatus } = await server.ssrLoadModule(
    "/src/features/my-route/services/visitPhotoVerification.ts"
  ));
  ({ VisitCompletionPopup } = await server.ssrLoadModule(
    "/src/features/my-route/components/day-route/DayRouteDialogs.tsx"
  ));
});

after(async () => {
  await server?.close();
});

test("여행 중 카메라 촬영만 GPS 사진 인증으로 처리한다", () => {
  assert.equal(getVisitPhotoVerificationStatus("camera", false), "GPS_PHOTO");
  assert.equal(getVisitPhotoVerificationStatus("library", false), "MANUAL");
});

test("지난 일정의 사진은 촬영 경로와 관계없이 일반 완료로 처리한다", () => {
  assert.equal(getVisitPhotoVerificationStatus("camera", true), "MANUAL");
  assert.equal(getVisitPhotoVerificationStatus("library", true), "MANUAL");
});

test("도착 인증 버튼을 GPS, GPS 카메라, 앨범·일반 인증 순서로 배치한다", () => {
  const markup = renderToStaticMarkup(
    createElement(VisitCompletionPopup, {
      target: {
        routeDay: { id: "day-1", dayIndex: 1 },
        stop: { id: "stop-1", place: { title: "테스트 장소" } },
      },
      isSaving: false,
      mode: "live",
      onClose() {},
      onCompleteWithGps() {},
      onCompleteWithPhoto() {},
      onCompleteManually() {},
    })
  );
  const gpsIndex = markup.indexOf("GPS 인증");
  const cameraIndex = markup.indexOf("GPS + 카메라 인증");
  const albumIndex = markup.indexOf("앨범 인증");
  const manualIndex = markup.indexOf("그냥 인증");

  assert.ok(gpsIndex >= 0);
  assert.ok(gpsIndex < cameraIndex);
  assert.ok(cameraIndex < albumIndex);
  assert.ok(albumIndex < manualIndex);
  assert.match(markup, /grid grid-cols-2 gap-2/);
});
