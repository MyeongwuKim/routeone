/**
 * 사용 위치: DAY 장소의 GPS 테스트 지도
 *
 * 용도:
 * 장소 반경과 GPS 마커를 표시하고, 지도 클릭과 마커 이동을 좌표 선택으로 전달한다.
 *
 * 동작 방식:
 * 지도는 유지한 채 적용 좌표에 맞춰 마커를 옮긴다. 가상 이동·GPS 복귀 중에는 선택을 막는다.
 */
import { useCallback, useEffect, useRef } from "react";
import type {
  NaverMapInstance,
  NaverMapReadyContext,
  NaverMarkerInstance,
} from "@/components/map/NaverMapView";
import {
  getOffsetTestLocation,
  type TestLocation,
} from "../utils/gpsTestLocation";

type TestMarker = NaverMarkerInstance & {
  getPosition: () => { lat: () => number; lng: () => number };
  setMap: (map: NaverMapInstance | null) => void;
  setDraggable?: (draggable: boolean) => void;
};

type GpsTestMapOptions = {
  placeLocation: TestLocation & { title: string };
  location: TestLocation | null;
  verificationPolicy: {
    notificationRadiusMeters: number;
    verificationRadiusMeters: number;
  };
  disabled: boolean;
  onSelect: (position: TestLocation) => void;
};

function createPlaceMarkerIconHtml() {
  return `
    <div style="
      width:38px;
      height:38px;
      border:3px solid #ffffff;
      border-radius:9999px;
      background:#0f766e;
      box-shadow:0 8px 20px rgba(15,118,110,0.3);
      color:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">P</div>
  `;
}

function createTestLocationMarkerIconHtml() {
  return `
    <div style="
      position:relative;
      width:46px;
      height:60px;
      transform:translate(-23px,-60px);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      pointer-events:auto;
      user-select:none;
    ">
      <div style="
        width:46px;
        height:46px;
        border:3px solid #ffffff;
        border-radius:9999px;
        background:#7c3aed;
        box-shadow:0 10px 24px rgba(124,58,237,0.34);
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:11px;
        font-weight:900;
        line-height:1;
      ">GPS</div>
      <div style="
        position:absolute;
        left:50%;
        top:41px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:13px solid #7c3aed;
      "></div>
    </div>
  `;
}

