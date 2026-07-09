import type { PlaceProvider, PrismaClient, User } from "@prisma/client";

type DevHistorySeedPlace = {
  title: string;
  address: string;
  lat: number;
  lng: number;
  contentTypeId: string;
  categoryLabel: string;
  categoryName: string;
  stayMinutes: number;
  actualStayMinutes: number;
  travelMinutesFromPrevious?: number | null;
};

type DevHistorySeedDay = {
  places: DevHistorySeedPlace[];
};

type DevHistorySeedRoute = {
  sourceRouteId: string;
  primaryRegionCode: string;
  primaryRegionLabelKey: string;
  startDateKey: string;
  dailyStartMinutes: number;
  scheduleEndMinutes: number;
  startLocation: {
    lat: number;
    lng: number;
  };
  shareTags: string[];
  days: DevHistorySeedDay[];
};

const DEV_HISTORY_SEED_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.ROUTEONE_DEV_HISTORY_SEEDS !== "false";

const VISIT_PHOTO_URL_PREFIX = "routeone-test://history-seed";
const seedPromiseByUserId = new Map<string, Promise<void>>();

const DEV_HISTORY_SEED_ROUTES: DevHistorySeedRoute[] = [
  {
    sourceRouteId: "660000000000000000000101",
    primaryRegionCode: "51150",
    primaryRegionLabelKey: "강릉",
    startDateKey: "2026-03-15",
    dailyStartMinutes: 9 * 60,
    scheduleEndMinutes: 20 * 60,
    startLocation: {
      lat: 37.7519,
      lng: 128.8761,
    },
    shareTags: ["강원", "강릉", "당일치기", "촘촘 플랜", "인증 6/6곳"],
    days: [
      {
        places: [
          tourPlace({
            title: "오죽헌",
            address: "강원 강릉시 율곡로3139번길 24",
            lat: 37.7796,
            lng: 128.8785,
            categoryName: "역사관광",
            stayMinutes: 70,
            actualStayMinutes: 80,
          }),
          tourPlace({
            title: "강릉 선교장",
            address: "강원 강릉시 운정길 63",
            lat: 37.7867,
            lng: 128.8836,
            categoryName: "역사관광",
            stayMinutes: 60,
            actualStayMinutes: 65,
            travelMinutesFromPrevious: 8,
          }),
          foodPlace({
            title: "초당순두부마을",
            address: "강원 강릉시 초당동",
            lat: 37.7915,
            lng: 128.9145,
            categoryName: "한식",
            stayMinutes: 70,
            actualStayMinutes: 75,
            travelMinutesFromPrevious: 15,
          }),
          cafePlace({
            title: "툇마루",
            address: "강원 강릉시 난설헌로 232",
            lat: 37.7908,
            lng: 128.914,
            stayMinutes: 50,
            actualStayMinutes: 55,
            travelMinutesFromPrevious: 4,
          }),
          tourPlace({
            title: "경포해변",
            address: "강원 강릉시 강문동 산1",
            lat: 37.8056,
            lng: 128.9098,
            categoryName: "해변·해수욕장",
            stayMinutes: 60,
            actualStayMinutes: 70,
            travelMinutesFromPrevious: 12,
          }),
          tourPlace({
            title: "안목해변",
            address: "강원 강릉시 창해로14번길 20-1",
            lat: 37.7735,
            lng: 128.9475,
            categoryName: "해변·해수욕장",
            stayMinutes: 70,
            actualStayMinutes: 85,
            travelMinutesFromPrevious: 22,
          }),
        ],
      },
    ],
  },
  {
    sourceRouteId: "660000000000000000000102",
    primaryRegionCode: "51210",
    primaryRegionLabelKey: "속초·양양",
    startDateKey: "2026-04-04",
    dailyStartMinutes: 8 * 60 + 30,
    scheduleEndMinutes: 21 * 60,
    startLocation: {
      lat: 38.207,
      lng: 128.5918,
    },
    shareTags: ["강원", "속초", "1박 2일", "촘촘 플랜", "인증 10/10곳"],
    days: [
      {
        places: [
          tourPlace({
            title: "설악산국립공원 소공원",
            address: "강원 속초시 설악산로 1055",
            lat: 38.1739,
            lng: 128.4973,
            categoryName: "국립공원",
            stayMinutes: 120,
            actualStayMinutes: 130,
          }),
          tourPlace({
            title: "신흥사",
            address: "강원 속초시 설악산로 1137",
            lat: 38.1697,
            lng: 128.4851,
            categoryName: "역사관광",
            stayMinutes: 60,
            actualStayMinutes: 55,
            travelMinutesFromPrevious: 8,
          }),
          tourPlace({
            title: "설악케이블카",
            address: "강원 속초시 설악산로 1085",
            lat: 38.1712,
            lng: 128.4914,
            categoryName: "레포츠",
            stayMinutes: 90,
            actualStayMinutes: 105,
            travelMinutesFromPrevious: 5,
          }),
          marketPlace({
            title: "속초관광수산시장",
            address: "강원 속초시 중앙로147번길 12",
            lat: 38.2042,
            lng: 128.5906,
            stayMinutes: 80,
            actualStayMinutes: 90,
            travelMinutesFromPrevious: 35,
          }),
          tourPlace({
            title: "청초호",
            address: "강원 속초시 청초호반로",
            lat: 38.1997,
            lng: 128.586,
            categoryName: "호수",
            stayMinutes: 50,
            actualStayMinutes: 45,
            travelMinutesFromPrevious: 8,
          }),
        ],
      },
      {
        places: [
          tourPlace({
            title: "영금정",
            address: "강원 속초시 영금정로 43",
            lat: 38.2127,
            lng: 128.6017,
            categoryName: "해안명소",
            stayMinutes: 50,
            actualStayMinutes: 55,
          }),
          tourPlace({
            title: "속초해수욕장",
            address: "강원 속초시 조양동",
            lat: 38.1904,
            lng: 128.6036,
            categoryName: "해변·해수욕장",
            stayMinutes: 70,
            actualStayMinutes: 80,
            travelMinutesFromPrevious: 15,
          }),
          tourPlace({
            title: "대포항",
            address: "강원 속초시 대포항희망길",
            lat: 38.1746,
            lng: 128.6073,
            categoryName: "항구",
            stayMinutes: 70,
            actualStayMinutes: 75,
            travelMinutesFromPrevious: 12,
          }),
          tourPlace({
            title: "낙산사",
            address: "강원 양양군 강현면 낙산사로 100",
            lat: 38.1245,
            lng: 128.6274,
            categoryName: "역사관광",
            stayMinutes: 90,
            actualStayMinutes: 95,
            travelMinutesFromPrevious: 25,
          }),
          tourPlace({
            title: "하조대해변",
            address: "강원 양양군 현북면 하광정리",
            lat: 38.0223,
            lng: 128.7346,
            categoryName: "해변·해수욕장",
            stayMinutes: 80,
            actualStayMinutes: 90,
            travelMinutesFromPrevious: 30,
          }),
        ],
      },
    ],
  },
  {
    sourceRouteId: "660000000000000000000103",
    primaryRegionCode: "51110",
    primaryRegionLabelKey: "춘천",
    startDateKey: "2026-04-25",
    dailyStartMinutes: 10 * 60,
    scheduleEndMinutes: 20 * 60,
    startLocation: {
      lat: 37.8813,
      lng: 127.7298,
    },
    shareTags: ["강원", "춘천", "1박 2일", "균형 플랜", "인증 9/9곳"],
    days: [
      {
        places: [
          tourPlace({
            title: "소양강 스카이워크",
            address: "강원 춘천시 영서로 2663",
            lat: 37.8938,
            lng: 127.7247,
            categoryName: "전망시설",
            stayMinutes: 50,
            actualStayMinutes: 45,
          }),
          foodPlace({
            title: "춘천 명동 닭갈비골목",
            address: "강원 춘천시 금강로62번길",
            lat: 37.8797,
            lng: 127.7286,
            categoryName: "한식",
            stayMinutes: 80,
            actualStayMinutes: 90,
            travelMinutesFromPrevious: 12,
          }),
          tourPlace({
            title: "춘천중앙시장",
            address: "강원 춘천시 명동길 34",
            lat: 37.879,
            lng: 127.7273,
            categoryName: "전통시장",
            stayMinutes: 55,
            actualStayMinutes: 60,
            travelMinutesFromPrevious: 4,
          }),
          tourPlace({
            title: "공지천",
            address: "강원 춘천시 근화동",
            lat: 37.875,
            lng: 127.7083,
            categoryName: "공원",
            stayMinutes: 70,
            actualStayMinutes: 85,
            travelMinutesFromPrevious: 10,
          }),
          tourPlace({
            title: "KT&G 상상마당 춘천",
            address: "강원 춘천시 스포츠타운길399번길 25",
            lat: 37.8737,
            lng: 127.7049,
            categoryName: "문화시설",
            stayMinutes: 75,
            actualStayMinutes: 80,
            travelMinutesFromPrevious: 6,
          }),
        ],
      },
      {
        places: [
          tourPlace({
            title: "남이섬",
            address: "강원 춘천시 남산면 남이섬길 1",
            lat: 37.7914,
            lng: 127.5254,
            categoryName: "관광지",
            stayMinutes: 150,
            actualStayMinutes: 165,
          }),
          tourPlace({
            title: "제이드가든",
            address: "강원 춘천시 남산면 햇골길 80",
            lat: 37.8314,
            lng: 127.586,
            categoryName: "수목원",
            stayMinutes: 100,
            actualStayMinutes: 110,
            travelMinutesFromPrevious: 25,
          }),
          tourPlace({
            title: "강촌레일파크 김유정역",
            address: "강원 춘천시 신동면 김유정로 1383",
            lat: 37.8184,
            lng: 127.7145,
            categoryName: "레포츠",
            stayMinutes: 90,
            actualStayMinutes: 95,
            travelMinutesFromPrevious: 28,
          }),
          tourPlace({
            title: "김유정문학촌",
            address: "강원 춘천시 신동면 김유정로 1430-14",
            lat: 37.817,
            lng: 127.7167,
            categoryName: "문화시설",
            stayMinutes: 70,
            actualStayMinutes: 65,
            travelMinutesFromPrevious: 5,
          }),
        ],
      },
    ],
  },
  {
    sourceRouteId: "660000000000000000000104",
    primaryRegionCode: "51760",
    primaryRegionLabelKey: "평창·정선",
    startDateKey: "2026-05-16",
    dailyStartMinutes: 8 * 60,
    scheduleEndMinutes: 19 * 60 + 30,
    startLocation: {
      lat: 37.3704,
      lng: 128.3906,
    },
    shareTags: ["강원", "평창", "2박 3일", "균형 플랜", "인증 12/12곳"],
    days: [
      {
        places: [
          tourPlace({
            title: "대관령 양떼목장",
            address: "강원 평창군 대관령면 대관령마루길 483-32",
            lat: 37.6867,
            lng: 128.7548,
            categoryName: "체험관광",
            stayMinutes: 100,
            actualStayMinutes: 110,
          }),
          tourPlace({
            title: "삼양라운드힐",
            address: "강원 평창군 대관령면 꽃밭양지길 708-9",
            lat: 37.7184,
            lng: 128.7375,
            categoryName: "체험관광",
            stayMinutes: 120,
            actualStayMinutes: 135,
            travelMinutesFromPrevious: 18,
          }),
          tourPlace({
            title: "월정사",
            address: "강원 평창군 진부면 오대산로 374-8",
            lat: 37.7314,
            lng: 128.592,
            categoryName: "역사관광",
            stayMinutes: 80,
            actualStayMinutes: 85,
            travelMinutesFromPrevious: 35,
          }),
          tourPlace({
            title: "오대산 선재길",
            address: "강원 평창군 진부면 오대산로",
            lat: 37.7355,
            lng: 128.5908,
            categoryName: "트레킹",
            stayMinutes: 90,
            actualStayMinutes: 100,
            travelMinutesFromPrevious: 5,
          }),
        ],
      },
      {
        places: [
          marketPlace({
            title: "정선아리랑시장",
            address: "강원 정선군 정선읍 5일장길 36",
            lat: 37.3802,
            lng: 128.6608,
            stayMinutes: 80,
            actualStayMinutes: 90,
          }),
          tourPlace({
            title: "아라리촌",
            address: "강원 정선군 정선읍 애산로 37",
            lat: 37.3716,
            lng: 128.6633,
            categoryName: "문화시설",
            stayMinutes: 70,
            actualStayMinutes: 70,
            travelMinutesFromPrevious: 8,
          }),
          tourPlace({
            title: "병방치 스카이워크",
            address: "강원 정선군 정선읍 병방치길 225",
            lat: 37.3485,
            lng: 128.6488,
            categoryName: "전망시설",
            stayMinutes: 60,
            actualStayMinutes: 65,
            travelMinutesFromPrevious: 16,
          }),
          tourPlace({
            title: "화암동굴",
            address: "강원 정선군 화암면 화암동굴길 12-1",
            lat: 37.3294,
            lng: 128.7893,
            categoryName: "동굴",
            stayMinutes: 100,
            actualStayMinutes: 115,
            travelMinutesFromPrevious: 35,
          }),
        ],
      },
      {
        places: [
          tourPlace({
            title: "하이원리조트",
            address: "강원 정선군 고한읍 하이원길 424",
            lat: 37.2097,
            lng: 128.8227,
            categoryName: "리조트",
            stayMinutes: 120,
            actualStayMinutes: 145,
          }),
          tourPlace({
            title: "만항재",
            address: "강원 정선군 고한읍 함백산로",
            lat: 37.1695,
            lng: 128.9189,
            categoryName: "자연관광",
            stayMinutes: 80,
            actualStayMinutes: 90,
            travelMinutesFromPrevious: 30,
          }),
          marketPlace({
            title: "고한 구공탄시장",
            address: "강원 정선군 고한읍 고한6길",
            lat: 37.2049,
            lng: 128.8524,
            stayMinutes: 60,
            actualStayMinutes: 70,
            travelMinutesFromPrevious: 25,
          }),
          tourPlace({
            title: "정암사",
            address: "강원 정선군 고한읍 함백산로 1410",
            lat: 37.1709,
            lng: 128.9028,
            categoryName: "역사관광",
            stayMinutes: 70,
            actualStayMinutes: 75,
            travelMinutesFromPrevious: 25,
          }),
        ],
      },
    ],
  },
  {
    sourceRouteId: "660000000000000000000105",
    primaryRegionCode: "51170",
    primaryRegionLabelKey: "동해·삼척",
    startDateKey: "2026-06-06",
    dailyStartMinutes: 9 * 60 + 30,
    scheduleEndMinutes: 21 * 60,
    startLocation: {
      lat: 37.5247,
      lng: 129.1143,
    },
    shareTags: ["강원", "동해", "1박 2일", "촘촘 플랜", "인증 10/10곳"],
    days: [
      {
        places: [
          tourPlace({
            title: "추암촛대바위",
            address: "강원 동해시 추암동",
            lat: 37.479,
            lng: 129.1596,
            categoryName: "해안명소",
            stayMinutes: 55,
            actualStayMinutes: 60,
          }),
          tourPlace({
            title: "묵호등대",
            address: "강원 동해시 해맞이길 289",
            lat: 37.5545,
            lng: 129.116,
            categoryName: "전망시설",
            stayMinutes: 55,
            actualStayMinutes: 50,
            travelMinutesFromPrevious: 25,
          }),
          tourPlace({
            title: "논골담길",
            address: "강원 동해시 논골1길",
            lat: 37.5525,
            lng: 129.1167,
            categoryName: "마을관광",
            stayMinutes: 70,
            actualStayMinutes: 80,
            travelMinutesFromPrevious: 5,
          }),
          tourPlace({
            title: "도째비골 스카이밸리",
            address: "강원 동해시 묵호진동 2-109",
            lat: 37.5543,
            lng: 129.1197,
            categoryName: "전망시설",
            stayMinutes: 70,
            actualStayMinutes: 75,
            travelMinutesFromPrevious: 5,
          }),
          tourPlace({
            title: "망상해변",
            address: "강원 동해시 망상동",
            lat: 37.592,
            lng: 129.0903,
            categoryName: "해변·해수욕장",
            stayMinutes: 85,
            actualStayMinutes: 95,
            travelMinutesFromPrevious: 20,
          }),
        ],
      },
      {
        places: [
          tourPlace({
            title: "삼척해상케이블카 장호역",
            address: "강원 삼척시 근덕면 장호항길 12-10",
            lat: 37.2886,
            lng: 129.3134,
            categoryName: "레포츠",
            stayMinutes: 90,
            actualStayMinutes: 100,
          }),
          tourPlace({
            title: "장호항",
            address: "강원 삼척시 근덕면 장호항길",
            lat: 37.2876,
            lng: 129.3138,
            categoryName: "항구",
            stayMinutes: 80,
            actualStayMinutes: 90,
            travelMinutesFromPrevious: 4,
          }),
          tourPlace({
            title: "환선굴",
            address: "강원 삼척시 신기면 환선로 800",
            lat: 37.3252,
            lng: 129.0147,
            categoryName: "동굴",
            stayMinutes: 120,
            actualStayMinutes: 130,
            travelMinutesFromPrevious: 45,
          }),
          tourPlace({
            title: "죽서루",
            address: "강원 삼척시 죽서루길 37",
            lat: 37.4425,
            lng: 129.1656,
            categoryName: "역사관광",
            stayMinutes: 60,
            actualStayMinutes: 65,
            travelMinutesFromPrevious: 35,
          }),
          tourPlace({
            title: "이사부사자공원",
            address: "강원 삼척시 수로부인길 343",
            lat: 37.4437,
            lng: 129.1887,
            categoryName: "공원",
            stayMinutes: 70,
            actualStayMinutes: 75,
            travelMinutesFromPrevious: 15,
          }),
        ],
      },
    ],
  },
];

