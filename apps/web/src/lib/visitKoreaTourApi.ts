const TOUR_API_BASE_URL = "/tour-api/B551011/KorService2/areaBasedList2";
const TOUR_LCLS_CODE_BASE_URL = "/tour-api/B551011/KorService2/lclsSystmCode2";
const TOUR_DETAIL_COMMON_BASE_URL =
  "/tour-api/B551011/KorService2/detailCommon2";
const TOUR_DETAIL_IMAGE_BASE_URL = "/tour-api/B551011/KorService2/detailImage2";

const GANGWON_AREA_CODE = "32";

export const TOUR_CONTENT_TYPE_IDS = [
  "39", // 음식점
  "38", // 쇼핑
  "32", // 숙박
  "12", // 관광지
  "14", // 문화시설
  "15", // 축제/공연
  "28", // 레포츠
] as const;

type TourApiItem = {
  title?: string;
  mapx?: string;
  mapy?: string;
  addr1?: string;
  contentid?: string;
  contenttypeid?: string;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  firstimage?: string;
  firstimage2?: string;
  overview?: string;
  originimgurl?: string;
  smallimageurl?: string;
};

type TourApiResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: TourApiItem[] | TourApiItem;
      };
    };
  };
};

type TourPhotoGalleryItem = {
  galWebImageUrl?: string;
  galTitle?: string;
  galPhotographyLocation?: string;
  galSearchKeyword?: string;
};

type TourPhotoGalleryResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: TourPhotoGalleryItem[] | TourPhotoGalleryItem;
      };
    };
  };
};

type LclsSystemItem = {
  lclsSystm1Cd?: string;
  lclsSystm1Nm?: string;
  lclsSystm2Cd?: string;
  lclsSystm2Nm?: string;
  lclsSystm3Cd?: string;
  lclsSystm3Nm?: string;
};

type LclsSystemResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: LclsSystemItem[] | LclsSystemItem;
      };
    };
  };
};

export type GangwonAttraction = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  contentTypeId: string;
  lclsSystm1: string;
  lclsSystm2: string;
  lclsSystm3: string;
  firstImage: string;
  secondImage: string;
};

export type TourPlaceDetail = {
  overview: string;
  images: string[];
};

type FetchGangwonAttractionsOptions = {
  sigunguCode?: string;
  contentTypeIds?: string[];
};

function normalizeServiceKey(serviceKey: string) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function toArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function stripHtml(htmlText?: string) {
  if (!htmlText) {
    return "";
  }

  return htmlText
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function canonicalizeImageUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.split("?")[0].split("#")[0];
  }
}

function dedupeImageUrls(urls: string[]) {
  const unique = new Map<string, string>();

  urls.forEach((imageUrl) => {
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      return;
    }
    const key = canonicalizeImageUrl(trimmed);
    if (!unique.has(key)) {
      unique.set(key, trimmed);
    }
  });

  return [...unique.values()];
}

export async function fetchGangwonAttractions(
  serviceKey: string,
  options: FetchGangwonAttractionsOptions = {}
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const contentTypeIds =
    options.contentTypeIds && options.contentTypeIds.length > 0
      ? options.contentTypeIds
      : [...TOUR_CONTENT_TYPE_IDS];

  const queryBase: Record<string, string> = {
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    numOfRows: "200",
    pageNo: "1",
    arrange: "Q",
    areaCode: GANGWON_AREA_CODE,
  };

  if (options.sigunguCode) {
    queryBase.sigunguCode = options.sigunguCode;
  }

  const results = await Promise.all(
    contentTypeIds.map(async (contentTypeId) => {
      const query = new URLSearchParams({
        ...queryBase,
        contentTypeId,
      });

      const response = await fetch(`${TOUR_API_BASE_URL}?${query.toString()}`);

      if (!response.ok) {
        const errorText = (await response.text()).trim();
        throw new Error(
          `Tour API request failed: ${response.status}${
            errorText ? ` (${errorText})` : ""
          }`
        );
      }

      const data = (await response.json()) as TourApiResponse;
      const resultCode = data.response?.header?.resultCode;

      if (resultCode && resultCode !== "0000") {
        const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
        throw new Error(`Tour API error: ${resultCode} ${resultMsg}`);
      }

      const items = toArray(data.response?.body?.items?.item);

      return items
        .map((item, index): GangwonAttraction | null => {
          const lat = Number(item.mapy);
          const lng = Number(item.mapx);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }

          return {
            id:
              item.contentid ??
              `${item.title ?? "spot"}-${contentTypeId}-${index}`,
            title: item.title ?? "이름 없음",
            address: item.addr1 ?? "주소 정보 없음",
            lat,
            lng,
            contentTypeId: item.contenttypeid ?? contentTypeId,
            lclsSystm1: item.lclsSystm1 ?? "",
            lclsSystm2: item.lclsSystm2 ?? "",
            lclsSystm3: item.lclsSystm3 ?? "",
            firstImage: item.firstimage ?? "",
            secondImage: item.firstimage2 ?? "",
          };
        })
        .filter((item): item is GangwonAttraction => item !== null);
    })
  );

  const unique = new Map<string, GangwonAttraction>();
  results.flat().forEach((attraction) => {
    const uniqueKey = `${attraction.id}-${attraction.contentTypeId}`;
    if (!unique.has(uniqueKey)) {
      unique.set(uniqueKey, attraction);
    }
  });

  return [...unique.values()];
}

