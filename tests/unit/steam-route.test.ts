import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/steam/report/route";
import type { ReportData } from "@/lib/report/types";
import type { SteamLookupResponse } from "@/lib/steam/types";

import ownedGamesPrivateFixture from "../fixtures/steam/owned-games-private.json";
import ownedGamesPublicFixture from "../fixtures/steam/owned-games-public.json";
import playerPublicFixture from "../fixtures/steam/player-public.json";

const fixtureSteamId = "76561198000000001";
const apiUrl = "http://localhost/api/steam/report";

function createRequest(body: BodyInit) {
  return new Request(apiUrl, {
    body,
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function jsonRequest(steamIdInput: string) {
  return createRequest(JSON.stringify({ steamIdInput }));
}

function steamJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createSteamFetch(ownedGamesBody: unknown) {
  return vi.fn<typeof fetch>().mockImplementation((request) => {
    const url = new URL(String(request));

    if (url.pathname.includes("/ISteamUser/GetPlayerSummaries/")) {
      return Promise.resolve(steamJsonResponse(playerPublicFixture));
    }

    if (url.pathname.includes("/IPlayerService/GetOwnedGames/")) {
      return Promise.resolve(steamJsonResponse(ownedGamesBody));
    }

    if (url.origin === "https://store.steampowered.com") {
      return Promise.resolve(
        steamJsonResponse({
          41001: {
            success: true,
            data: {
              type: "game",
              genres: [{ description: "动作" }],
              categories: [{ description: "单人" }],
            },
          },
          41002: {
            success: true,
            data: {
              type: "game",
              genres: [{ description: "策略" }],
              categories: [{ description: "多人" }],
            },
          },
          41003: {
            success: true,
            data: {
              type: "game",
              genres: [{ description: "动作" }],
              categories: [{ description: "合作" }],
            },
          },
        }),
      );
    }

    return Promise.resolve(steamJsonResponse({ unexpected: true }, 404));
  });
}

async function readPayload(response: Response) {
  return (await response.json()) as SteamLookupResponse<ReportData>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/steam/report", () => {
  it("rejects malformed JSON before reading configuration", async () => {
    const response = await POST(createRequest("{"));
    const payload = await readPayload(response);

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "INVALID_STEAM_ID", retryable: false },
    });
  });

  it("returns a configuration error when the server API key is absent", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "");

    const response = await POST(jsonRequest(fixtureSteamId));
    const payload = await readPayload(response);

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "CONFIGURATION_ERROR", retryable: false },
    });
  });

  it("returns an analyzed public report without placing the key in URLs", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "route-test-api-key");
    const fetchMock = createSteamFetch(ownedGamesPublicFixture);
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(fixtureSteamId));
    const payload = await readPayload(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(payload).toMatchObject({
      ok: true,
      data: {
        player: { steamId: fixtureSteamId, displayName: "夜航员_01" },
        metrics: {
          totalGameCount: 3,
          playedGameCount: 3,
          lowPlaytimeGameCount: 1,
          totalPlaytimeMinutes: 10_757,
        },
        topGames: [{ appId: 41001 }, { appId: 41002 }, { appId: 41003 }],
        gameMetadata: {
          requestedGameCount: 3,
          resolvedGameCount: 3,
          topGenres: [
            { label: "动作", playtimeMinutes: 9_507 },
            { label: "策略", playtimeMinutes: 1_250 },
          ],
        },
        title: { id: "first-ignition", name: "宇宙刚刚点火" },
        diagnostics: { reportedGameCount: 3, skippedGameCount: 0 },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    fetchMock.mock.calls.slice(0, 2).forEach(([request, init]) => {
      const url = new URL(String(request));
      const headers = new Headers(init?.headers);

      expect(url.origin).toBe("https://api.steampowered.com");
      expect(url.searchParams.has("key")).toBe(false);
      expect(headers.get("x-webapi-key")).toBe("route-test-api-key");
    });
  });

  it("keeps a private library distinct from an empty public library", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "route-test-api-key");
    vi.stubGlobal("fetch", createSteamFetch(ownedGamesPrivateFixture));

    const response = await POST(jsonRequest(fixtureSteamId));
    const payload = await readPayload(response);

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "GAME_DETAILS_PRIVATE", retryable: false },
    });
  });

  it("preserves retry guidance for Steam rate limits", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "route-test-api-key");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(steamJsonResponse({ error: "rate limited" }, 429)),
    );

    const response = await POST(jsonRequest(fixtureSteamId));
    const payload = await readPayload(response);

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "STEAM_RATE_LIMITED", retryable: true },
    });
  });

  it("maps an invalid identity to a stable client-facing error", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "route-test-api-key");

    const response = await POST(jsonRequest("not a supported Steam identity"));
    const payload = await readPayload(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "INVALID_STEAM_ID", retryable: false },
    });
  });
});
