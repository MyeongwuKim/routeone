import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NOTIFICATION_SETTINGS_QUERY_KEY, NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY } from "@/api/notificationApi";
import { getAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useServiceAreaStore } from "@/stores/serviceAreaStore";
import { saveDefaultServiceRegion } from "../serviceAreaSelection";

/** 기본 지역과 축제 알림 저장 결과를 설정 화면의 진행 상태·토스트·알림 캐시에 반영한다. */
export function useDefaultServiceAreaSelection() {
  const text = useUiText();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore(state => state.showToast);
  const mutation = useMutation({
    mutationFn: saveDefaultServiceRegion,
    onSuccess: async ({ area, region, notificationSettings, authToken }) => {
      const isCurrentSelection = () => {
        const current = useServiceAreaStore.getState();
        return getAuthToken() === authToken && current.selectedAreaId === area.id &&
          current.selectedRegionCode === region.sigunguCode;
      };
      if (!isCurrentSelection()) return;
      if (notificationSettings) {
        await queryClient.cancelQueries({ queryKey: NOTIFICATION_SETTINGS_QUERY_KEY });
        // 대기 중 계정이나 기본 지역이 바뀌었으면 이전 응답으로 캐시를 덮어쓰지 않는다.
        if (!isCurrentSelection()) return;
        queryClient.setQueryData(NOTIFICATION_SETTINGS_QUERY_KEY, { notificationSettings });
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY });
      }
      const label = `${text.labels.regions[area.label] ?? area.label} · ${text.labels.regions[region.label] ?? region.label}`;
      showToast(notificationSettings?.festivalEnabled
        ? text.serviceArea.changedWithFestivalToast(label)
        : text.serviceArea.changedToast(label));
    },
    onError: () => showToast(text.serviceArea.saveError, 3000),
  });
  return { selectDefaultRegion: mutation.mutate, isSaving: mutation.isPending };
}
