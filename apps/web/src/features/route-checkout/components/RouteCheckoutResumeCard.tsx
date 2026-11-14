import { Link } from "react-router-dom";
import { MdArrowForward, MdHistory, MdClose } from "react-icons/md";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useRouteCheckoutDraftStore } from "@/stores/routeCheckoutDraftStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiText } from "@/lib/uiText";

/** 홈에서 이 기기의 작성 중인 루트를 재개하거나, 담은 장소를 유지한 채 초안만 폐기한다. */
export default function RouteCheckoutResumeCard() {
  const text = useUiText();
  const draft = useRouteCheckoutDraftStore((state) => state.draft);
  const userId = useAuthUserStore((state) => state.user?.id ?? null);
  if (!draft || draft.savedPlaces.length === 0 || (draft.ownerUserId && draft.ownerUserId !== userId)) return null;

  const discard = () => useUiModalStore.getState().openModal({
    title: text.cart.discardDraftTitle,
    description: text.cart.discardDraftDescription,
    actions: [
      { label: text.common.cancel, variant: "secondary" },
      { label: text.cart.discardDraft, variant: "danger", onClick: () => useRouteCheckoutDraftStore.getState().clearDraft(draft.id) },
    ],
  });

  return <div className="mb-4 flex min-w-0 items-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-2 dark:border-brand-400/30 dark:bg-brand-900/40">
    <Link to="/home/map?resumeDraft=1" className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-brand-800 dark:text-brand-100">
      <MdHistory aria-hidden="true" className="shrink-0 text-2xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{text.cart.resumeDraft}</span>
        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-300">{text.cart.resumeDraftDescription(draft.savedPlaces.length)}</span>
      </span>
      <MdArrowForward aria-hidden="true" className="shrink-0 text-lg" />
    </Link>
    <button type="button" aria-label={text.cart.discardDraft} onClick={discard} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-brand-900">
      <MdClose aria-hidden="true" />
    </button>
  </div>;
}