export async function fetchLclsSystemNameMap(serviceKey: string) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const query = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    numOfRows: "1000",
    pageNo: "1",
    lclsSystmListYn: "Y",
  });

  const response = await fetch(
    `${TOUR_LCLS_CODE_BASE_URL}?${query.toString()}`
  );

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(
      `Lcls code request failed: ${response.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const data = (await response.json()) as LclsSystemResponse;
  const resultCode = data.response?.header?.resultCode;

  if (resultCode && resultCode !== "0000") {
    const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
    throw new Error(`Lcls code API error: ${resultCode} ${resultMsg}`);
  }

  const items = toArray(data.response?.body?.items?.item);
  const codeNameMap: Record<string, string> = {};

  items.forEach((item) => {
    if (item.lclsSystm1Cd && item.lclsSystm1Nm) {
      codeNameMap[item.lclsSystm1Cd] = item.lclsSystm1Nm;
    }
    if (item.lclsSystm2Cd && item.lclsSystm2Nm) {
      codeNameMap[item.lclsSystm2Cd] = item.lclsSystm2Nm;
    }
    if (item.lclsSystm3Cd && item.lclsSystm3Nm) {
      codeNameMap[item.lclsSystm3Cd] = item.lclsSystm3Nm;
    }
  });

  return codeNameMap;
}

export async function fetchTourPlaceDetail(
  serviceKey: string,
  contentId: string,
  contentTypeId?: string,
  fallbackKeyword?: string
) {
  if (!serviceKey || !contentId) {
    throw new Error("Tour place detail params are missing.");
  }

  const commonQuery = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    contentId,
    numOfRows: "10",
    pageNo: "1",
  });

  const imageQuery = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    contentId,
    imageYN: "Y",
    numOfRows: "50",
    pageNo: "1",
  });
  console.log(contentId);
  // if (contentTypeId) {
  //   imageQuery.set("contentTypeId", contentTypeId);
  // }

  const [commonResponse, imageResponse] = await Promise.all([
    fetch(`${TOUR_DETAIL_COMMON_BASE_URL}?${commonQuery.toString()}`),
    fetch(`${TOUR_DETAIL_IMAGE_BASE_URL}?${imageQuery.toString()}`),
  ]);

  if (!commonResponse.ok) {
    const errorText = (await commonResponse.text()).trim();
    throw new Error(
      `Tour detail request failed: ${commonResponse.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const commonData = (await commonResponse.json()) as TourApiResponse;
  console.log(commonData);
  const commonCode = commonData.response?.header?.resultCode;

  if (commonCode && commonCode !== "0000") {
    const resultMsg = commonData.response?.header?.resultMsg ?? "Unknown error";
    throw new Error(`Tour detail API error: ${commonCode} ${resultMsg}`);
  }

  const commonItem = toArray(commonData.response?.body?.items?.item)[0];
  const commonImages = [commonItem?.firstimage, commonItem?.firstimage2].filter(
    (image): image is string => Boolean(image)
  );

  let detailImageUrls: string[] = [];
  if (imageResponse.ok) {
    const imageData = (await imageResponse.json()) as TourApiResponse;
    console.log(imageData);
    const imageCode = imageData.response?.header?.resultCode;
    if (!imageCode || imageCode === "0000") {
      detailImageUrls = toArray(imageData.response?.body?.items?.item)
        .map((item) => item.originimgurl ?? item.smallimageurl ?? "")
        .filter((image): image is string => Boolean(image));
    }
  }

  let uniqueImages = dedupeImageUrls([...detailImageUrls, ...commonImages]);

  return {
    overview: stripHtml(commonItem?.overview),
    images: uniqueImages,
  } satisfies TourPlaceDetail;
}
