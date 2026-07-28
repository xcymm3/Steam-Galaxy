import type { ReportData } from "@/lib/report/types";

const reportStorageKey = "steam-report:data:v3";
const posterImageStorageKey = "steam-galaxy:poster-image:v1";
const legacyProgressStorageKey = "steam-report:page:v1";
const reportStorageVersion = 3;

interface StoredReport {
  version: typeof reportStorageVersion;
  report: ReportData;
}

type SessionStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function removeItemSafely(storage: SessionStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage access can be blocked by browser privacy settings.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReportData(value: unknown): value is ReportData {
  return (
    isRecord(value) &&
    isRecord(value.player) &&
    typeof value.player.displayName === "string" &&
    isRecord(value.metrics) &&
    typeof value.metrics.totalGameCount === "number" &&
    Array.isArray(value.games) &&
    Array.isArray(value.topGames) &&
    isRecord(value.gameMetadata) &&
    isRecord(value.galaxy) &&
    Array.isArray(value.galaxy.games) &&
    isRecord(value.title) &&
    typeof value.title.name === "string" &&
    typeof value.retrievedAt === "string"
  );
}

export function saveReportSession(
  storage: SessionStorage,
  report: ReportData,
): boolean {
  const value: StoredReport = { version: reportStorageVersion, report };

  try {
    storage.setItem(reportStorageKey, JSON.stringify(value));
    return true;
  } catch {
    clearReportSession(storage);
    return false;
  }
}

export function loadReportSession(storage: SessionStorage): ReportData | null {
  try {
    const serialized = storage.getItem(reportStorageKey);
    if (!serialized) {
      return null;
    }

    const value: unknown = JSON.parse(serialized);
    if (
      !isRecord(value) ||
      value.version !== reportStorageVersion ||
      !isReportData(value.report)
    ) {
      removeItemSafely(storage, reportStorageKey);
      return null;
    }

    return value.report;
  } catch {
    removeItemSafely(storage, reportStorageKey);
    return null;
  }
}

export function clearReportSession(storage: SessionStorage): void {
  removeItemSafely(storage, reportStorageKey);
  removeItemSafely(storage, posterImageStorageKey);
  removeItemSafely(storage, legacyProgressStorageKey);
}

export function savePosterImageSession(
  storage: SessionStorage,
  imageDataUrl: string,
): boolean {
  if (!imageDataUrl.startsWith("data:image/")) {
    return false;
  }

  try {
    storage.setItem(posterImageStorageKey, imageDataUrl);
    return true;
  } catch {
    removeItemSafely(storage, posterImageStorageKey);
    return false;
  }
}

export function loadPosterImageSession(storage: SessionStorage): string | null {
  try {
    const imageDataUrl = storage.getItem(posterImageStorageKey);
    return imageDataUrl?.startsWith("data:image/") ? imageDataUrl : null;
  } catch {
    removeItemSafely(storage, posterImageStorageKey);
    return null;
  }
}
