import { Link } from "react-router-dom";
import { MdArrowForward, MdMap } from "react-icons/md";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { useUiText } from "@/lib/uiText";

function MyRouteEmptyState() {
  const text = useUiText();

  return (
    <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center space-y-3">
      <PotatoLoadingCard
        title={text.myRoute.emptyTitle}
        description={text.myRoute.emptyDescription}
        footerText={text.myRoute.emptyFooter}
        animation="empty"
        compact
        className="shadow-sm"
      />
      <Link
        to="/home"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
      >
        <MdMap className="text-lg" />
        {text.myRoute.createFromMap}
        <MdArrowForward className="text-lg" />
      </Link>
    </div>
  );
}

export default MyRouteEmptyState;
