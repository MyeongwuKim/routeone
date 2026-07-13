import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type TourPlaceLocalizationInput = {
  contentId: string;
  contentTypeId?: string | null;
  title: string;
  address?: string | null;
};

export type TourPlaceOverviewLocalizationInput = {
  contentId: string;
  overview: string;
  operatingHours?: string | null;
  restDate?: string | null;
  infoCenter?: string | null;
};

type TourPlaceOverviewCacheInput = {
  contentId: string;
  overview: string;
  operatingHours: string;
  restDate: string;
  infoCenter: string;
  sourceHash: string;
};

export type TourCategoryLocalizationInput = {
  code: string;
  locale: string;
  label: string;
  sourceLabel?: string | null;
};

type TitleTranslation = {
  id: string;
  translatedTitle: string;
};

type AddressTranslation = {
  id: string;
  translatedAddress: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

type JusoSearchResponse = {
  results?: {
    common?: { errorCode?: string; errorMessage?: string };
    juso?:
      | Array<{
          roadAddr?: string;
          roadAddrPart1?: string;
          jibunAddr?: string;
          engAddr?: string;
        }>
      | string;
  };
};

const MAX_LOCALIZATION_BATCH_SIZE = 600;
const MAX_CATEGORY_LOCALIZATION_BATCH_SIZE = 2000;
const OPENAI_BATCH_SIZE = 40;
const OPENAI_CONCURRENCY = 2;
const ADDRESS_CONCURRENCY = 10;
const DATABASE_CONCURRENCY = 10;
const OPENAI_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv(
  "OPENAI_TRANSLATION_TIMEOUT_MS",
  20_000
);
const JUSO_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv(
  "JUSO_ADDRESS_TIMEOUT_MS",
  4_000
);
const LOCALIZATION_VERSION = "2026-07-13-v2";
const OVERVIEW_LOCALIZATION_VERSION = "2026-07-13-v3";
const TITLE_LOCALIZATION_OVERRIDES: Record<string, string> = {
  도직해변: "Dojik Beach",
};
const SUSPICIOUS_LOCALIZATION_PATTERN =
  /\b(?:noname|no\s*name|visit\s+to|catch\s+nonamei)\b/iu;
const refreshingPlaceLocalizationKeys = new Set<string>();
const refreshingOverviewLocalizationKeys = new Set<string>();

const TITLE_RESPONSE_SCHEMA = {
  name: "tour_place_title_localization",
  strict: true,
  schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            translatedTitle: { type: "string" },
          },
          required: ["id", "translatedTitle"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  },
} as const;

const ADDRESS_RESPONSE_SCHEMA = {
  name: "tour_place_address_localization",
  strict: true,
  schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            translatedAddress: { type: "string" },
          },
          required: ["id", "translatedAddress"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  },
} as const;

const OVERVIEW_RESPONSE_SCHEMA = {
  name: "tour_place_overview_localization",
  strict: true,
  schema: {
    type: "object",
    properties: {
      translatedOverview: { type: "string" },
      translatedOperatingHours: { type: "string" },
      translatedRestDate: { type: "string" },
      translatedInfoCenter: { type: "string" },
    },
    required: [
      "translatedOverview",
      "translatedOperatingHours",
      "translatedRestDate",
      "translatedInfoCenter",
    ],
    additionalProperties: false,
  },
} as const;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsedValue = Number(process.env[name]);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.floor(parsedValue)
    : fallback;
}

async function fetchJsonWithTimeout<TResponse>(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...(init ?? {}),
      signal: controller.signal,
    });
    const data = (await response.json()) as TResponse;

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function cleanAddressKeyword(address: string) {
  return address
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeAddressForMatch(address: string) {
  return cleanAddressKeyword(address).replace(/[\s,]/gu, "");
}

function createSourceHash(input: TourPlaceLocalizationInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: LOCALIZATION_VERSION,
        title: input.title.trim(),
        address: input.address?.trim() || "",
        contentTypeId: input.contentTypeId || "",
      })
    )
    .digest("hex");
}

