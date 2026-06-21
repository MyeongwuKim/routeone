export type PlaceDuplicateSource = {
  id?: string | null;
  contentId?: string | null;
  contentTypeId?: string | null;
  title?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function normalizeText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function coordinateKey(value?: number | null) {
  return Number.isFinite(value) ? Number(value).toFixed(5) : "";
}

export function getPlaceDuplicateKeys(place: PlaceDuplicateSource) {
  const keys = new Set<string>();
  const id = normalizeText(place.id);
  const contentId = normalizeText(place.contentId);
  const contentTypeId = normalizeText(place.contentTypeId);
  const title = normalizeText(place.title);
  const address = normalizeText(place.address);
  const lat = coordinateKey(place.lat);
  const lng = coordinateKey(place.lng);

  if (id) {
    keys.add(`id:${id}`);
  }

  if (contentId) {
    keys.add(`content:${contentTypeId}:${contentId}`);
  }

  if (title && address) {
    keys.add(`text:${title}|${address}`);
  }

  if (title && lat && lng) {
    keys.add(`geo:${title}|${lat}|${lng}`);
  }

  return [...keys];
}

export function createPlaceDuplicateKeySet(places: PlaceDuplicateSource[]) {
  return new Set(places.flatMap((place) => getPlaceDuplicateKeys(place)));
}

export function hasDuplicatePlace(
  place: PlaceDuplicateSource,
  duplicateKeys: Set<string>
) {
  return getPlaceDuplicateKeys(place).some((key) => duplicateKeys.has(key));
}

export function isSamePlaceDuplicate(
  left: PlaceDuplicateSource,
  right: PlaceDuplicateSource
) {
  const rightKeys = new Set(getPlaceDuplicateKeys(right));
  return hasDuplicatePlace(left, rightKeys);
}
