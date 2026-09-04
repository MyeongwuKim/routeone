import assert from "node:assert/strict";
import test from "node:test";
import {
  derivePlaceVerificationPolicy,
  resolvePlaceVerificationPolicy,
} from "../src/modules/routes/routePlaceVerificationPolicy.ts";
import { normalizePlaceSnapshot } from "../src/modules/routes/route.shared.ts";

test("공원과 해변 같은 대형 야외 장소는 사진 인증 반경을 500m로 계산한다", () => {
  assert.deepEqual(
    derivePlaceVerificationPolicy({
      contentTypeId: "12",
      categoryName: "해변·해수욕장",
    }),
    {
      verificationRadiusMeters: 500,
      extendedVerificationRequiresPhoto: true,
    }
  );
});

test("일반 관광지는 200m, 음식점은 100m로 계산한다", () => {
  assert.equal(
    derivePlaceVerificationPolicy({
      contentTypeId: "14",
      categoryName: "미술관",
    }).verificationRadiusMeters,
    200
  );
  assert.deepEqual(
    derivePlaceVerificationPolicy({
      contentTypeId: "39",
      categoryName: "음식점",
    }),
    {
      verificationRadiusMeters: 100,
      extendedVerificationRequiresPhoto: false,
    }
  );
});

test("저장된 루트는 현재 분류 계산보다 스냅샷 인증 정책을 우선한다", () => {
  assert.deepEqual(
    resolvePlaceVerificationPolicy({
      contentTypeId: "12",
      categoryName: "공원",
      verificationRadiusMeters: 200,
      extendedVerificationRequiresPhoto: true,
    }),
    {
      verificationRadiusMeters: 200,
      extendedVerificationRequiresPhoto: true,
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
  assert.equal(snapshot.verificationRadiusMeters, 500);
  assert.equal(snapshot.extendedVerificationRequiresPhoto, true);
});

test("기존 장소 스냅샷을 복제할 때 저장 당시 인증 정책을 유지한다", () => {
  const snapshot = normalizePlaceSnapshot({
    provider: "TOUR_API",
    contentTypeId: "12",
    title: "기존 공원",
    lat: 37,
    lng: 127,
    categoryName: "공원",
    verificationRadiusMeters: 200,
    extendedVerificationRequiresPhoto: true,
  });

  assert.equal(snapshot.verificationRadiusMeters, 200);
  assert.equal(snapshot.extendedVerificationRequiresPhoto, true);
});