function resolveLocalizedTitle(
  input: TourPlaceLocalizationInput,
  translatedTitle?: string
) {
  const overrideTitle = TITLE_LOCALIZATION_OVERRIDES[input.title.trim()];

  if (overrideTitle) {
    return {
      title: overrideTitle,
      source: "OVERRIDE" as const,
    };
  }

  const normalizedTranslatedTitle = translatedTitle?.trim();

  if (
    !normalizedTranslatedTitle ||
    SUSPICIOUS_LOCALIZATION_PATTERN.test(normalizedTranslatedTitle)
  ) {
    return {
      title: input.title,
      source: "SOURCE" as const,
    };
  }

  return {
    title: normalizedTranslatedTitle,
    source: "OPENAI" as const,
  };
}

function normalizeLocale(locale: string) {
  return locale.trim().toLowerCase();
}

export async function getTourCategoryLocalizations(
  prisma: PrismaClient,
  locale: string
) {
  const normalizedLocale = normalizeLocale(locale);
  if (!normalizedLocale) {
    return [];
  }

  const rows = await prisma.tourCategoryLocalization.findMany({
    where: {
      provider: "TOUR_API",
      locale: normalizedLocale,
    },
    orderBy: {
      code: "asc",
    },
  });

  return rows.map((row) => ({
    code: row.code,
    locale: row.locale,
    label: row.label,
    sourceLabel: row.sourceLabel ?? "",
    cached: true,
  }));
}

export async function cacheTourCategoryLocalizations(
  prisma: PrismaClient,
  rawInputs: TourCategoryLocalizationInput[]
) {
  const inputByKey = new Map<string, TourCategoryLocalizationInput>();
  rawInputs.forEach((input) => {
    const code = input.code.trim();
    const locale = normalizeLocale(input.locale);
    const label = input.label.trim();

    if (!code || !locale || !label) {
      return;
    }

    inputByKey.set(`${locale}:${code}`, {
      code,
      locale,
      label,
      sourceLabel: input.sourceLabel?.trim() || null,
    });
  });

  const inputs = [...inputByKey.values()];
  if (inputs.length > MAX_CATEGORY_LOCALIZATION_BATCH_SIZE) {
    throw new Error(
      `한 번에 최대 ${MAX_CATEGORY_LOCALIZATION_BATCH_SIZE}개 분류 라벨을 처리할 수 있습니다.`
    );
  }

  if (inputs.length === 0) {
    return [];
  }

  const storedRows = await mapWithConcurrency(
    inputs,
    DATABASE_CONCURRENCY,
    (input) =>
      prisma.tourCategoryLocalization.upsert({
        where: {
          provider_code_locale: {
            provider: "TOUR_API",
            code: input.code,
            locale: input.locale,
          },
        },
        create: {
          provider: "TOUR_API",
          code: input.code,
          locale: input.locale,
          label: input.label,
          sourceLabel: input.sourceLabel || null,
        },
        update: {
          label: input.label,
          sourceLabel: input.sourceLabel || null,
        },
      })
  );

  return storedRows.map((row) => ({
    code: row.code,
    locale: row.locale,
    label: row.label,
    sourceLabel: row.sourceLabel ?? "",
    cached: false,
  }));
}

async function translateTitleBatch(inputs: TourPlaceLocalizationInput[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const model =
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  const { response, data } = await fetchJsonWithTimeout<ChatCompletionResponse>(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "Translate Korean tourism place names into concise, natural English display names.",
              "Treat restaurants, cafes, and brands as proper nouns and prefer transliteration.",
              "For Korean place names ending in facility nouns, transliterate the name stem and translate only the facility noun: 해변/해수욕장=Beach, 공원=Park, 항구=Port, 시장=Market, 박물관=Museum.",
              "Do not invent House, Restaurant, Cafe, Store, or similar facility words.",
              "Do not translate a place name as an action phrase such as Visit to, Catch, Go to, or similar.",
              "Never output placeholders or unknown-name words such as noname, no name, unnamed, or N/A.",
              "Translate descriptive public-place nouns such as beach, park, museum, market, port, tunnel, and village.",
              "Preserve established Korean romanization where possible and never add facts.",
              "Return one result for every input id in the same order.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(
              inputs.map(({ contentId, contentTypeId, title }) => ({
                id: contentId,
                contentTypeId: contentTypeId || "",
                title,
              }))
            ),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: TITLE_RESPONSE_SCHEMA,
        },
      }),
    },
    OPENAI_REQUEST_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(
      `OpenAI request failed (${response.status}): ${data.error?.message ?? "Unknown error"}`
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 응답에 장소명 번역 결과가 없습니다.");
  }

  const parsed = JSON.parse(content) as { translations?: TitleTranslation[] };
  if (!Array.isArray(parsed.translations)) {
    throw new Error("OpenAI 장소명 번역 결과 형식이 올바르지 않습니다.");
  }
  return parsed.translations;
}

