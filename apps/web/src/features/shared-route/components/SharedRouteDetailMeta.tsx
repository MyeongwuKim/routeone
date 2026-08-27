import { MdSell } from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import { getDisplayShareTags, type SharedRoute } from "../sharedRouteCardModel";

function SharedRouteDetailMeta({ route }: { route: SharedRoute }) {
  const text = useUiText();
  const shareTags = getDisplayShareTags(route, text);

  return (
    <div className="scrollbar-hide flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
      {shareTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2 py-1 text-[10px] font-black text-brand-700 dark:border-brand-400/25 dark:bg-brand-400/10 dark:text-brand-100"
        >
          <MdSell className="text-[11px]" />
          {tag}
        </span>
      ))}
    </div>
  );
}

export default SharedRouteDetailMeta;
