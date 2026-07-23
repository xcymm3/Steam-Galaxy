import { NextRequest, NextResponse } from "next/server";

import type { ReportData } from "@/lib/report/types";
import {
  getSteamErrorHttpStatus,
  SteamGatewayError,
  toSteamGatewayError,
} from "@/lib/steam/errors";
import { getSteamReport } from "@/lib/steam/get-report";
import { steamOpenIdSteamIdCookieName } from "@/lib/steam/openid";
import type { SteamLookupResponse } from "@/lib/steam/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "private, no-store",
};

function jsonResponse(body: SteamLookupResponse<ReportData>, status: number) {
  return NextResponse.json(body, {
    headers: responseHeaders,
    status,
  });
}

function clearSteamId(response: NextResponse) {
  response.cookies.set({
    name: steamOpenIdSteamIdCookieName,
    value: "",
    expires: new Date(0),
    path: "/",
  });
}

function errorResponse(error: unknown) {
  const steamError = toSteamGatewayError(error);
  const response = jsonResponse(
    {
      ok: false,
      error: {
        code: steamError.code,
        message: steamError.message,
        retryable: steamError.retryable,
      },
    },
    getSteamErrorHttpStatus(steamError.code),
  );
  clearSteamId(response);
  return response;
}

export async function POST(request: NextRequest) {
  const steamId = request.cookies.get(steamOpenIdSteamIdCookieName)?.value;

  if (!steamId || !/^\d{17}$/u.test(steamId)) {
    return errorResponse(new SteamGatewayError("OPENID_STATE_INVALID"));
  }

  try {
    const report = await getSteamReport(steamId);
    const response = jsonResponse({ ok: true, data: report }, 200);
    clearSteamId(response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
