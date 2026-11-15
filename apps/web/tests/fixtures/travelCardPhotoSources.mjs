// 테스트 계정의 가상 인증 사진이 실제 편집 화면과 PNG에서 모두 표시되는지 확인한다.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const checkPage = await context.newPage();
  try {
    await checkPage.goto("http://127.0.0.1:5173/tests/fixtures/travelCardEditor.html?testPhotos=1");
    await checkPage.getByRole("button", { name: "카드 만들기", exact: true }).click();
    await checkPage.getByRole("img", { name: "완성될 여행 카드", exact: true }).waitFor();
    await checkPage.getByRole("button", { name: "사진 편집", exact: true }).click();
    await checkPage.waitForFunction(() => {
      const images = [...document.querySelectorAll("dialog section img")];
      return images.length === 9 && images.every(image => image.complete);
    });
    const images = await checkPage.locator("dialog section img").evaluateAll(elements => elements.map(element => ({
      source: element.getAttribute("src"), loaded: element.complete && element.naturalWidth > 0,
    })));
    const passed = images.length === 9 && images.every(image => image.loaded && image.source.startsWith("data:image/"));
    await checkPage.screenshot({ path: "/private/tmp/masil-travel-card-photo-sources.png", fullPage: true });
    return { passed, checkedImages: images.length, failedImages: images.filter(image => !image.loaded), loadedImages: images.filter(image => image.loaded).length };
  } finally { await context.close(); }
}
