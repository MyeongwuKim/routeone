import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { inspect } from "node:util";
import { fetchOfficialTourCourses } from "../src/modules/home-tour-courses/tourCourseSource.ts";

const serviceKey = "course-test-key+/=";
const previousKey = process.env.VISITKOREA_SERVICE_KEY;
before(() => {
  process.env.VISITKOREA_SERVICE_KEY = encodeURIComponent(serviceKey);
});
after(() => {
  if (previousKey === undefined) delete process.env.VISITKOREA_SERVICE_KEY;
  else process.env.VISITKOREA_SERVICE_KEY = previousKey;
});

function tourResponse(item, totalCount) {
  return Response.json({
    response: {
      header: { resultCode: "0000" },
      body: { items: { item }, totalCount },
    },
  });
}

test("국문 공식 코스 페이지의 원본 순서와 좌표가 없는 코스를 보존한다", async (t) => {
  const pages = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const { origin, pathname, searchParams } = new URL(url);
    assert.equal(origin, "https://apis.data.go.kr");
    assert.equal(pathname, "/B551011/KorService2/areaBasedList2");
    assert.equal(searchParams.get("serviceKey"), serviceKey);
    assert.equal(searchParams.get("contentTypeId"), "25");
    assert.equal(searchParams.get("arrange"), "C");
    assert.equal(searchParams.get("numOfRows"), "200");
    assert.equal(searchParams.has("areaCode"), false);
    assert.equal(searchParams.has("sigunguCode"), false);
    assert.ok(options.signal instanceof AbortSignal);

    const page = searchParams.get("pageNo");
    pages.push(page);
    if (page === "1") {
      return tourResponse({ contentid: "101", title: "<b>공식 코스</b>", mapx: "", mapy: "0" }, "201");
    }
    return tourResponse([
      { contentid: "101", title: "앞 페이지와 중복된 코스" },
      { contentid: "103", title: "<b></b>" },
      {
        contentid: "102", title: "다음 페이지의<br/>공식 코스", mapx: "128.88", mapy: "37.75",
        areacode: " 32 ", sigungucode: "1", lDongRegnCd: "51", lDongSignguCd: "150",
        firstimage: " ", firstimage2: " https://example.test/official.jpg ",
      },
    ], 201);
  });

  const courses = await fetchOfficialTourCourses();
  assert.deepEqual(pages, ["1", "2"]);
  assert.deepEqual(courses, [
    { id: "101", title: "공식 코스", image: "", areaCode: "", sigunguCode: "", adminCode: "", location: null },
    {
      id: "102", title: "다음 페이지의 공식 코스", image: "https://example.test/official.jpg",
      areaCode: "32", sigunguCode: "1", adminCode: "51150", location: { lat: 37.75, lng: 128.88 },
    },
  ]);
});

test("코스 원본 요청 오류에 서비스 키가 포함된 URL이나 원본 응답을 전달하지 않는다", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    throw new Error(`Failed ${url}`);
  });
  await assert.rejects(fetchOfficialTourCourses(), { message: "Tour course source request failed (page 1)" });

  fetch.mock.mockImplementation(async () => Response.json({
    response: { header: { resultCode: "99", resultMsg: serviceKey } },
  }));
  await assert.rejects(fetchOfficialTourCourses(), { message: "Tour course source returned an invalid response (page 1)" });
});

for (const code of ["UND_ERR_CONNECT_TIMEOUT", "ENOTFOUND", "CERT_HAS_EXPIRED"]) {
  test(`네트워크 원인 ${code}는 남기고 원본 오류의 키와 URL은 제거한다`, async (t) => {
    t.mock.method(globalThis, "fetch", async (url) => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error(`Failed ${url}`), { code }),
      });
    });

    await assert.rejects(fetchOfficialTourCourses(), (error) => {
      assert.equal(error.message, `Tour course source request failed (page 1, ${code})`);
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(inspect(error), /course-test-key|apis\.data\.go\.kr/);
      return true;
    });
  });
}

test("여러 연결 시도의 오류 코드를 중복 없이 남긴다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    throw new TypeError("fetch failed", {
      cause: new AggregateError([
        Object.assign(new Error(`Failed ${url}`), { code: "ENETUNREACH" }),
        Object.assign(new Error(`Failed ${url}`), { code: "ETIMEDOUT" }),
        Object.assign(new Error(`Failed ${url}`), { code: "ETIMEDOUT" }),
      ]),
    });
  });

  await assert.rejects(fetchOfficialTourCourses(), {
    message: "Tour course source request failed (page 1, ENETUNREACH, ETIMEDOUT)",
  });
});

for (const name of ["TimeoutError", "AbortError"]) {
  test(`요청 중단 ${name}을 네트워크 연결 오류와 구분한다`, async (t) => {
    t.mock.method(globalThis, "fetch", async (url) => {
      throw new DOMException(`Failed ${url}`, name);
    });

    await assert.rejects(fetchOfficialTourCourses(), {
      message: `Tour course source request failed (page 1, ${name})`,
    });
  });
}

test("허용하지 않은 오류 코드와 순환 원인에는 민감한 값을 남기지 않는다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const error = Object.assign(new Error(`Failed ${url}`), { code: serviceKey });
    error.cause = error;
    throw error;
  });

  await assert.rejects(fetchOfficialTourCourses(), {
    message: "Tour course source request failed (page 1)",
  });
});
