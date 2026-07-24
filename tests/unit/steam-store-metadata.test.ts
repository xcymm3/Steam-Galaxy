import { describe, expect, it, vi } from "vitest";

import { SteamStoreMetadataClient } from "@/lib/steam/store-metadata";
import type { SteamGame } from "@/lib/steam/types";

const games: SteamGame[] = [
  {
    appId: 730,
    iconHash: null,
    lastPlayedAt: null,
    name: "Counter-Strike 2",
    playtimeMinutes: 600,
  },
  {
    appId: 620,
    iconHash: null,
    lastPlayedAt: null,
    name: "Portal 2",
    playtimeMinutes: 120,
  },
];

describe("Steam Store metadata client", () => {
  it("reads genres and play modes with individual AppID-keyed Store requests", async () => {
    const responseBody = {
      620: {
        success: true,
        data: {
          type: "game",
          genres: [{ description: "解谜" }],
          categories: [{ description: "单人" }, { description: "合作" }],
          developers: ["Valve"],
          header_image: "https://cdn.example.test/portal-2.jpg",
          publishers: ["Valve"],
          short_description: "传送门测试。",
        },
      },
      730: {
        success: true,
        data: {
          type: "game",
          genres: [{ description: "动作" }, { description: "免费开玩" }],
          categories: [{ description: "多人" }, { description: "在线 PvP" }],
          developers: ["Valve"],
          header_image: "https://cdn.example.test/cs2.jpg",
          publishers: ["Valve"],
          short_description: "反恐精英测试。",
        },
      },
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(responseBody), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );
    const client = new SteamStoreMetadataClient({
      cache: new Map(),
      countryCode: "cn",
      fetchImpl: fetchMock,
      language: "schinese",
    });

    await expect(client.getGameMetadata(games)).resolves.toEqual([
      {
        appId: 730,
        appType: "game",
        genres: ["动作", "免费开玩"],
        headerImageUrl: "https://cdn.example.test/cs2.jpg",
        modes: ["multiplayer"],
        developers: ["Valve"],
        publishers: ["Valve"],
        shortDescription: "反恐精英测试。",
      },
      {
        appId: 620,
        appType: "game",
        genres: ["解谜"],
        headerImageUrl: "https://cdn.example.test/portal-2.jpg",
        modes: ["single-player", "co-op", "multiplayer"],
        developers: ["Valve"],
        publishers: ["Valve"],
        shortDescription: "传送门测试。",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map(([request, init]) => ({
      headers: new Headers(init?.headers),
      url: new URL(String(request)),
    }));

    expect(requests.map(({ url }) => url.searchParams.get("appids"))).toEqual([
      "730",
      "620",
    ]);
    requests.forEach(({ headers, url }) => {
      expect(url.origin).toBe("https://store.steampowered.com");
      expect(url.pathname).toBe("/api/appdetails");
      expect(url.searchParams.get("cc")).toBe("cn");
      expect(url.searchParams.get("l")).toBe("schinese");
      expect(headers.get("x-webapi-key")).toBeNull();
    });
  });

  it("returns no metadata when the Store response is unavailable", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    const client = new SteamStoreMetadataClient({
      cache: new Map(),
      fetchImpl: fetchMock,
    });

    await expect(client.getGameMetadata(games)).resolves.toEqual([]);
  });
});
