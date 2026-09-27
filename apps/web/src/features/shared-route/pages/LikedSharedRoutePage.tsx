/** 좋아요한 루트 진입 경로에서 SharedRoutePage를 liked 모드로 열어 현재 사용자가 좋아요한 공개 경로만 조회한다. */
import SharedRoutePage from "@/pages/SharedRoutePage";

function LikedSharedRoutePage() {
  return <SharedRoutePage mode="liked" />;
}

export default LikedSharedRoutePage;
