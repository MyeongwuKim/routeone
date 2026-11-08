import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { ApolloServer } from "@apollo/server";
import { gql } from "graphql-tag";
import { fetchFestivalSource, hasFestivalCoordinates } from "../src/modules/notifications/festivalSource.service.ts";
import { getFestivals } from "../src/modules/notifications/festivalLookup.service.ts";
import { notificationTypeDefs, notificationResolvers } from "../src/modules/notifications/notification.resolver.ts";
import { syncFestivalNotificationInbox } from "../src/modules/notifications/notification.service.ts";
import { updateNotificationSettings } from "../src/modules/notifications/notificationSettings.service.ts";
import { runNotificationSchedulerOnce } from "../src/modules/notifications/notificationScheduler.service.ts";
import { normalizeFestivalRegionCode, getFestivalRegionLabel, resolveFestivalRegionCode, isFestivalRegionSelected } from "../src/modules/notifications/festivalRegions.ts";

const now = new Date("2026-11-03T01:00:00.000Z");
let previousFetch, previousKey;
const requests = [];
const failedAreas = new Set();
const badApiAreas = new Set();
const officialFailedAreas = new Set();
const officialCoordlessAreas = new Set();
const cities = { "32": ["1"], "38": ["1", "13"], "6": ["16"], "1": ["23"], "7": ["1"], "5": ["3"] };
const fixtures = area => (cities[area] ?? ["1"]).map(code => ({
  contentid: `festival-${area}-${code}`, title: `축제-${area}-${code}`, areacode: area, sigungucode: code,
  eventstartdate: "20261101", eventenddate: "20261110", addr1: "공개 축제 장소",
  mapx: "127.5", mapy: "35.5", firstimage: "",
}));
before(() => {
  previousFetch = globalThis.fetch;
  previousKey = process.env.VISITKOREA_SERVICE_KEY;
  process.env.VISITKOREA_SERVICE_KEY = "festival-unit-test-key";
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const official = url.hostname === "award.visitkorea.or.kr";
    assert.ok(official || url.hostname === "apis.data.go.kr", "테스트는 실제 푸시나 다른 외부 서비스에 요청하지 않는다");
    const params = official ? new URLSearchParams(options.body) : url.searchParams;
    const area = params.get(official ? "searchArea" : "areaCode");
    requests.push({ area, official });
    if (failedAreas.has(area) || (official && officialFailedAreas.has(area))) return new Response("unavailable", { status: 503 });
    if (!official && badApiAreas.has(area)) return Response.json({ response: { header: { resultCode: "99", resultMsg: "API unavailable" } } });
    const items = fixtures(area);
    if (official) return Response.json({ totalCnt: items.length, resultList: items.map(item => ({
      fstvlCntntsId: item.contentid, cntntsNm: item.title, regnDivCd: area, signguDivCd: item.sigungucode,
      fstvlBgngDe: item.eventstartdate, fstvlEndDe: item.eventenddate,
      adres: item.addr1, xcrdVal: officialCoordlessAreas.has(area) ? "" : item.mapx, ycrdVal: officialCoordlessAreas.has(area) ? "" : item.mapy, dispFstvlCntntsImgRout: "",
    })) });
    // 다른 권역의 결과와 좌표가 없는 축제도 섞어 필터링을 확인한다.
    const extra = [
      { ...items[0], contentid: "wrong-area", areacode: "999" },
      { ...items[0], contentid: `missing-coordinates-${area}`, title: "좌표 없는 축제", mapx: "", mapy: "" },
    ];
    return Response.json({ response: { header: { resultCode: "0000" }, body: { totalCount: items.length + extra.length, items: { item: [...items, ...extra] } } } });
  };
});
after(() => {
  globalThis.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.VISITKOREA_SERVICE_KEY;
  else process.env.VISITKOREA_SERVICE_KEY = previousKey;
});