async function translateTitles(inputs: TourPlaceLocalizationInput[]) {
  const batches = chunk(inputs, OPENAI_BATCH_SIZE);
  const translatedBatches = await mapWithConcurrency(
    batches,
    OPENAI_CONCURRENCY,
    translateTitleBatch
  );
  return new Map(
    translatedBatches.flat().map((translation) => [translation.id, translation])
  );
}

async function translateAddressBatch(inputs: TourPlaceLocalizationInput[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const model =
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  const { response, data } = await fetchJsonWithTimeout<ChatCompletionResponse>(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "Convert Korean addresses into conventional English address order using Korean romanization.",
              "Preserve every number and every administrative unit from the source.",
              "Never invent a road name, building number, postal code, or missing location detail.",
              "Use standard suffixes such as -do, -si, -gun, -gu, -eup, -myeon, -dong, and -ri.",
              "Return one result for every input id in the same order.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(
              inputs.map(({ contentId, address }) => ({
                id: contentId,
                address: address || "",
              }))
            ),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: ADDRESS_RESPONSE_SCHEMA,
        },
      }),
    },
    OPENAI_REQUEST_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(
      `OpenAI request failed (${response.status}): ${data.error?.message ?? "Unknown error"}`
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 응답에 주소 변환 결과가 없습니다.");
  }
  const parsed = JSON.parse(content) as { translations?: AddressTranslation[] };
  if (!Array.isArray(parsed.translations)) {
    throw new Error("OpenAI 주소 변환 결과 형식이 올바르지 않습니다.");
  }
  return parsed.translations;
}

async function translateAddresses(inputs: TourPlaceLocalizationInput[]) {
  const addressInputs = inputs.filter((input) => input.address?.trim());
  if (addressInputs.length === 0) {
    return new Map<string, AddressTranslation>();
  }
  const batches = chunk(addressInputs, OPENAI_BATCH_SIZE);
  const translatedBatches = await mapWithConcurrency(
    batches,
    OPENAI_CONCURRENCY,
    translateAddressBatch
  );
  const translationById = new Map(
    translatedBatches.flat().map((translation) => [translation.id, translation])
  );
  const missingInputs = addressInputs.filter(
    (input) => !translationById.has(input.contentId)
  );
  if (missingInputs.length > 0) {
    const retryBatches = chunk(missingInputs, OPENAI_BATCH_SIZE);
    const retryResults = await mapWithConcurrency(
      retryBatches,
      OPENAI_CONCURRENCY,
      translateAddressBatch
    );
    retryResults.flat().forEach((translation) => {
      translationById.set(translation.id, translation);
    });
  }
  return translationById;
}

async function fetchOfficialEnglishAddress(address: string) {
  const apiKey = process.env.JUSO_API_KEY?.trim();
  const keyword = cleanAddressKeyword(address);
  if (!apiKey || !keyword) {
    return null;
  }

  try {
    const query = new URLSearchParams({
      confmKey: apiKey,
      currentPage: "1",
      countPerPage: "10",
      keyword,
      resultType: "json",
    });
    const { response, data } = await fetchJsonWithTimeout<JusoSearchResponse>(
      `https://business.juso.go.kr/addrlink/addrLinkApi.do?${query.toString()}`,
      undefined,
      JUSO_REQUEST_TIMEOUT_MS
    );
    if (!response.ok || data.results?.common?.errorCode !== "0") {
      return null;
    }

    const rawItems = data.results?.juso;
    const items = Array.isArray(rawItems) ? rawItems : [];
    const normalizedKeyword = normalizeAddressForMatch(keyword);
    const exactMatch = items.find((item) =>
      [item.roadAddrPart1, item.roadAddr, item.jibunAddr].some(
        (candidate) =>
          candidate && normalizeAddressForMatch(candidate) === normalizedKeyword
      )
    );
    const uniqueNumberedMatch =
      /\d/u.test(keyword) && items.length === 1 ? items[0] : undefined;

    return (exactMatch || uniqueNumberedMatch)?.engAddr?.trim() || null;
  } catch {
    return null;
  }
}

