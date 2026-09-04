/** 네이티브 앱 모듈이 실행되기 전에 Sentry 오류 수집을 초기화한다. */
import { initializeNativeMonitoring } from "@/monitoring/sentry";

initializeNativeMonitoring();
