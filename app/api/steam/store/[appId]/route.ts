import { NextResponse } from "next/server";

import { SteamStoreMetadataClient } from "@/lib/steam/store-metadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const appIdPattern = /^\d{1,10}$/u;
const maximumAppId = 2_147_483_647;
const cacheHeaders = {
  "Cache-Control":
    "public, max-age=300, s-maxage=43200, stale-while-revalidate=86400",
};

interface StoreRouteContext {
  params: Promise<{ appId: string }>;
}

function invalidAppIdResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_APP_ID",
        message: "游戏 App ID 无效。",
        retryable: false,
      },
    },
    { headers: { "Cache-Control": "no-store" }, status: 400 },
  );
}

function unavailableResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "STORE_METADATA_UNAVAILABLE",
        message: "Steam 商店暂时没有返回这款游戏的详情。",
        retryable: true,
      },
    },
    { headers: { "Cache-Control": "no-store" }, status: 404 },
  );
}

/**
 * Returns public Store metadata for one already-visible AppID. The Store
 * client holds a process-level 12-hour cache; response headers add an edge or
 * browser cache when the deployment platform supports one.
 */
export async function GET(_request: Request, context: StoreRouteContext) {
  const { appId: rawAppId } = await context.params;

  if (!appIdPattern.test(rawAppId)) {
    return invalidAppIdResponse();
  }

  const appId = Number(rawAppId);
  if (!Number.isSafeInteger(appId) || appId <= 0 || appId > maximumAppId) {
    return invalidAppIdResponse();
  }

  const client = new SteamStoreMetadataClient();
  const [metadata] = await client.getGameMetadata([
    {
      appId,
      iconHash: null,
      lastPlayedAt: null,
      name: `Steam app ${appId}`,
      playtimeMinutes: 0,
    },
  ]);

  if (!metadata) {
    return unavailableResponse();
  }

  return NextResponse.json(
    { ok: true, data: metadata },
    { headers: cacheHeaders, status: 200 },
  );
}
