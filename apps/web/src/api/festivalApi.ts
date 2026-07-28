import { GangwonFestivalsDocument } from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export const festivalApi = {
  list(startDate: string, endDate: string) {
    return requestGraphQL(GangwonFestivalsDocument, {
      startDate,
      endDate,
    });
  },
};
