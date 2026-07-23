import { NextRequest, NextResponse } from "next/server";

import {
  createSteamOpenIdLoginUrl,
  createSteamOpenIdState,
  getSteamOpenIdAppOrigin,
  steamOpenIdStateCookieName,
  steamOpenIdStateMaxAgeSeconds,
} from "@/lib/steam/openid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function redirectHome(request: NextRequest, auth: string) {
  const destination = new URL("/", request.nextUrl.origin);
  destination.searchParams.set("auth", auth);
  return NextResponse.redirect(destination, { headers: noStoreHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const origin = getSteamOpenIdAppOrigin(request.url);
    const openIdState = createSteamOpenIdState();
    const response = NextResponse.redirect(
      createSteamOpenIdLoginUrl(origin, openIdState.state),
      { headers: noStoreHeaders },
    );

    response.cookies.set({
      name: steamOpenIdStateCookieName,
      value: openIdState.cookieValue,
      httpOnly: true,
      maxAge: steamOpenIdStateMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: origin.startsWith("https://"),
    });

    return response;
  } catch {
    return redirectHome(request, "configuration");
  }
}
