import {
  PushPlatform,
  UserNotificationPushStatus,
  UserNotificationType,
  type PrismaClient,
  type Prisma,
  type User,
} from "@prisma/client";
import { runTransactionWithRetry } from "../../lib/transaction.js";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { normalizeFestivalRegionCode } from "./festivalRegions.js";

const MAX_FESTIVAL_REGION_COUNT = 2;
const EXPO_PUSH_TOKEN_PATTERN =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export type UpdateNotificationSettingsInput = {
  festivalEnabled?: boolean | null;
  festivalRegionCodes?: string[] | null;
  routeStartEnabled?: boolean | null;
  routeReviewEnabled?: boolean | null;
  routeArrivalEnabled?: boolean | null;
};

export type RegisterPushDeviceInput = {
  expoPushToken: string;
  platform: PushPlatform;
  appVariant?: string | null;
  locale?: string | null;
};

function normalizeRegionCodes(regionCodes: string[]) {
  const normalized = [
    ...new Set(regionCodes.map(normalizeFestivalRegionCode)),
  ];

  if (
    normalized.length > MAX_FESTIVAL_REGION_COUNT ||
    normalized.includes(null)
  ) {
    throw new UserFacingError("축제 알림 지역은 지원 지역 중 최대 2곳까지 선택할 수 있습니다.");
  }

  return normalized.filter((code): code is string => code !== null);
}

function normalizeExpoPushToken(value: string) {
  const token = value.trim();

  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
    throw new UserFacingError("Expo 푸시 토큰이 올바르지 않습니다.");
  }

  return token;
}

function normalizeAppVariant(value?: string | null) {
  const appVariant = value?.trim() ?? "";

  if (appVariant.length > 40) {
    throw new UserFacingError("앱 환경 값이 올바르지 않습니다.");
  }

  return appVariant || null;
}

function normalizeNotificationLocale(value?: string | null) {
  const locale = value?.trim().toLowerCase() ?? "";

  if (!locale) {
    return null;
  }

  if (locale !== "ko" && locale !== "en") {
    throw new UserFacingError("알림 언어 값이 올바르지 않습니다.");
  }

  return locale;
}

export function getNotificationSettings(prisma: PrismaClient, user: User) {
  return prisma.userNotificationSetting.upsert({
    where: {
      userId: user.id,
    },
    create: {
      userId: user.id,
    },
    update: {},
  });
}

/** 축제 지역 변경 전의 미발송 알림을 취소한다. 이미 보낸 알림과 테스트 알림은 유지한다. */
function cancelPendingFestivalNotifications(transaction: Prisma.TransactionClient, userId: string) {
  return transaction.userNotification.updateMany({
    where: {
      userId,
      type: UserNotificationType.FESTIVAL_SUMMARY,
      pushStatus: { in: [UserNotificationPushStatus.PENDING, UserNotificationPushStatus.FAILED] },
      NOT: { notificationKey: { startsWith: "festival:test:" } },
    },
    data: {
      pushStatus: UserNotificationPushStatus.CANCELED,
      nextPushAttemptAt: null,
      pushError: "축제 알림 설정이 변경되어 다시 계산합니다.",
    },
  });
}