function tourPlace(
  place: Omit<DevHistorySeedPlace, "contentTypeId" | "categoryLabel">
): DevHistorySeedPlace {
  return {
    ...place,
    contentTypeId: "12",
    categoryLabel: "관광지",
  };
}

function foodPlace(
  place: Omit<DevHistorySeedPlace, "contentTypeId" | "categoryLabel">
): DevHistorySeedPlace {
  return {
    ...place,
    contentTypeId: "39",
    categoryLabel: "음식점",
  };
}

function cafePlace(
  place: Omit<DevHistorySeedPlace, "contentTypeId" | "categoryLabel" | "categoryName">
): DevHistorySeedPlace {
  return {
    ...place,
    contentTypeId: "39",
    categoryLabel: "카페",
    categoryName: "카페",
  };
}

function marketPlace(
  place: Omit<DevHistorySeedPlace, "contentTypeId" | "categoryLabel" | "categoryName">
): DevHistorySeedPlace {
  return {
    ...place,
    contentTypeId: "38",
    categoryLabel: "쇼핑",
    categoryName: "전통시장",
  };
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function getUtcDate(dateKey: string, minutes = 0) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCMinutes(minutes);

  return date;
}

function getRouteEndDateKey(seedRoute: DevHistorySeedRoute) {
  return addDaysToDateKey(seedRoute.startDateKey, seedRoute.days.length - 1);
}

