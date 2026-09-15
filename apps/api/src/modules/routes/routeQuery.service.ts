/**
 * 용도:
 * 내 루트와 공개·좋아요 루트 목록을 조회하고 커서 페이지를 구성한다.
 *
 * 동작 방식:
 * 로그인 사용자의 공개 콘텐츠 조회에서는 개인 차단 목록을 소유자 조건에 함께 적용한다.
 */
import type {
  Prisma,
  PrismaClient,
  Route,
  User,
} from "@prisma/client";
import { getBlockedUserIds } from "../user/userBlock.service.js";

async function getBlockedRouteOwnerWhere(
  prisma: PrismaClient,
  viewerId?: string | null
): Promise<Prisma.RouteWhereInput> {
  if (!viewerId) {
    return {};
  }

  const blockedUserIds = await getBlockedUserIds(prisma, viewerId);

  return blockedUserIds.length > 0
    ? { ownerId: { notIn: blockedUserIds } }
    : {};
}

export async function getSavedRoutes(prisma: PrismaClient, user: User) {
  const saves = await prisma.routeSave.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const routes = await Promise.all(
    saves.map((save) =>
      prisma.route.findUnique({
        where: {
          id: save.routeId,
        },
      })
    )
  );

  return routes.filter((route): route is Route => Boolean(route));
}

export async function getLikedRoutes(prisma: PrismaClient, user: User) {
  const blockedOwnerWhere = await getBlockedRouteOwnerWhere(prisma, user.id);
  const likes = await prisma.routeLike.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const routes = await Promise.all(
    likes.map((like) =>
      prisma.route.findFirst({
        where: {
          id: like.routeId,
          visibility: "PUBLIC",
          ...blockedOwnerWhere,
        },
      })
    )
  );

  return routes.filter((route): route is Route => Boolean(route));
}

const DEFAULT_ROUTE_CONNECTION_LIMIT = 20;

const MAX_ROUTE_CONNECTION_LIMIT = 30;

function clampRouteConnectionLimit(limit?: number | null) {
  return Math.max(
    1,
    Math.min(MAX_ROUTE_CONNECTION_LIMIT, limit ?? DEFAULT_ROUTE_CONNECTION_LIMIT)
  );
}

