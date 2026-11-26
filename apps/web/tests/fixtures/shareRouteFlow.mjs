async (page) => {
  const origin = "http://127.0.0.1:4187";
  const mapSdk = `
    class LatLng {
      constructor(lat, lng) { this.latitude = lat; this.longitude = lng; }
      lat() { return this.latitude; }
      lng() { return this.longitude; }
    }
    class MapView {
      constructor(container) {
        container.dataset.testid = "fake-naver-map";
        container.addEventListener("click", () =>
          maps.Event.trigger(this, "click", { coord: new LatLng(37.351234, 128.451234) }));
      }
    }
    const listeners = new WeakMap();
    const maps = {
      jsContentLoaded: true, MapTypeId: { NORMAL: "normal" }, LatLng, Map: MapView,
      Marker: class { setMap() {} setPosition() {} },
      LatLngBounds: class { extend() {} }, Point: class {},
      Event: {
        addListener(target, event, handler) {
          if (!listeners.has(target)) listeners.set(target, {});
          listeners.get(target)[event] = handler;
          return { target, event };
        },
        removeListener({ target, event }) { delete listeners.get(target)?.[event]; },
        trigger(target, event, value) { listeners.get(target)?.[event]?.(value); },
      },
    };
    window.naver = { maps };
  `;
  const results = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await page.context().browser().newContext({ viewport });
    try {
      // 요청은 로컬 번들과 가짜 지도 SDK로 제한한다.
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(origin + "/map-direction/v1/driving?")) {
          return route.fulfill({ json: { code: 0, route: { traoptimal: [{
            summary: { duration: 600000, distance: 1200 },
            path: [[128.34, 37.23], [128.56, 37.46]],
          }] } } });
        }
        if (url.startsWith(origin + "/")) return route.continue();
        if (url.startsWith("https://oapi.map.naver.com/openapi/v3/maps.js")) {
          return route.fulfill({ contentType: "application/javascript", body: mapSdk });
        }
        return route.abort();
      });
      const browserPage = await context.newPage();
      const errors = [];
      browserPage.on("pageerror", (error) => errors.push(error.message));
      browserPage.on("response", (response) => {
        if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      });
      await browserPage.goto(origin + "/tests/fixtures/shareRoute.html");
      const share = browserPage.getByRole("button", { name: "공유하기", exact: true });
      const confirmDialog = browserPage.getByRole("dialog", { name: "이대로 공유할까요?" });
      const requestCount = () => browserPage.evaluate(() => window.shareRouteTest.requests.length);
      const openPicker = () => confirmDialog.getByRole("button", { name: "지도에서 변경" }).first().click();

      await share.click();
      await confirmDialog.getByText("이 출발지가 다른 사람에게 공개돼요.").waitFor();
      await confirmDialog.getByText("37.231234, 128.341234").waitFor();
      await confirmDialog.getByText("37.33, 128.44").waitFor();
      if (await requestCount() !== 0) throw new Error("확인 창을 열 때 공유 요청이 전송됐어요.");

      await openPicker();
      await browserPage.getByTestId("fake-naver-map").click();
      await browserPage.getByRole("button", { name: "취소", exact: true }).click();
      await confirmDialog.getByText("37.231234, 128.341234").waitFor();
      await openPicker();
      await browserPage.getByTestId("fake-naver-map").click();
      await browserPage.getByRole("button", { name: "적용", exact: true }).click();
      await confirmDialog.getByText("37.351234, 128.451234").waitFor();
      await confirmDialog.getByRole("button", { name: "취소", exact: true }).click();
      await confirmDialog.waitFor({ state: "hidden" });
      if (await requestCount() !== 0) throw new Error("취소했는데 공유 요청이 전송됐어요.");

      await share.click();
      await confirmDialog.getByText("37.231234, 128.341234").waitFor();
      await openPicker();
      await browserPage.getByTestId("fake-naver-map").click();
      await browserPage.getByRole("button", { name: "적용", exact: true }).click();
      await confirmDialog.getByText("37.351234, 128.451234").waitFor();
      const fits = await confirmDialog.evaluate((dialog) =>
        dialog.scrollWidth <= dialog.clientWidth && dialog.getBoundingClientRect().bottom <= window.innerHeight);
      if (!fits) throw new Error("확인 창이 화면을 벗어났어요.");
      if (viewport.width === 390) {
        await browserPage.screenshot({ path: "/Users/myeongwu/routeone/output/masil-share-location-confirmation.png" });
      }
      await browserPage.evaluate(() => { window.shareRouteTest.failNextShare = true; });
      await confirmDialog.getByRole("button", { name: "동의하고 공유" }).click();
      await confirmDialog.getByRole("alert").waitFor();
      await confirmDialog.getByText("37.351234, 128.451234").waitFor();
      await confirmDialog.getByRole("button", { name: "동의하고 공유" }).click();
      await confirmDialog.waitFor({ state: "hidden" });
      const state = await browserPage.evaluate(() => window.shareRouteTest);
      const expected = {
        routeId: "test-route",
        startLocations: [
          { dayId: "day-1", startLocation: { lat: 37.351234, lng: 128.451234 } },
          { dayId: "day-2", startLocation: { lat: 37.33, lng: 128.44 } },
        ],
      };
      if (JSON.stringify(state.requests) !== JSON.stringify([expected, expected])) throw new Error("확인값과 공유 요청이 달라요.");
      if (state.route.startLocation.lat !== 37.231234 || state.route.days[0].startLocation !== null) {
        throw new Error("내 루트 출발지가 바뀌었어요.");
      }
      if (errors.length) throw new Error(errors.join("\n"));
      results.push(`${viewport.width}×${viewport.height} 공유 변경·취소·실패 재시도 검증 통과`);
    } finally {
      await context.close();
    }
  }
  return results;
}
