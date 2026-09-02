/**
 * 용도:
 * 방문 사진의 선택 경로에 따라 GPS를 함께 검증할지 결정한다.
 *
 * 동작 방식:
 * 여행 중 카메라로 바로 촬영한 사진만 GPS 사진 인증으로 처리하고,
 * 앨범 사진과 지난 일정의 사진은 위치 없는 일반 완료 기록으로 분류한다.
 */
import type { VisitPhotoSource } from "./visitPhotoService";

export type VisitPhotoVerificationStatus = "GPS_PHOTO" | "MANUAL";

export function getVisitPhotoVerificationStatus(
  source: VisitPhotoSource,
  isRetrospectiveCompletion: boolean
): VisitPhotoVerificationStatus {
  return source === "camera" && !isRetrospectiveCompletion
    ? "GPS_PHOTO"
    : "MANUAL";
}
