import {
  PushPlatform,
  UserNotificationPushStatus,
  UserNotificationType,
  type PrismaClient,
  type User,
} from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";

export const GANGWON_REGION_BY_CODE = {
  "1": "강릉",
  "2": "고성",
  "3": "동해",
  "4": "삼척",
  "5": "속초",
  "6": "양구",
  "7": "양양",
  "8": "영월",
  "9": "원주",
  "10": "인제",
  "11": "정선",
  "12": "철원",
  "13": "춘천",
  "14": "태백",
  "15": "평창",
  "16": "홍천",
  "17": "화천",
  "18": "횡성",
} as const;

const GANGWON_REGION_CODES = new Set(Object.keys(GANGWON_REGION_BY_CODE));
const MAX_FESTIVAL_REGION_COUNT = 2;
const EXPO_PUSH_TOKEN_PATTERN =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export type UpdateNotificationSettingsInput = {
  festivalEnabled?: boolean | null;
  festivalRegionCodes?: string[] | null;
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
    ...new Set(regionCodes.map((regionCode) => regionCode.trim())),
  ];

  if (
    normalized.length > MAX_FESTIVAL_REGION_COUNT ||
    normalized.some((regionCode) => !GANGWON_REGION_CODES.has(regionCode))
  ) {
    throw new UserFacingError("축제 알림 지역은 강원 지역 중 최대 2곳까지 선택할 수 있습니다.");
  }

  return normalized;
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
          routeArrivalEnabled:
            input.routeArrivalEnabled ?? current.routeArrivalEnabled,
        },
      });

    if (shouldResetFestivalEvaluation) {
      await transaction.userNotification.updateMany({
        where: {
          userId: user.id,
          type: UserNotificationType.FESTIVAL_SUMMARY,
          pushStatus: {
            in: [
              UserNotificationPushStatus.PENDING,
              UserNotificationPushStatus.FAILED,
            ],
          },
          NOT: {
            notificationKey: {
              startsWith: "festival:test:",
            },
          },
        },
        data: {
          pushStatus: UserNotificationPushStatus.CANCELED,
          nextPushAttemptAt: null,
          pushError: "축제 알림 설정이 변경되어 다시 계산합니다.",
        },
      });
    }

    return updatedSetting;
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