function getSeedPlaceSnapshot(
  place: DevHistorySeedPlace,
  route: DevHistorySeedRoute
) {
  return {
    provider: "CUSTOM" as PlaceProvider,
    externalId: null,
    contentId: null,
    contentTypeId: place.contentTypeId,
    title: place.title,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    categoryLabel: place.categoryLabel,
    categoryName: place.categoryName,
    imageUrl: null,
    regionCode: route.primaryRegionCode,
    regionLabelKey: route.primaryRegionLabelKey,
  };
}

async function createDevHistoryRoute(
  prisma: PrismaClient,
  user: User,
  seedRoute: DevHistorySeedRoute
) {
  const travelStartDate = getUtcDate(seedRoute.startDateKey);
  const travelEndDate = getUtcDate(getRouteEndDateKey(seedRoute));
  const completedAt = getUtcDate(getRouteEndDateKey(seedRoute), 21 * 60);
  const totalStopCount = seedRoute.days.reduce(
    (total, day) => total + day.places.length,
    0
  );
  const route = await prisma.route.create({
    data: {
      ownerId: user.id,
      sourceRouteId: seedRoute.sourceRouteId,
      countryCode: "KR",
      primaryRegionCode: seedRoute.primaryRegionCode,
      primaryRegionLabelKey: seedRoute.primaryRegionLabelKey,
      tripDays: seedRoute.days.length,
      travelStartDate,
      travelEndDate,
      dailyStartMinutes: seedRoute.dailyStartMinutes,
      scheduleEndMinutes: seedRoute.scheduleEndMinutes,
      startLocation: seedRoute.startLocation,
      status: "COMPLETED",
      visibility: "PRIVATE",
      totalStopCount,
      completedStopCount: totalStopCount,
      startedAt: travelStartDate,
      completedAt,
      shareTags: seedRoute.shareTags,
    },
  });
  let globalOrder = 1;

  for (const [dayOffset, day] of seedRoute.days.entries()) {
    const dayDateKey = addDaysToDateKey(seedRoute.startDateKey, dayOffset);
    const routeDay = await prisma.routeDay.create({
      data: {
        routeId: route.id,
        dayIndex: dayOffset + 1,
        date: getUtcDate(dayDateKey),
      },
    });
    let cursorMinutes = seedRoute.dailyStartMinutes;

    for (const [placeIndex, place] of day.places.entries()) {
      cursorMinutes += place.travelMinutesFromPrevious ?? (placeIndex === 0 ? 0 : 15);
      cursorMinutes += place.actualStayMinutes;

      await prisma.routeStop.create({
        data: {
          routeId: route.id,
          dayId: routeDay.id,
          order: globalOrder,
          place: getSeedPlaceSnapshot(place, seedRoute),
          stayMinutes: place.stayMinutes,
          travelMinutesFromPrevious:
            placeIndex === 0 ? null : (place.travelMinutesFromPrevious ?? 15),
          visitStatus: "VISITED",
          visitedAt: getUtcDate(dayDateKey, cursorMinutes),
          verificationStatus: "GPS_PHOTO",
          verifiedAt: getUtcDate(dayDateKey, cursorMinutes),
          verificationPhotoUrl: `${VISIT_PHOTO_URL_PREFIX}/${seedRoute.sourceRouteId}/${dayOffset + 1}/${placeIndex + 1}`,
          verificationLat: place.lat,
          verificationLng: place.lng,
          verificationAccuracyMeters: 18 + ((globalOrder + dayOffset) % 11),
          checkedInAt: getUtcDate(
            dayDateKey,
            Math.max(seedRoute.dailyStartMinutes, cursorMinutes - place.actualStayMinutes)
          ),
          checkedOutAt: getUtcDate(dayDateKey, cursorMinutes),
          actualStayMinutes: place.actualStayMinutes,
        },
      });

      globalOrder += 1;
    }
  }
}

