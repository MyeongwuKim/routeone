/**
 * 용도:
 * 앱이 여행 시작 도중 종료됐을 때 서버의 실제 시작 상태를 다시 확인하고
 * 복구 성공 또는 재시작 필요 상태를 사용자에게 안내한다.
 *
 * 동작 방식:
 * 영속 시작 시도를 서버에서 두 번 확인해 늦은 응답을 기다린다. 이미 시작된
 * 일정은 기록을 정리하고, 미시작 일정은 다시 시작할 수 있는 팝업으로 연결한다.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { routeApi } from "@/api/routeApi";
import { getAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import { nativeBridge } from "@/native-bridge";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  isRouteArrivalTransitionLocked,
  subscribeRouteArrivalTransitionLock,
} from "../services/routeArrivalTransitionLock";
import { getRouteStartAttemptRecoveryDecision } from "../services/routeStartAttemptRecovery";
import {
  deferRouteStartAttempt,
  getRouteStartAttempts,
  hasActiveRouteStartAttempt,
  markRouteStartAttemptRestartRequired,
  markRouteStartAttemptStatusUnavailable,
  recordRouteStartAttemptPendingObservation,
  resolveRouteStartAttempt,
  retryRouteStartAttemptNow,
  ROUTE_START_RECOVERY_GENERATION_PARAM,
  ROUTE_START_RECOVERY_ROUTE_ID_PARAM,
  subscribeRouteStartAttempts,
} from "../services/routeStartAttemptJournal";

const STATUS_RECHECK_LATER_DELAY_MS = 60_000;

function RouteStartAttemptRecoveryCoordinator() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const text = useUiText();
  const openModal = useUiModalStore((state) => state.openModal);
  const isModalOpen = useUiModalStore((state) => state.isOpen);
  const showToast = useUiToastStore((state) => state.showToast);
  const [revision, setRevision] = useState(0);
  const inFlightAttemptKeysRef = useRef(new Set<string>());
  const presentedRecoveryModalRef = useRef<{
    modalId: number;
    routeId: string;
    generation: number;
    status: "restart-required" | "status-unavailable";
  } | null>(null);
  const isEnabled = Boolean(pathname && getAuthToken());

  useEffect(() => {
    const requestRender = () => {
      setRevision((currentRevision) => currentRevision + 1);
    };
    const unsubscribeAttempts = subscribeRouteStartAttempts(requestRender);
    const unsubscribeArrivalTransitions =
      subscribeRouteArrivalTransitionLock(requestRender);

    return () => {
      unsubscribeAttempts();
      unsubscribeArrivalTransitions();
    };
  }, []);

  useEffect(() => {
    const presentedModal = presentedRecoveryModalRef.current;

    if (!presentedModal) {
      return;
    }

    const currentAttempt = getRouteStartAttempts().find(
      (attempt) =>
        attempt.routeId === presentedModal.routeId &&
        attempt.generation === presentedModal.generation
    );

    if (currentAttempt?.status === presentedModal.status) {
      return;
    }

    const modalState = useUiModalStore.getState();

    if (
      modalState.isOpen &&
      modalState.modalId === presentedModal.modalId
    ) {
      modalState.closeModal(presentedModal.modalId);
    }
    presentedRecoveryModalRef.current = null;
  }, [revision]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const requestImmediateRetry = () => {
      getRouteStartAttempts().forEach((attempt) => {
        if (attempt.status !== "pending") {
          retryRouteStartAttemptNow(attempt.routeId, attempt.generation);
        }
      });
      setRevision((currentRevision) => currentRevision + 1);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestImmediateRetry();
      }
    };
    const unsubscribeAppActive = nativeBridge.runtime.isAvailable()
      ? nativeBridge.events.subscribeAppActive(requestImmediateRetry)
      : () => undefined;

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", requestImmediateRetry);
    requestImmediateRetry();

    return () => {
      unsubscribeAppActive();
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("online", requestImmediateRetry);
    };
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const now = Date.now();
    const pendingAttempts = getRouteStartAttempts().filter(
      (attempt) =>
        attempt.status === "pending" &&
        !hasActiveRouteStartAttempt(attempt.routeId)
    );

    if (pendingAttempts.length === 0) {
      return;
    }

    const earliestReadyAt = Math.min(
      ...pendingAttempts.map((attempt) => attempt.readyAt)
    );

    if (earliestReadyAt > now) {
      const timeoutId = window.setTimeout(() => {
        setRevision((currentRevision) => currentRevision + 1);
      }, earliestReadyAt - now);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    pendingAttempts
      .filter((attempt) => attempt.readyAt <= now)
      .forEach((attempt) => {
        const attemptKey = `${attempt.routeId}:${attempt.generation}`;

        if (inFlightAttemptKeysRef.current.has(attemptKey)) {
          return;
        }

        inFlightAttemptKeysRef.current.add(attemptKey);

        void routeApi
          .routeById(attempt.routeId)
          .then((result) => {
            const decision = getRouteStartAttemptRecoveryDecision(
              attempt,
              result.route
            );

            if (decision.kind === "started") {
              if (isRouteArrivalTransitionLocked(attempt.routeId)) {
                deferRouteStartAttempt(
                  attempt.routeId,
                  attempt.generation
                );
                return;
              }

              if (
                resolveRouteStartAttempt(
                  attempt.routeId,
                  attempt.generation
                )
              ) {
                showToast(text.myRoute.startRecoverySuccess, 2600);
              }
              return;
            }

            if (decision.kind === "restart-required") {
              markRouteStartAttemptRestartRequired(
                attempt.routeId,
                attempt.generation
              );
              return;
            }

            recordRouteStartAttemptPendingObservation(
              attempt.routeId,
              attempt.generation,
              decision.pendingFingerprint
            );
          })
          .catch((error) => {
            console.warn(
              "[route-start] interrupted start status lookup failed",
              error instanceof Error ? error.message : error
            );
            markRouteStartAttemptStatusUnavailable(
              attempt.routeId,
              attempt.generation
            );
          })
          .finally(() => {
            inFlightAttemptKeysRef.current.delete(attemptKey);
          });
      });
  }, [isEnabled, revision, showToast, text.myRoute]);

  useEffect(() => {
    if (
      !isEnabled ||
      isModalOpen ||
      isRouteArrivalTransitionLocked()
    ) {
      return;
    }

    const attempt = getRouteStartAttempts().find(
      (candidateAttempt) =>
        candidateAttempt.status !== "pending" &&
        !hasActiveRouteStartAttempt(candidateAttempt.routeId)
    );

    if (!attempt) {
      return;
    }

    if (attempt.status === "restart-required") {
      let didRequestRestart = false;

      const modalId = openModal({
        title: text.myRoute.interruptedStartTitle,
        description: text.myRoute.interruptedStartDescription,
        detail: text.myRoute.interruptedStartDetail,
        onDismiss: () => {
          const currentAttempt = getRouteStartAttempts().find(
            (candidateAttempt) =>
              candidateAttempt.routeId === attempt.routeId &&
              candidateAttempt.generation === attempt.generation
          );

          if (
            !didRequestRestart &&
            currentAttempt?.status === "restart-required"
          ) {
            resolveRouteStartAttempt(
              attempt.routeId,
              attempt.generation
            );
          }
        },
        actions: [
          {
            label: text.common.cancel,
            variant: "secondary",
          },
          {
            label: text.myRoute.retryInterruptedStart,
            variant: "primary",
            onClick: () => {
              const retryAttempt = retryRouteStartAttemptNow(
                attempt.routeId,
                attempt.generation,
                { delayMs: STATUS_RECHECK_LATER_DELAY_MS }
              );

              if (!retryAttempt) {
                showToast(text.myRoute.startAttemptStorageError, 2600);
                return;
              }

              didRequestRestart = true;
              navigate({
                pathname: "/my-route",
                search: new URLSearchParams({
                  [ROUTE_START_RECOVERY_ROUTE_ID_PARAM]: attempt.routeId,
                  [ROUTE_START_RECOVERY_GENERATION_PARAM]: String(
                    attempt.generation
                  ),
                }).toString(),
              });
            },
          },
        ],
      });
      presentedRecoveryModalRef.current = {
        modalId,
        routeId: attempt.routeId,
        generation: attempt.generation,
        status: attempt.status,
      };
      return;
    }

    let didRequestImmediateRetry = false;

    const modalId = openModal({
      title: text.myRoute.startStatusUnavailableTitle,
      description: text.myRoute.startStatusUnavailableDescription,
      detail: text.myRoute.startStatusUnavailableDetail,
      onDismiss: () => {
        const currentAttempt = getRouteStartAttempts().find(
          (candidateAttempt) =>
            candidateAttempt.routeId === attempt.routeId &&
            candidateAttempt.generation === attempt.generation
        );

        if (
          !didRequestImmediateRetry &&
          currentAttempt?.status === "status-unavailable"
        ) {
          retryRouteStartAttemptNow(
            attempt.routeId,
            attempt.generation,
            { delayMs: STATUS_RECHECK_LATER_DELAY_MS }
          );
        }
      },
      actions: [
        {
          label: text.myRoute.checkStartStatusLater,
          variant: "secondary",
        },
        {
          label: text.myRoute.checkStartStatusAgain,
          variant: "primary",
          onClick: () => {
            didRequestImmediateRetry = Boolean(
              retryRouteStartAttemptNow(
                attempt.routeId,
                attempt.generation
              )
            );
          },
        },
      ],
    });
    presentedRecoveryModalRef.current = {
      modalId,
      routeId: attempt.routeId,
      generation: attempt.generation,
      status: "status-unavailable",
    };
  }, [
    isEnabled,
    isModalOpen,
    navigate,
    openModal,
    revision,
    showToast,
    text.common.cancel,
    text.myRoute,
  ]);

  return null;
}

export default RouteStartAttemptRecoveryCoordinator;
