import { IoAlertCircleOutline, IoClose } from "react-icons/io5";
import { useUiModalStore, type UiModalAction } from "@/stores/uiModalStore";

function getActionClassName(action: UiModalAction) {
  if (action.variant === "danger") {
    return "border border-rose-500 bg-rose-600 text-white";
  }

  if (action.variant === "secondary") {
    return "border border-slate-200 bg-white text-slate-600";
  }

  return "border border-brand-500 bg-brand-600 text-white";
}

function GlobalModal() {
  const {
    isOpen,
    title,
    description,
    detail,
    actions,
    closeModal,
  } = useUiModalStore();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2800] flex items-end justify-center bg-slate-900/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-modal-title"
        className="w-full max-w-sm rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xl text-amber-600">
              <IoAlertCircleOutline />
            </span>
            <div className="min-w-0">
              <p id="global-modal-title" className="text-base font-bold text-slate-900">
                {title}
              </p>
              {description ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={closeModal}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            <IoClose />
          </button>
        </header>

        {detail ? (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {detail}
          </div>
        ) : null}

        <div className={`mt-5 grid gap-2 ${actions.length === 2 ? "grid-cols-2" : ""}`}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                action.onClick?.();
                if (action.autoClose !== false) {
                  closeModal();
                }
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${getActionClassName(
                action
              )}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default GlobalModal;
