import {
  getTouristNameMatchScore,
  shouldHideAttraction,
} from "@/lib/gangwonAttractionMap";
import { isTouristPlace } from "@/lib/placeCategory";
import {
  buildLatestConcentrationMap,
  type GangwonAttraction,
  type TouristConcentrationPoint,
} from "@/lib/visitKoreaTourApi";

export type HomeAttractionQueryData = {
  /** 숨김 대상이 제거되고 현재 언어의 표시값이 반영된 지도·검색용 관광지 목록 */
  allAttractions: GangwonAttraction[];
  /** 언어가 바뀔 때 다시 번역할 기준으로 보관하는 원본 관광지 목록 */
  sourceAttractions: GangwonAttraction[];
  /** 이 데이터가 속하는 시·군·구 코드 */
  sigunguCode: string;
  /** 혼잡도 순위에 포함된 관광지와 트렌드 표시명 목록 */
  topAttractions: Array<{
    attraction: GangwonAttraction;
    touristTrendName: string;
  }>;
  /** 관광 분류 코드를 키로 갖는 현재 언어의 분류명 조회표 */
  lclsNameByCode: Record<string, string>;
  /** allAttractions와 분류명이 현재 앱 언어로 변환됐는지 여부 */
  isLocalized: boolean;
};

type HomeAttractionDataInput = {
  attractions: GangwonAttraction[];
  festivals: GangwonAttraction[];
  concentrationPoints: TouristConcentrationPoint[];
  lclsNameByCode: Record<string, string>;
  sigunguCode: string;
  isLocalized: boolean;
};

/**
 * 관광지 다음에 축제를 붙여 이름·주소가 같은 첫 항목을 남기고 숨김 대상을 제외한다.
 * 최신 혼잡도 순서로 관광지만 이름 매칭해 ID가 겹치지 않는 상위 10곳을 고른다.
 * 입력을 변경하지 않으며 표시 목록과 원문 목록은 같은 배열로 시작한다.
 */
export function buildHomeAttractionData({
  attractions,
  festivals,
  concentrationPoints,
  lclsNameByCode,
  sigunguCode,
  isLocalized,
}: HomeAttractionDataInput): HomeAttractionQueryData {
  const attractionsWithFestivals = [...attractions, ...festivals];
  const dedupedAttractions = attractionsWithFestivals.filter(
    (attraction, index, array) => {
      const key = `${attraction.title.trim().toLowerCase()}|${attraction.address
        .trim()
        .toLowerCase()}`;
      return (
        array.findIndex((candidate) => {
          const candidateKey = `${candidate.title
            .trim()
            .toLowerCase()}|${candidate.address.trim().toLowerCase()}`;
          return candidateKey === key;
        }) === index
      );
    }
  );
  const filteredAttractions = dedupedAttractions.filter(
    (attraction) => !shouldHideAttraction(attraction, lclsNameByCode)
  );
  const rankableTouristAttractions = filteredAttractions.filter(
    (attraction) => isTouristPlace(attraction)
  );
  const latestConcentrationByName =
    buildLatestConcentrationMap(concentrationPoints);
  const latestConcentrationPoints = [
    ...latestConcentrationByName.values(),
  ].sort((a, b) => b.concentrationRate - a.concentrationRate);

  const usedAttractionIds = new Set<string>();
  const topAttractions: HomeAttractionQueryData["topAttractions"] = [];

  latestConcentrationPoints.forEach((point) => {
    if (topAttractions.length >= 10) {
      return;
    }

    const bestMatch = rankableTouristAttractions
      .filter((attraction) => !usedAttractionIds.has(attraction.id))
      .map((attraction) => ({
        attraction,
        score: getTouristNameMatchScore(attraction.title, point.touristName),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!bestMatch) {
      return;
    }

    usedAttractionIds.add(bestMatch.attraction.id);
    topAttractions.push({
      attraction: bestMatch.attraction,
      touristTrendName: point.touristName,
    });
  });

  return {
    allAttractions: filteredAttractions,
    sourceAttractions: filteredAttractions,
    sigunguCode,
    topAttractions,
    lclsNameByCode,
    isLocalized,
  };
}

/** ID와 장소 유형이 같은 원문에 비해 이름이나 주소가 달라진 번역이 하나라도 있는지 확인한다. */
export function hasHomeAttractionLocalizedText(
  sourceAttractions: GangwonAttraction[],
  localizedAttractions: GangwonAttraction[]
) {
  const sourceAttractionByKey = new Map(
    sourceAttractions.map((attraction) => [
      `${attraction.id}-${attraction.contentTypeId}`,
      attraction,
    ])
  );

  return localizedAttractions.some((attraction) => {
    const sourceAttraction = sourceAttractionByKey.get(
      `${attraction.id}-${attraction.contentTypeId}`
    );

    return (
      sourceAttraction &&
      (attraction.title !== sourceAttraction.title ||
        attraction.address !== sourceAttraction.address)
    );
  });
}

/**
 * 번역 목록 순서로 표시 목록을 교체하되 캐시의 기존 이미지를 우선하고 원문은 보관한다.
 * 순위 항목은 ID·장소 유형이 같은 번역 객체에 연결하며, 캐시가 없거나 이미 번역됐으면 그대로 반환한다.
 * 입력 객체와 배열은 변경하지 않는다.
 */
export function applyHomeAttractionLocalization(
  currentData: HomeAttractionQueryData | undefined,
  sourceAttractions: GangwonAttraction[],
  localizedAttractions: GangwonAttraction[]
): HomeAttractionQueryData | undefined {
  if (!currentData || currentData.isLocalized) {
    return currentData;
  }

  const localizedAttractionByKey = new Map(
    localizedAttractions.map((attraction) => [
      `${attraction.id}-${attraction.contentTypeId}`,
      attraction,
    ])
  );
  const currentAttractionByKey = new Map(
    currentData.allAttractions.map((attraction) => [
      `${attraction.id}-${attraction.contentTypeId}`,
      attraction,
    ])
  );
  const nextAttractions = localizedAttractions.map((attraction) => {
    const currentAttraction = currentAttractionByKey.get(
      `${attraction.id}-${attraction.contentTypeId}`
    );

    if (!currentAttraction) {
      return attraction;
    }

    return {
      ...attraction,
      firstImage: currentAttraction.firstImage || attraction.firstImage,
      secondImage: currentAttraction.secondImage || attraction.secondImage,
    };
  });

  return {
    ...currentData,
    allAttractions: nextAttractions,
    sourceAttractions,
    topAttractions: currentData.topAttractions.map((item) => ({
      ...item,
      attraction:
        localizedAttractionByKey.get(
          `${item.attraction.id}-${item.attraction.contentTypeId}`
        ) ?? item.attraction,
    })),
    isLocalized: true,
  };
}
