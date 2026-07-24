import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/steam/store/[appId]/route";

const appId = "987654";

function routeContext(value: string) {
  return { params: Promise.resolve({ appId: value }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/steam/store/[appId]", () => {
  it("returns public Store metadata without requiring an API key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          [appId]: {
            success: true,
            data: {
              type: "game",
              genres: [{ description: "策略" }],
              categories: [{ description: "单人" }, { description: "合作" }],
              developers: ["Archive Studio"],
              header_image: "https://cdn.example.test/archive.jpg",
              publishers: ["Archive Studio"],
              short_description: "档案测试。",
            },
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`http://localhost/api/steam/store/${appId}`),
      routeContext(appId),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data?: { appId: number; modes: string[] };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=43200");
    expect(payload).toMatchObject({
      ok: true,
      data: {
        appId: Number(appId),
        modes: ["single-player", "co-op", "multiplayer"],
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [request, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request));

    expect(url.origin).toBe("https://store.steampowered.com");
    expect(url.pathname).toBe("/api/appdetails");
    expect(url.searchParams.get("appids")).toBe(appId);
    expect(new Headers(init?.headers).get("x-webapi-key")).toBeNull();

    const cachedResponse = await GET(
      new Request(`http://localhost/api/steam/store/${appId}`),
      routeContext(appId),
    );

    expect(cachedResponse.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed AppIDs before contacting the Store", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/steam/store/not-an-app"),
      routeContext("not-an-app"),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error?: { code: string; retryable: boolean };
    };

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "INVALID_APP_ID", retryable: false },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
