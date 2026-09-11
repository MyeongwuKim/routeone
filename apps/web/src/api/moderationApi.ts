/**
 * 용도:
 * OWNER 신고 관리 화면에서 검토 목록을 조회하고 사진 조치를 요청한다.
 *
 * 동작 방식:
 * 생성된 GraphQL 문서를 사용해 대기 목록 조회와 기각·숨김·삭제 요청을 전달한다.
 */
import {
  ModeratePlacePhotoDocument,
  PendingPhotoReportsDocument,
  type PlacePhotoModerationAction,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export const moderationApi = {
  pendingPhotoReports() {
    return requestGraphQL(PendingPhotoReportsDocument);
  },
  moderatePlacePhoto(photoId: string, action: PlacePhotoModerationAction) {
    return requestGraphQL(ModeratePlacePhotoDocument, { photoId, action });
  },
};
