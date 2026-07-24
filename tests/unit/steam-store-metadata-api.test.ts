import { describe, expect, it, vi } from "vitest";

import { fetchSteamStoreMetadata } from "@/lib/steam/store-metadata-api";

describe("Steam Store metadata API client", () => {
  it("requests one public AppID endpoint and returns validated metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            appId: 440,
            appType: "game",
            genres: ["动作"],
            headerImageUrl: "https://cdn.example.test/tf2.jpg",
            modes: ["multiplayer"],
            developers: ["Valve"],
            publishers: ["Valve"],
            shortDescription: "军团要塞测试。",
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );

    await expect(fetchSteamStoreMetadata(440, fetchMock)).resolves.toEqual({
      appId: 440,
      appType: "game",
      genres: ["动作"],
      headerImageUrl: "https://cdn.example.test/tf2.jpg",
      modes: ["multiplayer"],
      developers: ["Valve"],
      publishers: ["Valve"],
      shortDescription: "军团要塞测试。",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/steam/store/440", {
      headers: { Accept: "application/json" },
    });
  });

  it("rejects invalid AppIDs and malformed or unavailable responses", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(fetchSteamStoreMetadata(0, fetchMock)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { appId: "bad" } }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    await expect(fetchSteamStoreMetadata(440, fetchMock)).resolves.toBeNull();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchSteamStoreMetadata(440, fetchMock)).resolves.toBeNull();
  });
});
