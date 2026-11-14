// Playwright의 browser_run_code_unsafe에 이 파일을 전달해 목록부터 편집·내보내기까지 확인한다.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: false });
  const checkPage = await context.newPage();
  const checks = [];
  const errors = [];
  checkPage.on("pageerror", error => errors.push(error.message));
  const assert = (condition, name) => { if (!condition) throw new Error(name); checks.push(name); };
  const preview = () => checkPage.getByRole("img", { name: "완성될 여행 카드", exact: true });
  const share = () => checkPage.getByRole("button", { name: "공유하기", exact: true });
  const open = async () => {
    await checkPage.getByRole("button", { name: "카드 만들기", exact: true }).click();
    await preview().waitFor();
  };
  try {
    await checkPage.goto("http://127.0.0.1:5173/tests/fixtures/travelCardEditor.html");
    await open();
    await share().waitFor({ state: "visible" });
    assert(await share().isEnabled(), "목록에서 대표 카드 한 장 생성");
    assert(await checkPage.getByRole("dialog").count() === 1, "한 편집 세션만 표시");

    await checkPage.evaluate(async () => {
      const { useAppLanguageStore } = await import("/src/stores/appLanguageStore.ts");
      useAppLanguageStore.setState({language:"en"});
    });
    assert(await checkPage.getByLabel("Trip title",{exact:true}).inputValue() === "My travel memories", "편집하지 않은 기본 제목은 앱 언어에 맞게 전환");
    await checkPage.getByLabel("Trip title",{exact:true}).fill("강릉에서 남긴 순간");
    assert(await checkPage.getByLabel("Trip title",{exact:true}).inputValue() === "강릉에서 남긴 순간", "이전 언어의 기본 제목을 직접 입력해도 사용자 제목으로 유지");
    await checkPage.evaluate(async () => {
      const { useAppLanguageStore } = await import("/src/stores/appLanguageStore.ts");
      useAppLanguageStore.setState({language:"ko"});
    });

    await checkPage.getByRole("button", {name:"사진 편집",exact:true}).click();
    assert(await checkPage.getByRole("heading", {name:/카드에 담을 사진/}).evaluate(element=>element.getBoundingClientRect().top >= 0 && element.getBoundingClientRect().top < 200), "사진 편집 영역으로 바로 이동");

    const title = checkPage.getByLabel("여행 제목", { exact: true });
    const caption = checkPage.getByLabel("짧은 한 줄", { exact: false });
    await title.fill("너무 긴 여행 제목".repeat(20));
    await checkPage.getByText("제목이 한 줄에 들어오도록 줄여 주세요.").first().waitFor();
    assert(await share().isDisabled(), "긴 제목은 입력 단계 안내·내보내기 차단");
    await title.fill("강릉에서 보낸 이틀");
    await caption.fill("바다를 걷던 우리");
    await preview().waitFor();
    assert(await title.inputValue() === "강릉에서 보낸 이틀", "사용자가 수정한 제목 유지");

    await checkPage.getByRole("button", { name: "뒤로 이동", exact: true }).click();
    await preview().waitFor();
    assert(await checkPage.getByRole("button", { name: "대표 사진: 오후의 카페", exact: true }).count() === 1, "순서 변경으로 대표 사진 전환");
    await checkPage.getByRole("button", { name: "앞으로 이동", exact: true }).click();
    await checkPage.getByRole("slider", { name: "세로 위치", exact: true }).focus();
    await checkPage.getByRole("slider", { name: "세로 위치", exact: true }).press("Home");
    await preview().waitFor();
    assert(await checkPage.getByRole("slider", { name: "세로 위치", exact: true }).inputValue() === "0", "키보드로 사진 위치 조정");
    await checkPage.getByRole("button", { name: "가운데로", exact: true }).click();
    assert(await checkPage.getByRole("slider", { name: "세로 위치", exact: true }).inputValue() === "50", "사진 위치 초기화");

    const album = await checkPage.evaluate(() => window.travelCardTest.route.stops[0].verificationPhotoUrl);
    for (let remaining = 3; remaining >= 0; remaining--) {
      await checkPage.getByRole("button", { name: "사진 빼기", exact: true }).click();
      if (remaining) await preview().waitFor();
    }
    await checkPage.getByText("여행 사진을 골라 주세요", { exact: true }).waitFor();
    assert(await share().isDisabled(), "사진 제거 후 빈 카드 공유 차단");
    assert(await checkPage.getByRole("button", { name: "기존 DAY 카드 보기", exact: true }).count() === 1, "사진 없는 기존 DAY 기록 접근 유지");
    await checkPage.locator('input[type="file"]').setInputFiles({ name: "holiday.png", mimeType: "image/png", buffer: Buffer.from(album.split(",")[1], "base64") });
    await preview().waitFor();
    assert(await checkPage.getByRole("button", { name: "대표 사진: 앨범 사진", exact: true }).count() === 1, "웹 앨범 사진을 카드에 추가");

    await checkPage.evaluate(() => {
      window.cardTransfers = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      window.RouteOneNative = {
        saveImage: async options => { window.cardTransfers.push(options); await new Promise(resolve => setTimeout(resolve, 250)); return { shared: false }; },
        takeVisitPhoto: async options => { window.cardPhotoRequest = options; throw new Error("사진 선택을 취소했어요."); },
      };
    });
    await checkPage.getByRole("button", { name: "앨범 사진으로 교체", exact: true }).click();
    await checkPage.waitForFunction(() => Boolean(window.cardPhotoRequest));
    assert(await checkPage.getByRole("button", { name: "대표 사진: 앨범 사진", exact: true }).count() === 1, "네이티브 사진 선택 취소 시 기존 사진 유지");
    assert(await checkPage.evaluate(() => Object.keys(window.cardPhotoRequest).join() === "source" && window.cardPhotoRequest.source === "library"), "업로드 대상 없이 앨범 선택 요청");

    await checkPage.getByRole("button", { name: "이미지 저장", exact: true }).dblclick();
    await checkPage.waitForFunction(() => window.cardTransfers.length === 1);
    await checkPage.waitForFunction(() => !document.querySelector('button[disabled] svg.animate-spin'));
    assert(await checkPage.evaluate(() => window.cardTransfers.length === 1), "저장 중 중복 요청 차단");
    assert(await title.inputValue() === "강릉에서 보낸 이틀", "시스템 저장 취소 후 편집 유지");
    await share().click();
    await checkPage.waitForFunction(() => window.cardTransfers.length === 2);
    assert(await checkPage.evaluate(() => window.cardTransfers.every(item => item.dataUrl.startsWith("data:image/png;base64,") && item.fileName.endsWith(".png") && item.title === "강릉에서 보낸 이틀")), "저장·공유에 현재 PNG·제목 전달");

    await checkPage.waitForTimeout(300);
    await checkPage.evaluate(() => {
      window.decodeStarted = 0; window.cardDecodeDelay = 700;
      const original = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () {
        const delay = window.cardDecodeDelay;
        await original.call(this);
        window.decodeStarted++;
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      };
    });
    await title.fill("먼저 요청한 제목");
    await checkPage.waitForFunction(() => window.decodeStarted > 0);
    await checkPage.evaluate(() => { window.cardDecodeDelay = 0; });
    await title.fill("마지막 여행 제목");
    await preview().waitFor();
    const latestPng = await preview().getAttribute("src");
    await checkPage.waitForTimeout(800);
    assert(await preview().getAttribute("src") === latestPng, "지연된 이전 PNG가 최신 편집본을 덮어쓰지 않음");

    assert(await checkPage.evaluate(() => JSON.stringify(window.travelCardTest.route) === window.travelCardTest.original), "앨범·제목·순서·크롭 편집 후 서버 기록 원본 보존");
    assert(await checkPage.evaluate(() => window.travelCardTest.requests.every(query => !query.includes("mutation") || query.startsWith("mutation LocalizeTourPlaces("))), "카드 편집에서 방문·인증·사진 업로드 요청 없음");

    await checkPage.getByRole("button", {name:"오후의 카페",exact:true}).click();
    await preview().waitFor();
    await checkPage.evaluate(() => {
      window.failedCardPhoto = document.querySelector('button[aria-label="대표 사진: 앨범 사진"] img').src;
      const original = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function () { return this.src === window.failedCardPhoto ? Promise.reject(new Error("Test photo unavailable")) : original.call(this); };
    });
    await caption.fill("사진 복구 테스트");
    await checkPage.getByRole("button", {name:"불러오기 실패: 앨범 사진",exact:true}).waitFor();
    assert(await checkPage.getByRole("button", {name:"대표 사진: 오후의 카페",exact:true}).count() === 1, "실패 사진 표시와 실제 PNG 대표 사진을 구분");
    await checkPage.evaluate(() => { window.failedCardPhoto = null; });
    await checkPage.getByRole("button", {name:"다시 시도",exact:true}).click();
    await preview().waitFor();
    assert(await checkPage.getByRole("button", {name:"대표 사진: 앨범 사진",exact:true}).count() === 1, "사진 재시도 성공 후 대표·선택 표시 복구");
    assert(await checkPage.getByRole("dialog").evaluate(element => element.scrollWidth <= window.innerWidth), "390px에서 가로 넘침 없음");
    await checkPage.screenshot({ path: "/private/tmp/masil-travel-card-mobile.png", fullPage: true });

    await checkPage.setViewportSize({ width: 1440, height: 900 });
    assert(await checkPage.getByRole("dialog").evaluate(element => element.scrollWidth <= window.innerWidth), "1440px에서 가로 넘침 없음");
    await checkPage.screenshot({ path: "/private/tmp/masil-travel-card-desktop.png", fullPage: true });
    await checkPage.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await checkPage.evaluate(() => document.documentElement.classList.add("dark"));
    await checkPage.screenshot({ path: "/private/tmp/masil-travel-card-dark.png", fullPage: true });

    await checkPage.evaluate(async () => {
      const { useAppLanguageStore } = await import("/src/stores/appLanguageStore.ts");
      useAppLanguageStore.setState({ language: "en" });
    });
    await checkPage.getByRole("button", { name: "Share", exact: true }).waitFor();
    assert(await checkPage.getByLabel("Trip title", { exact: true }).inputValue() === "마지막 여행 제목", "영어 전환에도 사용자 제목 보존");
    await checkPage.keyboard.press("Escape");
    assert(await checkPage.getByRole("dialog").count() === 0, "Escape로 편집 종료");

    await checkPage.evaluate(async () => {
      const { useAppLanguageStore } = await import("/src/stores/appLanguageStore.ts");
      useAppLanguageStore.setState({ language: "ko" });
    });
    for (const canShareFiles of [false,true]) {
    await open();
    await checkPage.evaluate(canShareFiles => {
      window.cardTransfers = [];
      window.browserCardShares = [];
      const original = window.fetch;
      window.cardFetchOriginal = original;
      window.fetch = (input,init) => typeof input === "string" && input.startsWith("data:image/png")
        ? new Promise(resolve => { window.resolveCardFetch = () => resolve(new Response(new Blob(["test"],{type:"image/png"}))); })
        : original(input,init);
      Object.defineProperty(navigator,"share",{configurable:true,value:async options=>{ window.browserCardShares.push(options); }});
      Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>canShareFiles});
    },canShareFiles);
    await share().click();
    await checkPage.waitForFunction(() => Boolean(window.resolveCardFetch));
    await checkPage.getByRole("button", {name:"닫기",exact:true}).click();
    await checkPage.evaluate(() => { window.resolveCardFetch(); window.fetch = window.cardFetchOriginal; });
    await checkPage.waitForTimeout(150);
    assert(await checkPage.evaluate(() => window.cardTransfers.length === 0 && window.browserCardShares.length === 0), `닫힌 세션의 공유 준비 뒤 공유·저장 차단 (파일 공유 ${canShareFiles})`);
    }

    await checkPage.evaluate(async () => {
      const { useAppLanguageStore } = await import("/src/stores/appLanguageStore.ts");
      useAppLanguageStore.setState({ language: "ko" });
      window.travelCardTest.delay = 500;
    });
    await checkPage.getByRole("button", { name: "카드 만들기", exact: true }).click();
    await checkPage.getByRole("button", { name: "닫기", exact: true }).click();
    await checkPage.waitForTimeout(650);
    assert(await checkPage.getByRole("dialog").count() === 0, "닫은 뒤 도착한 조회 결과가 편집기를 다시 열지 않음");

    await checkPage.evaluate(() => { window.travelCardTest.delay = 0; window.travelCardTest.failRead = true; });
    await checkPage.getByRole("button", { name: "카드 만들기", exact: true }).click();
    await checkPage.getByText("여행 기록을 불러오지 못했어요. 다시 시도해 주세요.", { exact: true }).waitFor();
    await checkPage.evaluate(() => { window.travelCardTest.failRead = false; });
    await checkPage.getByRole("button", { name: "다시 시도", exact: true }).click();
    await preview().waitFor();
    assert(await title.inputValue() === "강릉에서 남긴 순간", "조회 실패 재시도·새 세션의 기본 제목 복원");
    await checkPage.evaluate(async () => {
      const { useAuthUserStore } = await import("/src/stores/authUserStore.ts");
      useAuthUserStore.setState({ user: { id: "other-card-test-owner" } });
    });
    await checkPage.getByRole("dialog").waitFor({ state: "detached" });
    assert(await checkPage.getByRole("dialog").count() === 0, "계정 전환 시 사진·편집 세션 제거");
    assert(errors.length === 0, `브라우저 런타임 오류 없음: ${errors.join("; ")}`);
    return { passed: true, checked: checks.length, checks, errors };
  } catch (error) {
    await checkPage.screenshot({ path: "/private/tmp/masil-travel-card-flow-failure.png", fullPage: true });
    return { passed: false, checked: checks.length, checks, error: String(error), errors, body: (await checkPage.locator("body").innerText()).slice(-1600) };
  } finally { await context.close(); }
}
