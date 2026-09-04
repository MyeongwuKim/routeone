import assert from "node:assert/strict";
import test from "node:test";
import {
  derivePlaceVerificationPolicy,
  resolvePlaceVerificationPolicy,
} from "../src/modules/routes/routePlaceVerificationPolicy.ts";
import { normalizePlaceSnapshot } from "../src/modules/routes/route.shared.ts";

test("공원과 해변 같은 넓은 야외 장소는 알림 500m, 인증 300m로 계산한다", () => {
  assert.deepEqual(
    derivePlaceVerificationPolicy({
      contentTypeId: "12",
      categoryName: "해변·해수욕장",
    }),
    {
      notificationRadiusMeters: 500,
      verificationRadiusMeters: 300,
    }
  );
});

test("일반 관광지와 음식점은 알림 300m, 인증 100m로 계산한다", () => {
  assert.deepEqual(
    derivePlaceVerificationPolicy({
      contentTypeId: "14",
      categoryName: "미술관",
    }),
    {
      notificationRadiusMeters: 300,
      verificationRadiusMeters: 100,
    }
  );
  assert.deepEqual(
    derivePlaceVerificationPolicy({
      contentTypeId: "39",
      categoryName: "음식점",
    }),
    {
      notificationRadiusMeters: 300,
      verificationRadiusMeters: 100,
    }
  );
});

test("저장된 루트는 현재 분류 계산보다 스냅샷 인증 정책을 우선한다", () => {
  assert.deepEqual(
    resolvePlaceVerificationPolicy({
      contentTypeId: "12",
      categoryName: "공원",
      notificationRadiusMeters: 300,
      verificationRadiusMeters: 100,
    }),
    {
      notificationRadiusMeters: 300,
      verificationRadiusMeters: 100,
    }
  );
});

test("루트 장소 스냅샷에 세부 분류 코드와 계산된 인증 정책을 함께 저장한다", () => {
  const snapshot = normalizePlaceSnapshot({
    provider: "TOUR_API",
    contentTypeId: "12",
    title: "테스트 해변",
    lat: 37,
    lng: 127,
    categoryName: "해변·해수욕장",
    categoryCode1: "TEST_L1",
    categoryCode2: "TEST_L2",
    categoryCode3: "TEST_L3",
  });

  assert.equal(snapshot.categoryCode1, "TEST_L1");
  assert.equal(snapshot.categoryCode2, "TEST_L2");
  assert.equal(snapshot.categoryCode3, "TEST_L3");
  assert.equal(snapshot.notificationRadiusMeters, 500);
  assert.equal(snapshot.verificationRadiusMeters, 300);
});

test("기존 장소 스냅샷을 복제할 때 저장 당시 인증 정책을 유지한다", () => {
  const snapshot = normalizePlaceSnapshot({
    provider: "TOUR_API",
    contentTypeId: "12",
    title: "기존 공원",
    lat: 37,
    lng: 127,
    categoryName: "공원",
    notificationRadiusMeters: 300,
    verificationRadiusMeters: 100,
  });

  assert.equal(snapshot.notificationRadiusMeters, 300);
  assert.equal(snapshot.verificationRadiusMeters, 100);
});

test("이전 500m 인증 스냅샷은 현재 장소 분류 정책으로 보정한다", () => {
  assert.deepEqual(
    resolvePlaceVerificationPolicy({
      contentTypeId: "12",
      categoryName: "공원",
      verificationRadiusMeters: 500,
    }),
    {
      notificationRadiusMeters: 500,
      verificationRadiusMeters: 300,
    }
  );
});
