---
name: masil-home-verification
description: 마실의 홈 추천 코스, 지역·언어 선택, 지도 장소 목록 또는 iOS WebView에 반영된 홈 변경을 검증한다. 추천 코스 누락, 번역, 더 보기, 스크롤, 내 위치의 회귀를 조사할 때 사용한다.
---

# 마실 홈 검증

저장소 루트의 `docs/ai/project-context.md`에서 변경에 해당하는 코드 진입점과 실행 환경만 읽는다. 기존 diff를 확인하고 요청에 맞는 검증만 선택한다.

## 자동 검사

저장소 루트에서 변경과 관련된 기존 테스트를 선택한다.

| 변경 영역 | 명령 |
| --- | --- |
| 추천 목록, 지역 필터, 방문지, 코스 메타데이터 | `node --test apps/web/tests/homeRecommendations.test.mjs` |
| 지도 목록, 내 위치의 지역 판정 | `node --test apps/web/tests/homePlaceList.test.mjs apps/web/tests/homeCurrentRegion.test.mjs` |
| API 코스 색인과 지원 지역 | `pnpm --filter api exec node --import tsx --test tests/homeTourCourseIndex.test.mjs tests/routeRegions.test.mjs` |

웹 TypeScript 동작을 변경했으면 `pnpm --filter web exec tsc -b --noEmit`과 변경 파일 대상 ESLint를 실행한다. API 타입은 `pnpm --filter api exec tsc --noEmit`, 네이티브 타입은 `pnpm native:typecheck`로 확인한다.

## 화면과 데이터 확인

- 코스가 누락되면 현재 지역으로 받은 API 목록, 방문지 상세 조회, 최종 카드 표시를 순서대로 확인한다. 코스가 없는 결과와 요청 실패가 각자 올바른 화면을 보여주는지 본다. 재현 가능한 테스트 응답이 있으면 외부 서비스 호출에 앞서 사용한다.
- 언어를 변경했으면 로그인 없이 변경되는지 확인한다. 관련 변경은 코스를 펼쳐 제목·소개, 방문지 이름·주소·설명을 확인한다. 거리·소요시간의 값이 없을 때 라벨이 유지되고, 테마가 없을 때 표시되지 않는지도 해당 변경에서 확인한다.
- `코스 더 보기`나 맨 위로 버튼을 변경했으면 모바일 크기에서 확인한다. 로딩 중 버튼 상태, 다음 코스를 붙인 뒤 스크롤 유지, 지역 선택 영역이 화면을 벗어났을 때 맨 위로 버튼이 나타나고 복귀 후 사라지는 동작을 확인한다.
- 지도 내 위치를 변경했으면 지원 지역 안과 밖을 나눠 확인한다. 밖에서는 기존 탐색 지역이 유지되고, 위치를 받을 수 있으면 지도 이동과 위치 표시가 이뤄지는지 확인한다. 장소 목록을 바꿨으면 펼치고 접을 때 지도와 목록의 배치를 확인한다.
- iOS 반영을 요청받았거나 동작이 WebView나 네이티브 기능에 의존하면 해당 빌드 환경과 API 대상을 확인한다. 로컬 시뮬레이터는 `pnpm native:ios:local`로 변경된 웹 번들을 반영해 요청된 화면을 다시 확인한다. 실기기 권한 확인 결과는 시뮬레이터 결과와 구분한다.

실제 실행한 명령, 확인한 환경과 동작, 남은 검증을 보고한다. API 키와 실제 사용자 좌표는 결과에 포함하지 않는다.
