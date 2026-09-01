/**
 * 용도:
 * 여행 시작·방문 완료의 네이티브 알림 전환과 API 처리가 끝날 때까지
 * 전역 도착 알림 동기화가 중간 상태를 덮어쓰지 못하게 한다.
 *
 * 동작 방식:
 * routeId별 진행 횟수와 API 전 기대 상태를 기록한다. API 전환 journal은
 * localStorage에 남겨 WebView가 다시 실행돼도 복원한다. 일반 동기화는
 * 잠금 중 건너뛰고 서버 기준 재조회와 네이티브 상태 정리를 다시 시도한다.
 */
export type RouteArrivalTransitionExpectation =
  | { kind: "route-start" }
  | { kind: "stop-visit"; stopId: string; visited: boolean }
  | { kind: "unknown" };

export type UnresolvedRouteArrivalTransition = {
  routeId: string;
  generation: number;
  expectation: RouteArrivalTransitionExpectation;
  readyAt: number;
  pendingFingerprint: string | null;
  stablePendingReadCount: number;
};

const activeTransitionCountByRouteId = new Map<string, number>();
const unresolvedTransitionByRouteId =
  new Map<string, UnresolvedRouteArrivalTransition>();
const transitionListeners = new Set<() => void>();
let nextTransitionGeneration = 0;

export const ROUTE_ARRIVAL_TRANSITION_RECONCILIATION_DELAY_MS = 5_000;
export const ROUTE_ARRIVAL_TRANSITION_API_SETTLEMENT_DELAY_MS = 30_000;
export const ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY =
  "routeone:route-arrival-transition-journal:v1";
const CORRUPTED_TRANSITION_ROUTE_ID =
  "__routeone_corrupted_arrival_transition__";

function isRouteArrivalTransitionExpectation(
  value: unknown
): value is RouteArrivalTransitionExpectation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const expectation = value as Partial<RouteArrivalTransitionExpectation>;

  return (
    expectation.kind === "route-start" ||
    expectation.kind === "unknown" ||
    (expectation.kind === "stop-visit" &&
      typeof expectation.stopId === "string" &&
      Boolean(expectation.stopId.trim()) &&
      typeof expectation.visited === "boolean")
  );
}

function isStoredUnresolvedTransition(
  value: unknown
): value is UnresolvedRouteArrivalTransition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const transition = value as Partial<UnresolvedRouteArrivalTransition>;

  return (
    typeof transition.routeId === "string" &&
    Boolean(transition.routeId.trim()) &&
    typeof transition.generation === "number" &&
    Number.isSafeInteger(transition.generation) &&
    transition.generation > 0 &&
    isRouteArrivalTransitionExpectation(transition.expectation) &&
    typeof transition.readyAt === "number" &&
    Number.isFinite(transition.readyAt) &&
    (transition.pendingFingerprint === null ||
      typeof transition.pendingFingerprint === "string") &&
    typeof transition.stablePendingReadCount === "number" &&
    Number.isSafeInteger(transition.stablePendingReadCount) &&
    transition.stablePendingReadCount >= 0
  );
}