async function storeTourPlaceLocalizations(
  prisma: PrismaClient,
  inputs: TourPlaceLocalizationInput[]
) {
  if (inputs.length === 0) {
    return;
  }

  const [titleById, officialAddresses] = await Promise.all([
    translateTitles(inputs),
    mapWithConcurrency(inputs, ADDRESS_CONCURRENCY, (input) =>
      fetchOfficialEnglishAddress(input.address || "")
    ),
  ]);
  const fallbackAddressById = await translateAddresses(
    inputs.filter((_, index) => !officialAddresses[index])
  );

  await mapWithConcurrency(
    inputs,
    DATABASE_CONCURRENCY,
    (input, index) => {
      const translation = titleById.get(input.contentId);
      const officialAddress = officialAddresses[index];
      const fallbackAddress = fallbackAddressById
        .get(input.contentId)
        ?.translatedAddress.trim();
      const localizedAddress =
        officialAddress || fallbackAddress || input.address || null;
      const addressSource = officialAddress
        ? "JUSO"
        : fallbackAddress
          ? "OPENAI"
          : "SOURCE";
      const localizedTitle = resolveLocalizedTitle(
        input,
        translation?.translatedTitle
      );
      return prisma.placeLocalization.upsert({
        where: {
          provider_externalId_locale: {
            provider: "TOUR_API",
            externalId: input.contentId,
            locale: "en",
          },
        },
        create: {
          provider: "TOUR_API",
          externalId: input.contentId,
          locale: "en",
          sourceTitle: input.title,
          sourceAddress: input.address || null,
          sourceHash: createSourceHash(input),
          title: localizedTitle.title,
          address: localizedAddress,
          titleSource: localizedTitle.source,
          addressSource,
        },
        update: {
          sourceTitle: input.title,
          sourceAddress: input.address || null,
          sourceHash: createSourceHash(input),
          title: localizedTitle.title,
          address: localizedAddress,
          titleSource: localizedTitle.source,
          addressSource,
        },
      });
    }
  );
}

function refreshTourPlaceLocalizationsInBackground(
  prisma: PrismaClient,
  inputs: TourPlaceLocalizationInput[]
) {
  const refreshInputs = inputs.filter((input) => {
    const key = `${input.contentId}:${createSourceHash(input)}`;
    if (refreshingPlaceLocalizationKeys.has(key)) {
      return false;
    }
    refreshingPlaceLocalizationKeys.add(key);
    return true;
  });

  if (refreshInputs.length === 0) {
    return;
  }

  void storeTourPlaceLocalizations(prisma, refreshInputs)
    .catch((error) => {
      console.warn("장소 영문 현지화 캐시 갱신에 실패했습니다.", error);
    })
    .finally(() => {
      refreshInputs.forEach((input) => {
        refreshingPlaceLocalizationKeys.delete(
          `${input.contentId}:${createSourceHash(input)}`
        );
      });
    });
}

export async function localizeTourPlaces(
  prisma: PrismaClient,
  rawInputs: TourPlaceLocalizationInput[]
) {
  const inputById = new Map<string, TourPlaceLocalizationInput>();
  rawInputs.forEach((input) => {
    const contentId = input.contentId.trim();
    const title = input.title.trim();
    if (contentId && title && !inputById.has(contentId)) {
      inputById.set(contentId, {
        ...input,
        contentId,
        title,
        address: input.address?.trim() || "",
      });
    }
  });
  const inputs = [...inputById.values()];
  if (inputs.length > MAX_LOCALIZATION_BATCH_SIZE) {
    throw new Error(`한 번에 최대 ${MAX_LOCALIZATION_BATCH_SIZE}개 장소를 처리할 수 있습니다.`);
  }
  if (inputs.length === 0) {
    return [];
  }

  const cachedRows = await prisma.placeLocalization.findMany({
    where: {
      provider: "TOUR_API",
      locale: "en",
      externalId: { in: inputs.map((input) => input.contentId) },
    },
  });
  const cachedById = new Map(cachedRows.map((row) => [row.externalId, row]));
  const refreshInputs = inputs.filter((input) => {
    const cached = cachedById.get(input.contentId);
    return (
      !cached ||
      cached.sourceHash !== createSourceHash(input) ||
      (cached.addressSource === "SOURCE" && Boolean(input.address))
    );
  });

  refreshTourPlaceLocalizationsInBackground(prisma, refreshInputs);

  return inputs.map((input) => {
    const row = cachedById.get(input.contentId);
    return {
      contentId: input.contentId,
      title: row?.title || input.title,
      address: row?.address || input.address || "",
      titleSource: row?.titleSource || "SOURCE",
      addressSource: row?.addressSource || "SOURCE",
      cached: Boolean(row),
    };
  });
}

