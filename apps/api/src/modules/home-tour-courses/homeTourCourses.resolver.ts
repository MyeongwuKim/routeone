import { gql } from "graphql-tag";
import { getHomeTourCoursePage } from "./tourCourseIndex.service.js";

export const homeTourCourseTypeDefs = gql`
  type HomeTourCourse {
    id: String!
    title: String!
    image: String!
  }

  type HomeTourCoursePage {
    courses: [HomeTourCourse!]!
    totalCount: Int!
  }

  extend type Query {
    homeTourCourses(areaCode: String!, sigunguCode: String, sigunguCodes: [String!], page: Int!): HomeTourCoursePage!
  }
`;

/** 비로그인 상태에서도 선택 지역의 공식 여행 코스를 조회할 수 있다. */
export const homeTourCourseResolvers = {
  Query: {
    homeTourCourses(_parent: unknown, args: Parameters<typeof getHomeTourCoursePage>[0]) {
      return getHomeTourCoursePage(args);
    },
  },
};
