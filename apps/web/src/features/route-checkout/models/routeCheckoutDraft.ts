import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { RouteAppendTarget } from "@/stores/routeEditFlowStore";
import type { CartFlowStep } from "./routeCheckoutFlow";
import type { RouteCheckoutState } from "./routeCheckoutState";
import type { PlannedRouteDay } from "./routePlanTypes";
import type { RouteEditorState } from "./routeResultEditorState";

/** 새 루트·공유 복사·기존 루트 DAY 추가를 구분해 복원 후 저장 대상을 유지한다. */
export type RouteCheckoutDraftContext =
  | { mode: "new" }
  | { mode: "shared-copy"; sourceRouteId: string }
  | { mode: "append"; target: RouteAppendTarget };

/** 최초 전송한 생성 본문 JSON(inputKey)과 요청 ID를 함께 보존해 재실행 후에도 같은 요청을 확인한다. */
export type RouteCreateAttempt = {
  inputKey: string;
  requestId: string;
};

/**
 * 앱을 다시 열어도 일정 입력과 적용 전후 편집을 이어갈 수 있는 한 개의 작성본이다.
 * ownerUserId가 null이면 비로그인 작성본이며, 인증 토큰이나 네트워크 응답 캐시는 포함하지 않는다.
 */
export type RouteCheckoutDraft = {
  id: string;
  ownerUserId: string | null;
  context: RouteCheckoutDraftContext;
  savedPlaces: SavedPlaceItem[];
  initialRoutePlan: PlannedRouteDay[] | null;
  initialStep: CartFlowStep;
  form: RouteCheckoutState;
  editor: RouteEditorState | null;
  createAttempt: RouteCreateAttempt | null;
  /** 마지막 입력·편집 저장 시각의 Unix 밀리초 값 */
  updatedAt: number;
};

