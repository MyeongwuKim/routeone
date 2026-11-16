import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

/**
 * 코스 팝업의 포커스와 배경 스크롤을 관리한다.
 * 전역 장소 상세·안내가 열리면 팝업만 닫아 두고, 복귀할 때 방문지 버튼과 읽던 스크롤을 복원한다.
 */
export function useHomeCourseDialog(isCovered: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollTopRef = useRef(0);
  const resumeFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const root = document.documentElement;
    root.classList.add("home-course-dialog-open");

    return () => {
      dialog?.close();
      root.classList.remove("home-course-dialog-open");
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isCovered) {
      if (dialog.open) {
        scrollTopRef.current = scrollRef.current?.scrollTop ?? 0;
        if (document.activeElement instanceof HTMLElement && dialog.contains(document.activeElement)) {
          resumeFocusRef.current = document.activeElement;
        }
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
      const target = resumeFocusRef.current?.isConnected ? resumeFocusRef.current : titleRef.current;
      target?.focus({ preventScroll: true });
      if (scrollRef.current) scrollRef.current.scrollTop = scrollTopRef.current;
    }
  }, [isCovered]);

  /** 전역 상세를 열기 전에 팝업을 숨겨 브라우저 최상위 레이어가 새 화면을 가리지 않게 한다. */
  const suspendForOverlay = (trigger: HTMLElement) => {
    scrollTopRef.current = scrollRef.current?.scrollTop ?? 0;
    resumeFocusRef.current = trigger;
    dialogRef.current?.close();
  };

  /** 첫·마지막 버튼에서 Tab을 순환시켜 브라우저 툴바나 뒤쪽 홈으로 포커스가 빠지지 않게 한다. */
  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const targets = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]');
    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === titleRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return { dialogRef, scrollRef, titleRef, suspendForOverlay, trapFocus };
}
