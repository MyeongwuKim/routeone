/**
 * 용도:
 * 웹 앱의 다른 모듈이 실행되기 전에 오류 수집을 시작한다.
 *
 * 동작 방식:
 * 앱 진입점의 첫 import에서 Sentry 초기화를 한 번 호출한다.
 */
import { initializeWebMonitoring } from "./monitoring/sentry";

initializeWebMonitoring();
