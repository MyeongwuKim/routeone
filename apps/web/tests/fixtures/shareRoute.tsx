import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import DayRoutePopup from "/src/features/my-route/components/DayRoutePopup";
import type { MyRoute } from "/src/features/my-route/types";
import "/src/index.css";

const date = "2026-11-24T10:00:00.000Z";
const day = (dayIndex: number, startLocation: MyRoute["startLocation"]) => ({
  id: `day-${dayIndex}`, routeId: "test-route", dayIndex, date, plannedStartMinutes: null,
  startedAt: date, startLocation,
  stops: [{
    id: `stop-${dayIndex}`, routeId: "test-route", dayId: `day-${dayIndex}`, order: 1,
    place: { provider: "CUSTOM", title: "테스트 여행지", lat: 37.46, lng: 128.56 },
    visitStatus: "VISITED", visitedAt: date, verificationStatus: "GPS",
    verificationLat: 37.47, verificationLng: 128.57, verificationAccuracyMeters: 13.25,
  }],
});
const days = [day(1, null), day(2, { lat: 37.33, lng: 128.44 })];
const route = {
  id: "test-route", isMine: true, countryCode: "KR", tripDays: 2,
  status: "COMPLETED", visibility: "PRIVATE", sharedAt: null,
  travelStartDate: date, travelEndDate: date, startedAt: date, completedAt: date,
  totalStopCount: 2, completedStopCount: 2, likeCount: 0, shareTags: [],
  startLocation: { lat: 37.231234, lng: 128.341234 },
  days, stops: days.flatMap((item) => item.stops),
};
const requests: unknown[] = [];
const state = { route, requests, failNextShare: false };
Object.assign(window, { shareRouteTest: state });

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("graphql")) return originalFetch(input, init);
  const body = JSON.parse(String(init?.body));
  if (body.query.includes("mutation ShareRoute")) {
    requests.push(body.variables);
    if (state.failNextShare) {
      state.failNextShare = false;
      return Promise.resolve(Response.json({ errors: [{ message: "테스트 공유 실패" }] }));
    }
    return Promise.resolve(Response.json({ data: {
      shareRoute: { ...route, visibility: "PUBLIC", sharedAt: date },
    } }));
  }
  return Promise.resolve(Response.json({ errors: [{ message: "테스트에서 지원하지 않는 요청" }] }));
};

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const popupRoute = route as unknown as MyRoute;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MemoryRouter>
      <DayRoutePopup route={popupRoute} day={popupRoute.days[0]!} isReadOnly onClose={() => {}} />
    </MemoryRouter>
  </QueryClientProvider>
);
