/**
 * 용도:
 * 장소 검색 팝업에서 표시하는 최근 검색어와 저장 동작을 관리한다.
 *
 * 동작 방식:
 * 로컬 스토리지에서 초기 목록을 읽고 검색어 추가, 개별 삭제, 전체 삭제 결과를
 * 화면 상태와 로컬 스토리지에 함께 반영한다.
 */
import { useCallback, useState } from "react";
import {
  readRecentPlaceSearches,
  writeRecentPlaceSearches,
} from "@/lib/recentPlaceSearches";

export function useRecentPlaceSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>(
    readRecentPlaceSearches
  );

  /** 공백을 제거한 검색어를 목록 앞에 추가하고 같은 문자열의 기존 항목은 제거한다. 빈 값은 저장하지 않는다. */
  const appendRecentSearch = useCallback((keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return;
    }

    setRecentSearches((previous) =>
      writeRecentPlaceSearches([
        trimmedKeyword,
        ...previous.filter((item) => item !== trimmedKeyword),
      ])
    );
  }, []);

  /** 문자열이 정확히 일치하는 최근 검색어를 목록과 localStorage에서 제거한다. */
  const removeRecentSearch = useCallback((keyword: string) => {
    setRecentSearches((previous) =>
      writeRecentPlaceSearches(
        previous.filter((item) => item !== keyword)
      )
    );
  }, []);

  /** 최근 검색어 전체를 화면 상태와 localStorage에서 비운다. */
  const clearRecentSearches = useCallback(() => {
    setRecentSearches(writeRecentPlaceSearches([]));
  }, []);

  return {
    recentSearches,
    appendRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
}
