import {
  chunk,
  containsSuspiciousLocalization,
  fetchJsonWithTimeout,
  mapWithConcurrency,
  OPENAI_BATCH_SIZE,
  OPENAI_CONCURRENCY,
  OPENAI_REQUEST_TIMEOUT_MS,
} from "./placeLocalization.shared.js";
import type {
  AddressTranslation,
  PlaceOverviewTranslation,
  TitleTranslation,
  TourPlaceLocalizationInput,
  TourPlaceOverviewCacheInput,
} from "./placeLocalization.types.js";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

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

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  return {
    apiKey,
    model:
      process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-5.4-mini",
  };
}

async function requestTranslation(
  messages: Array<{ role: "system" | "user"; content: string }>,
  schema: typeof TITLE_RESPONSE_SCHEMA | typeof ADDRESS_RESPONSE_SCHEMA | typeof OVERVIEW_RESPONSE_SCHEMA
) {
  const { apiKey, model } = getOpenAiConfig();
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
        messages,
        response_format: {
          type: "json_schema",
          json_schema: schema,
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

  return data.choices?.[0]?.message?.content || null;
}

async function translateTitleBatch(inputs: TourPlaceLocalizationInput[]) {
  const content = await requestTranslation(
    [
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
    TITLE_RESPONSE_SCHEMA
  );

  if (!content) {
    throw new Error("OpenAI 응답에 장소명 번역 결과가 없습니다.");
  }

  const parsed = JSON.parse(content) as { translations?: TitleTranslation[] };
  if (!Array.isArray(parsed.translations)) {
    throw new Error("OpenAI 장소명 번역 결과 형식이 올바르지 않습니다.");
  }
  return parsed.translations;
}

export async function translateTitles(inputs: TourPlaceLocalizationInput[]) {
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
  const content = await requestTranslation(
    [
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
    ADDRESS_RESPONSE_SCHEMA
  );

  if (!content) {
    throw new Error("OpenAI 응답에 주소 변환 결과가 없습니다.");
  }

  const parsed = JSON.parse(content) as {
    translations?: AddressTranslation[];
  };
  if (!Array.isArray(parsed.translations)) {
    throw new Error("OpenAI 주소 변환 결과 형식이 올바르지 않습니다.");
  }
  return parsed.translations;
}

export async function translateAddresses(
  inputs: TourPlaceLocalizationInput[]
) {
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

export async function translatePlaceOverview(
  input: TourPlaceOverviewCacheInput
): Promise<PlaceOverviewTranslation> {
  const content = await requestTranslation(
    [
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
    OVERVIEW_RESPONSE_SCHEMA
  );

  if (!content) {
    throw new Error("OpenAI 응답에 장소 설명 번역 결과가 없습니다.");
  }

  const parsed = JSON.parse(content) as Partial<PlaceOverviewTranslation>;
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
    containsSuspiciousLocalization(
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

  return {
    translatedOverview: translatedOverview || "",
    translatedOperatingHours,
    translatedRestDate,
    translatedInfoCenter,
  };
}
