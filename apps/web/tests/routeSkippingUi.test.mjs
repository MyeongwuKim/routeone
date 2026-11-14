import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let RouteStopNode;
let DayRouteAccordionItem;
let DayRoutePopupHeader;
let DayRoutePopupFooter;
let getTravelSegmentKey;
let text;
const noop = () => {};

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ default: RouteStopNode } = await server.ssrLoadModule("/src/features/my-route/components/day-route/RouteStopNode.tsx"));
  ({ default: DayRouteAccordionItem } = await server.ssrLoadModule("/src/features/my-route/components/day-route/DayRouteAccordionItem.tsx"));
  ({ default: DayRoutePopupHeader } = await server.ssrLoadModule("/src/features/my-route/components/day-route/DayRoutePopupHeader.tsx"));
  ({ default: DayRoutePopupFooter } = await server.ssrLoadModule("/src/features/my-route/components/day-route/DayRoutePopupFooter.tsx"));
  ({ getTravelSegmentKey } = await server.ssrLoadModule("/src/features/my-route/hooks/useDayRouteTravelSegments.ts"));
  ({ getUiText: text } = await server.ssrLoadModule("/src/lib/uiText.ts"));
  text = text("ko");
});

after(async () => { await server?.close(); });

function stop(id = "second", visitStatus = "SKIPPED") {
  return {
    id, dayId: "day-1", order: 2, visitStatus, stayMinutes: 60,
    checkedInAt: null, checkedOutAt: null, visitedAt: null, actualStayMinutes: null,
    verificationStatus: "NONE", verificationPhotoUrl: null, visitTimeEditedAt: null,
    travelMinutesFromPrevious: 5,
    place: { title: `테스트 ${id}`, address: "테스트 주소", lat: id === "first" ? 37.75 : id === "third" ? 37.77 : 37.76, lng: 128.9, contentTypeId: "12", categoryLabel: "관광지", categoryName: "관광지", imageUrl: null },
  };
}

function nodeProps(overrides = {}) {
  return {
    stop: stop(), index: 1, isLast: true, isOrderEditing: false, isDragging: false,
    isVisitSaving: false, isVisitActionBusy: false, isStaySaving: false, isReadOnly: false,
    isActiveDestination: false, canToggleVisited: true, canToggleSkipped: true,
    enableVerificationPhotoPreview: true, isGpsTestEnabled: false, isGpsTestLocationActive: false,
    isNotificationFocused: false, travelSegmentToNext: null, scheduleLabel: "예상 10:00 ~ 11:00",
    canEditVisitTimes: true, canEditVerificationPhoto: true, previousDayIndex: null, nextDayIndex: null,
    onStartDrag: noop, onRemoveFromRoute: noop, onRequestStayMinutesEdit: noop,
    onRequestVisitTimesEdit: noop, onToggleVisited: noop, onToggleSkipped: noop,
    onOpenPlace: noop, onOpenDirections: noop, onEditVerificationPhoto: noop,
    onOpenGpsTest: noop, onOpenVerificationPhoto: noop,
    ...overrides,
  };
}

const renderNode = (props = {}) => renderToStaticMarkup(createElement(RouteStopNode, nodeProps(props)));

test("건너뛴 장소는 방문·시각·체류·인증을 꾸미지 않고 건너뜀과 취소만 표시한다", () => {
  const markup = renderNode({ stop: { ...stop(), checkedInAt: "2026-11-13T10:00:00Z", visitedAt: "2026-11-13T11:00:00Z", actualStayMinutes: 55, verificationStatus: "GPS", verificationPhotoUrl: "https://example.invalid/test-photo.jpg" } });
  assert.match(markup, /건너뜀/);
  assert.match(markup, /건너뛰기 취소/);
  assert.doesNotMatch(markup, /예상 10:00|실제 체류|예상 체류|방문 취소|도착 인증|GPS 인증|test-photo/);
  assert.match(markup, />2<\/div>/, "계획한 두 번째 위치를 유지한다");
});

test("방문한 장소에는 건너뛰기 액션을 추가하지 않는다", () => {
  const markup = renderNode({ stop: stop("visited", "VISITED") });
  assert.doesNotMatch(markup, /건너뛰기/);
  assert.match(markup, /방문 완료/);
});

test("미방문 장소의 건너뛰기는 허용된 소유자에게만 보이고 편집 중에는 숨긴다", () => {
  assert.match(renderNode({ stop: stop("pending", "PENDING") }), /건너뛰기/);
  assert.doesNotMatch(renderNode({ stop: stop("pending", "PENDING"), canToggleSkipped: false }), /건너뛰기/);
  assert.doesNotMatch(renderNode({ stop: stop("pending", "PENDING"), isOrderEditing: true }), /건너뛰기/);
});

