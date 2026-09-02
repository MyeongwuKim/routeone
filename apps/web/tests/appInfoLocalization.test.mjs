import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let getUiText;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts"));
});

after(async () => {
  await server?.close();
});

test("버전 및 권한 화면의 영문 문구와 권한 상태를 제공한다", () => {
  const text = getUiText("en");

  assert.deepEqual(
    {
      title: text.routeShell.appInfoTitle,
      infoSection: text.appInfo.infoSection,
      runtimeEnvironment: text.appInfo.runtimeEnvironment,
      appVersion: text.appInfo.appVersion,
      osVersion: text.appInfo.osVersion,
      webBundleVersion: text.appInfo.webBundleVersion,
      permissionsSection: text.appInfo.permissionsSection,
      locationPermission: text.appInfo.locationPermission,
      notificationPermission: text.appInfo.notificationPermission,
      cameraPermission: text.appInfo.cameraPermission,
      photoLibraryPermission: text.appInfo.photoLibraryPermission,
      permissionStatuses: text.appInfo.permissionStatuses,
    },
    {
      title: "Version & Permissions",
      infoSection: "App Info",
      runtimeEnvironment: "Runtime",
      appVersion: "App Version",
      osVersion: "OS Version",
      webBundleVersion: "Web Bundle Version",
      permissionsSection: "Permissions",
      locationPermission: "Location",
      notificationPermission: "Push Notifications",
      cameraPermission: "Camera",
      photoLibraryPermission: "Photo Library",
      permissionStatuses: {
        granted: "On",
        denied: "Off",
        undetermined: "Not Set",
        unavailable: "Unavailable",
      },
    }
  );
});

test("버전 및 권한 화면의 한글 문구도 기존 표시를 유지한다", () => {
  const text = getUiText("ko");

  assert.deepEqual(text.appInfo.permissionStatuses, {
    granted: "켜짐",
    denied: "꺼짐",
    undetermined: "미설정",
    unavailable: "확인 불가",
  });
  assert.equal(text.appInfo.locationPermission, "위치 권한");
  assert.equal(text.appInfo.notificationPermission, "푸시 알림 권한");
});
