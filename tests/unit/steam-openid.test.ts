import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSteamOpenIdCallbackUrl,
  createSteamOpenIdLoginUrl,
  createSteamOpenIdState,
  getSteamOpenIdAppOrigin,
  steamOpenIdEndpoint,
  steamOpenIdIdentifierSelect,
  steamOpenIdNamespace,
  SteamOpenIdError,
  verifySteamOpenIdAssertion,
  verifySteamOpenIdState,
} from "@/lib/steam/openid";

const origin = "https://report.example";
const steamId = "76561198000000001";

function createAssertion(state: string) {
  const expectedReturnTo = createSteamOpenIdCallbackUrl(origin, state);
  const callbackUrl = new URL(expectedReturnTo);
  const claimedId = `https://steamcommunity.com/openid/id/${steamId}`;

  callbackUrl.searchParams.set("openid.ns", steamOpenIdNamespace);
  callbackUrl.searchParams.set("openid.mode", "id_res");
  callbackUrl.searchParams.set("openid.op_endpoint", steamOpenIdEndpoint);
  callbackUrl.searchParams.set("openid.claimed_id", claimedId);
  callbackUrl.searchParams.set("openid.identity", claimedId);
  callbackUrl.searchParams.set("openid.return_to", expectedReturnTo);
  callbackUrl.searchParams.set(
    "openid.response_nonce",
    "2026-07-22T00:00:00Zabc",
  );
  callbackUrl.searchParams.set(
    "openid.signed",
    "op_endpoint,claimed_id,identity,return_to,response_nonce",
  );

  return { callbackUrl, expectedReturnTo };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Steam OpenID", () => {
  it("builds a Steam checkid_setup URL with a fixed callback and realm", () => {
    const url = new URL(createSteamOpenIdLoginUrl(origin, "test-state"));

    expect(url.origin).toBe("https://steamcommunity.com");
    expect(url.pathname).toBe("/openid/login");
    expect(url.searchParams.get("openid.ns")).toBe(steamOpenIdNamespace);
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(url.searchParams.get("openid.realm")).toBe(origin);
    expect(url.searchParams.get("openid.claimed_id")).toBe(
      steamOpenIdIdentifierSelect,
    );
    expect(url.searchParams.get("openid.identity")).toBe(
      steamOpenIdIdentifierSelect,
    );
    expect(url.searchParams.get("openid.return_to")).toBe(
      createSteamOpenIdCallbackUrl(origin, "test-state"),
    );
  });

  it("uses APP_ORIGIN in production and allows only localhost fallback", () => {
    vi.stubEnv("APP_ORIGIN", origin);
    expect(getSteamOpenIdAppOrigin("https://ignored.example/api/auth")).toBe(
      origin,
    );

    vi.stubEnv("APP_ORIGIN", "");
    expect(getSteamOpenIdAppOrigin("http://localhost:3000/api/auth")).toBe(
      "http://localhost:3000",
    );
    expect(() =>
      getSteamOpenIdAppOrigin("https://untrusted.example/api/auth"),
    ).toThrow(SteamOpenIdError);
  });

  it("requires the one-time cookie state to be valid, current and equal", () => {
    const openIdState = createSteamOpenIdState(1_000);

    expect(
      verifySteamOpenIdState(openIdState.cookieValue, openIdState.state, 1_500),
    ).toMatchObject({ state: openIdState.state });
    expect(() =>
      verifySteamOpenIdState(openIdState.cookieValue, "not-the-same", 1_500),
    ).toThrow(SteamOpenIdError);
    expect(() =>
      verifySteamOpenIdState(
        openIdState.cookieValue,
        openIdState.state,
        1_000 + 10 * 60 * 1_000 + 1,
      ),
    ).toThrow(SteamOpenIdError);
  });

  it("posts the signed assertion back to Steam before returning its SteamID", async () => {
    const { callbackUrl, expectedReturnTo } = createAssertion("state-value");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"),
      );

    await expect(
      verifySteamOpenIdAssertion(callbackUrl, {
        expectedReturnTo,
        fetchImpl: fetchMock,
      }),
    ).resolves.toBe(steamId);

    expect(fetchMock).toHaveBeenCalledWith(
      steamOpenIdEndpoint,
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    expect(String(init?.body)).toContain("openid.mode=check_authentication");
  });

  it("rejects an assertion whose return URL or direct verification is invalid", async () => {
    const { callbackUrl, expectedReturnTo } = createAssertion("state-value");
    callbackUrl.searchParams.set("openid.return_to", "https://evil.example/");

    await expect(
      verifySteamOpenIdAssertion(callbackUrl, { expectedReturnTo }),
    ).rejects.toMatchObject({ code: "verification" });
  });
});
