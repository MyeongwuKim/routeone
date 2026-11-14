/** 라우터보다 먼저 popstate를 받아 저장 중인 화면의 앱 내부 이동을 되돌린다. */
let installed = false;
let lockCount = 0;
let lockedIndex: number | null = null;

/** window의 popstate는 등록 순서로 실행되므로 React 라우터를 렌더링하기 전에 설치한다. */
export function installHistoryNavigationGuard() {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", (event) => {
    const nextIndex = window.history.state?.idx;
    if (lockCount === 0 || lockedIndex === null || typeof nextIndex !== "number" || nextIndex === lockedIndex) return;
    event.stopImmediatePropagation();
    window.history.go(lockedIndex - nextIndex);
  });
}

/** 중첩된 진행 화면이 있어도 마지막 잠금이 해제될 때까지 진입 위치를 유지한다. */
export function lockHistoryNavigation() {
  if (lockCount === 0) {
    const index = window.history.state?.idx;
    lockedIndex = typeof index === "number" ? index : null;
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) lockedIndex = null;
  };
}
