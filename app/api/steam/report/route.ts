import { NextResponse } from "next/server";

import type { ReportData } from "@/lib/report/types";
import {
  getSteamErrorHttpStatus,
  SteamGatewayError,
  toSteamGatewayError,
} from "@/lib/steam/errors";
import { getSteamReport } from "@/lib/steam/get-report";
import { steamLookupRequestSchema } from "@/lib/steam/schemas";
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

function errorResponse(error: unknown) {
  const steamError = toSteamGatewayError(error);

  return jsonResponse(
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
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch (error) {
    return errorResponse(
      new SteamGatewayError("INVALID_STEAM_ID", { cause: error }),
    );
  }

  const requestResult = steamLookupRequestSchema.safeParse(requestBody);
  if (!requestResult.success) {
    return errorResponse(
      new SteamGatewayError("INVALID_STEAM_ID", {
        cause: requestResult.error,
      }),
    );
  }

  try {
    const report = await getSteamReport(requestResult.data.steamIdInput);

    return jsonResponse({ ok: true, data: report }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
