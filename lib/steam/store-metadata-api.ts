import type { SteamStoreGameMetadata } from "./store-metadata";

interface SteamStoreMetadataApiSuccess {
  ok: true;
  data: SteamStoreGameMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isSteamStoreGameMetadata(
  value: unknown,
): value is SteamStoreGameMetadata {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.appId) &&
    (typeof value.appType === "string" || value.appType === null) &&
    isStringArray(value.genres) &&
    (typeof value.headerImageUrl === "string" ||
      value.headerImageUrl === null) &&
    isStringArray(value.modes) &&
    isStringArray(value.developers) &&
    isStringArray(value.publishers) &&
    (typeof value.shortDescription === "string" ||
      value.shortDescription === null)
  );
}

function isSuccessResponse(
  value: unknown,
): value is SteamStoreMetadataApiSuccess {
  return (
    isRecord(value) && value.ok === true && isSteamStoreGameMetadata(value.data)
  );
}

/**
 * Requests Store metadata only after a player opens an individual archive.
 * The endpoint exposes public AppID data only; no SteamID or API key travels
 * from the browser.
 */
export async function fetchSteamStoreMetadata(
  appId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<SteamStoreGameMetadata | null> {
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    return null;
  }

  try {
    const response = await fetchImpl(`/api/steam/store/${appId}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    return isSuccessResponse(body) ? body.data : null;
  } catch {
    return null;
  }
}
