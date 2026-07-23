import type { ZodType } from "zod";

import { SteamGatewayError, toSteamGatewayError } from "./errors";
import {
  type OwnedGamesPayload,
  ownedGamesResponseSchema,
  playerSummariesResponseSchema,
  resolveVanityResponseSchema,
  type SteamPlayerPayload,
} from "./schemas";

const steamWebApiOrigin = "https://api.steampowered.com";
const defaultTimeoutMs = 20_000;
const timeoutRetryDelayMs = 600;

export interface SteamGateway {
  resolveVanity(vanity: string): Promise<string>;
  getPlayerSummary(steamId: string): Promise<SteamPlayerPayload>;
  getOwnedGames(steamId: string): Promise<OwnedGamesPayload>;
}

interface SteamApiClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class SteamApiClient implements SteamGateway {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor({
    apiKey,
    fetchImpl = fetch,
    timeoutMs = defaultTimeoutMs,
  }: SteamApiClientOptions) {
    if (apiKey.trim().length === 0) {
      throw new SteamGatewayError("CONFIGURATION_ERROR");
    }

    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async resolveVanity(vanity: string): Promise<string> {
    const payload = await this.request(
      "/ISteamUser/ResolveVanityURL/v1/",
      { vanityurl: vanity, url_type: "1" },
      resolveVanityResponseSchema,
    );

    if (payload.response.success !== 1 || !payload.response.steamid) {
      throw new SteamGatewayError("INVALID_STEAM_ID");
    }

    return payload.response.steamid;
  }

  async getPlayerSummary(steamId: string): Promise<SteamPlayerPayload> {
    const payload = await this.request(
      "/ISteamUser/GetPlayerSummaries/v2/",
      { steamids: steamId },
      playerSummariesResponseSchema,
    );
    const player = payload.response.players[0];

    if (!player) {
      throw new SteamGatewayError("INVALID_STEAM_ID");
    }

    return player;
  }

  async getOwnedGames(steamId: string): Promise<OwnedGamesPayload> {
    return this.request(
      "/IPlayerService/GetOwnedGames/v1/",
      {
        steamid: steamId,
        include_appinfo: "true",
        include_played_free_games: "true",
      },
      ownedGamesResponseSchema,
    );
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
    schema: ZodType<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.requestOnce(path, query, schema);
      } catch (error) {
        const steamError = toSteamGatewayError(error);

        if (steamError.code !== "STEAM_TIMEOUT" || attempt === 1) {
          throw steamError;
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, timeoutRetryDelayMs);
        });
      }
    }

    throw new SteamGatewayError("STEAM_TIMEOUT");
  }

  private async requestOnce<T>(
    path: string,
    query: Record<string, string>,
    schema: ZodType<T>,
  ): Promise<T> {
    const url = new URL(path, steamWebApiOrigin);
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "x-webapi-key": this.apiKey,
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new SteamGatewayError("STEAM_UNAUTHORIZED");
      }

      if (response.status === 429) {
        throw new SteamGatewayError("STEAM_RATE_LIMITED");
      }

      if (!response.ok) {
        throw new SteamGatewayError("UNKNOWN_UPSTREAM_ERROR");
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        throw new SteamGatewayError("STEAM_BAD_RESPONSE", { cause: error });
      }

      const result = schema.safeParse(body);
      if (!result.success) {
        throw new SteamGatewayError("STEAM_BAD_RESPONSE", {
          cause: result.error,
        });
      }

      return result.data;
    } catch (error) {
      if (timedOut) {
        throw new SteamGatewayError("STEAM_TIMEOUT", { cause: error });
      }

      throw toSteamGatewayError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
