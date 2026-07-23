import type { ReportData } from "@/lib/report/types";

const reportStorageKey = "steam-report:data:v2";
const progressStorageKey = "steam-report:page:v1";
const reportStorageVersion = 2;

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
    storage.setItem(progressStorageKey, "0");
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

export function saveReportProgress(
  storage: SessionStorage,
  pageIndex: number,
): void {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex > 9) {
    return;
  }

  try {
    storage.setItem(progressStorageKey, String(pageIndex));
  } catch {
    // Progress restoration is optional; the current report remains usable.
  }
}

export function loadReportProgress(storage: SessionStorage): number {
  try {
    const value = Number(storage.getItem(progressStorageKey));
    return Number.isInteger(value) && value >= 0 && value <= 9 ? value : 0;
  } catch {
    return 0;
  }
}

export function clearReportSession(storage: SessionStorage): void {
  removeItemSafely(storage, reportStorageKey);
  removeItemSafely(storage, progressStorageKey);
}
