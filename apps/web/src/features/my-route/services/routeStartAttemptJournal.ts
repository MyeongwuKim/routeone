/**
 * 용도:
 * 여행 시작 도중 WebView가 종료돼도 서버 반영 여부를 다시 확인할 수 있도록
 * 시작 요청과 복구 상태를 브라우저 저장소에 남긴다.
 *
 * 동작 방식:
 * 시작 요청을 기록하기 전에 메모리 잠금을 먼저 잡아 전역 복구와의 경합을 막고,
 * 서버 상태 확인 결과에 따라 재확인·재시작 필요 상태를 generation 단위로 갱신한다.
 */
export type RouteStartAttemptStatus =
  | "pending"
  | "restart-required"
  | "status-unavailable";

export type RouteStartAttempt = {
  routeId: string;
  generation: number;
  startedAt: string;
  dayStartedAt: string | null;
  createdAt: number;
  readyAt: number;
  status: RouteStartAttemptStatus;
  pendingFingerprint: string | null;
  stablePendingReadCount: number;
};

export type RouteStartAttemptInput = {
  routeId: string | number;
  startedAt: string;
  dayStartedAt?: string | null;
};

export const ROUTE_START_ATTEMPT_STORAGE_KEY =
  "routeone:route-start-attempt-journal:v1";
export const ROUTE_START_RECOVERY_ROUTE_ID_PARAM =
  "routeStartRecoveryRouteId";
export const ROUTE_START_RECOVERY_GENERATION_PARAM =
  "routeStartRecoveryGeneration";
export const ROUTE_START_ATTEMPT_RECONCILIATION_DELAY_MS = 5_000;
export const ROUTE_START_ATTEMPT_API_SETTLEMENT_DELAY_MS = 30_000;

const activeAttemptCountByRouteId = new Map<string, number>();
const attemptByRouteId = new Map<string, RouteStartAttempt>();
const attemptListeners = new Set<() => void>();
let nextAttemptGeneration = 0;

function normalizeRouteId(routeId: string | number) {
  return String(routeId).trim();
}

function normalizeRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNormalizedDelay(delayMs: number | undefined) {
  return typeof delayMs === "number" && Number.isFinite(delayMs)
    ? Math.max(0, delayMs)
    : ROUTE_START_ATTEMPT_RECONCILIATION_DELAY_MS;
}

function isRouteStartAttemptStatus(
  value: unknown
): value is RouteStartAttemptStatus {
  return (
    value === "pending" ||
    value === "restart-required" ||
    value === "status-unavailable"
  );
}

function isStoredRouteStartAttempt(
  value: unknown
): value is RouteStartAttempt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const attempt = value as Partial<RouteStartAttempt>;

  return (
    typeof attempt.routeId === "string" &&
    Boolean(attempt.routeId.trim()) &&
    typeof attempt.generation === "number" &&
    Number.isSafeInteger(attempt.generation) &&
    attempt.generation > 0 &&
    typeof attempt.startedAt === "string" &&
    Boolean(attempt.startedAt.trim()) &&
    (attempt.dayStartedAt === null ||
      (typeof attempt.dayStartedAt === "string" &&
        Boolean(attempt.dayStartedAt.trim()))) &&
    typeof attempt.createdAt === "number" &&
    Number.isFinite(attempt.createdAt) &&
    typeof attempt.readyAt === "number" &&
    Number.isFinite(attempt.readyAt) &&
    isRouteStartAttemptStatus(attempt.status) &&
    (attempt.pendingFingerprint === null ||
      typeof attempt.pendingFingerprint === "string") &&
    typeof attempt.stablePendingReadCount === "number" &&
    Number.isSafeInteger(attempt.stablePendingReadCount) &&
    attempt.stablePendingReadCount >= 0
  );
}

function notifyAttemptListeners() {
  attemptListeners.forEach((listener) => listener());
}

