/**
 * 용도:
 * 운영 API에 만든 강원 공유루트의 출발지를 대표 지역 중심으로 정리한다.
 *
 * 동작 방식:
 * 별도 환경 파일에 기록된 계정과 루트만 조회해 변경 대상을 검증하고,
 * --apply 옵션이 있을 때 소유 계정으로 루트와 모든 DAY 출발지를 갱신한다.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

type Coordinates = { lat: number; lng: number };

type RegionCenter = {
  label: string;
  sigunguCode: string;
  adminCode: string;
  center: Coordinates;
};

type AuthAccount = { accountId: string; password: string };

type AuthSession = {
  token: string;
  user: { id: string; displayName: string | null };
};

type RouteAudit = {
  id: string;
  primaryRegionCode: string | null;
  primaryRegionLabelKey: string | null;
  startLocation: Coordinates | null;
  visibility: "PRIVATE" | "PUBLIC";
  owner: { id: string; displayName: string | null };
  days: Array<{
    id: string;
    dayIndex: number;
    startLocation: Coordinates | null;
  }>;
  stops: Array<{ order: number; place: Coordinates }>;
};

const REGION_CENTERS: readonly RegionCenter[] = [
  { label: "강릉", sigunguCode: "1", adminCode: "51150", center: { lat: 37.7519, lng: 128.8761 } },
  { label: "고성", sigunguCode: "2", adminCode: "51820", center: { lat: 38.3804, lng: 128.4677 } },
  { label: "동해", sigunguCode: "3", adminCode: "51170", center: { lat: 37.5247, lng: 129.1143 } },
  { label: "삼척", sigunguCode: "4", adminCode: "51230", center: { lat: 37.4499, lng: 129.1652 } },
  { label: "속초", sigunguCode: "5", adminCode: "51210", center: { lat: 38.207, lng: 128.5918 } },
  { label: "양구", sigunguCode: "6", adminCode: "51800", center: { lat: 38.1057, lng: 127.99 } },
  { label: "양양", sigunguCode: "7", adminCode: "51830", center: { lat: 38.0754, lng: 128.6191 } },
  { label: "영월", sigunguCode: "8", adminCode: "51750", center: { lat: 37.1836, lng: 128.4617 } },
  { label: "원주", sigunguCode: "9", adminCode: "51130", center: { lat: 37.3422, lng: 127.9202 } },
  { label: "인제", sigunguCode: "10", adminCode: "51810", center: { lat: 38.0697, lng: 128.1704 } },
  { label: "정선", sigunguCode: "11", adminCode: "51770", center: { lat: 37.3807, lng: 128.6611 } },
  { label: "철원", sigunguCode: "12", adminCode: "51780", center: { lat: 38.1466, lng: 127.3134 } },
  { label: "춘천", sigunguCode: "13", adminCode: "51110", center: { lat: 37.8813, lng: 127.7298 } },
  { label: "태백", sigunguCode: "14", adminCode: "51190", center: { lat: 37.1641, lng: 128.9856 } },
  { label: "평창", sigunguCode: "15", adminCode: "51760", center: { lat: 37.3704, lng: 128.3906 } },
  { label: "홍천", sigunguCode: "16", adminCode: "51720", center: { lat: 37.6972, lng: 127.8886 } },
  { label: "화천", sigunguCode: "17", adminCode: "51790", center: { lat: 38.1062, lng: 127.7082 } },
  { label: "횡성", sigunguCode: "18", adminCode: "51730", center: { lat: 37.4918, lng: 127.985 } },
];

const LOGIN_MUTATION = `
  mutation SeedRouteLogin($input: PasswordLoginInput!) {
    loginWithPassword(input: $input) {
      token
      user { id displayName }
    }
  }
`;

const ROUTE_QUERY = `
  query SeedRouteAudit($id: ID!) {
    route(id: $id) {
      id
      primaryRegionCode
      primaryRegionLabelKey
      startLocation { lat lng }
      visibility
      owner { id displayName }
      days { id dayIndex startLocation { lat lng } }
      stops { order place { lat lng } }
    }
  }
`;

const UPDATE_START_MUTATION = `
  mutation SeedRouteStartUpdate($input: UpdateRouteStartLocationInput!) {
    updateRouteStartLocation(input: $input) { id }
  }
`;

function readRequired(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} 값을 찾지 못했습니다.`);
  }

  return value;
}

function loadEnvironment() {
  [
    resolve(process.cwd(), "../native/.env.production"),
    resolve(process.cwd(), ".env.gangwon-seed-20260902"),
  ].forEach((path) => config({ path, override: false }));
}

function loadTargetRouteIds() {
  return Array.from(
    new Set(
      Object.entries(process.env)
        .filter(([name, value]) => name.endsWith("_ROUTE_ID") && value?.trim())
        .map(([, value]) => value!.trim())
    )
  );
}

function loadAccounts() {
  const accounts: AuthAccount[] = [];
  const commonPassword = readRequired("ROUTEONE_GANGWON_SEED_PASSWORD");

  for (let index = 1; index <= 20; index += 1) {
    const prefix = `ROUTEONE_GANGWON_SEED_${String(index).padStart(2, "0")}`;
    accounts.push({
      accountId: readRequired(`${prefix}_ACCOUNT_ID`),
      password: commonPassword,
    });
  }

  return accounts;
}

async function requestGraphQL<T>(options: {
  endpoint: string;
  query: string;
  variables: Record<string, unknown>;
  token?: string;
}) {
  const response = await fetch(options.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
    },
    body: JSON.stringify({ query: options.query, variables: options.variables }),
  });
  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  const errorMessage = payload.errors
    ?.map((error) => error.message)
    .filter(Boolean)
    .join("\n");

  if (!response.ok || errorMessage || !payload.data) {
    throw new Error(errorMessage || `운영 API 요청에 실패했습니다. (${response.status})`);
  }

  return payload.data;
}

async function loginAccounts(endpoint: string, accounts: AuthAccount[]) {
  const sessions = await Promise.all(
    accounts.map(async (account) => {
      const result = await requestGraphQL<{ loginWithPassword: AuthSession }>({
        endpoint,
        query: LOGIN_MUTATION,
        variables: { input: account },
      });

      return result.loginWithPassword;
    })
  );

  return new Map(sessions.map((session) => [session.user.id, session]));
}

function getRegionCenter(route: RouteAudit) {
  const labelParts = route.primaryRegionLabelKey?.split(":") ?? [];
  const candidates = [
    route.primaryRegionCode,
    route.primaryRegionLabelKey,
    labelParts.at(-1),
  ].filter((value): value is string => Boolean(value));

  return REGION_CENTERS.find((region) =>
    candidates.some(
      (candidate) =>
        candidate === region.label ||
        candidate === region.sigunguCode ||
        candidate === region.adminCode
    )
  );
}

function isSameCoordinates(left: Coordinates | null, right: Coordinates) {
  return left?.lat === right.lat && left.lng === right.lng;
}

async function readRoutes(
  endpoint: string,
  routeIds: string[],
  auditToken: string
) {
  return Promise.all(
    routeIds.map(async (id) => {
      const result = await requestGraphQL<{ route: RouteAudit | null }>({
        endpoint,
        query: ROUTE_QUERY,
        variables: { id },
        token: auditToken,
      });

      if (!result.route) {
        throw new Error(`운영 API에서 루트를 찾지 못했습니다: ${id}`);
      }

      return result.route;
    })
  );
}

async function updateRouteStart(options: {
  endpoint: string;
  token: string;
  routeId: string;
  dayId?: string;
  startLocation: Coordinates;
}) {
  await requestGraphQL({
    endpoint: options.endpoint,
    query: UPDATE_START_MUTATION,
    variables: {
      input: {
        routeId: options.routeId,
        ...(options.dayId ? { dayId: options.dayId } : {}),
        startLocation: options.startLocation,
      },
    },
    token: options.token,
  });
}

async function main() {
  loadEnvironment();
  const endpoint = readRequired("EXPO_PUBLIC_GRAPHQL_ENDPOINT");
  const routeIds = loadTargetRouteIds();
  const accounts = loadAccounts();
  const shouldApply = process.argv.includes("--apply");

  if (routeIds.length === 0) {
    throw new Error("출발지를 수정할 공유루트 ID를 찾지 못했습니다.");
  }

  const sessionsByUserId = await loginAccounts(endpoint, accounts);
  const auditToken = sessionsByUserId.values().next().value?.token;

  if (!auditToken) {
    throw new Error("운영 공유루트를 조회할 인증 정보를 만들지 못했습니다.");
  }

  const routes = await readRoutes(endpoint, routeIds, auditToken);
  const nonPublicRoutes = routes.filter((route) => route.visibility !== "PUBLIC");
  const unresolvedRoutes = routes.filter((route) => !getRegionCenter(route));
  const ownerMissingRoutes = routes.filter(
    (route) => !sessionsByUserId.has(route.owner.id)
  );

  if (nonPublicRoutes.length > 0) {
    throw new Error(`공개 상태가 아닌 대상 루트가 ${nonPublicRoutes.length}개 있습니다.`);
  }

  if (unresolvedRoutes.length > 0) {
    throw new Error(`대표 지역을 판별하지 못한 루트가 ${unresolvedRoutes.length}개 있습니다.`);
  }

  if (ownerMissingRoutes.length > 0) {
    throw new Error(`소유 계정을 확인하지 못한 루트가 ${ownerMissingRoutes.length}개 있습니다.`);
  }

  const targets = routes.map((route) => {
    const region = getRegionCenter(route)!;

    return {
      route,
      region,
      firstPlace: [...route.stops].sort((left, right) => left.order - right.order)[0]
        ?.place ?? null,
      mismatchedDayCount: route.days.filter(
        (day) => !isSameCoordinates(day.startLocation, region.center)
      ).length,
    };
  });
  const changedTargets = targets.filter(
    (target) =>
      !isSameCoordinates(target.route.startLocation, target.region.center) ||
      target.mismatchedDayCount > 0
  );

  console.table(
    targets.map((target) => ({
      routeId: target.route.id,
      owner: target.route.owner.displayName ?? "이름 없음",
      region: target.region.label,
      routeStart: target.route.startLocation
        ? `${target.route.startLocation.lat},${target.route.startLocation.lng}`
        : "없음",
      firstPlace: target.firstPlace
        ? `${target.firstPlace.lat},${target.firstPlace.lng}`
        : "없음",
      targetStart: `${target.region.center.lat},${target.region.center.lng}`,
      mismatchedDays: target.mismatchedDayCount,
    }))
  );
  console.log(
    `[seed-route-start] mode=${shouldApply ? "apply" : "dry-run"} targets=${targets.length} changes=${changedTargets.length}`
  );

  if (!shouldApply || changedTargets.length === 0) {
    return;
  }

  for (const target of changedTargets) {
    const session = sessionsByUserId.get(target.route.owner.id)!;
    await updateRouteStart({
      endpoint,
      token: session.token,
      routeId: target.route.id,
      startLocation: target.region.center,
    });

    for (const day of target.route.days) {
      await updateRouteStart({
        endpoint,
        token: session.token,
        routeId: target.route.id,
        dayId: day.id,
        startLocation: target.region.center,
      });
    }
  }

  const verifiedRoutes = await readRoutes(endpoint, routeIds, auditToken);
  const failedRoutes = verifiedRoutes.filter((route) => {
    const region = getRegionCenter(route)!;

    return (
      !isSameCoordinates(route.startLocation, region.center) ||
      route.days.some((day) => !isSameCoordinates(day.startLocation, region.center))
    );
  });

  if (failedRoutes.length > 0) {
    throw new Error(`갱신 검증에 실패한 루트가 ${failedRoutes.length}개 있습니다.`);
  }

  console.log(`[seed-route-start] verified=${verifiedRoutes.length}`);
}

await main();