test("권역별 조회·캐시를 분리하고 같은 권역의 동시 요청은 한 번만 실행한다", async () => {
  const [gangwon, sameGangwon, jeonnam] = await Promise.all([
    fetchFestivalSource("32", now), fetchFestivalSource("32", now), fetchFestivalSource("38", now),
  ]);
  assert.strictEqual(gangwon, sameGangwon);
  assert.equal(requests.filter(request => request.area === "32").length, 3);
  assert.equal(requests.filter(request => request.area === "38").length, 3);
  assert.equal(gangwon.find(festival => festival.id === "festival-32-1").regionCode, "51150");
  assert.equal(jeonnam.find(festival => festival.id === "festival-38-1").regionCode, "46810");
  assert.equal(jeonnam.filter(festival => festival.id === "festival-38-13").length, 1);
  assert.ok(!jeonnam.some(festival => festival.id === "wrong-area"));
  const count = requests.length;
  await fetchFestivalSource("32", now);
  assert.equal(requests.length, count);
});

test("선택한 도·시군구와 조회 기간만 반환하고 좌표 없는 축제는 지도 결과에서 제외한다", async () => {
  const scope = { startDate: "2026-11-03", endDate: "2026-11-09", regionCodes: ["46130"] };
  assert.deepEqual((await getFestivals(scope)).map(festival => festival.id), ["festival-38-13"]);
  assert.deepEqual((await getFestivals({ ...scope, regionCodes: ["51150", "46130"] })).map(festival => festival.regionCode).sort(), ["46130", "51150"]);
  assert.equal((await getFestivals({ startDate: "2026-11-20", endDate: "2026-11-25", areaCode: "38" })).length, 0);
  assert.equal(hasFestivalCoordinates({ lat: 0, lng: 0 }), false);
  assert.equal(hasFestivalCoordinates({ lat: NaN, lng: 127 }), false);
});

test("기존 강원 GraphQL 조회는 예전 시군구 코드 응답을 유지한다", async () => {
  const results = await notificationResolvers.Query.gangwonFestivals(null, { startDate: "2026-11-03", endDate: "2026-11-09" });
  assert.equal(results.length, 1);
  assert.equal(results[0].regionCode, "1");
});

test("실패한 지역 조회는 빈 성공 결과로 캐시하지 않고 다음 요청에서 다시 시도한다", async () => {
  failedAreas.add("7");
  await assert.rejects(fetchFestivalSource("7", now));
  const count = requests.filter(request => request.area === "7").length;
  failedAreas.delete("7");
  assert.ok((await fetchFestivalSource("7", now)).length);
  assert.equal(requests.filter(request => request.area === "7").length, count + 3);
});

test("Open API 오류 응답도 실패로 판정하고 한 출처만 성공하면 그 목록을 사용한다", async () => {
  officialFailedAreas.add("5");
  badApiAreas.add("5");
  await assert.rejects(fetchFestivalSource("5", now));
  badApiAreas.delete("5");
  assert.ok((await fetchFestivalSource("5", now)).some(festival => festival.id === "festival-5-3"));
  officialFailedAreas.delete("5");
});

test("잘못된 날짜·지역과 지역 없는 조회는 외부 요청 전에 거절한다", async () => {
  const count = requests.length;
  for (const input of [
    { startDate: "2026-02-30", endDate: "2026-03-01", areaCode: "38" },
    { startDate: "2026-11-10", endDate: "2026-11-03", areaCode: "38" },
    { startDate: "2026-11-03", endDate: "2027-01-03", areaCode: "38" },
    { startDate: "2026-11-03", endDate: "2026-11-10", areaCode: "999" },
    { startDate: "2026-11-03", endDate: "2026-11-10" },
  ]) await assert.rejects(getFestivals(input));
  assert.equal(requests.length, count);
});