async function storeTourPlaceOverviewLocalization(
  prisma: PrismaClient,
  input: TourPlaceOverviewCacheInput
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }
  const model =
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  const { response, data } = await fetchJsonWithTimeout<ChatCompletionResponse>(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "Translate Korean tourism place details into natural, concise English.",
              "Translate overview, operating hours, closed days, and contact information independently.",
              "Preserve all facts, proper nouns, dates, seasons, weekdays, times, phone numbers, and paragraph meaning.",
              "Keep time ranges compact and preserve summer/winter distinctions.",
              "Return an empty string when the corresponding source field is empty.",
              "For Korean place names ending in facility nouns, transliterate the name stem and translate only the facility noun, such as 도직해변 -> Dojik Beach.",
              "Do not add recommendations, claims, or facts that are absent from the source.",
              "Do not translate place names into action phrases such as Visit to, Catch, Go to, or similar.",
              "Never output placeholders or unknown-name words such as noname, no name, unnamed, or N/A.",
              "Return every translated field in the required JSON structure.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              overview: input.overview,
              operatingHours: input.operatingHours,
              restDate: input.restDate,
              infoCenter: input.infoCenter,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: OVERVIEW_RESPONSE_SCHEMA,
        },
      }),
    },
    OPENAI_REQUEST_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(
      `OpenAI request failed (${response.status}): ${data.error?.message ?? "Unknown error"}`
    );
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 응답에 장소 설명 번역 결과가 없습니다.");
  }
  const parsed = JSON.parse(content) as {
    translatedOverview?: string;
    translatedOperatingHours?: string;
    translatedRestDate?: string;
    translatedInfoCenter?: string;
  };
  const translatedOverview = parsed.translatedOverview?.trim();
  const translatedOperatingHours =
    parsed.translatedOperatingHours?.trim() ?? "";
  const translatedRestDate = parsed.translatedRestDate?.trim() ?? "";
  const translatedInfoCenter = parsed.translatedInfoCenter?.trim() ?? "";
  if (input.overview && !translatedOverview) {
    throw new Error("OpenAI 장소 설명 번역 결과 형식이 올바르지 않습니다.");
  }
  if (input.operatingHours && !translatedOperatingHours) {
    throw new Error("OpenAI 운영시간 번역 결과 형식이 올바르지 않습니다.");
  }
  if (input.restDate && !translatedRestDate) {
    throw new Error("OpenAI 휴무일 번역 결과 형식이 올바르지 않습니다.");
  }
  if (input.infoCenter && !translatedInfoCenter) {
    throw new Error("OpenAI 문의 정보 번역 결과 형식이 올바르지 않습니다.");
  }
  if (
    SUSPICIOUS_LOCALIZATION_PATTERN.test(
      [
        translatedOverview,
        translatedOperatingHours,
        translatedRestDate,
        translatedInfoCenter,
      ].join(" ")
    )
  ) {
    throw new Error("OpenAI 장소 상세 번역에 의심스러운 placeholder가 포함되었습니다.");
  }

  return prisma.placeOverviewLocalization.upsert({
    where: {
      provider_externalId_locale: {
        provider: "TOUR_API",
        externalId: input.contentId,
        locale: "en",
      },
    },
    create: {
      provider: "TOUR_API",
      externalId: input.contentId,
      locale: "en",
      sourceOverview: input.overview,
      sourceOperatingHours: input.operatingHours || null,
      sourceRestDate: input.restDate || null,
      sourceInfoCenter: input.infoCenter || null,
      sourceHash: input.sourceHash,
      overview: translatedOverview || "",
      operatingHours: translatedOperatingHours || null,
      restDate: translatedRestDate || null,
      infoCenter: translatedInfoCenter || null,
      overviewSource: "OPENAI",
    },
    update: {
      sourceOverview: input.overview,
      sourceOperatingHours: input.operatingHours || null,
      sourceRestDate: input.restDate || null,
      sourceInfoCenter: input.infoCenter || null,
      sourceHash: input.sourceHash,
      overview: translatedOverview || "",
      operatingHours: translatedOperatingHours || null,
      restDate: translatedRestDate || null,
      infoCenter: translatedInfoCenter || null,
      overviewSource: "OPENAI",
    },
  });
}

