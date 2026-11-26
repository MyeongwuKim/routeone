import assert from "node:assert/strict";
import test from "node:test";
import { routeResolvers } from "../src/modules/routes/route.resolver.ts";
import { cloneRoute } from "../src/modules/routes/routeCommand.service.ts";
import { getSavedRoutes } from "../src/modules/routes/routeQuery.service.ts";
import { setRouteLike, setRouteSave } from "../src/modules/routes/routeSocial.service.ts";
import { setRouteStopVisitPhoto } from "../src/modules/routes/routeVisit.service.ts";
import {
  confirmRouteVisitPhoto,
  deleteRouteVisitPhotoImage,
} from "../src/modules/routes/routeVisitPhoto.service.ts";
import { dayRow, memoryDatabase, owner, routeRow } from "./helpers/routeMemoryDatabase.mjs";

const viewer = { id: "viewer" };
const routeId = "route";

test("루트 상호작용은 상세가 비공개·차단·신고로 제한된 경우 조회와 쓰기를 거절한다", async () => {
  for (const restriction of ["private", "blocked", "reported"]) {
    const db = memoryDatabase({ routes: [routeRow({ visibility: restriction === "private" ? "PRIVATE" : "PUBLIC" })] });
    db.prisma.userBlock.findUnique = async () => restriction === "blocked" ? { id: "block" } : null;
    db.prisma.sharedRouteReport.findFirst = async () => restriction === "reported" ? { id: "report" } : null;

    const detail = await routeResolvers.Query.route(null, { id: routeId }, { prisma: db.prisma, user: viewer });
    assert.equal(detail, null);
    for (const action of [setRouteLike, setRouteSave]) {
      for (const selected of [true, false]) {
        await assert.rejects(action(db.prisma, viewer, routeId, selected), /루트를 찾을 수 없습니다/);
      }
    }
    await assert.rejects(cloneRoute(db.prisma, viewer, { routeId }), /공유 루트를 찾을 수 없습니다/);
    assert.deepEqual(db.writes, []);
  }
});

test("소유자의 비공개 루트와 볼 수 있는 공개 루트의 좋아요·저장은 반복 요청에도 집계가 유지된다", async () => {
  for (const [actor, visibility] of [[owner, "PRIVATE"], [viewer, "PUBLIC"]]) {
    const db = memoryDatabase({ routes: [routeRow({ visibility, likeCount: 0, saveCount: 0 })], days: [dayRow(1)] });
    for (const [action, field, count] of [[setRouteLike, "liked", "likeCount"], [setRouteSave, "saved", "saveCount"]]) {
      for (const selected of [true, true, false, false]) {
        const result = await action(db.prisma, actor, routeId, selected);
        assert.equal(result[field], selected);
        assert.equal(result.route[count], selected ? 1 : 0);
      }
    }
    assert.ok(db.writes.every(({ inTransaction }) => inTransaction));
  }
});

test("저장 목록은 공개가 해제되거나 차단·신고된 루트를 빼고 자기 루트는 유지한다", async () => {
  const routes = [
    routeRow({ id: "open", visibility: "PUBLIC" }),
    routeRow({ id: "private", visibility: "PRIVATE" }),
    routeRow({ id: "own", ownerId: viewer.id }),
    routeRow({ id: "blocked", ownerId: "blocked-owner", visibility: "PUBLIC" }),
    routeRow({ id: "reported", visibility: "PUBLIC" }),
  ];
  const db = memoryDatabase({ routes, saves: routes.map(({ id }, index) => ({ userId: viewer.id, routeId: id, createdAt: index })) });
  db.prisma.userBlock.findMany = async () => [{ blockedId: "blocked-owner" }];
  db.prisma.sharedRouteReport.findMany = async () => [{ routeId: "reported" }];
  assert.deepEqual((await getSavedRoutes(db.prisma, viewer)).map(({ id }) => id).sort(), ["open", "own"]);
});

test("사진은 일치하는 발급 정보와 업로드 완료를 확인한 뒤 저장 주소를 결정하며 원본 삭제에도 소유권을 요구한다", async (t) => {
  const env = { CF_ACCOUNT: "fixture-account", CF_TOKEN: "fixture-token", ROUTEONE_ENV: "dev", CF_IMAGES_VARIANT: "public" };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const issuedTo = { userId: "owner", stopId: "stop-1" };
  const photoId = "fixture-image";
  const canonicalUrl = "https://imagedelivery.net/fixture/fixture-image/public";
  const record = { id: photoId, variants: [canonicalUrl], meta: {
    ...issuedTo, kind: "route-stop-visit-photo", environment: "dev",
  } };
  let uploaded = true;
  let deleted = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    if (options.method === "DELETE") {
      deleted += 1;
      return Response.json({ success: true });
    }
    return Response.json({ success: true, result: { ...record, draft: !uploaded } });
  });
  assert.deepEqual(await confirmRouteVisitPhoto(issuedTo, photoId, "https://example.test/client-image"), {
    imageId: photoId, imageUrl: canonicalUrl,
  });
  const now = new Date();
  const db = memoryDatabase({
    routes: [routeRow({ travelEndDate: now })],
    stops: [{ id: "stop-1", routeId, visitStatus: "VISITED", visitedAt: now, verificationStatus: "GPS",
      place: { provider: "CUSTOM", externalId: "fixture-place", title: "테스트 장소", lat: 37, lng: 128 } }],
  });
  db.prisma.placePhoto.upsert = ({ create }) => db.prisma.placePhoto.create({ data: create });
  await setRouteStopVisitPhoto(db.prisma, owner, "stop-1", photoId, "https://example.test/client-image");
  assert.equal(db.state.stops[0].verificationPhotoUrl, canonicalUrl);
  assert.equal(db.state.stops[0].verificationPhotoImageId, photoId);
  assert.equal(db.state.photos[0].imageUrl, canonicalUrl);
  for (const unauthorized of [{ ...issuedTo, userId: "viewer" }, { ...issuedTo, stopId: "stop-2" }]) {
    await assert.rejects(confirmRouteVisitPhoto(unauthorized, photoId, canonicalUrl), /사진을 확인하지 못했어요/);
    await deleteRouteVisitPhotoImage(unauthorized, photoId);
    assert.equal(deleted, 0);
  }
  uploaded = false;
  await assert.rejects(confirmRouteVisitPhoto(issuedTo, photoId, canonicalUrl), /사진을 확인하지 못했어요/);
  const writesBefore = db.writes.length;
  await assert.rejects(setRouteStopVisitPhoto(db.prisma, owner, "stop-1", photoId, canonicalUrl), /사진을 확인하지 못했어요/);
  assert.equal(db.writes.length, writesBefore);
  uploaded = true;
  await deleteRouteVisitPhotoImage(issuedTo, photoId);
  assert.equal(deleted, 1);
});