export async function updateNotificationSettings(
  prisma: PrismaClient,
  user: User,
  input: UpdateNotificationSettingsInput
) {
  const current = await getNotificationSettings(prisma, user);
  const shouldResetFestivalEvaluation =
    input.festivalEnabled != null || input.festivalRegionCodes != null;
  let festivalRegionCodes =
    input.festivalRegionCodes == null
      ? current.festivalRegionCodes
      : normalizeRegionCodes(input.festivalRegionCodes);
  let festivalEnabled =
    input.festivalRegionCodes == null
      ? input.festivalEnabled ?? current.festivalEnabled
      : festivalRegionCodes.length > 0;

  if (input.festivalEnabled === false && input.festivalRegionCodes == null) {
    festivalRegionCodes = [];
    festivalEnabled = false;
  }

  if (festivalEnabled && festivalRegionCodes.length === 0) {
    throw new UserFacingError("축제 알림을 받을 지역을 1곳 이상 선택해 주세요.");
  }

  return prisma.$transaction(async (transaction) => {
    const updatedSetting =
      await transaction.userNotificationSetting.update({
        where: {
          userId: user.id,
        },
        data: {
          festivalEnabled,
          festivalRegionCodes,
          ...(shouldResetFestivalEvaluation
            ? {
                festivalLastEvaluationKey: null,
              }
            : {}),
          routeReviewEnabled:
            input.routeReviewEnabled ?? current.routeReviewEnabled,
          routeStartEnabled:
            input.routeStartEnabled ?? current.routeStartEnabled ?? true,
          routeArrivalEnabled:
            input.routeArrivalEnabled ?? current.routeArrivalEnabled,
        },
      });

    if (shouldResetFestivalEvaluation) {
      await cancelPendingFestivalNotifications(transaction, user.id);
    }

    if (input.routeStartEnabled === false) {
      await transaction.userNotification.deleteMany({
        where: {
          userId: user.id,
          type: UserNotificationType.ROUTE_START,
          pushStatus: {
            in: [
              UserNotificationPushStatus.PENDING,
              UserNotificationPushStatus.FAILED,
              UserNotificationPushStatus.CANCELED,
            ],
          },
        },
      });
    }

    return updatedSetting;
  });
}

/**
 * 설정에서 기본 지역을 바꿀 때 이미 켜져 있는 축제 알림만 새 시군구에 맞춘다.
 * 활성 여부는 변경하지 않으며, 동시 끄기 요청과 겹쳐도 알림을 다시 켜지 않는다.
 * 지역 교체·재평가 초기화·기존 미발송 알림 취소는 하나의 트랜잭션으로 처리한다.
 */
export async function syncFestivalRegionWithServiceArea(prisma: PrismaClient, user: User, regionCode: string) {
  const [normalizedCode] = normalizeRegionCodes([regionCode]);
  await getNotificationSettings(prisma, user);
  return runTransactionWithRetry(prisma, async transaction => {
    const result = await transaction.userNotificationSetting.updateMany({
      where: { userId: user.id, festivalEnabled: true },
      data: { festivalRegionCodes: [normalizedCode], festivalLastEvaluationKey: null },
    });
    if (result.count > 0) await cancelPendingFestivalNotifications(transaction, user.id);
    return transaction.userNotificationSetting.findUniqueOrThrow({ where: { userId: user.id } });
  });
}

export async function registerPushDevice(
  prisma: PrismaClient,
  user: User,
  input: RegisterPushDeviceInput,
  sessionExpiresAt: Date
) {
  const expoPushToken = normalizeExpoPushToken(input.expoPushToken);
  const locale = normalizeNotificationLocale(input.locale);
  const now = new Date();

  await Promise.all([
    getNotificationSettings(prisma, user),
    locale && locale !== user.locale
      ? prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            locale,
          },
        })
      : Promise.resolve(),
  ]);

  return prisma.pushDevice.upsert({
    where: {
      expoPushToken,
    },
    create: {
      userId: user.id,
      expoPushToken,
      platform: input.platform,
      appVariant: normalizeAppVariant(input.appVariant),
      enabled: true,
      lastSeenAt: now,
      sessionExpiresAt,
    },
    update: {
      userId: user.id,
      platform: input.platform,
      appVariant: normalizeAppVariant(input.appVariant),
      enabled: true,
      lastSeenAt: now,
      sessionExpiresAt,
      disabledAt: null,
    },
  });
}

export async function unregisterPushDevice(
  prisma: PrismaClient,
  user: User,
  expoPushTokenValue: string
) {
  const expoPushToken = normalizeExpoPushToken(expoPushTokenValue);
  const result = await prisma.pushDevice.updateMany({
    where: {
      userId: user.id,
      expoPushToken,
      enabled: true,
    },
    data: {
      enabled: false,
      sessionExpiresAt: null,
      disabledAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
}
