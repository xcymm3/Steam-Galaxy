import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as callback } from "@/app/api/auth/steam/callback/route";
import { POST as consume } from "@/app/api/auth/steam/consume/route";
import { GET as start } from "@/app/api/auth/steam/start/route";
import {
  createSteamOpenIdCallbackUrl,
  createSteamOpenIdState,
  steamOpenIdEndpoint,
  steamOpenIdNamespace,
  steamOpenIdStateCookieName,
  steamOpenIdSteamIdCookieName,
} from "@/lib/steam/openid";

import ownedGamesPublicFixture from "../fixtures/steam/owned-games-public.json";
import playerPublicFixture from "../fixtures/steam/player-public.json";

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

  return callbackUrl;
}

function createSteamFetch() {
  return vi.fn<typeof fetch>().mockImplementation((request) => {
    const url = new URL(String(request));

    if (url.pathname.includes("/ISteamUser/GetPlayerSummaries/")) {
      return Promise.resolve(
        new Response(JSON.stringify(playerPublicFixture), { status: 200 }),
      );
    }

    if (url.pathname.includes("/IPlayerService/GetOwnedGames/")) {
      return Promise.resolve(
        new Response(JSON.stringify(ownedGamesPublicFixture), { status: 200 }),
      );
    }

    return Promise.resolve(new Response("not found", { status: 404 }));
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Steam OpenID routes", () => {
  it("redirects to Steam with a short-lived, HttpOnly state cookie", async () => {
    vi.stubEnv("APP_ORIGIN", origin);

    const response = await start(
      new NextRequest(`${origin}/api/auth/steam/start`),
    );
    const destination = new URL(response.headers.get("location")!);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(destination.origin).toBe("https://steamcommunity.com");
    expect(destination.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(setCookie).toContain(`${steamOpenIdStateCookieName}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Secure");
  });

  it("verifies Steam's assertion, clears state and creates only a short-lived SteamID cookie", async () => {
    vi.stubEnv("APP_ORIGIN", origin);
    const openIdState = createSteamOpenIdState();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("is_valid:true\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const proxiedCallbackUrl = createAssertion(openIdState.state);
    proxiedCallbackUrl.protocol = "http:";
    proxiedCallbackUrl.host = "localhost:10000";

    const response = await callback(
      new NextRequest(proxiedCallbackUrl, {
        headers: {
          cookie: `${steamOpenIdStateCookieName}=${openIdState.cookieValue}`,
        },
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.headers.get("location")).toBe(`${origin}/?auth=success`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(fetchMock).toHaveBeenCalledWith(
      steamOpenIdEndpoint,
      expect.objectContaining({ method: "POST" }),
    );
    expect(setCookie).toContain(`${steamOpenIdStateCookieName}=`);
    expect(setCookie).toContain(`${steamOpenIdSteamIdCookieName}=${steamId}`);
    expect(setCookie).toContain("HttpOnly");
  });

  it("clears the attempt and returns a distinct home notice when the user cancels", async () => {
    vi.stubEnv("APP_ORIGIN", origin);

    const response = await callback(
      new NextRequest(`${origin}/api/auth/steam/callback?openid.mode=cancel`),
    );

    expect(response.headers.get("location")).toBe(`${origin}/?auth=cancelled`);
    expect(response.headers.get("set-cookie")).toContain(
      `${steamOpenIdStateCookieName}=`,
    );
  });

  it("allows the verified SteamID cookie to enter the existing report API once", async () => {
    vi.stubEnv("STEAM_WEB_API_KEY", "openid-route-test-key");
    vi.stubGlobal("fetch", createSteamFetch());

    const response = await consume(
      new NextRequest(`${origin}/api/auth/steam/consume`, {
        headers: { cookie: `${steamOpenIdSteamIdCookieName}=${steamId}` },
        method: "POST",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(payload).toMatchObject({
      ok: true,
      data: { player: { steamId } },
    });
    expect(response.headers.get("set-cookie")).toContain(
      `${steamOpenIdSteamIdCookieName}=`,
    );
  });

  it("does not consume a missing or replayed SteamID cookie", async () => {
    const response = await consume(
      new NextRequest(`${origin}/api/auth/steam/consume`, { method: "POST" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "OPENID_STATE_INVALID" },
    });
  });
});