export function useGpsTestMap({
  placeLocation,
  location,
  verificationPolicy,
  disabled,
  onSelect,
}: GpsTestMapOptions) {
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const testMarkerRef = useRef<TestMarker | null>(null);
  const locationRef = useRef(location);
  const selectionRef = useRef({ disabled, onSelect });
  const hasPositionRef = useRef(false);
  const fitBoundsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectionRef.current = { disabled, onSelect };
    testMarkerRef.current?.setDraggable?.(!disabled);
  }, [disabled, onSelect]);

  useEffect(() => {
    locationRef.current = location;
    const marker = testMarkerRef.current;
    const map = mapInstanceRef.current;
    if (!marker || !map || !window.naver?.maps) return;
    if (!location) {
      marker.setMap(null);
      hasPositionRef.current = false;
      return;
    }
    const position = new window.naver.maps.LatLng(location.lat, location.lng);
    marker.setPosition?.(position);
    marker.setMap(map);
    if (hasPositionRef.current) {
      map.panTo?.(position);
    } else {
      fitBoundsRef.current?.();
      hasPositionRef.current = true;
    }
  }, [location]);

  const handleMapReady = useCallback(
    ({ map, naverMaps }: NaverMapReadyContext) => {
      mapInstanceRef.current = map;

      const initialLocation = locationRef.current;
      const overlays: NaverMarkerInstance[] = [];
      const placePosition = new naverMaps.LatLng(
        placeLocation.lat,
        placeLocation.lng
      );
      const testPosition = new naverMaps.LatLng(
        initialLocation?.lat ?? placeLocation.lat,
        initialLocation?.lng ?? placeLocation.lng
      );
      const visibleRadiusMeters = Math.max(
        verificationPolicy.notificationRadiusMeters,
        verificationPolicy.verificationRadiusMeters
      );
      const westEdge = getOffsetTestLocation(
        placeLocation,
        -visibleRadiusMeters
      );
      const eastEdge = getOffsetTestLocation(
        placeLocation,
        visibleRadiusMeters
      );
      const verificationCircle = new naverMaps.Circle({
        map,
        center: placePosition,
        radius: verificationPolicy.verificationRadiusMeters,
        fillColor: "#8b5cf6",
        fillOpacity: 0.12,
        strokeColor: "#7c3aed",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        zIndex: 450,
      }) as NaverMarkerInstance;
      overlays.push(verificationCircle);

      const arrivalCircle = new naverMaps.Circle({
        map,
        center: placePosition,
        radius: verificationPolicy.notificationRadiusMeters,
        fillColor: "#14b8a6",
        fillOpacity: 0.13,
        strokeColor: "#0f766e",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        zIndex: 400,
      }) as NaverMarkerInstance;
      overlays.push(arrivalCircle);

      const placeMarker = new naverMaps.Marker({
        map,
        position: placePosition,
        title: placeLocation.title,
        zIndex: 1600,
        icon: {
          content: createPlaceMarkerIconHtml(),
          anchor: new naverMaps.Point(19, 19),
        },
      }) as NaverMarkerInstance;
      overlays.push(placeMarker);

      const testMarker = new naverMaps.Marker({
        map: initialLocation ? map : null,
        position: testPosition,
        draggable: !selectionRef.current.disabled,
        zIndex: 2600,
        icon: {
          content: createTestLocationMarkerIconHtml(),
          anchor: new naverMaps.Point(0, 0),
        },
      }) as TestMarker;
      testMarkerRef.current = testMarker;
      overlays.push(testMarker);

      const selectLocation = (position: TestLocation) => {
        if (selectionRef.current.disabled) {
          const currentLocation = locationRef.current;
          if (currentLocation) {
            testMarker.setPosition?.(
              new naverMaps.LatLng(currentLocation.lat, currentLocation.lng)
            );
          }
          return;
        }
        selectionRef.current.onSelect(position);
      };
      const dragListener = naverMaps.Event.addListener(
        testMarker,
        "dragend",
        () => {
          const position = testMarker.getPosition();
          selectLocation({
            lat: position.lat(),
            lng: position.lng(),
          });
        }
      );
      const clickListener = naverMaps.Event.addListener(
        map,
        "click",
        (event: { coord: { lat: () => number; lng: () => number } }) => {
          selectLocation({
            lat: event.coord.lat(),
            lng: event.coord.lng(),
          });
        }
      );

      const fitVisibleBounds = () => {
        const bounds = new naverMaps.LatLngBounds();
        bounds.extend(placePosition);
        bounds.extend(new naverMaps.LatLng(westEdge.lat, westEdge.lng));
        bounds.extend(new naverMaps.LatLng(eastEdge.lat, eastEdge.lng));
        const currentLocation = locationRef.current;
        if (currentLocation) {
          bounds.extend(new naverMaps.LatLng(currentLocation.lat, currentLocation.lng));
        }
        naverMaps.Event.trigger(map, "resize");

        try {
          map.fitBounds?.(bounds, {
            top: 120,
            right: 48,
            bottom: 80,
            left: 48,
          });
        } catch {
          map.fitBounds?.(bounds);
        }
      };
      fitBoundsRef.current = fitVisibleBounds;
      hasPositionRef.current = Boolean(initialLocation);
      const frameId = window.requestAnimationFrame(fitVisibleBounds);
      const timerId = window.setTimeout(fitVisibleBounds, 160);

      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timerId);
        naverMaps.Event.removeListener(dragListener);
        naverMaps.Event.removeListener(clickListener);
        overlays.forEach((overlay) => overlay.setMap(null));
        fitBoundsRef.current = null;
        testMarkerRef.current = null;
        mapInstanceRef.current = null;
      };
    },
    [placeLocation, verificationPolicy]
  );

  return handleMapReady;
}
