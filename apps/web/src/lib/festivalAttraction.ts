import type { FestivalsQuery } from "@/generated/graphql";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";

/** 축제 응답을 지도·검색·장소 상세에서 쓰는 장소로 변환한다. 시군구 필터에는 관광공사 코드를 사용한다. */
export function createFestivalAttraction(festival: FestivalsQuery["festivals"][number], todayYmd?: string): GangwonAttraction {
  const eventStartDate = festival.startDate.replaceAll("-", "");
  const eventEndDate = festival.endDate.replaceAll("-", "");
  return {
    id: festival.id, title: festival.title, address: festival.address,
    lat: festival.lat, lng: festival.lng, contentTypeId: "15",
    lclsSystm1: "", lclsSystm2: "", lclsSystm3: "",
    firstImage: festival.imageUrl, secondImage: "",
    eventStartDate, eventEndDate,
    isTodayFestival: Boolean(todayYmd && eventStartDate <= todayYmd && eventEndDate >= todayYmd),
    tourApiSigunguCode: festival.sigunguCode,
  };
}