type RouteConnection = {
  nodes: Route[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
};

const REGION_QUERY_RULES: Record<
  string,
  { areaCodes: string[]; adminCodePrefixes: string[] }
> = {
  강원: {
    areaCodes: ["32", "51"],
    adminCodePrefixes: ["51"],
  },
  서울: {
    areaCodes: ["1", "11"],
    adminCodePrefixes: ["11"],
  },
};

function getRegionTagWhere(regionTag?: string | null): Prisma.RouteWhereInput {
  const normalizedRegionTag = regionTag?.trim();

  if (!normalizedRegionTag) {
    return {};
  }

  const rule = REGION_QUERY_RULES[normalizedRegionTag];

  if (!rule) {
    return {
      shareTags: {
        has: normalizedRegionTag,
      },
    };
  }

  return {
    OR: [
      {
        shareTags: {
          has: normalizedRegionTag,
        },
      },
      ...rule.areaCodes.map((areaCode) => ({
        primaryRegionLabelKey: {
          startsWith: `${areaCode}:`,
        },
      })),
      ...rule.adminCodePrefixes.map((prefix) => ({
        primaryRegionCode: {
          startsWith: prefix,
        },
      })),
    ],
  };
}

function getRouteHistoryTodayStart(today?: Date | null) {
  const baseDate = today ?? new Date();
  const todayKey = baseDate.toISOString().slice(0, 10);

  return new Date(`${todayKey}T00:00:00.000Z`);
}

function getMyRouteHistoryWhere(
  user: User,
  today?: Date | null
): Prisma.RouteWhereInput {
  const todayStart = getRouteHistoryTodayStart(today);

  return {
    ownerId: user.id,
    OR: [
      {
        status: "COMPLETED",
      },
      {
        travelEndDate: {
          lt: todayStart,
        },
      },
      {
        travelEndDate: null,
        travelStartDate: {
          lt: todayStart,
        },
      },
    ],
  };
}

export async function getMyRouteHistoryConnection(
  prisma: PrismaClient,
  user: User,
  options: {
    limit?: number | null;
    cursor?: string | null;
    today?: Date | null;
  }
): Promise<RouteConnection> {
  const limit = clampRouteConnectionLimit(options.limit);
  const routes = await prisma.route.findMany({
    where: getMyRouteHistoryWhere(user, options.today),
    orderBy: [
      {
        travelEndDate: "desc",
      },
      {
        completedAt: "desc",
      },
      {
        updatedAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    ...(options.cursor
      ? {
          cursor: {
            id: options.cursor,
          },
          skip: 1,
        }
      : {}),
    take: limit + 1,
  });
  const nodes = routes.slice(0, limit);

  return {
    nodes,
    pageInfo: {
      endCursor: nodes[nodes.length - 1]?.id ?? null,
      hasNextPage: routes.length > limit,
    },
  };
}

export async function getLikedRouteConnection(
  prisma: PrismaClient,
  user: User,
  options: {
    regionTag?: string | null;
    limit?: number | null;
    cursor?: string | null;
  }
): Promise<RouteConnection> {
  const limit = clampRouteConnectionLimit(options.limit);
  const blockedOwnerWhere = await getBlockedRouteOwnerWhere(prisma, user.id);
  const entries: Array<{ cursor: string; route: Route }> = [];
  let cursor = options.cursor ?? null;
  let lastProcessedCursor: string | null = cursor;
  let hasMoreLikes = true;

  while (entries.length <= limit && hasMoreLikes) {
    const likes = await prisma.routeLike.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
      take: limit + 1,
    });

    if (likes.length === 0) {
      hasMoreLikes = false;
      break;
    }

    lastProcessedCursor = likes[likes.length - 1]?.id ?? lastProcessedCursor;
    cursor = lastProcessedCursor;
    hasMoreLikes = likes.length > limit;

    const routes = await prisma.route.findMany({
      where: {
        id: {
          in: likes.map((like) => like.routeId),
        },
        visibility: "PUBLIC",
        ...blockedOwnerWhere,
        ...getRegionTagWhere(options.regionTag),
      },
    });
    const routeById = new Map(routes.map((route) => [route.id, route]));

    for (const like of likes) {
      const route = routeById.get(like.routeId);

      if (route) {
        entries.push({
          cursor: like.id,
          route,
        });
      }

      if (entries.length > limit) {
        break;
      }
    }
  }

  const pageEntries = entries.slice(0, limit);
  const endCursor =
    pageEntries[pageEntries.length - 1]?.cursor ?? lastProcessedCursor;

  return {
    nodes: pageEntries.map((entry) => entry.route),
    pageInfo: {
      endCursor,
      hasNextPage: entries.length > limit || hasMoreLikes,
    },
  };
}

export async function getPublicRoutes(
  prisma: PrismaClient,
  options: {
    viewerId?: string | null;
    regionCode?: string | null;
    regionTag?: string | null;
    limit?: number | null;
  }
) {
  const blockedOwnerWhere = await getBlockedRouteOwnerWhere(
    prisma,
    options.viewerId
  );

  return prisma.route.findMany({
    where: {
      visibility: "PUBLIC",
      ...blockedOwnerWhere,
      ...(options.regionCode
        ? {
            primaryRegionCode: options.regionCode,
          }
        : {}),
      ...getRegionTagWhere(options.regionTag),
    },
    orderBy: {
      sharedAt: "desc",
    },
    take: Math.max(1, Math.min(50, options.limit ?? 20)),
  });
}

export async function getPublicRouteConnection(
  prisma: PrismaClient,
  options: {
    viewerId?: string | null;
    regionCode?: string | null;
    regionTag?: string | null;
    limit?: number | null;
    cursor?: string | null;
  }
): Promise<RouteConnection> {
  const limit = clampRouteConnectionLimit(options.limit);
  const blockedOwnerWhere = await getBlockedRouteOwnerWhere(
    prisma,
    options.viewerId
  );
  const routes = await prisma.route.findMany({
    where: {
      visibility: "PUBLIC",
      ...blockedOwnerWhere,
      ...(options.regionCode
        ? {
            primaryRegionCode: options.regionCode,
          }
        : {}),
      ...getRegionTagWhere(options.regionTag),
    },
    orderBy: [
      {
        sharedAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    ...(options.cursor
      ? {
          cursor: {
            id: options.cursor,
          },
          skip: 1,
        }
      : {}),
    take: limit + 1,
  });
  const nodes = routes.slice(0, limit);

  return {
    nodes,
    pageInfo: {
      endCursor: nodes[nodes.length - 1]?.id ?? null,
      hasNextPage: routes.length > limit,
    },
  };
}