test("기존 강원 설정과 다른 지방의 행정 코드는 혼동하지 않고 한영 지역명을 제공한다", () => {
  assert.equal(normalizeFestivalRegionCode("13"), "51110");
  assert.equal(normalizeFestivalRegionCode("46130"), "46130");
  assert.equal(resolveFestivalRegionCode("13", "38:13"), "46130");
  assert.equal(resolveFestivalRegionCode("36110", "36:36110"), "36110");
  assert.equal(resolveFestivalRegionCode("48120", "48:48120"), "48120");
  assert.equal(getFestivalRegionLabel("46130"), "전남 여수시");
  assert.equal(getFestivalRegionLabel("46130", "en"), "Jeonnam Yeosu-si");
  assert.equal(isFestivalRegionSelected("51150", ["1"]), true);
  assert.equal(isFestivalRegionSelected("11680", ["1"]), false);
  assert.equal(isFestivalRegionSelected("invalid", ["invalid"]), false);
});

function settingsDatabase() {
  let state = { id: "setting", userId: "user", festivalEnabled: true, festivalRegionCodes: ["1"], routeStartEnabled: true, routeReviewEnabled: true, routeArrivalEnabled: true };
  const cancellations = [];
  const prisma = {
    userNotificationSetting: { upsert: async () => state, update: async ({ data }) => (state = { ...state, ...data }) },
    userNotification: { updateMany: async (query) => { cancellations.push(query); return { count: 0 }; } },
    $transaction: async callback => callback(prisma),
  };
  return { prisma, cancellations };
}

test("축제 알림 지역은 다른 도를 포함해 최대 두 곳 저장하고 기존 단축 코드를 정규화한다", async () => {
  const db = settingsDatabase();
  const updated = await updateNotificationSettings(db.prisma, { id: "user" }, { festivalRegionCodes: ["1", "51150", "46130"] });
  assert.deepEqual(updated.festivalRegionCodes, ["51150", "46130"]);
  assert.equal(updated.festivalLastEvaluationKey, null);
  assert.equal(db.cancellations.length, 1);
  await assert.rejects(updateNotificationSettings(db.prisma, { id: "user" }, { festivalRegionCodes: ["51150", "46130", "26350"] }));
  await assert.rejects(updateNotificationSettings(db.prisma, { id: "user" }, { festivalRegionCodes: ["invalid"] }));
  const disabled = await updateNotificationSettings(db.prisma, { id: "user" }, { festivalRegionCodes: [] });
  assert.equal(disabled.festivalEnabled, false);
});

function schedulerDatabase(settings, tripDays = []) {
  const notifications = [];
  const evaluations = [];
  const prisma = {
    route: { findMany: async () => [] },
    routeDay: { findMany: async query => query.orderBy ? [] : tripDays },
    userNotificationSetting: {
      findMany: async () => settings,
      update: async ({ where, data }) => { evaluations.push({ id: where.id, ...data }); Object.assign(settings.find(setting => setting.id === where.id), data); return data; },
    },
    userNotification: {
      updateMany: async () => ({ count: 0 }), deleteMany: async () => ({ count: 0 }),
      findMany: async () => [],
      findUnique: async ({ where }) => notifications.find(notification => notification.notificationKey === where.userId_notificationKey.notificationKey && notification.userId === where.userId_notificationKey.userId) ?? null,
      create: async ({ data }) => { const notification = { id: `notification-${notifications.length}`, ...data }; notifications.push(notification); return notification; },
      update: async ({ where, data }) => Object.assign(notifications.find(notification => notification.id === where.id), data),
    },
  };
  return { prisma, notifications, evaluations };
}

test("예약 알림은 선택한 지방과 당일 여행 지역을 합치고 반복 실행에도 하루 한 건만 만든다", async () => {
  const db = schedulerDatabase([{ id: "setting", userId: "user", festivalEnabled: true, festivalRegionCodes: ["1", "46130"] }], [{
    id: "day", route: { ownerId: "user", primaryRegionCode: "26350", primaryRegionLabelKey: "26:26350" },
    stops: [{ place: { regionCode: "26350", regionLabelKey: "26:26350" } }],
  }]);
  await runNotificationSchedulerOnce(db.prisma, now);
  assert.equal(db.notifications.length, 1);
  assert.deepEqual([...db.notifications[0].festivalRegionCodes].sort(), ["26350", "46130", "51150"]);
  assert.equal(db.notifications[0].festivalKind, "TRIP");
  assert.ok(db.notifications[0].regionLabel.includes("전남 여수시"));
  await runNotificationSchedulerOnce(db.prisma, now);
  assert.equal(db.notifications.length, 1);
  assert.equal(db.evaluations.length, 1);
});