async function runDevHistorySeed(prisma: PrismaClient, user: User) {
  const seedSourceRouteIds = DEV_HISTORY_SEED_ROUTES.map(
    (route) => route.sourceRouteId
  );
  const existingRoutes = await prisma.route.findMany({
    where: {
      ownerId: user.id,
      sourceRouteId: {
        in: seedSourceRouteIds,
      },
    },
    select: {
      sourceRouteId: true,
    },
  });
  const existingSourceRouteIds = new Set(
    existingRoutes
      .map((route) => route.sourceRouteId)
      .filter((value): value is string => Boolean(value))
  );

  for (const seedRoute of DEV_HISTORY_SEED_ROUTES) {
    if (existingSourceRouteIds.has(seedRoute.sourceRouteId)) {
      continue;
    }

    await createDevHistoryRoute(prisma, user, seedRoute);
  }
}

export function ensureDevHistoryRoutes(prisma: PrismaClient, user: User) {
  if (!DEV_HISTORY_SEED_ENABLED) {
    return Promise.resolve();
  }

  const existingPromise = seedPromiseByUserId.get(user.id);
  if (existingPromise) {
    return existingPromise;
  }

  const seedPromise = runDevHistorySeed(prisma, user).finally(() => {
    seedPromiseByUserId.delete(user.id);
  });
  seedPromiseByUserId.set(user.id, seedPromise);

  return seedPromise;
}
