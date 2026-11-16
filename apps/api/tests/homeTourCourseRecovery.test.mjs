import assert from "node:assert/strict";
import test from "node:test";
import { ApolloServer } from "@apollo/server";
import { gql } from "graphql-tag";
import {
  homeTourCourseResolvers,
  homeTourCourseTypeDefs,
} from "../src/modules/home-tour-courses/homeTourCourses.resolver.ts";

test("캐시가 없는 서버의 첫 연결이 시간 초과되어도 재시도를 공유해 모든 지역 코스를 반환한다", async (t) => {
  const previousKey = process.env.VISITKOREA_SERVICE_KEY;
  process.env.VISITKOREA_SERVICE_KEY = "course-recovery-test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.VISITKOREA_SERVICE_KEY;
    else process.env.VISITKOREA_SERVICE_KEY = previousKey;
  });

  let fetchCount = 0;
  const request = t.mock.method(globalThis, "fetch", async () => {
    fetchCount += 1;
    if (fetchCount === 1) {
      throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    }
    return Response.json({
      response: {
        header: { resultCode: "0000" },
        body: {
          totalCount: 3,
          items: { item: [
            { contentid: "seoul", title: "서울 코스", areacode: "1", sigungucode: "1" },
            { contentid: "gyeonggi", title: "경기 코스", areacode: "31", sigungucode: "13" },
            { contentid: "gangwon", title: "강원 코스", areacode: "32", sigungucode: "1" },
          ] },
        },
      },
    });
  });
  const server = new ApolloServer({
    typeDefs: [gql`type Query { _empty: String }`, homeTourCourseTypeDefs],
    resolvers: homeTourCourseResolvers,
  });
  t.after(() => server.stop());
  const query = gql`
    query HomeCourseRecovery($areaCode: String!) {
      homeTourCourses(areaCode: $areaCode, page: 1) {
        courses { id }
        totalCount
      }
    }
  `;
  const results = await Promise.all(["1", "31", "32"].map(async (areaCode) => {
    const response = await server.executeOperation({ query, variables: { areaCode } });
    assert.equal(response.body.kind, "single");
    return response.body.singleResult;
  }));

  for (const result of results) {
    assert.equal(result.errors?.[0]?.message, undefined);
    assert.equal(result.data.homeTourCourses.totalCount, 1);
  }
  assert.deepEqual(results.map(({ data }) => data.homeTourCourses.courses[0].id), ["seoul", "gyeonggi", "gangwon"]);
  assert.equal(request.mock.callCount(), 2);

  await t.test("만료 후 연결이 계속 실패해도 기존 지역 목록은 유지한다", async (t) => {
    let now = Date.now() + 60 * 60_000 + 1;
    t.mock.method(Date, "now", () => now);
    const warning = t.mock.method(console, "warn", () => undefined);
    let retryCount = 0;
    let finishAttempts;
    const attemptsFinished = new Promise((resolve) => { finishAttempts = resolve; });
    request.mock.mockImplementation(async () => {
      retryCount += 1;
      if (retryCount === 3) finishAttempts();
      throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    });

    const cached = await Promise.all(["1", "31", "32"].map(async (areaCode) => {
      const response = await server.executeOperation({ query, variables: { areaCode } });
      assert.equal(response.body.kind, "single");
      assert.equal(response.body.singleResult.errors, undefined);
      return response.body.singleResult.data.homeTourCourses;
    }));
    assert.deepEqual(cached.map(({ courses }) => courses[0].id), ["seoul", "gyeonggi", "gangwon"]);
    await attemptsFinished;
    await new Promise(setImmediate);
    assert.equal(warning.mock.callCount(), 1);

    now += 59_000;
    const response = await server.executeOperation({ query, variables: { areaCode: "1" } });
    assert.equal(response.body.singleResult.errors, undefined);
    assert.equal(retryCount, 3);
  });
});
