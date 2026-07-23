import { describe, expect, it, vi } from "vitest";

import { SteamApiClient } from "@/lib/steam/client";

import vanitySuccessFixture from "../fixtures/steam/resolve-vanity-success.json";

const apiKey = "test-only-api-key";

describe("Steam API client", () => {
  it("keeps the API key out of the request URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(vanitySuccessFixture), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    const client = new SteamApiClient({ apiKey, fetchImpl: fetchMock });

    await expect(client.resolveVanity("night-pilot")).resolves.toBe(
      "76561198000000001",
    );

    const [request, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request));
    const headers = new Headers(init?.headers);

    expect(url.origin).toBe("https://api.steampowered.com");
    expect(url.searchParams.has("key")).toBe(false);
    expect(url.searchParams.get("vanityurl")).toBe("night-pilot");
    expect(headers.get("x-webapi-key")).toBe(apiKey);
  });

  it("maps malformed JSON structures to STEAM_BAD_RESPONSE", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    const client = new SteamApiClient({ apiKey, fetchImpl: fetchMock });

    await expect(client.resolveVanity("night-pilot")).rejects.toMatchObject({
      code: "STEAM_BAD_RESPONSE",
      retryable: true,
    });
  });

  it("aborts a slow Steam response and exposes a retryable timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_request, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );
    const client = new SteamApiClient({
      apiKey,
      fetchImpl: fetchMock,
      timeoutMs: 5,
    });

    await expect(client.resolveVanity("night-pilot")).rejects.toMatchObject({
      code: "STEAM_TIMEOUT",
      retryable: true,
    });
  });

  it("retries a Steam timeout once before returning a response", async () => {
    let callCount = 0;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation((_request, init) => {
        callCount += 1;

        if (callCount === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              );
            });
          });
        }

        return Promise.resolve(
          new Response(JSON.stringify(vanitySuccessFixture), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        );
      });
    const client = new SteamApiClient({
      apiKey,
      fetchImpl: fetchMock,
      timeoutMs: 5,
    });

    await expect(client.resolveVanity("night-pilot")).resolves.toBe(
      "76561198000000001",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
