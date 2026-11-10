import assert from "node:assert/strict";
import test from "node:test";
import { ApolloServer } from "@apollo/server";
import { gql } from "graphql-tag";
import {
  homeTourCourseResolvers,
  homeTourCourseTypeDefs,
} from "../src/modules/home-tour-courses/homeTourCourses.resolver.ts";
import { warmHomeTourCourses } from "../src/modules/home-tour-courses/tourCourseIndex.service.ts";

test("기동 조회를 공유하고 공식 코스를 선택 지역과 페이지로 제한한다", async (t) => {
  const previousKey = process.env.VISITKOREA_SERVICE_KEY;
  process.env.VISITKOREA_SERVICE_KEY = "course-index-test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.VISITKOREA_SERVICE_KEY;
    else process.env.VISITKOREA_SERVICE_KEY = previousKey;
  });

  const gangnamCourses = Array.from({ length: 13 }, (_, index) => ({
    contentid: `gangnam-${index}`,
    title: `강남 코스 ${index}`,
    areacode: "1",
    sigungucode: "1",
  }));
  const items = [
    ...gangnamCourses.slice(0, 4),
    { contentid: "gangneung", title: "강릉 코스", areacode: "32", sigungucode: "1" },
    { contentid: "gangneung-legacy", title: "강릉 행정코드 코스", lDongRegnCd: "42", lDongSignguCd: "150", mapx: "127.0473", mapy: "37.5172" },
    { contentid: "suwon-tour-code", title: "수원 관광 코드 코스", areacode: "31", sigungucode: "13" },
    { contentid: "suwon-district", title: "팔달구 행정 코드 코스", lDongRegnCd: "41", lDongSignguCd: "115" },
    { contentid: "suwon-location", title: "대표 좌표가 수원인 코스", mapx: "127.0286", mapy: "37.2635" },
    { contentid: "gangnam-location", title: "대표 좌표가 강남과 서초 경계에 있는 코스", mapx: "127.063813", mapy: "37.469001" },
    { contentid: "jongno-location", title: "대표 좌표가 종로인 코스", mapx: "126.979", mapy: "37.5735" },
    { contentid: "mismatched-location", title: "다른 권역이 등록된 코스", areacode: "32", mapx: "127.0473", mapy: "37.5172" },
    { contentid: "unknown-location", title: "등록 지역이나 대표 좌표가 없는 코스" },
    ...gangnamCourses.slice(4),
  ];

  const catalogResponse = (catalogItems) => Response.json({
    response: {
      header: { resultCode: "0000" },
      body: { totalCount: catalogItems.length, items: { item: catalogItems } },
    },
  });
  let now = Date.now();
  let fetchCount = 0;
  let resolveRefresh;
  const refreshResponse = new Promise((resolve) => { resolveRefresh = resolve; });
  t.mock.method(Date, "now", () => now);
  const request = t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://apis.data.go.kr");
    assert.equal(url.searchParams.get("contentTypeId"), "25");
    fetchCount += 1;
    return fetchCount === 1 ? catalogResponse(items) : refreshResponse;
  });

  const server = new ApolloServer({
    typeDefs: [gql`type Query { _empty: String }`, homeTourCourseTypeDefs],
    resolvers: homeTourCourseResolvers,
  });
  t.after(() => server.stop());
  const query = gql`
    query HomeTourCourses($areaCode: String!, $sigunguCode: String, $sigunguCodes: [String!], $page: Int!) {
      homeTourCourses(areaCode: $areaCode, sigunguCode: $sigunguCode, sigunguCodes: $sigunguCodes, page: $page) {
        courses { id title image }
        totalCount
      }
    }
  `;
  const execute = async (areaCode, sigunguCode, page, sigunguCodes) => {
    const response = await server.executeOperation({ query, variables: { areaCode, sigunguCode, sigunguCodes, page } });
    assert.equal(response.body.kind, "single");
    return response.body.singleResult;
  };

  warmHomeTourCourses();
  const results = await Promise.all([
    execute("1", "1", 1),
    execute("1", "1", 2),
    execute("1", null, 2),
    execute("32", "1", 1),
    execute("1", "2", 1),
    execute("1", null, 1, ["23", "15", "1", "1"]),
    execute("1", null, 2, ["1", "15", "23"]),
    execute("1", "15", 1),
  ]);
  for (const { errors } of results) assert.equal(errors, undefined);
  const [first, next, province, gangneung, empty, combinedFirst, combinedNext, seocho] = results.map(({ data }) => data.homeTourCourses);

  assert.equal(request.mock.callCount(), 1);
  assert.equal(first.totalCount, 14);
  assert.deepEqual(first.courses.map(({ id }) => id), [
    ...gangnamCourses.slice(0, 4).map(({ contentid }) => contentid),
    "gangnam-location",
    ...gangnamCourses.slice(4, 11).map(({ contentid }) => contentid),
  ]);
  assert.equal(next.totalCount, 14);
  assert.deepEqual(next.courses.map(({ id }) => id), ["gangnam-11", "gangnam-12"]);
  assert.equal(province.totalCount, 15);
  assert.deepEqual(gangneung.courses.map(({ id }) => id), ["gangneung", "gangneung-legacy"]);
  const suwon = await execute("31", "13", 1);
  assert.equal(suwon.errors, undefined);
  assert.deepEqual(suwon.data.homeTourCourses.courses.map(({ id }) => id), ["suwon-tour-code", "suwon-district", "suwon-location"]);
  assert.equal(empty.totalCount, 0);
  assert.deepEqual(seocho.courses.map(({ id }) => id), ["gangnam-location"]);
  assert.equal(combinedFirst.totalCount, 15);
  assert.equal(combinedNext.totalCount, 15);
  assert.equal(combinedFirst.courses.length, 12);
  assert.equal(combinedNext.courses.length, 3);
  assert.deepEqual([...combinedFirst.courses, ...combinedNext.courses].map(({ id }) => id), [
    ...gangnamCourses.slice(0, 4).map(({ contentid }) => contentid),
    "gangnam-location",
    "jongno-location",
    ...gangnamCourses.slice(4).map(({ contentid }) => contentid),
  ]);

  assert.equal((await execute("1", "999", 1)).errors?.[0]?.message, "여행 코스 지역이 올바르지 않아요.");
  assert.equal((await execute("1", null, 1, ["1", "999"])).errors?.[0]?.message, "여행 코스 지역이 올바르지 않아요.");
  assert.equal((await execute("1", null, 0)).errors?.[0]?.message, "여행 코스 페이지가 올바르지 않아요.");
  assert.equal(request.mock.callCount(), 1);

  now += 60 * 60 * 1000 + 1;
  const [staleFirst, staleNext] = await Promise.all([execute("1", "1", 1), execute("1", "1", 2)]);
  assert.deepEqual(staleFirst.data.homeTourCourses, first);
  assert.deepEqual(staleNext.data.homeTourCourses, next);
  assert.equal(request.mock.callCount(), 2);

  resolveRefresh(catalogResponse([{ ...gangnamCourses[0], title: "갱신된 공식 코스" }]));
  await refreshResponse;
  await new Promise(setImmediate);
  const refreshed = (await execute("1", "1", 1)).data.homeTourCourses;
  assert.equal(refreshed.totalCount, 1);
  assert.equal(refreshed.courses[0].title, "갱신된 공식 코스");
  assert.equal(request.mock.callCount(), 2);
});
