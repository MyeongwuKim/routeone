import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let renderRoutePosterTheme;
let getRoutePosterPhotoLayout;
let buildRoutePosterPages;
const originalPhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0h8AAAAASUVORK5CYII=";
const themes = ["journal", "polaroid", "blocks", "pixel", "fantasy"];
const sample = {
  backgroundId: "paper", title: "여행 기록", dayIndex: 1, dateLabel: "9.7",
  stopCount: 1, photoCount: 1, visits: [], pageIndex: 1, pageCount: 1,
  items: [{ title: "사진을 남긴 곳", subtitle: "공원", verificationLabel: "GPS", imageDataUrl: originalPhoto }],
};

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ renderRoutePosterTheme } = await server.ssrLoadModule("/src/features/my-route/utils/poster/renderRoutePosterTheme.ts"));
  ({ buildRoutePosterPages } = await server.ssrLoadModule("/src/features/my-route/utils/poster/routePosterPages.ts"));
  ({ getRoutePosterPhotoLayout } = await server.ssrLoadModule("/src/features/my-route/utils/poster/routePosterLayout.ts"));
});
after(async () => { await server?.close(); });

for (const themeId of themes) {
  test(`${themeId}: 사진 1~6장이 기록 영역을 침범하거나 서로 겹치지 않는다`, () => {
    for (let count = 1; count <= 6; count++) {
      const rects = getRoutePosterPhotoLayout(count, themeId);
      assert.equal(rects.length, count);
      for (const [index, rect] of rects.entries()) {
        assert.ok(rect.x >= 84 && rect.y >= 326);
        assert.ok(rect.width > 0 && rect.height > 0);
        assert.ok(rect.x + rect.width <= 996);
        assert.ok(rect.y + rect.height <= 1092);
        for (const other of rects.slice(index + 1)) {
          assert.ok(rect.x + rect.width <= other.x || other.x + other.width <= rect.x || rect.y + rect.height <= other.y || other.y + other.height <= rect.y);
        }
      }
    }
  });
  test(`${themeId}: 사진 원본을 필터와 픽셀화 없이 삽입한다`, () => {
    const svg = renderRoutePosterTheme({ ...sample, themeId });
    const images = [...svg.matchAll(/<image\b[^>]+>/g)].map(([tag]) => tag);
    assert.equal(images.length, 1);
    assert.ok(images[0].includes(`href="${originalPhoto}"`));
    assert.ok(images[0].includes('preserveAspectRatio="xMidYMid slice"'));
    assert.doesNotMatch(images[0], /\bfilter=|\bstyle=|image-rendering/);
    assert.doesNotMatch(svg, /<filter\b|feColorMatrix|pixelated/);
  });
}

test("장소명과 루트 제목이 SVG 태그로 해석되지 않는다", () => {
  const svg = renderRoutePosterTheme({
    ...sample, themeId: "blocks", title: "<script>&",
    items: [{ ...sample.items[0], title: '<img>&"', subtitle: "A&B" }],
  });
  assert.doesNotMatch(svg, /<script>|<img>/);
  assert.match(svg, /&lt;script&gt;&amp;/);
  assert.match(svg, /&lt;img&gt;&amp;&quot;/);
  assert.match(svg, /A&amp;B/);
});

test("사용자 배경을 바꿔도 사진 원본은 같은 이미지로 유지한다", () => {
  const background = "data:image/png;base64,background";
  const svg = renderRoutePosterTheme({ ...sample, themeId: "pixel", backgroundId: "custom", backgroundImageDataUrl: background });
  const images = [...svg.matchAll(/<image\b[^>]+>/g)].map(([tag]) => tag);
  assert.equal(images.length, 2);
  assert.ok(images[0].includes(background));
  assert.ok(images[1].includes(originalPhoto));
});

test("사진 한 장과 사진 없는 세 곳을 빈 사진 칸 없이 배치한다", () => {
  const stops = [sample.items[0], ...[2, 3, 4].map(order => ({ ...sample.items[0], order, title: `방문지 ${order}`, imageDataUrl: null }))];
  const [page] = buildRoutePosterPages(stops);
  assert.equal(page.items.length, 1);
  assert.equal(page.visits.length, 3);
  for (const themeId of themes) {
    const svg = renderRoutePosterTheme({ ...sample, ...page, themeId, stopCount: 4 });
    assert.doesNotMatch(svg, /PHOTO MEMORY|MORE PLACES|undefined|NaN/);
    assert.equal([...svg.matchAll(/<image\b/g)].length, 1);
    for (const title of ["방문지 2", "방문지 3", "방문지 4"]) assert.ok(svg.includes(title));
  }
});

test("여러 페이지에 사진과 방문 기록을 빠짐없이 한 번씩 담는다", () => {
  const stops = Array.from({length: 23}, (_, index) => ({ ...sample.items[0], stopId: `stop-${index}`, order: index + 1, imageDataUrl: index < 9 ? originalPhoto : null }));
  const pages = buildRoutePosterPages(stops);
  assert.equal(pages.length, 3);
  const ids = pages.flatMap(page => [...page.items, ...page.visits].map(stop => stop.stopId));
  assert.equal(ids.length, stops.length);
  assert.equal(new Set(ids).size, stops.length);
  pages.forEach((page, index) => {
    assert.ok(page.items.length <= 4);
    assert.ok(page.visits.length <= 6);
    assert.equal(page.pageIndex, index + 1);
    assert.equal(page.pageCount, pages.length);
  });
});

test("사진이 없어도 방문 기록 카드가 나오며 빈 여행은 만들지 않는다", () => {
  assert.deepEqual(buildRoutePosterPages([]), []);
  const [page] = buildRoutePosterPages([{ ...sample.items[0], imageDataUrl: null }]);
  for (const themeId of themes) {
    const svg = renderRoutePosterTheme({ ...sample, ...page, themeId, photoCount: 0 });
    assert.match(svg, /이날의 발자취/);
    assert.doesNotMatch(svg, /PHOTO MEMORY|<image\b|undefined|NaN/);
  }
});