test("공유 읽기 전용은 건너뜀 표시를 유지하고 소유자 기록 편집만 취소를 허용한다", () => {
  const shared = renderNode({ isReadOnly: true, canToggleVisited: false, canToggleSkipped: false });
  assert.match(shared, /건너뜀/);
  assert.doesNotMatch(shared, /건너뛰기 취소/);
  assert.match(renderNode({ isReadOnly: true, canToggleSkipped: true }), /건너뛰기 취소/);
});

test("다른 방문 저장이 진행 중이면 건너뛰기 액션도 잠근다", () => {
  const markup = renderNode({ isVisitActionBusy: true });
  assert.match(markup, /<button[^>]*aria-label="테스트 second 건너뛰기 취소"[^>]*disabled=""/);
});

function dayProps(stops, overrides = {}) {
  const day = { id: "day-1", dayIndex: 1, date: "2026-11-13", startedAt: null, plannedStartMinutes: 540, stops };
  return {
    routeDay: day, orderedStops: stops, isExpanded: true, startLocation: null, dailyStartMinutes: 540,
    isOrderEditing: false, activeDropIndex: null, draggedStopId: null, visitSavingStopId: null,
    staySavingStopId: null, isReadOnly: false, canEditVisitTimes: true, canEditDayStartTime: false,
    canEditStartLocation: false, canRecordDayStart: false, canEditVerificationPhoto: false,
    canToggleVisited: true, canToggleSkipStatus: true, isVisitDateAllowed: true, showActiveDestination: true,
    enableVerificationPhotoPreview: false, isGpsTestEnabled: false, gpsTestLocationStopId: null,
    focusedStopId: null, travelSegmentByKey: {}, canDeleteDay: false, previousDay: null, nextDay: null,
    onSelect: noop, onRequestDeleteDay: noop, onRequestPlannedStartEdit: noop,
    onRequestActualStartEdit: noop, onRequestStartLocationEdit: noop, onRegisterDropZone: noop,
    onStartDrag: noop, onMoveStopToDay: noop, onRemoveStop: noop, onRequestStayMinutesEdit: noop,
    onRequestVisitTimesEdit: noop, onToggleVisited: noop, onToggleSkipped: noop, onOpenPlace: noop,
    onOpenDirections: noop, onEditVerificationPhoto: noop, onOpenGpsTest: noop, onOpenVerificationPhoto: noop,
    ...overrides,
  };
}

test("방문 1·3과 건너뜀 2의 계획 순서를 유지하고 방문 수와 건너뜀 수를 구분한다", () => {
  const stops = [stop("first", "VISITED"), stop(), stop("third", "VISITED")];
  const markup = renderToStaticMarkup(createElement(DayRouteAccordionItem, dayProps(stops)));
  assert.ok(markup.indexOf("테스트 first") < markup.indexOf("테스트 second"));
  assert.ok(markup.indexOf("테스트 second") < markup.indexOf("테스트 third"));
  assert.ok(markup.includes(text.dayRoute.visitSkippedSummary(2, 1)));
  assert.doesNotMatch(markup, /aria-current="step"/);
});

test("날짜 또는 시작 권한이 없는 DAY에는 건너뛰기를 노출하지 않는다", () => {
  const stops = [stop("pending", "PENDING")];
  for (const restrictions of [{ isVisitDateAllowed: false }, { canToggleVisited: false }, { canToggleSkipStatus: false }]) {
    const markup = renderToStaticMarkup(createElement(DayRouteAccordionItem, dayProps(stops, restrictions)));
    assert.doesNotMatch(markup, /건너뛰기/);
  }
});

test("건너뛴 첫 장소의 체류시간을 다음 장소 시각에 더하지 않는다", () => {
  const stops = [stop(), stop("third", "PENDING")];
  const markup = renderToStaticMarkup(createElement(DayRouteAccordionItem, dayProps(stops)));
  assert.ok(markup.includes(text.dayRoute.estimatedTimeRange("09:00", "10:00")));
  assert.ok(!markup.includes(text.dayRoute.estimatedTimeRange("10:05", "11:05")));
});

