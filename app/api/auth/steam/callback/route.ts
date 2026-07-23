import { NextRequest, NextResponse } from "next/server";

import {
  createSteamOpenIdCallbackUrl,
  getSteamOpenIdAppOrigin,
  SteamOpenIdError,
  steamOpenIdStateCookieName,
  steamOpenIdSteamIdCookieName,
  steamOpenIdSteamIdMaxAgeSeconds,
  verifySteamOpenIdAssertion,
  verifySteamOpenIdState,
} from "@/lib/steam/openid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function redirectHome(origin: string, auth: string) {
  const destination = new URL("/", origin);
  destination.searchParams.set("auth", auth);
  return NextResponse.redirect(destination, { headers: noStoreHeaders });
}

function clearOpenIdState(response: NextResponse) {
  response.cookies.set({
    name: steamOpenIdStateCookieName,
    value: "",
    expires: new Date(0),
    path: "/",
  });
}

function errorStatus(error: unknown) {
  if (!(error instanceof SteamOpenIdError)) {
    return "failed";
  }

  switch (error.code) {
    case "configuration":
      return "configuration";
    case "state":
      return "expired";
    case "timeout":
      return "timeout";
    case "verification":
      return "failed";
  }
}

export async function GET(request: NextRequest) {
  let origin = request.nextUrl.origin;

  try {
    origin = getSteamOpenIdAppOrigin(request.url);
    const mode = request.nextUrl.searchParams.get("openid.mode");
    if (mode === "cancel") {
      const response = redirectHome(origin, "cancelled");
      clearOpenIdState(response);
      return response;
    }

    const state = request.nextUrl.searchParams.get("state");
    verifySteamOpenIdState(
      request.cookies.get(steamOpenIdStateCookieName)?.value,
      state,
    );
    const steamId = await verifySteamOpenIdAssertion(request.nextUrl, {
      expectedReturnTo: createSteamOpenIdCallbackUrl(origin, state!),
    });
    const response = redirectHome(origin, "success");

    clearOpenIdState(response);
    response.cookies.set({
      name: steamOpenIdSteamIdCookieName,
      value: steamId,
      httpOnly: true,
      maxAge: steamOpenIdSteamIdMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: origin.startsWith("https://"),
    });

    return response;
  } catch (error) {
    const response = redirectHome(origin, errorStatus(error));
    clearOpenIdState(response);
    return response;
  }
}
