import { z } from "zod";

import type { SteamGame } from "./types";

const steamStoreOrigin = "https://store.steampowered.com";
const defaultTimeoutMs = 6_000;
const defaultCacheTtlMs = 12 * 60 * 60 * 1_000;
const storeRequestConcurrency = 5;

const storeLabelSchema = z
  .object({
    description: z.string().min(1),
  })
  .passthrough();

const storeAppSchema = z
  .object({
    type: z.string().optional(),
    genres: z.array(storeLabelSchema).optional(),
    categories: z.array(storeLabelSchema).optional(),
    developers: z.array(z.string()).optional(),
    header_image: z.string().url().optional(),
    publishers: z.array(z.string()).optional(),
    short_description: z.string().optional(),
  })
  .passthrough();

const storeAppDetailsSchema = z.record(
  z.string(),
  z
    .object({
      success: z.boolean(),
      data: storeAppSchema.optional(),
    })
    .passthrough(),
);

export type SteamStoreGameMode = "single-player" | "multiplayer" | "co-op";

export interface SteamStoreGameMetadata {
  appId: number;
  appType: string | null;
  genres: string[];
  headerImageUrl: string | null;
  modes: SteamStoreGameMode[];
  developers: string[];
  publishers: string[];
  shortDescription: string | null;
}

interface CacheEntry {
  expiresAt: number;
  metadata: SteamStoreGameMetadata;
}

const metadataCache = new Map<string, CacheEntry>();

export interface SteamStoreMetadataGateway {
  getGameMetadata(games: SteamGame[]): Promise<SteamStoreGameMetadata[]>;
}

interface SteamStoreMetadataClientOptions {
  countryCode?: string;
  fetchImpl?: typeof fetch;
  language?: string;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cache?: Map<string, CacheEntry>;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeCategory(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[\s_/-]+/gu, "");
}

function categoryContains(normalizedCategories: string[], terms: string[]) {
  return normalizedCategories.some((category) =>
    terms.some((term) => category.includes(term)),
  );
}

function getModes(categories: string[]): SteamStoreGameMode[] {
  const normalizedCategories = categories.map(normalizeCategory);
  const modes: SteamStoreGameMode[] = [];

  if (categoryContains(normalizedCategories, ["单人", "singleplayer"])) {
    modes.push("single-player");
  }

  if (
    categoryContains(normalizedCategories, [
      "多人",
      "multiplayer",
      "onlinepvp",
      "localpvp",
      "pvp",
      "对战",
    ])
  ) {
    modes.push("multiplayer");
  }

  if (categoryContains(normalizedCategories, ["合作", "coop", "cooperative"])) {
    modes.push("co-op");
    if (!modes.includes("multiplayer")) {
      modes.push("multiplayer");
    }
  }

  return modes;
}

function toMetadata(
  appId: number,
  data: z.infer<typeof storeAppSchema>,
): SteamStoreGameMetadata {
  const categories = uniqueStrings(
    (data.categories ?? []).map((category) => category.description),
  );

  return {
    appId,
    appType: data.type ?? null,
    headerImageUrl: data.header_image ?? null,
    genres: uniqueStrings(
      (data.genres ?? []).map((genre) => genre.description),
    ),
    modes: getModes(categories),
    developers: uniqueStrings(data.developers ?? []),
    publishers: uniqueStrings(data.publishers ?? []),
    shortDescription: data.short_description ?? null,
  };
}

/**
 * Reads public Store page metadata for a small, playtime-ranked app set. It is
 * deliberately independent from the authenticated Steam Web API: a Store
 * outage or an unsupported app must never prevent the base report from loading.
 */
export class SteamStoreMetadataClient implements SteamStoreMetadataGateway {
  private readonly cache: Map<string, CacheEntry>;
  private readonly cacheTtlMs: number;
  private readonly countryCode: string;
  private readonly fetchImpl: typeof fetch;
  private readonly language: string;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  constructor({
    cache = metadataCache,
    cacheTtlMs = defaultCacheTtlMs,
    countryCode = process.env.STEAM_STORE_COUNTRY_CODE ?? "cn",
    fetchImpl = fetch,
    language = process.env.STEAM_STORE_LANGUAGE ?? "schinese",
    now = Date.now,
    timeoutMs = defaultTimeoutMs,
  }: SteamStoreMetadataClientOptions = {}) {
    this.cache = cache;
    this.cacheTtlMs = cacheTtlMs;
    this.countryCode = countryCode;
    this.fetchImpl = fetchImpl;
    this.language = language;
    this.now = now;
    this.timeoutMs = timeoutMs;
  }

  async getGameMetadata(games: SteamGame[]): Promise<SteamStoreGameMetadata[]> {
    const appIds = [...new Set(games.map((game) => game.appId))];
    const now = this.now();
    const cached = new Map<number, SteamStoreGameMetadata>();
    const missingAppIds: number[] = [];

    appIds.forEach((appId) => {
      const entry = this.cache.get(this.getCacheKey(appId));
      if (entry && entry.expiresAt > now) {
        cached.set(appId, entry.metadata);
      } else {
        missingAppIds.push(appId);
      }
    });

    if (missingAppIds.length > 0) {
      const fetched = await this.fetchMissingMetadata(missingAppIds);
      fetched.forEach((metadata) => {
        cached.set(metadata.appId, metadata);
        this.cache.set(this.getCacheKey(metadata.appId), {
          expiresAt: now + this.cacheTtlMs,
          metadata,
        });
      });
    }

    return appIds.flatMap((appId) => {
      const metadata = cached.get(appId);
      return metadata ? [metadata] : [];
    });
  }

  private getCacheKey(appId: number) {
    return `${this.countryCode}:${this.language}:${appId}`;
  }

  private async fetchMissingMetadata(appIds: number[]) {
    const metadata: SteamStoreGameMetadata[] = [];

    for (
      let index = 0;
      index < appIds.length;
      index += storeRequestConcurrency
    ) {
      const group = appIds.slice(index, index + storeRequestConcurrency);
      const results = await Promise.all(
        group.map((appId) => this.fetchSingleMetadata(appId)),
      );
      metadata.push(...results.flatMap((result) => (result ? [result] : [])));
    }

    return metadata;
  }

  private async fetchSingleMetadata(appId: number) {
    const url = new URL("/api/appdetails", steamStoreOrigin);
    url.searchParams.set("appids", String(appId));
    url.searchParams.set("cc", this.countryCode);
    url.searchParams.set("l", this.language);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        cache: "force-cache",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const parsed = storeAppDetailsSchema.safeParse(await response.json());
      if (!parsed.success) {
        return null;
      }

      const item = parsed.data[String(appId)];
      return item?.success && item.data ? toMetadata(appId, item.data) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
