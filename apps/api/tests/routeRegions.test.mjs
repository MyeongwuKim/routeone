import assert from "node:assert/strict";
import test from "node:test";
import { findRouteRegionTag, getRouteRegionWhere, ROUTE_REGION_RULES } from "../src/modules/routes/routeRegions.ts";
import { buildRouteShareTags } from "../src/modules/routes/route.shared.ts";

function matches(route, where) {
  if (where.OR) return where.OR.some(condition => matches(route, condition));
  return Object.entries(where).every(([key, condition]) => {
    if ("has" in condition) return route[key]?.includes(condition.has);
    if ("in" in condition) return condition.in.includes(route[key]);
    return route[key]?.startsWith(condition.startsWith) ?? false;
  });
}

const routes = {
  sejong: { primaryRegionCode: "36110", primaryRegionLabelKey: "36:36110", shareTags: [] },
  gyeongnam: { primaryRegionCode: "48120", primaryRegionLabelKey: "48:48120", shareTags: [] },
  legacyGyeongnam: { primaryRegionCode: "16", primaryRegionLabelKey: "36:16", shareTags: [] },
};

test("행정 코드 36인 세종과 관광 코드 36인 경남은 조회·태그 판정에서 구분한다", () => {
  for (const [key, route] of Object.entries(routes)) {
    const expected = key === "sejong" ? "세종" : "경남";
    assert.equal(findRouteRegionTag([route.primaryRegionCode], [route.primaryRegionLabelKey]), expected);
    assert.equal(matches(route, getRouteRegionWhere("세종")), expected === "세종");
    assert.equal(matches(route, getRouteRegionWhere("경남")), expected === "경남");
  }
});

test("모든 지원 지방은 주소의 언어와 상관없이 행정 코드로 공유 태그와 조회 조건을 적용한다", () => {
  for (const rule of ROUTE_REGION_RULES) {
    const prefix = rule.adminCodePrefixes[0];
    const route = {
      primaryRegionCode: `${prefix}110`, primaryRegionLabelKey: `${prefix}:${prefix}110`,
      shareTags: [], tripDays: 1, totalStopCount: 0, completedStopCount: 0,
    };
    assert.ok(buildRouteShareTags(route, []).includes(rule.tag), rule.tag);
    assert.equal(matches(route, getRouteRegionWhere(rule.tag)), true, rule.tag);
    for (const otherRule of ROUTE_REGION_RULES.filter(other => other.tag !== rule.tag)) {
      assert.equal(matches(route, getRouteRegionWhere(otherRule.tag)), false, `${rule.tag} / ${otherRule.tag}`);
    }
  }
});

test("전북 전환 전 행정 코드와 기존 강원 관광 코드도 유지한다", () => {
  assert.equal(findRouteRegionTag(["45110"], ["45:45110"]), "전북");
  assert.equal(findRouteRegionTag(["13"], ["32:13"]), "강원");
  assert.equal(matches({ primaryRegionCode: "45110", shareTags: [] }, getRouteRegionWhere("전북")), true);
});

test("지역 조건이 없으면 제한하지 않고 미등록 태그는 기존 태그 조건을 사용한다", () => {
  assert.deepEqual(getRouteRegionWhere(null), {});
  assert.deepEqual(getRouteRegionWhere("  "), {});
  assert.equal(matches({ shareTags: ["기타"] }, getRouteRegionWhere("기타")), true);
});
