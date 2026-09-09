/**
 * 용도: 고아 이미지 정리 작업에서 Cloudflare Images 목록·상세 조회와 삭제를 요청한다.
 * 동작 방식: Cloudflare에 RouteOne 종류·환경 필터를 보내 해당 목록의 모든 페이지를 읽는다.
 * 파일명과 메타데이터를 함께 반환하고, API 오류는 작업 실패로 넘긴다.
 */
export type CloudflareImage = {
  id: string;
  filename?: string;
  uploaded?: string;
  draft?: boolean;
  meta?: Record<string, unknown>;
};

export type CloudflareImageStore = {
  listImages: (environment: "dev" | "prod") => Promise<CloudflareImage[]>;
  getImage: (id: string) => Promise<CloudflareImage | null>;
  deleteImage: (id: string) => Promise<boolean>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readImage(value: unknown): CloudflareImage {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new Error("Cloudflare returned an image without an ID.");
  }
  const meta = value.meta ?? value.metadata;
  return {
    id: value.id,
    filename: typeof value.filename === "string" ? value.filename : undefined,
    uploaded: typeof value.uploaded === "string" ? value.uploaded : undefined,
    draft: value.draft === true,
    meta: isRecord(meta) ? meta : undefined,
  };
}

export function createCloudflareImageStore({
  accountId,
  token,
  fetchImpl = fetch,
}: {
  accountId: string;
  token: string;
  fetchImpl?: typeof fetch;
}): CloudflareImageStore {
  if (!accountId.trim() || !token.trim()) {
    throw new Error("CF_ACCOUNT and CF_TOKEN are required.");
  }
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/images`;

  async function request(path: string, method = "GET", allowMissing = false) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Cloudflare Images ${method} failed (HTTP ${response.status}).`);
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.result)) {
      throw new Error(`Cloudflare Images ${method} returned an invalid or unsuccessful response.`);
    }
    return payload.result;
  }

  return {
    async listImages(environment) {
      if (environment !== "dev" && environment !== "prod") {
        throw new Error("Cloudflare Images list requires a dev or prod environment.");
      }
      const images = new Map<string, CloudflareImage>();
      const seenTokens = new Set<string>();
      let continuationToken: string | undefined;
      do {
        const query = new URLSearchParams({
          per_page: "1000",
          sort_order: "asc",
          "meta.kind[eq:string]": "route-stop-visit-photo",
          "meta.environment[eq:string]": environment,
        });
        if (continuationToken) query.set("continuation_token", continuationToken);
        const result = await request(`/v2?${query}`);
        if (!result || !Array.isArray(result.images)) {
          throw new Error("Cloudflare Images list is missing images.");
        }
        for (const value of result.images) {
          const image = readImage(value);
          // 중복 페이지에서 같은 ID의 속성이 달라지면 불완전한 목록으로 판단한다.
          const previous = images.get(image.id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(image)) {
            throw new Error("Cloudflare Images list changed during pagination.");
          }
          images.set(image.id, image);
        }
        const next = result.continuation_token;
        if (next != null && typeof next !== "string") {
          throw new Error("Cloudflare Images returned an invalid continuation token.");
        }
        continuationToken = next || undefined;
        if (continuationToken) {
          if (seenTokens.has(continuationToken)) {
            throw new Error("Cloudflare Images pagination repeated a continuation token.");
          }
          seenTokens.add(continuationToken);
        }
      } while (continuationToken);
      return [...images.values()];
    },
    async getImage(id) {
      const result = await request(`/v1/${encodeURIComponent(id)}`, "GET", true);
      if (!result) return null;
      const image = readImage(result);
      if (image.id !== id) throw new Error("Cloudflare Images returned a different image ID.");
      return image;
    },
    async deleteImage(id) {
      return (await request(`/v1/${encodeURIComponent(id)}`, "DELETE", true)) !== null;
    },
  };
}
