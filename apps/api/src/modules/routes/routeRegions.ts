import type { Prisma } from "@prisma/client";

type RegionRule = {
  tag: string;
  tourAreaCode: string;
  adminCodePrefixes: string[];
  tourRegionCodes: string[];
};

/** 공개 루트의 권역 태그와 관광공사·행정 코드를 연결한다. 관광공사 36(경남)과 행정 36(세종)을 구분한다. */
export const ROUTE_REGION_RULES: RegionRule[] = [
  {
    tag: "강원", tourAreaCode: "32",
    adminCodePrefixes: ["51", "42"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"],
  },
  {
    tag: "서울", tourAreaCode: "1",
    adminCodePrefixes: ["11"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"],
  },
  {
    tag: "부산", tourAreaCode: "6",
    adminCodePrefixes: ["26"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
  },
  {
    tag: "대구", tourAreaCode: "4",
    adminCodePrefixes: ["27"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
  {
    tag: "광주", tourAreaCode: "5",
    adminCodePrefixes: ["29"],
    tourRegionCodes: ["1", "2", "3", "4", "5"],
  },
  {
    tag: "대전", tourAreaCode: "3",
    adminCodePrefixes: ["30"],
    tourRegionCodes: ["1", "2", "3", "4", "5"],
  },
  {
    tag: "울산", tourAreaCode: "7",
    adminCodePrefixes: ["31"],
    tourRegionCodes: ["1", "2", "3", "4", "5"],
  },
  {
    tag: "세종", tourAreaCode: "8",
    adminCodePrefixes: ["36"],
    tourRegionCodes: ["1"],
  },
  {
    tag: "충북", tourAreaCode: "33",
    adminCodePrefixes: ["43"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "10", "11", "12"],
  },
  {
    tag: "충남", tourAreaCode: "34",
    adminCodePrefixes: ["44"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "12", "13", "14", "15", "16"],
  },
  {
    tag: "전북", tourAreaCode: "37",
    adminCodePrefixes: ["52", "45"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
  },
  {
    tag: "전남", tourAreaCode: "38",
    adminCodePrefixes: ["46"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "15", "16", "17", "18", "19", "20", "21", "22", "23"],
  },
  {
    tag: "경북", tourAreaCode: "35",
    adminCodePrefixes: ["47"],
    tourRegionCodes: ["1", "2", "3", "4", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"],
  },
  {
    tag: "경남", tourAreaCode: "36",
    adminCodePrefixes: ["48"],
    tourRegionCodes: ["1", "2", "3", "4", "5", "7", "8", "9", "10", "12", "13", "15", "16", "17", "18", "19", "20", "21"],
  },
  {
    tag: "제주", tourAreaCode: "39",
    adminCodePrefixes: ["50"],
    tourRegionCodes: ["3", "4"],
  },
];

/** 행정 코드가 포함된 지역 키의 접두어와 예전 관광공사 시군구 키를 각각 만든다. */
function getRegionLabelMatchers(rule: RegionRule) {
  return {
    prefixes: rule.adminCodePrefixes.flatMap((prefix) => [
      `${prefix}:${prefix}`,
      `${rule.tourAreaCode}:${prefix}`,
    ]),
    legacyKeys: rule.tourRegionCodes.map((code) => `${rule.tourAreaCode}:${code}`),
  };
}

/** 저장된 행정 코드 또는 관광공사 지역 키로 루트의 권역 태그를 찾고, 매칭할 수 없으면 null을 반환한다. */
export function findRouteRegionTag(regionCodes: string[], regionLabelKeys: string[]) {
  const adminRule = ROUTE_REGION_RULES.find((rule) => regionCodes.some((code) =>
    /^\\d{5}$/.test(code) && rule.adminCodePrefixes.some((prefix) => code.startsWith(prefix))
  ));
  if (adminRule) return adminRule.tag;
  return ROUTE_REGION_RULES.find((rule) => {
    const { prefixes, legacyKeys } = getRegionLabelMatchers(rule);
    return regionLabelKeys.some((key) => prefixes.some((prefix) => key.startsWith(prefix)) || legacyKeys.includes(key));
  })?.tag ?? null;
}

/** 선택 권역의 태그·행정 코드·관광공사 키로 공유 루트를 조회한다. 빈 권역은 지역 조건을 추가하지 않는다. */
export function getRouteRegionWhere(regionTag?: string | null): Prisma.RouteWhereInput {
  const tag = regionTag?.trim();
  if (!tag) return {};
  const rule = ROUTE_REGION_RULES.find((rule) => rule.tag === tag);
  if (!rule) return { shareTags: { has: tag } };
  const { prefixes, legacyKeys } = getRegionLabelMatchers(rule);
  return {
    OR: [
      { shareTags: { has: tag } },
      ...rule.adminCodePrefixes.map((prefix) => ({ primaryRegionCode: { startsWith: prefix } })),
      ...prefixes.map((prefix) => ({ primaryRegionLabelKey: { startsWith: prefix } })),
      { primaryRegionLabelKey: { in: legacyKeys } },
    ],
  };
}
