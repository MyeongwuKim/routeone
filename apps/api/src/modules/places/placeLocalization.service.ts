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
const OPENAI_BATCH_SIZE = 40;
const OPENAI_CONCURRENCY = 2;
const ADDRESS_CONCURRENCY = 10;
const DATABASE_CONCURRENCY = 10;
const LOCALIZATION_VERSION = "2026-07-12-v1";
const OVERVIEW_LOCALIZATION_VERSION = "2026-07-12-v1";

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
    },
    required: ["translatedOverview"],
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

async function translateTitleBatch(inputs: TourPlaceLocalizationInput[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const model =
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            "Do not invent House, Restaurant, Cafe, Store, or similar facility words.",
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
  });
  const data = (await response.json()) as ChatCompletionResponse;
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
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
  });
  const data = (await response.json()) as ChatCompletionResponse;
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
    const response = await fetch(
      `https://business.juso.go.kr/addrlink/addrLinkApi.do?${query.toString()}`
    );
    const data = (await response.json()) as JusoSearchResponse;
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
  const missingInputs = inputs.filter((input) => {
    const cached = cachedById.get(input.contentId);
    return !cached || cached.sourceHash !== createSourceHash(input);
  });
  const missingIdSet = new Set(missingInputs.map((input) => input.contentId));
  const fallbackOnlyInputs = inputs.filter((input) => {
    const cached = cachedById.get(input.contentId);
    return (
      !missingIdSet.has(input.contentId) &&
      cached?.addressSource === "SOURCE" &&
      Boolean(input.address)
    );
  });
  const processedIdSet = new Set(missingIdSet);

  if (missingInputs.length > 0) {
    const [titleById, officialAddresses] = await Promise.all([
      translateTitles(missingInputs),
      mapWithConcurrency(missingInputs, ADDRESS_CONCURRENCY, (input) =>
        fetchOfficialEnglishAddress(input.address || "")
      ),
    ]);
    const fallbackAddressById = await translateAddresses(
      missingInputs.filter((_, index) => !officialAddresses[index])
    );

    const storedRows = await mapWithConcurrency(
      missingInputs,
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
            title: translation?.translatedTitle.trim() || input.title,
            address: localizedAddress,
            titleSource: translation?.translatedTitle ? "OPENAI" : "SOURCE",
            addressSource,
          },
          update: {
            sourceTitle: input.title,
            sourceAddress: input.address || null,
            sourceHash: createSourceHash(input),
            title: translation?.translatedTitle.trim() || input.title,
            address: localizedAddress,
            titleSource: translation?.translatedTitle ? "OPENAI" : "SOURCE",
            addressSource,
          },
        });
      }
    );
    storedRows.forEach((row) => cachedById.set(row.externalId, row));
  }

  if (fallbackOnlyInputs.length > 0) {
    const fallbackAddressById = await translateAddresses(fallbackOnlyInputs);
    const updatedRows = await mapWithConcurrency(
      fallbackOnlyInputs,
      DATABASE_CONCURRENCY,
      async (input) => {
        const fallbackAddress = fallbackAddressById
          .get(input.contentId)
          ?.translatedAddress.trim();
        if (!fallbackAddress) {
          return cachedById.get(input.contentId) ?? null;
        }
        processedIdSet.add(input.contentId);
        return prisma.placeLocalization.update({
          where: {
            provider_externalId_locale: {
              provider: "TOUR_API",
              externalId: input.contentId,
              locale: "en",
            },
          },
          data: {
            address: fallbackAddress,
            addressSource: "OPENAI",
          },
        });
      }
    );
    updatedRows.forEach((row) => {
      if (row) {
        cachedById.set(row.externalId, row);
      }
    });
  }

  return inputs.map((input) => {
    const row = cachedById.get(input.contentId);
    return {
      contentId: input.contentId,
      title: row?.title || input.title,
      address: row?.address || input.address || "",
      titleSource: row?.titleSource || "SOURCE",
      addressSource: row?.addressSource || "SOURCE",
      cached: !processedIdSet.has(input.contentId),
    };
  });
}

export async function localizeTourPlaceOverview(
  prisma: PrismaClient,
  rawInput: TourPlaceOverviewLocalizationInput
) {
  const contentId = rawInput.contentId.trim();
  const overview = rawInput.overview.trim();
  if (!contentId) {
    throw new Error("장소 ID가 비어있습니다.");
  }
  if (!overview) {
    return {
      contentId,
      overview: "",
      overviewSource: "SOURCE" as const,
      cached: true,
    };
  }

  const sourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        version: OVERVIEW_LOCALIZATION_VERSION,
        overview,
      })
    )
    .digest("hex");
  const cached = await prisma.placeOverviewLocalization.findUnique({
    where: {
      provider_externalId_locale: {
        provider: "TOUR_API",
        externalId: contentId,
        locale: "en",
      },
    },
  });
  if (cached?.sourceHash === sourceHash) {
    return {
      contentId,
      overview: cached.overview,
      overviewSource: cached.overviewSource,
      cached: true,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }
  const model =
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            "Translate Korean tourism place descriptions into natural, concise English.",
            "Preserve all facts, proper nouns, dates, numbers, and paragraph meaning.",
            "Do not add recommendations, claims, or facts that are absent from the source.",
            "Return only the translated overview in the required JSON structure.",
          ].join(" "),
        },
        {
          role: "user",
          content: overview,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: OVERVIEW_RESPONSE_SCHEMA,
      },
    }),
  });
  const data = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(
      `OpenAI request failed (${response.status}): ${data.error?.message ?? "Unknown error"}`
    );
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 응답에 장소 설명 번역 결과가 없습니다.");
  }
  const parsed = JSON.parse(content) as { translatedOverview?: string };
  const translatedOverview = parsed.translatedOverview?.trim();
  if (!translatedOverview) {
    throw new Error("OpenAI 장소 설명 번역 결과 형식이 올바르지 않습니다.");
  }

  const stored = await prisma.placeOverviewLocalization.upsert({
    where: {
      provider_externalId_locale: {
        provider: "TOUR_API",
        externalId: contentId,
        locale: "en",
      },
    },
    create: {
      provider: "TOUR_API",
      externalId: contentId,
      locale: "en",
      sourceOverview: overview,
      sourceHash,
      overview: translatedOverview,
      overviewSource: "OPENAI",
    },
    update: {
      sourceOverview: overview,
      sourceHash,
      overview: translatedOverview,
      overviewSource: "OPENAI",
    },
  });

  return {
    contentId,
    overview: stored.overview,
    overviewSource: stored.overviewSource,
    cached: false,
  };
}