function refreshTourPlaceOverviewInBackground(
  prisma: PrismaClient,
  input: TourPlaceOverviewCacheInput
) {
  const key = `${input.contentId}:${input.sourceHash}`;
  if (refreshingOverviewLocalizationKeys.has(key)) {
    return;
  }

  refreshingOverviewLocalizationKeys.add(key);
  void storeTourPlaceOverviewLocalization(prisma, input)
    .catch((error) => {
      console.warn("장소 설명 영문 현지화 캐시 갱신에 실패했습니다.", error);
    })
    .finally(() => {
      refreshingOverviewLocalizationKeys.delete(key);
    });
}

export async function localizeTourPlaceOverview(
  prisma: PrismaClient,
  rawInput: TourPlaceOverviewLocalizationInput
) {
  const contentId = rawInput.contentId.trim();
  const overview = rawInput.overview.trim();
  const operatingHours = rawInput.operatingHours?.trim() || "";
  const restDate = rawInput.restDate?.trim() || "";
  const infoCenter = rawInput.infoCenter?.trim() || "";
  if (!contentId) {
    throw new Error("장소 ID가 비어있습니다.");
  }
  if (!overview && !operatingHours && !restDate && !infoCenter) {
    return {
      contentId,
      overview: "",
      operatingHours: "",
      restDate: "",
      infoCenter: "",
      overviewSource: "SOURCE" as const,
      cached: true,
    };
  }

  const sourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        version: OVERVIEW_LOCALIZATION_VERSION,
        overview,
        operatingHours,
        restDate,
        infoCenter,
      })
    )
    .digest("hex");
  const cacheInput: TourPlaceOverviewCacheInput = {
    contentId,
    overview,
    operatingHours,
    restDate,
    infoCenter,
    sourceHash,
  };
  const cached = await prisma.placeOverviewLocalization.findUnique({
    where: {
      provider_externalId_locale: {
        provider: "TOUR_API",
        externalId: contentId,
        locale: "en",
      },
    },
  });

  if (cached) {
    if (cached.sourceHash !== sourceHash) {
      const isMissingRequestedDetail =
        (overview && !cached.overview) ||
        (operatingHours && !cached.operatingHours) ||
        (restDate && !cached.restDate) ||
        (infoCenter && !cached.infoCenter);

      if (isMissingRequestedDetail) {
        const stored = await storeTourPlaceOverviewLocalization(
          prisma,
          cacheInput
        );

        return {
          contentId,
          overview: stored.overview,
          operatingHours: stored.operatingHours ?? "",
          restDate: stored.restDate ?? "",
          infoCenter: stored.infoCenter ?? "",
          overviewSource: stored.overviewSource,
          cached: false,
        };
      }

      refreshTourPlaceOverviewInBackground(prisma, cacheInput);
    }

    return {
      contentId,
      overview: cached.overview,
      operatingHours: cached.operatingHours ?? "",
      restDate: cached.restDate ?? "",
      infoCenter: cached.infoCenter ?? "",
      overviewSource: cached.overviewSource,
      cached: true,
    };
  }

  const stored = await storeTourPlaceOverviewLocalization(prisma, cacheInput);

  return {
    contentId,
    overview: stored.overview,
    operatingHours: stored.operatingHours ?? "",
    restDate: stored.restDate ?? "",
    infoCenter: stored.infoCenter ?? "",
    overviewSource: stored.overviewSource,
    cached: false,
  };
}
