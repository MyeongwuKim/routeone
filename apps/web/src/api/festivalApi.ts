
import { GangwonFestivalsDocument } from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

/** 전달한 시작일과 종료일에 겹치는 강원 축제 목록을 GraphQL로 조회한다. */
export const festivalApi = {
  list(startDate: string, endDate: string) {
    return requestGraphQL(GangwonFestivalsDocument, {
      startDate,
      endDate,
    });
  },
};