function persistUnresolvedTransitions() {
  if (typeof globalThis.localStorage === "undefined") {
    return false;
  }

  try {
    if (unresolvedTransitionByRouteId.size === 0) {
      globalThis.localStorage.removeItem(
        ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY
      );
      return true;
    }

    globalThis.localStorage.setItem(
      ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY,
      JSON.stringify([...unresolvedTransitionByRouteId.values()])
    );
    return true;
  } catch (error) {
    console.warn(
      "[route-arrival-notifications] transition journal persist failed",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

function registerCorruptedJournalSentinel() {
  nextTransitionGeneration += 1;
  unresolvedTransitionByRouteId.set(CORRUPTED_TRANSITION_ROUTE_ID, {
    routeId: CORRUPTED_TRANSITION_ROUTE_ID,
    generation: nextTransitionGeneration,
    expectation: { kind: "unknown" },
    readyAt:
      Date.now() + ROUTE_ARRIVAL_TRANSITION_RECONCILIATION_DELAY_MS,
    pendingFingerprint: null,
    stablePendingReadCount: 0,
  });
  persistUnresolvedTransitions();
}

function hydrateUnresolvedTransitions() {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  try {
    const storedValue = globalThis.localStorage.getItem(
      ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY
    );

    if (!storedValue) {
      return;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      registerCorruptedJournalSentinel();
      return;
    }

    const storedTransitions = parsedValue.filter(
      isStoredUnresolvedTransition
    );

    storedTransitions.forEach((transition) => {
      const normalizedRouteId = transition.routeId.trim();
      const hydratedTransition = {
        ...transition,
        routeId: normalizedRouteId,
        expectation:
          transition.expectation.kind === "stop-visit"
            ? {
                ...transition.expectation,
                stopId: transition.expectation.stopId.trim(),
              }
            : transition.expectation,
      } satisfies UnresolvedRouteArrivalTransition;

      unresolvedTransitionByRouteId.set(
        normalizedRouteId,
        hydratedTransition
      );
      nextTransitionGeneration = Math.max(
        nextTransitionGeneration,
        hydratedTransition.generation
      );
    });

    if (storedTransitions.length !== parsedValue.length) {
      registerCorruptedJournalSentinel();
      return;
    }

    persistUnresolvedTransitions();
  } catch (error) {
    registerCorruptedJournalSentinel();
    console.warn(
      "[route-arrival-notifications] transition journal hydrate failed",
      error instanceof Error ? error.message : error
    );
  }
}

hydrateUnresolvedTransitions();

function normalizeRouteId(routeId: string) {
  return routeId.trim();
}

function notifyTransitionListeners() {
  transitionListeners.forEach((listener) => listener());
}

export function acquireRouteArrivalTransitionLock(routeId: string) {
  const normalizedRouteId = normalizeRouteId(routeId);

  if (!normalizedRouteId) {
    return () => undefined;
  }

  activeTransitionCountByRouteId.set(
    normalizedRouteId,
    (activeTransitionCountByRouteId.get(normalizedRouteId) ?? 0) + 1
  );
  notifyTransitionListeners();
  let isReleased = false;

  return () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    const nextCount =
      (activeTransitionCountByRouteId.get(normalizedRouteId) ?? 1) - 1;

    if (nextCount > 0) {
      activeTransitionCountByRouteId.set(normalizedRouteId, nextCount);
    } else {
      activeTransitionCountByRouteId.delete(normalizedRouteId);
    }

    notifyTransitionListeners();
  };
}

export function markRouteArrivalTransitionUnresolved(
  routeId: string,
  options: {
    expectation: RouteArrivalTransitionExpectation;
    now?: number;
    delayMs?: number;
  }
) {
  const normalizedRouteId = normalizeRouteId(routeId);

  if (!normalizedRouteId) {
    return null;
  }

  const now = options.now ?? Date.now();
  const delayMs = Math.max(
    0,
    options.delayMs ?? ROUTE_ARRIVAL_TRANSITION_RECONCILIATION_DELAY_MS
  );
  nextTransitionGeneration += 1;
  const transition: UnresolvedRouteArrivalTransition = {
    routeId: normalizedRouteId,
    generation: nextTransitionGeneration,
    expectation: options.expectation,
    readyAt: now + delayMs,
    pendingFingerprint: null,
    stablePendingReadCount: 0,
  };

  unresolvedTransitionByRouteId.set(normalizedRouteId, transition);
  if (!persistUnresolvedTransitions()) {
    unresolvedTransitionByRouteId.delete(normalizedRouteId);
    notifyTransitionListeners();
    return null;
  }
  notifyTransitionListeners();

  return transition;
}

export function recordRouteArrivalTransitionPendingObservation(
  routeId: string,
  generation: number,
  pendingFingerprint: string,
  options: {
    now?: number;
    delayMs?: number;
  } = {}
) {
  const normalizedRouteId = normalizeRouteId(routeId);
  const currentTransition =
    unresolvedTransitionByRouteId.get(normalizedRouteId);

  if (
    !currentTransition ||
    currentTransition.generation !== generation
  ) {
    return null;
  }

  const now = options.now ?? Date.now();
  const delayMs = Math.max(
    0,
    options.delayMs ?? ROUTE_ARRIVAL_TRANSITION_RECONCILIATION_DELAY_MS
  );
  const stablePendingReadCount =
    currentTransition.pendingFingerprint === pendingFingerprint
      ? currentTransition.stablePendingReadCount + 1
      : 1;
  const nextTransition: UnresolvedRouteArrivalTransition = {
    ...currentTransition,
    readyAt: now + delayMs,
    pendingFingerprint,
    stablePendingReadCount,
  };

  unresolvedTransitionByRouteId.set(normalizedRouteId, nextTransition);
  persistUnresolvedTransitions();
  notifyTransitionListeners();

  return nextTransition;
}

export function markRouteArrivalTransitionRequestDispatched(
  routeId: string,
  generation: number,
  options: {
    now?: number;
    delayMs?: number;
  } = {}
) {
  const normalizedRouteId = normalizeRouteId(routeId);
  const currentTransition =
    unresolvedTransitionByRouteId.get(normalizedRouteId);

  if (
    !currentTransition ||
    currentTransition.generation !== generation
  ) {
    return null;
  }

  const now = options.now ?? Date.now();
  const delayMs = Math.max(
    0,
    options.delayMs ??
      ROUTE_ARRIVAL_TRANSITION_API_SETTLEMENT_DELAY_MS
  );
  const nextTransition: UnresolvedRouteArrivalTransition = {
    ...currentTransition,
    readyAt: now + delayMs,
    pendingFingerprint: null,
    stablePendingReadCount: 0,
  };

  unresolvedTransitionByRouteId.set(normalizedRouteId, nextTransition);

  if (!persistUnresolvedTransitions()) {
    unresolvedTransitionByRouteId.set(
      normalizedRouteId,
      currentTransition
    );
    return null;
  }

  notifyTransitionListeners();
  return nextTransition;
}

export function deferRouteArrivalTransitionReconciliation(
  routeId: string,
  generation: number,
  options: {
    now?: number;
    delayMs?: number;
  } = {}
) {
  const normalizedRouteId = normalizeRouteId(routeId);
  const currentTransition =
    unresolvedTransitionByRouteId.get(normalizedRouteId);

  if (
    !currentTransition ||
    currentTransition.generation !== generation
  ) {
    return;
  }

  const now = options.now ?? Date.now();
  const delayMs = Math.max(
    0,
    options.delayMs ?? ROUTE_ARRIVAL_TRANSITION_RECONCILIATION_DELAY_MS
  );

  unresolvedTransitionByRouteId.set(normalizedRouteId, {
    ...currentTransition,
    readyAt: now + delayMs,
  });
  persistUnresolvedTransitions();
  notifyTransitionListeners();
}

export function resolveRouteArrivalTransition(
  routeId: string,
  generation?: number
) {
  const normalizedRouteId = normalizeRouteId(routeId);
  const currentTransition =
    unresolvedTransitionByRouteId.get(normalizedRouteId);

  if (
    currentTransition &&
    (generation === undefined || currentTransition.generation === generation)
  ) {
    unresolvedTransitionByRouteId.delete(normalizedRouteId);
    persistUnresolvedTransitions();
    notifyTransitionListeners();
  }
}

export function clearRouteArrivalTransitions() {
  const previousTransitions = new Map(unresolvedTransitionByRouteId);
  const previousActiveTransitions = new Map(
    activeTransitionCountByRouteId
  );

  unresolvedTransitionByRouteId.clear();
  activeTransitionCountByRouteId.clear();

  if (!persistUnresolvedTransitions()) {
    previousTransitions.forEach((transition, routeId) => {
      unresolvedTransitionByRouteId.set(routeId, transition);
    });
    previousActiveTransitions.forEach((count, routeId) => {
      activeTransitionCountByRouteId.set(routeId, count);
    });
    return false;
  }

  notifyTransitionListeners();
  return true;
}

export function getUnresolvedRouteArrivalTransitionRouteIds() {
  return [...unresolvedTransitionByRouteId.keys()];
}

export function getUnresolvedRouteArrivalTransitions() {
  return [...unresolvedTransitionByRouteId.values()];
}

export function getRouteArrivalTransitionReconciliationDelayMs(
  now = Date.now()
) {
  if (unresolvedTransitionByRouteId.size === 0) {
    return null;
  }

  const latestReadyAt = Math.max(
    ...[...unresolvedTransitionByRouteId.values()].map(
      (transition) => transition.readyAt
    )
  );

  return Math.max(0, latestReadyAt - now);
}

export function hasActiveRouteArrivalTransition() {
  return activeTransitionCountByRouteId.size > 0;
}

export function isRouteArrivalTransitionLocked(routeId?: string) {
  if (routeId !== undefined) {
    const normalizedRouteId = normalizeRouteId(routeId);

    return (
      activeTransitionCountByRouteId.has(normalizedRouteId) ||
      unresolvedTransitionByRouteId.has(normalizedRouteId)
    );
  }

  return (
    activeTransitionCountByRouteId.size > 0 ||
    unresolvedTransitionByRouteId.size > 0
  );
}

export function subscribeRouteArrivalTransitionLock(listener: () => void) {
  transitionListeners.add(listener);

  return () => {
    transitionListeners.delete(listener);
  };
}