test("중간 장소를 건너뛰면 원래 경유 시간 대신 첫 장소에서 세 번째 장소로 가는 시간을 쓴다", () => {
  const stops = [stop("first", "PENDING"), stop(), stop("third", "PENDING")];
  const travelSegmentByKey = { [getTravelSegmentKey(stops[0].place, stops[2].place)]: { status: "success", minutes: 42 } };
  const markup = renderToStaticMarkup(createElement(DayRouteAccordionItem, dayProps(stops, { travelSegmentByKey })));
  assert.ok(markup.includes(text.dayRoute.estimatedTimeRange("10:42", "11:42")));
});

test("모두 건너뛴 일정에는 가상의 시작·종료·체류 시간표를 표시하지 않는다", () => {
  const markup = renderToStaticMarkup(createElement(DayRouteAccordionItem, dayProps([stop(), stop("third")])));
  assert.ok(markup.includes(text.dayRoute.visitSkippedSummary(0, 2)));
  assert.ok(!markup.includes(text.dayRoute.expectedStart));
  assert.ok(!markup.includes(text.dayRoute.expectedEnd));
  assert.ok(!markup.includes(text.dayRoute.plannedStay(text.dayRoute.hours(1))));
});

function footer(overrides = {}) {
  const day = { id: "day-1", dayIndex: 1, startedAt: "2026-11-13T09:00:00Z", stops: [stop("pending", "PENDING")] };
  return { text, activeDay: day, routeActionDay: day, isReadOnly: false, isOrderEditing: false,
    isSavingOrder: false, isOrderDirty: false, routeStopCount: 1, routeStatus: "ACTIVE",
    canStartRouteActionDay: false, isStartingRouteDay: false, isRouteActionDayCompleted: false,
    canFinishDay: true, isFinishingDay: false, handleRequestFinishDay: noop,
    handleRequestRouteActionDayStart: noop, handleOpenMapForDay: noop,
    ...overrides };
}

test("일정 마치기는 허용된 DAY에만 표시하고 기존 시작·지도 버튼을 유지한다", () => {
  const markup = renderToStaticMarkup(createElement(DayRoutePopupFooter, { controller: footer() }));
  assert.ok(markup.includes(text.dayRoute.finishDay));
  assert.ok(markup.includes(text.dayRoute.routeMap));
  assert.ok(markup.includes(text.dayRoute.dayInProgressAction(1)));
  const blocked = renderToStaticMarkup(createElement(DayRoutePopupFooter, { controller: footer({ canFinishDay: false }) }));
  assert.ok(!blocked.includes(text.dayRoute.finishDay));
});

test("지난 기록 소유자의 마치기를 허용하며 저장·편집 중에는 마치기 버튼이 잠긴다", () => {
  const ownerHistory = renderToStaticMarkup(createElement(DayRoutePopupFooter, { controller: footer({ isReadOnly: true, readOnlyActionLabel: "공유하기", readOnlyActionDisabled: true }) }));
  assert.ok(ownerHistory.includes(text.dayRoute.finishDay));
  for (const busy of [{ isSavingOrder: true }, { isOrderEditing: true }, { isFinishingDay: true }]) {
    const markup = renderToStaticMarkup(createElement(DayRoutePopupFooter, { controller: footer(busy) }));
    const label = busy.isFinishingDay ? text.dayRoute.finishingDay : text.dayRoute.finishDay;
    const finishButton = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([button]) => button.includes(label))?.[0];
    assert.ok(finishButton);
    assert.match(finishButton, /^<button[^>]*disabled=""/);
  }
});

test("전체 루트 요약도 방문 수와 건너뜀 수를 분리해 표시한다", () => {
  const controller = { text, route: { tripDays: 1 }, activeDay: { dayIndex: 1, date: "2026-11-13" },
    routeCompletedStopCount: 2, routeSkippedStopCount: 1, routeStopCount: 3,
    routeTitle: "테스트 루트", isReadOnly: true, onClose: noop };
  const markup = renderToStaticMarkup(createElement(DayRoutePopupHeader, { controller }));
  assert.ok(markup.includes(text.dayRoute.visitSkippedSummary(2, 1)));
  assert.doesNotMatch(markup, /전체 루트 3\/3/);
});

test("건너뛰기 처리 중에는 DAY 화면의 닫기 버튼도 비활성화한다", () => {
  const controller = { text, route: { tripDays: 1 }, activeDay: { dayIndex: 1, date: "2026-11-13" },
    routeCompletedStopCount: 1, routeSkippedStopCount: 0, routeStopCount: 3,
    routeTitle: "테스트 루트", isReadOnly: false, isCloseDisabled: true, onClose: noop };
  const markup = renderToStaticMarkup(createElement(DayRoutePopupHeader, { controller }));
  assert.match(markup, /<button[^>]*aria-label="일차 경로 닫기"[^>]*disabled=""/);
});
