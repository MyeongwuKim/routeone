import { FestivalsDocument } from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

type FestivalScope = { areaCode?: string; regionCodes?: string[] };

/** 31일 이내의 기간과 겹치는 축제를 지정한 시도 또는 시군구에서 조회한다. 이전 여러 지역 알림은 강원 권역을 명시해서 조회한다. */
export const festivalApi = {
  list(startDate: string, endDate: string, scope: FestivalScope) {
    return requestGraphQL(FestivalsDocument, { startDate, endDate, ...scope });
  },
};
