import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { useAuthUserStore, type AuthUser } from "/src/stores/authUserStore";
import MyRouteHistoryPage from "/src/features/my-route/pages/MyRouteHistoryPage";
import "/src/index.css";

// 실제 목록·편집 화면을 사용하며 외부 조회 응답만 테스트 데이터로 바꾼다.
const colors = ["#397b9b", "#b76838", "#578651", "#c8a25a"];
function photo(index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 800;
  const context = canvas.getContext("2d")!;
  context.fillStyle = colors[index % colors.length]; context.fillRect(0, 0, 1200, 800);
  context.fillStyle = "#f1e6c8"; context.fillRect(0, 560, 1200, 240);
  context.fillStyle = "#123e35"; context.font = "64px sans-serif"; context.fillText(`TEST PHOTO ${index + 1}`, 100, 650);
  return canvas.toDataURL();
}

const runId = crypto.randomUUID();
const days = [1, 2].map(dayIndex => ({
  id: `day-${dayIndex}`, routeId: runId, dayIndex, date: `2026-09-0${6 + dayIndex}`, plannedStartMinutes: 540,
  startedAt: "2026-09-07T00:00:00Z", startLocation: null,
  stops: [0, 1].map(index => ({
    id: `stop-${dayIndex}-${index}`, routeId: runId, dayId: `day-${dayIndex}`, order: index + 1,
    stayMinutes: 30, travelMinutesFromPrevious: 10, memo: null,
    visitStatus: "VISITED", visitedAt: "2026-09-07T01:00:00Z", verificationStatus: "GPS_PHOTO",
    verifiedAt: "2026-09-07T01:00:00Z", verificationPhotoUrl: photo((dayIndex - 1) * 2 + index),
    verificationPhotoImageId: `image-${dayIndex}-${index}`, verificationPhotoPublicationConsent: false,
    checkedInAt: null, checkedOutAt: null, actualStayMinutes: null,
    place: { provider: "CUSTOM", title: ["바다 산책", "오후의 카페", "작은 공원", "해변의 노을"][(dayIndex - 1) * 2 + index],
      address: "테스트 여행지", lat: 37, lng: 128, categoryLabel: "여행지", imageUrl: null },
  })),
}));
const route = { id: runId, isMine: true, countryCode: "KR", status: "COMPLETED", visibility: "PRIVATE", tripDays: 2,
  travelStartDate: "2026-09-07", travelEndDate: "2026-09-08", primaryRegionCode: "강릉", primaryRegionLabelKey: null,
  totalStopCount: 4, completedStopCount: 4, likeCount: 0, saveCount: 0, sharedAt: null, shareTags: [],
  startedAt: "2026-09-07T00:00:00Z", completedAt: "2026-09-08T10:00:00Z", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-08T10:00:00Z",
  days, stops: days.flatMap(day => day.stops) };
const requests: string[] = [];
const original = JSON.stringify(route);
const fetchOriginal = window.fetch.bind(window);
const testState = { route, requests, original, delay: 0, failRead: false };
(window as unknown as { travelCardTest: typeof testState }).travelCardTest = testState;

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("graphql")) return fetchOriginal(input, init);
  const payload = JSON.parse(String(init?.body ?? "{}"));
  const query = String(payload.query ?? "");
  requests.push(query.split("{")[0].trim());
  // 언어 변경 때 기존 목록이 요청하는 장소 번역만 빈 결과로 대체한다. 여행·사진 쓰기는 계속 거절한다.
  if (query.includes("localizeTourPlaces")) return Response.json({ data: { localizeTourPlaces: [] } });
  if (query.includes("mutation")) throw new Error("여행 카드 검증 중 서버 쓰기 요청이 발생했어요.");
  if (testState.delay) await new Promise(resolve => setTimeout(resolve, testState.delay));
  if (testState.failRead) return Response.json({ errors: [{ message: "Test read failure" }] });
  if (query.includes("myRouteHistoryConnection")) return Response.json({ data: { myRouteHistoryConnection: { nodes: [route], pageInfo: { hasNextPage: false, endCursor: null } } } });
  if (/\broute\s*\(/.test(query)) return Response.json({ data: { route } });
  throw new Error(`예상하지 않은 카드 조회: ${query.split("{")[0]}`);
};
useAuthUserStore.setState({ user: { id: "travel-card-test-owner" } as AuthUser });
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><MemoryRouter initialEntries={["/me/routes"]}><MyRouteHistoryPage /></MemoryRouter></QueryClientProvider>,
);
