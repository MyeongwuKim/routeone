import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let getVisitPhotoVerificationStatus;
let assertVisitPositionNearPlace;
let derivePlaceVerificationPolicy;
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
  ({ assertVisitPositionNearPlace } = await server.ssrLoadModule(
    "/src/features/my-route/services/visitPhotoService.ts"
  ));
  ({ derivePlaceVerificationPolicy } = await server.ssrLoadModule(
    "/src/lib/placeVerificationPolicy.ts"
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

test("넓은 야외 장소는 알림 500m, 방문 인증 300m 정책을 적용한다", () => {
  assert.deepEqual(
    derivePlaceVerificationPolicy({
      contentTypeId: "12",
      categoryName: "국립공원",
    }),
    {
      notificationRadiusMeters: 500,
      verificationRadiusMeters: 300,
    }
  );
});

test("GPS와 GPS 사진 인증에 같은 장소 반경을 적용한다", () => {
  const place = {
    lat: 37,
    lng: 127,
    contentTypeId: "12",
    categoryName: "공원",
    notificationRadiusMeters: 500,
    verificationRadiusMeters: 300,
  };
  const positionAbout150MetersAway = {
    lat: 37.00135,
    lng: 127,
  };

  assert.doesNotThrow(() =>
    assertVisitPositionNearPlace(positionAbout150MetersAway, place)
  );
  assert.throws(
    () =>
      assertVisitPositionNearPlace(
        { lat: 37.00315, lng: 127 },
        place
      ),
    /인증 범위는 300m/
  );
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

for (const { name, place, radius } of [
  { name: "일반 장소", place: { categoryName: "음식점" }, radius: 100 },
  { name: "넓은 야외 장소", place: { categoryName: "국립공원" }, radius: 300 },
  {
    name: "저장된 100m 정책이 있는 야외 장소",
    place: {
      categoryName: "국립공원",
      notificationRadiusMeters: 300,
      verificationRadiusMeters: 100,
    },
    radius: 100,
  },
  {
    name: "저장된 300m 정책이 있는 장소",
    place: {
      categoryName: "음식점",
      notificationRadiusMeters: 500,
      verificationRadiusMeters: 300,
    },
    radius: 300,
  },
]) {
  test(`${name}의 인증 팝업에 실제 방문 인증 반경을 안내한다`, () => {
    const markup = renderToStaticMarkup(
      createElement(VisitCompletionPopup, {
        target: {
          routeDay: { id: "day-1", dayIndex: 1 },
          stop: { id: "stop-1", place: { title: "테스트 장소", ...place } },
        },
        isSaving: false,
        mode: "live",
        onClose() {},
        onCompleteWithGps() {},
        onCompleteWithPhoto() {},
        onCompleteManually() {},
      })
    );

    assert.match(markup, new RegExp(`이 장소 반경 ${radius}m 안에서 가능해요`));
    assert.match(markup, /앨범 인증은 위치를 확인하지 않아요/);
  });
}
