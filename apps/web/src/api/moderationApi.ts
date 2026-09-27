/**
 * 용도:
 * OWNER 신고 관리 화면에서 검토 목록을 조회하고 사진 조치를 요청한다.
 *
 * 동작 방식:
 * 생성된 GraphQL 문서를 사용해 대기 목록 조회와 기각·숨김·삭제 요청을 전달한다.
 */
import {
  ModerateSharedRouteDocument,
  ModeratePlacePhotoDocument,
  PendingSharedRouteReportsDocument,
  PendingPhotoReportsDocument,
  ReportSharedRouteDocument,
  type PlacePhotoModerationAction,
  type SharedRouteModerationAction,
  type SharedRouteReportReason,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

/**
 * 사진·공유 경로 신고 접수와 OWNER 검토 대기 목록, 공개 상태 조치 요청을 전달한다.
 * 입력 검증과 권한 판정은 서버에 맡기고 GraphQL 응답 Promise를 호출부에 그대로 반환한다.
 */
export const moderationApi = {
  pendingPhotoReports() {
    return requestGraphQL(PendingPhotoReportsDocument);
  },
  moderatePlacePhoto(photoId: string, action: PlacePhotoModerationAction) {
    return requestGraphQL(ModeratePlacePhotoDocument, { photoId, action });
  },
  reportSharedRoute(
    routeId: string,
    reason: SharedRouteReportReason,
    details?: string | null
  ) {
    return requestGraphQL(ReportSharedRouteDocument, {
      routeId,
      reason,
      details,
    });
  },
  pendingSharedRouteReports() {
    return requestGraphQL(PendingSharedRouteReportsDocument);
  },
  moderateSharedRoute(routeId: string, action: SharedRouteModerationAction) {
    return requestGraphQL(ModerateSharedRouteDocument, { routeId, action });
  },
};