const steps = new Set(["cart", "schedule", "tempo", "start-location", "result"]);
const sources = new Set(["current-location", "saved-places", "map", "shared-route"]);
const tempos = new Set(["relaxed", "balanced", "packed"]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isId = (value: unknown): value is string => isText(value) && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNonNegative = (value: unknown): value is number => isFiniteNumber(value) && value >= 0;
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
const isPoint = (value: unknown) => isRecord(value) &&
  isFiniteNumber(value.lat) && Math.abs(value.lat) <= 90 &&
  isFiniteNumber(value.lng) && Math.abs(value.lng) <= 180;

function isDateValue(value: unknown) {
  if (value === "") return true;
  if (!isText(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isTimeValue = (value: unknown) => isText(value) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

function isPlace(value: unknown) {
  return isRecord(value) && isPoint(value) &&
    ["id", "contentId"].every((key) => isId(value[key])) &&
    // 이전 저장 장소에는 관광 분류가 없어 공유 루트 변환기가 빈 문자열을 사용한다.
    ["contentTypeId", "areaCode", "signguCode", "touristTrendName", "title", "address", "contentTypeLabel", "categoryName", "icon"].every((key) => isText(value[key])) &&
    (value.topRank === null || isFiniteNumber(value.topRank)) && isTextList(value.images) &&
    ["categoryCode1", "categoryCode2", "categoryCode3", "eventStartDate", "eventEndDate"].every((key) => value[key] === undefined || isText(value[key])) &&
    ["notificationRadiusMeters", "verificationRadiusMeters"].every((key) => value[key] === undefined || value[key] === null || isNonNegative(value[key]));
}

function isSavedPlace(value: unknown) {
  return isRecord(value) && isId(value.id) && isPlace(value.place) &&
    isText(value.thumbnailUrl) && isNonNegative(value.savedAt) &&
    (value.labelLanguage === undefined || value.labelLanguage === "ko" || value.labelLanguage === "en");
}

function isRoutePlan(value: unknown): value is PlannedRouteDay[] {
  return Array.isArray(value) && value.every((day) => isRecord(day) &&
    isPositiveInteger(day.day) && isDateValue(day.date) &&
    typeof day.startsFromCurrentLocation === "boolean" &&
    (day.startLocation === null || isPoint(day.startLocation)) &&
    Array.isArray(day.items) && day.items.every((item) => isRecord(item) &&
      isId(item.id) && isPlace(item.place) &&
      ["stayMinutes", "recommendedStayMinutes", "startMinutes", "endMinutes", "travelMinutesFromPrevious"].every((key) => isNonNegative(item[key])) &&
      typeof item.isOverSchedule === "boolean"));
}

function isForm(value: unknown): value is RouteCheckoutState {
  return isRecord(value) && isText(value.step) && steps.has(value.step) &&
    isDateValue(value.travelStartDate) && isPositiveInteger(value.tripDays) &&
    isTimeValue(value.dailyStartTime) && isTimeValue(value.scheduleEndTime) &&
    (value.tempo === null || (isText(value.tempo) && tempos.has(value.tempo))) &&
    (value.startLocationSelection === null || (isRecord(value.startLocationSelection) &&
      isPoint(value.startLocationSelection.location) &&
      isText(value.startLocationSelection.source) && sources.has(value.startLocationSelection.source)));
}

function isEditorSnapshot(value: unknown) {
  return isRecord(value) && isRecord(value.stayOverrides) &&
    Object.values(value.stayOverrides).every(isNonNegative) &&
    isTextList(value.removedPlaceIds) &&
    (value.routePlanOverride === null || isRoutePlan(value.routePlanOverride)) &&
    Array.isArray(value.manualInsertions) && value.manualInsertions.every((insertion) => {
      if (!isRecord(insertion) || !isPlace(insertion.place) || !isRecord(insertion.request)) return false;
      const request = insertion.request;
      return isPositiveInteger(request.day) && isNonNegativeInteger(request.insertIndex) &&
        [request.from, request.to].every((point) => isRecord(point) && isPoint(point) && isText(point.title) && isText(point.subtitle));
    });
}

function isContext(value: unknown): value is RouteCheckoutDraftContext {
  if (!isRecord(value)) return false;
  if (value.mode === "new") return true;
  if (value.mode === "shared-copy") return isId(value.sourceRouteId);
  if (value.mode !== "append" || !isRecord(value.target)) return false;
  return isId(value.target.routeId) && isText(value.target.routeTitle) &&
    isPositiveInteger(value.target.nextDayIndex) &&
    (value.target.suggestedStartDate === null || isDateValue(value.target.suggestedStartDate));
}

/** 저장 파일의 날짜·좌표·장소·편집 구조를 확인한다. 과거 날짜는 복원 화면에서 수정할 수 있도록 허용한다. */
export function isRouteCheckoutDraft(value: unknown): value is RouteCheckoutDraft {
  return isRecord(value) && isId(value.id) &&
    (value.ownerUserId === null || isId(value.ownerUserId)) && isContext(value.context) &&
    Array.isArray(value.savedPlaces) && value.savedPlaces.every(isSavedPlace) &&
    (value.initialRoutePlan === null || isRoutePlan(value.initialRoutePlan)) &&
    isText(value.initialStep) && steps.has(value.initialStep) && isForm(value.form) &&
    (value.editor === null || (isRecord(value.editor) && isEditorSnapshot(value.editor.applied) && isEditorSnapshot(value.editor.draft))) &&
    (value.createAttempt === null || (isRecord(value.createAttempt) && isId(value.createAttempt.inputKey) && isId(value.createAttempt.requestId))) &&
    isNonNegative(value.updatedAt);
}

/** 담은 순서·장소 ID·관광 ID·좌표로 비교 키를 만든다. 번역 문구나 담은 시각만 바뀌면 같은 장소 구성으로 본다. */
export function getCheckoutPlacesKey(places: readonly SavedPlaceItem[]) {
  return JSON.stringify(places.map(({ id, place }) => [id, place.id, place.contentId, place.lat, place.lng]));
}

/** 원본 공유 루트와 DAY 추가 대상을 키로 구분하며, 제목 번역만 바뀌면 기존 작성본을 유지한다. */
export function getDraftContextKey(context: RouteCheckoutDraftContext) {
  if (context.mode === "new") return "new";
  if (context.mode === "shared-copy") return JSON.stringify([context.mode, context.sourceRouteId]);
  return JSON.stringify([context.mode, context.target.routeId, context.target.nextDayIndex, context.target.suggestedStartDate]);
}
