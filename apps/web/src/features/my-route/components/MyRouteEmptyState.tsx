import { Link } from "react-router-dom";
import { MdArrowForward, MdMap } from "react-icons/md";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";

function MyRouteEmptyState() {
  return (
    <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center space-y-3">
      <PotatoLoadingCard
        title="아직 만든 루트가 없어요"
        description="감자가 빈 여행 가방을 보고 있어요."
        footerText="지도에서 장소를 담고 루트를 만들어 보세요."
        animation="empty"
        compact
        className="shadow-sm"
      />
      <Link
        to="/home"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
      >
        <MdMap className="text-lg" />
        지도에서 루트 만들기
        <MdArrowForward className="text-lg" />
      </Link>
    </div>
  );
}

export default MyRouteEmptyState;