test("한 사용자의 권역 조회가 실패해도 다른 사용자는 처리하고 실패 대상은 다음 실행에서 재시도한다", async () => {
  const db = schedulerDatabase([
    { id: "success", userId: "user-1", festivalEnabled: true, festivalRegionCodes: ["51150"] },
    { id: "retry", userId: "user-2", festivalEnabled: true, festivalRegionCodes: ["30230"] },
    { id: "retry-2", userId: "user-3", festivalEnabled: true, festivalRegionCodes: ["30230"] },
  ]);
  const previousCount = requests.filter(request => request.area === "3").length;
  failedAreas.add("3");
  await runNotificationSchedulerOnce(db.prisma, now);
  assert.equal(requests.filter(request => request.area === "3").length - previousCount, 3);
  assert.equal(db.notifications.length, 1);
  assert.deepEqual(db.evaluations.map(evaluation => evaluation.id), ["success"]);
  failedAreas.delete("3");
  await runNotificationSchedulerOnce(db.prisma, now);
  assert.equal(db.notifications.length, 3);
  assert.deepEqual(db.evaluations.map(evaluation => evaluation.id), ["success", "retry", "retry-2"]);
});


test("공식 목록에 좌표가 없으면 같은 축제의 Open API 좌표를 사용한다", async () => {
  officialCoordlessAreas.add("1");
  const festivals = await getFestivals({ startDate: "2026-11-03", endDate: "2026-11-09", areaCode: "1" });
  assert.equal(festivals.length, 1);
  assert.equal(festivals[0].id, "festival-1-23");
  assert.equal(festivals[0].lat, 35.5);
  officialCoordlessAreas.delete("1");
});

test("실제 GraphQL 축제 요청 문서는 선택 지역의 행정 코드와 지도 필터 코드를 함께 반환한다", async () => {
  const server = new ApolloServer({
    typeDefs: [gql`scalar DateTime
 type Query { _empty: String }
 type Mutation { _empty: String }`, notificationTypeDefs],
    resolvers: notificationResolvers,
  });
  try {
    const query = await readFile(new URL("../../web/src/graphql/notifications/festivals.graphql", import.meta.url), "utf8");
    const result = await server.executeOperation({ query, variables: { startDate: "2026-11-03", endDate: "2026-11-09", regionCodes: ["46130"] } });
    assert.equal(result.body.kind, "single");
    assert.equal(result.body.singleResult.errors, undefined);
    const festival = result.body.singleResult.data.festivals[0];
    assert.equal(festival.areaCode, "38");
    assert.equal(festival.regionCode, "46130");
    assert.equal(festival.sigunguCode, "13");
  } finally { await server.stop(); }
});

test("이전 네이티브의 여러 지역 알림 동기화는 서버의 지역 목록을 지우지 않는다", async () => {
  const updates = [];
  const prisma = {
    $transaction: async callback => callback(prisma),
    $runCommandRaw: async command => { updates.push(...command.updates); return { ok: 1, n: command.updates.length }; },
    userNotification: { deleteMany: async () => ({ count: 0 }) },
  };
  await syncFestivalNotificationInbox(prisma, { id: "user" }, [{
    notificationKey: "festival:legacy", kind: "WEEKLY", regionCode: "MULTIPLE", regionLabel: "강릉, 춘천", dateKey: "2026-11-03",
    festivalIds: ["festival"], festivalTitles: ["축제"],
  }]);
  assert.equal(updates.length, 1);
  assert.equal(Object.hasOwn(updates[0].u.$set, "festivalRegionCodes"), false);
});
