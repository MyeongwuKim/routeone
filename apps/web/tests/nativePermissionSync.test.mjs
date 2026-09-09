import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let server;
let infoStore;
let positionStore;
let startSync;
let nativeBridge;
let stopSync;
let resolvePlaceDirectionOrigin;
let PlaceDirectionsSection;
let mapSheetStore;
let getUiText;
let text;
let appInfo;
let readAppInfo;
let readPosition;
let infoCalls;
let positionCalls;
const globals = new Map();
const position = (lat = 37.5) => ({ lat, lng: 127, accuracyMeters: 10, timestamp: Date.now() });
const grantedInfo = () => ({
  platform: "ios", appVersion: "1.0", capabilities: [],
  locationPermissionStatus: "granted", locationAccuracy: "full",
  notificationPermissionStatus: "granted", cameraPermissionStatus: "granted",
  photoLibraryPermissionStatus: "granted",
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
async function until(predicate) {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(predicate(), "상태 변경이 완료되어야 한다");
}
function appActive() {
  window.dispatchEvent(new Event("routeone:native-app-active"));
}

before(async () => {
  for (const name of ["window", "document"]) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(new EventTarget(), {
    RouteOneNative: {
      getAppInfo: () => { infoCalls += 1; return readAppInfo(); },
      getCurrentPosition: () => { positionCalls += 1; return readPosition(); },
    },
  }) });
  Object.defineProperty(globalThis, "document", { configurable: true, value: Object.assign(new EventTarget(), {
    visibilityState: "visible",
    documentElement: {},
  }) });
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ useNativeAppInfoStore: infoStore } = await server.ssrLoadModule("/src/stores/nativeAppInfoStore.ts"));
  ({ useCurrentPositionStore: positionStore } = await server.ssrLoadModule("/src/stores/currentPositionStore.ts"));
  ({ nativeBridge } = await server.ssrLoadModule("/src/native-bridge/index.ts"));
  ({ startNativePermissionSync: startSync } = await server.ssrLoadModule("/src/native-bridge/permissionSync.ts"));
  ({ resolvePlaceDirectionOrigin } = await server.ssrLoadModule("/src/features/place-sheet/utils/placeDirectionOrigin.ts"));
  ({ default: PlaceDirectionsSection } = await server.ssrLoadModule("/src/features/place-sheet/components/PlaceDirectionsSection.tsx"));
  ({ useMapSheetStore: mapSheetStore } = await server.ssrLoadModule("/src/stores/mapSheetStore.ts"));
  ({ getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts"));
  text = getUiText("ko");
});
beforeEach(() => {
  appInfo = grantedInfo();
  infoCalls = 0;
  positionCalls = 0;
  readAppInfo = async () => ({ ...appInfo });
  readPosition = async () => position();
  positionStore.getState().clearPosition();
  infoStore.setState({ appInfoState: { status: "loading", info: null }, isRefreshing: false });
});
afterEach(() => { stopSync?.(); stopSync = null; });
after(async () => {
  await server?.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

function resolveOrigin(directionOrigin = { coordinates: position(35), label: "이전 현재 위치", isCurrentLocation: true }) {
  return resolvePlaceDirectionOrigin({
    directionOrigin,
    fallbackDirectionOrigin: { coordinates: { lat: 36, lng: 128 }, label: "지역 기준", isCurrentLocation: false },
    selectedPlace: null,
    storedCurrentPosition: positionStore.getState().position,
    useTestPosition: false,
    text,
  }).resolvedDirectionOrigin;
}

test("앱 정보 화면이 없어도 설정 복귀 시 모든 권한과 열린 장소 상세·공유 좌표를 갱신한다", async () => {
  stopSync = startSync();
  await until(() => positionStore.getState().status === "success");
  assert.equal(resolveOrigin().coordinates.lat, 37.5);

  appInfo = { ...appInfo, locationPermissionStatus: "denied", notificationPermissionStatus: "denied",
    cameraPermissionStatus: "denied", photoLibraryPermissionStatus: "denied" };
  appActive();
  await until(() => infoStore.getState().appInfoState.info?.locationPermissionStatus === "denied");
  assert.equal(positionStore.getState().position, null);
  assert.equal(positionStore.getState().status, "error");
  assert.equal(positionCalls, 1, "권한이 꺼졌을 때 자동 GPS 요청을 보내지 않는다");
  assert.equal(resolveOrigin().isCurrentLocation, false);
  assert.equal(resolveOrigin().coordinates.lat, 36);
  for (const key of ["notificationPermissionStatus", "cameraPermissionStatus", "photoLibraryPermissionStatus"]) {
    assert.equal(infoStore.getState().appInfoState.info[key], "denied");
  }

  appInfo = grantedInfo();
  readPosition = async () => position(38);
  appActive();
  await until(() => positionStore.getState().position?.lat === 38);
  assert.equal(resolveOrigin().coordinates.lat, 38);
  assert.equal(resolveOrigin().isCurrentLocation, true);
  const savedOrigin = { coordinates: { lat: 34, lng: 126 }, label: "저장한 출발지", isCurrentLocation: false };
  assert.deepEqual(resolveOrigin(savedOrigin), savedOrigin);
});

test("캐시가 남아 있어도 위치 요청 직전에 권한 해제를 확인하면 좌표를 반환하지 않는다", async () => {
  positionStore.getState().applyPosition(position());
  appInfo.locationPermissionStatus = "denied";
  await assert.rejects(positionStore.getState().requestCurrentPosition(), /위치 권한/);
  assert.equal(positionStore.getState().position, null);
  assert.equal(positionCalls, 0);
});

test("권한 해제 전 GPS 응답이 늦게 도착해도 좌표를 복구하거나 새 요청을 지우지 않는다", async () => {
  const oldGps = deferred();
  readPosition = () => oldGps.promise;
  stopSync = startSync();
  await until(() => positionCalls === 1);
  appInfo.locationPermissionStatus = "denied";
  appActive();
  await until(() => positionStore.getState().status === "error");

  const newGps = deferred();
  readPosition = () => newGps.promise;
  appInfo.locationPermissionStatus = "granted";
  appActive();
  await until(() => positionCalls === 2);
  oldGps.resolve(position(35));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(positionStore.getState().position, null);
  const joinedRequest = positionStore.getState().requestCurrentPosition({ forceRefresh: true });
  assert.equal(positionCalls, 2);
  newGps.resolve(position(38));
  assert.equal((await joinedRequest).lat, 38);
  assert.equal(positionStore.getState().position.lat, 38);
});

test("복귀 전의 늦은 허용 응답은 새 거부 응답을 덮어쓰지 않는다", async () => {
  const oldLookup = deferred();
  readAppInfo = () => oldLookup.promise;
  const oldRequest = infoStore.getState().refresh();
  appInfo.locationPermissionStatus = "denied";
  readAppInfo = async () => ({ ...appInfo });
  await infoStore.getState().refresh({ forceRefresh: true });
  oldLookup.resolve(grantedInfo());
  await oldRequest;
  assert.equal(infoStore.getState().appInfoState.info.locationPermissionStatus, "denied");
});

test("정확한 위치 설정이 바뀌면 이전 좌표를 버리고 새 좌표를 사용한다", async () => {
  stopSync = startSync();
  await until(() => positionStore.getState().status === "success");
  const gps = deferred();
  readPosition = () => gps.promise;
  appInfo.locationAccuracy = "reduced";
  appActive();
  await until(() => positionCalls === 2);
  assert.equal(positionStore.getState().position, null);
  gps.resolve(position(36));
  await until(() => positionStore.getState().position?.lat === 36);
});

test("포커스와 표시 이벤트도 권한을 갱신하고 정리 후에는 조회하지 않는다", async () => {
  stopSync = startSync();
  await until(() => positionStore.getState().status === "success");
  appInfo.locationPermissionStatus = "denied";
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await until(() => positionStore.getState().position === null);
  await new Promise((resolve) => setImmediate(resolve));
  stopSync();
  stopSync = null;
  const previousCalls = infoCalls;
  appActive();
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(infoCalls, previousCalls);
});

test("권한 재조회 실패 시 이전 허용 상태와 좌표를 계속 쓰지 않는다", async () => {
  stopSync = startSync();
  await until(() => positionStore.getState().status === "success");
  readAppInfo = async () => { throw new Error("bridge unavailable"); };
  appActive();
  await until(() => infoStore.getState().appInfoState.status === "error");
  assert.equal(positionStore.getState().position, null);
});

test("미설정 권한은 자동으로 요청하지 않고 사용자가 시작한 위치 요청에서 허용할 수 있다", async () => {
  appInfo.locationPermissionStatus = "undetermined";
  stopSync = startSync();
  await until(() => infoStore.getState().appInfoState.info?.locationPermissionStatus === "undetermined");
  assert.equal(positionCalls, 0);
  readPosition = async () => {
    appInfo.locationPermissionStatus = "granted";
    return position(38);
  };
  assert.equal((await positionStore.getState().requestCurrentPosition()).lat, 38);
  assert.equal(infoStore.getState().appInfoState.info.locationPermissionStatus, "granted");
});

test("네이티브 GPS의 일시적 실패는 권한 해제와 구분해 이전 위치를 유지한다", async () => {
  stopSync = startSync();
  await until(() => positionStore.getState().status === "success");
  const previous = positionStore.getState().position;
  readPosition = async () => { throw new Error("temporary GPS failure"); };
  appActive();
  await until(() => positionStore.getState().status === "error");
  assert.deepEqual(positionStore.getState().position, previous);
  assert.equal(infoStore.getState().appInfoState.info.locationPermissionStatus, "granted");
});

test("권한 조회가 멈추면 제한 시간 후 실패하고 늦은 응답으로 허용 상태를 되살리지 않는다", async () => {
  const lookup = deferred();
  readAppInfo = () => lookup.promise;
  const request = infoStore.getState().refresh();
  await assert.rejects(request, /timed out/);
  assert.equal(infoStore.getState().appInfoState.status, "error");
  assert.equal(infoStore.getState().isRefreshing, false);
  lookup.resolve(grantedInfo());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(infoStore.getState().appInfoState.status, "error");
  readAppInfo = async () => grantedInfo();
  await infoStore.getState().refresh();
  assert.equal(infoStore.getState().appInfoState.status, "success");
});

test("다른 기능의 앱 정보 조회도 같은 전역 권한 상태를 갱신한다", async () => {
  appInfo.locationPermissionStatus = "denied";
  const result = await nativeBridge.appInfo.get();
  assert.equal(result.locationPermissionStatus, "denied");
  assert.equal(infoStore.getState().appInfoState.info.locationPermissionStatus, "denied");
});

function renderDirections(language = "ko", explicitOrigin = null) {
  // 서버 렌더링이 읽는 초기 스냅샷에 해당 시점의 실제 전역 권한을 전달한다.
  const infoSnapshot = infoStore.getInitialState();
  const previousInfo = infoSnapshot.appInfoState;
  const mapSnapshot = mapSheetStore.getInitialState();
  const previousOrigin = mapSnapshot.directionOrigin;
  infoSnapshot.appInfoState = infoStore.getState().appInfoState;
  mapSnapshot.directionOrigin = explicitOrigin;
  try {
    return renderToStaticMarkup(createElement(PlaceDirectionsSection, {
      appLanguage: language,
      currentLocation: position(),
      directionOrigin: explicitOrigin ?? resolveOrigin(),
      isCurrentLocationLookupPending: false,
      isDarkMode: false,
      isRouteLoading: false,
      routeDistanceText: "3km",
      routeDurationText: "15분",
      routeError: null,
      routePathPoints: [],
      selectedPlace: { id: "test-place", contentId: "test-place", contentTypeId: "12", title: "테스트 장소", address: "테스트 주소", lat: 37, lng: 127 },
      text: getUiText(language),
    }));
  } finally {
    infoSnapshot.appInfoState = previousInfo;
    mapSnapshot.directionOrigin = previousOrigin;
  }
}

test("설정에서 권한을 끄면 길찾기 지도 자리에 설정 안내가 나오고 다시 켜면 지도를 복원한다", async () => {
  stopSync = startSync();
  await until(() => positionStore.getState().status === "success");
  assert.match(renderDirections(), /h-48/);
  assert.doesNotMatch(renderDirections(), /위치 권한이 꺼져 있습니다\./);

  appInfo.locationPermissionStatus = "denied";
  appActive();
  await until(() => infoStore.getState().appInfoState.info?.locationPermissionStatus === "denied");
  const deniedMarkup = renderDirections();
  assert.match(deniedMarkup, /위치 권한이 꺼져 있습니다\./);
  assert.match(deniedMarkup, /설정에서 위치 권한 켜기/);
  assert.match(deniedMarkup, /role="status"/);
  assert.doesNotMatch(deniedMarkup, /h-48|15분|3km/);
  assert.match(renderDirections("en"), /Location access is turned off\./);
  assert.match(renderDirections("en"), /Open location settings/);

  appInfo.locationPermissionStatus = "granted";
  appActive();
  await until(() => positionStore.getState().status === "success");
  assert.doesNotMatch(renderDirections(), /위치 권한이 꺼져 있습니다\./);
  assert.match(renderDirections(), /h-48/);
});

test("GPS 일시 오류나 직접 정한 출발지는 위치 권한을 켜라는 안내로 막지 않는다", async () => {
  await infoStore.getState().refresh();
  positionStore.getState().invalidatePosition();
  assert.doesNotMatch(renderDirections(), /위치 권한이 꺼져 있습니다\./);
  appInfo.locationPermissionStatus = "denied";
  await infoStore.getState().refresh();
  const markup = renderDirections("ko", {
    coordinates: { lat: 36, lng: 128 }, label: "선택한 출발지", isCurrentLocation: false,
  });
  assert.doesNotMatch(markup, /위치 권한이 꺼져 있습니다\./);
  assert.match(markup, /h-48/);
});