function persistAttempts() {
  if (typeof globalThis.localStorage === "undefined") {
    return false;
  }

  try {
    if (attemptByRouteId.size === 0) {
      globalThis.localStorage.removeItem(ROUTE_START_ATTEMPT_STORAGE_KEY);
      return true;
    }

    globalThis.localStorage.setItem(
      ROUTE_START_ATTEMPT_STORAGE_KEY,
      JSON.stringify([...attemptByRouteId.values()])
    );
    return true;
  } catch (error) {
    console.warn(
      "[route-start] attempt journal persist failed",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

function hydrateAttempts() {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  try {
    const storedValue = globalThis.localStorage.getItem(
      ROUTE_START_ATTEMPT_STORAGE_KEY
    );

    if (!storedValue) {
      return;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      globalThis.localStorage.removeItem(ROUTE_START_ATTEMPT_STORAGE_KEY);
      return;
    }

    const storedAttempts = parsedValue.filter(isStoredRouteStartAttempt);

    storedAttempts.forEach((attempt) => {
      const normalizedAttempt = {
        ...attempt,
        routeId: attempt.routeId.trim(),
        startedAt: attempt.startedAt.trim(),
        dayStartedAt: attempt.dayStartedAt?.trim() ?? null,
      } satisfies RouteStartAttempt;
      const currentAttempt = attemptByRouteId.get(
        normalizedAttempt.routeId
      );

      if (
        !currentAttempt ||
        currentAttempt.generation < normalizedAttempt.generation
      ) {
        attemptByRouteId.set(
          normalizedAttempt.routeId,
          normalizedAttempt
        );
      }
      nextAttemptGeneration = Math.max(
        nextAttemptGeneration,
        normalizedAttempt.generation
      );
    });

    if (storedAttempts.length !== parsedValue.length) {
      console.warn("[route-start] invalid attempt journal entry ignored");
    }

    persistAttempts();
  } catch (error) {
    try {
      globalThis.localStorage.removeItem(ROUTE_START_ATTEMPT_STORAGE_KEY);
    } catch {
      // 저장소 자체를 사용할 수 없으면 새 시작 요청도 fail-safe로 거절한다.
    }
    console.warn(
      "[route-start] attempt journal hydrate failed",
      error instanceof Error ? error.message : error
    );
  }
}

hydrateAttempts();

function incrementActiveAttempt(routeId: string) {
  activeAttemptCountByRouteId.set(
    routeId,
    (activeAttemptCountByRouteId.get(routeId) ?? 0) + 1
  );
}

function decrementActiveAttempt(routeId: string, notify: boolean) {
  const nextCount = (activeAttemptCountByRouteId.get(routeId) ?? 1) - 1;

  if (nextCount > 0) {
    activeAttemptCountByRouteId.set(routeId, nextCount);
  } else {
    activeAttemptCountByRouteId.delete(routeId);
  }

  if (notify) {
    notifyAttemptListeners();
  }
}

function updateAttempt(
  routeId: string,
  generation: number,
  createNextAttempt: (
    currentAttempt: RouteStartAttempt
  ) => RouteStartAttempt | null
) {
  const normalizedRouteId = normalizeRouteId(routeId);
  const currentAttempt = attemptByRouteId.get(normalizedRouteId);

  if (!currentAttempt || currentAttempt.generation !== generation) {
    return null;
  }

  const nextAttempt = createNextAttempt(currentAttempt);

  if (!nextAttempt) {
    return null;
  }

  attemptByRouteId.set(normalizedRouteId, nextAttempt);

  if (!persistAttempts()) {
    attemptByRouteId.set(normalizedRouteId, currentAttempt);
    return null;
  }

  notifyAttemptListeners();
  return { ...nextAttempt };
}

export function beginRouteStartAttempt(
  input: RouteStartAttemptInput,
  options: {
    now?: number;
    delayMs?: number;
    replaceGeneration?: number;
  } = {}
) {
  const routeId = normalizeRouteId(input.routeId);
  const startedAt = normalizeRequiredString(input.startedAt);
  const dayStartedAt =
    input.dayStartedAt === null || input.dayStartedAt === undefined
      ? null
      : normalizeRequiredString(input.dayStartedAt);
  const hasInvalidDayStartedAt =
    input.dayStartedAt !== null &&
    input.dayStartedAt !== undefined &&
    !dayStartedAt;

  if (!routeId || !startedAt || hasInvalidDayStartedAt) {
    return null;
  }

  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();
  const readyAt = now + getNormalizedDelay(options.delayMs);
  const previousAttempt = attemptByRouteId.get(routeId);
  const isReplacement = options.replaceGeneration !== undefined;

  if (isReplacement) {
    if (
      !previousAttempt ||
      previousAttempt.generation !== options.replaceGeneration ||
      attemptByRouteId.size !== 1 ||
      activeAttemptCountByRouteId.size > 0
    ) {
      return null;
    }
  } else if (
    attemptByRouteId.size > 0 ||
    activeAttemptCountByRouteId.size > 0
  ) {
    return null;
  }

  incrementActiveAttempt(routeId);
  nextAttemptGeneration += 1;

  const attempt: RouteStartAttempt = {
    routeId,
    generation: nextAttemptGeneration,
    startedAt,
    dayStartedAt,
    createdAt: now,
    readyAt,
    status: "pending",
    pendingFingerprint: null,
    stablePendingReadCount: 0,
  };

  attemptByRouteId.set(routeId, attempt);

  if (!persistAttempts()) {
    if (previousAttempt) {
      attemptByRouteId.set(routeId, previousAttempt);
    } else {
      attemptByRouteId.delete(routeId);
    }
    decrementActiveAttempt(routeId, false);
    return null;
  }

  notifyAttemptListeners();
  let isReleased = false;

  return {
    attempt: { ...attempt },
    release: () => {
      if (isReleased) {
        return;
      }

      isReleased = true;
      decrementActiveAttempt(routeId, true);
    },
  };
}

export function resolveRouteStartAttempt(
  routeId: string,
  generation?: number
) {
  const normalizedRouteId = normalizeRouteId(routeId);
  const currentAttempt = attemptByRouteId.get(normalizedRouteId);

  if (
    !currentAttempt ||
    (generation !== undefined && currentAttempt.generation !== generation)
  ) {
    return false;
  }

  attemptByRouteId.delete(normalizedRouteId);

  if (!persistAttempts()) {
    attemptByRouteId.set(normalizedRouteId, currentAttempt);
    return false;
  }

  notifyAttemptListeners();
  return true;
}

export function clearRouteStartAttempts() {
  const previousAttempts = new Map(attemptByRouteId);
  const previousActiveAttempts = new Map(activeAttemptCountByRouteId);

  attemptByRouteId.clear();
  activeAttemptCountByRouteId.clear();

  if (!persistAttempts()) {
    previousAttempts.forEach((attempt, routeId) => {
      attemptByRouteId.set(routeId, attempt);
    });
    previousActiveAttempts.forEach((count, routeId) => {
      activeAttemptCountByRouteId.set(routeId, count);
    });
    return false;
  }

  notifyAttemptListeners();
  return true;
}

export function getRouteStartAttempts() {
  return [...attemptByRouteId.values()].map((attempt) => ({ ...attempt }));
}

export function hasActiveRouteStartAttempt(routeId?: string) {
  if (routeId === undefined) {
    return activeAttemptCountByRouteId.size > 0;
  }

  return activeAttemptCountByRouteId.has(normalizeRouteId(routeId));
}

export function isRouteStartAttemptLocked(routeId?: string) {
  if (routeId === undefined) {
    return (
      activeAttemptCountByRouteId.size > 0 || attemptByRouteId.size > 0
    );
  }

  const normalizedRouteId = normalizeRouteId(routeId);

  return (
    activeAttemptCountByRouteId.has(normalizedRouteId) ||
    attemptByRouteId.has(normalizedRouteId)
  );
}

export function subscribeRouteStartAttempts(listener: () => void) {
  attemptListeners.add(listener);

  return () => {
    attemptListeners.delete(listener);
  };
}

export function getRouteStartAttemptReconciliationDelayMs(
  now = Date.now()
) {
  const pendingAttempts = [...attemptByRouteId.values()].filter(
    (attempt) => attempt.status === "pending"
  );

  if (pendingAttempts.length === 0) {
    return null;
  }

  const earliestReadyAt = Math.min(
    ...pendingAttempts.map((attempt) => attempt.readyAt)
  );

  return Math.max(0, earliestReadyAt - now);
}

export function recordRouteStartAttemptPendingObservation(
  routeId: string,
  generation: number,
  pendingFingerprint: string,
  options: {
    now?: number;
    delayMs?: number;
  } = {}
) {
  const normalizedFingerprint = String(pendingFingerprint);
  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();

  return updateAttempt(routeId, generation, (currentAttempt) => {
    if (currentAttempt.status !== "pending") {
      return null;
    }

    return {
      ...currentAttempt,
      readyAt: now + getNormalizedDelay(options.delayMs),
      pendingFingerprint: normalizedFingerprint,
      stablePendingReadCount:
        currentAttempt.pendingFingerprint === normalizedFingerprint
          ? currentAttempt.stablePendingReadCount + 1
          : 1,
    };
  });
}

export function markRouteStartAttemptRequestDispatched(
  routeId: string,
  generation: number,
  options: {
    now?: number;
    delayMs?: number;
  } = {}
) {
  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();
  const delayMs =
    options.delayMs === undefined
      ? ROUTE_START_ATTEMPT_API_SETTLEMENT_DELAY_MS
      : getNormalizedDelay(options.delayMs);

  return updateAttempt(routeId, generation, (currentAttempt) => ({
    ...currentAttempt,
    readyAt: now + delayMs,
    status: "pending",
    pendingFingerprint: null,
    stablePendingReadCount: 0,
  }));
}

export function markRouteStartAttemptRestartRequired(
  routeId: string,
  generation: number,
  options: { now?: number } = {}
) {
  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();

  return updateAttempt(routeId, generation, (currentAttempt) => ({
    ...currentAttempt,
    readyAt: now,
    status: "restart-required",
  }));
}

export function markRouteStartAttemptStatusUnavailable(
  routeId: string,
  generation: number,
  options: { now?: number } = {}
) {
  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();

  return updateAttempt(routeId, generation, (currentAttempt) => ({
    ...currentAttempt,
    readyAt: now,
    status: "status-unavailable",
  }));
}

export function retryRouteStartAttemptNow(
  routeId: string,
  generation: number,
  options: { now?: number; delayMs?: number } = {}
) {
  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();

  return updateAttempt(routeId, generation, (currentAttempt) => ({
    ...currentAttempt,
    readyAt:
      now +
      (typeof options.delayMs === "number" &&
      Number.isFinite(options.delayMs)
        ? Math.max(0, options.delayMs)
        : 0),
    status: "pending",
  }));
}

export function deferRouteStartAttempt(
  routeId: string,
  generation: number,
  options: {
    now?: number;
    delayMs?: number;
  } = {}
) {
  const now =
    typeof options.now === "number" && Number.isFinite(options.now)
      ? options.now
      : Date.now();

  return updateAttempt(routeId, generation, (currentAttempt) => ({
    ...currentAttempt,
    readyAt: now + getNormalizedDelay(options.delayMs),
  }));
}
