import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import {
  clearReportSession,
  loadReportProgress,
  loadReportSession,
  saveReportProgress,
  saveReportSession,
} from "@/components/report/report-session";

import { ordinaryPlayerFixture } from "../fixtures/report";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

describe("report session", () => {
  it("round-trips a report and resets its page progress", () => {
    const storage = new MemoryStorage();

    saveReportProgress(storage, 7);
    expect(saveReportSession(storage, report)).toBe(true);

    expect(loadReportSession(storage)).toEqual(report);
    expect(loadReportProgress(storage)).toBe(0);
  });

  it("accepts only page indexes from the ten-page player", () => {
    const storage = new MemoryStorage();

    saveReportProgress(storage, 9);
    expect(loadReportProgress(storage)).toBe(9);

    saveReportProgress(storage, 10);
    expect(loadReportProgress(storage)).toBe(9);

    saveReportProgress(storage, 1.5);
    expect(loadReportProgress(storage)).toBe(9);
  });

  it("removes corrupted or unsupported report payloads", () => {
    const storage = new MemoryStorage();

    storage.setItem("steam-report:data:v2", "{bad json");
    expect(loadReportSession(storage)).toBeNull();
    expect(storage.getItem("steam-report:data:v2")).toBeNull();

    storage.setItem(
      "steam-report:data:v2",
      JSON.stringify({ version: 3, report }),
    );
    expect(loadReportSession(storage)).toBeNull();
  });

  it("clears report data and progress together", () => {
    const storage = new MemoryStorage();

    expect(saveReportSession(storage, report)).toBe(true);
    saveReportProgress(storage, 4);
    clearReportSession(storage);

    expect(loadReportSession(storage)).toBeNull();
    expect(loadReportProgress(storage)).toBe(0);
  });

  it("fails safely when browser storage is blocked", () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(saveReportSession(blockedStorage, report)).toBe(false);
    expect(loadReportSession(blockedStorage)).toBeNull();
    expect(loadReportProgress(blockedStorage)).toBe(0);
    expect(() => clearReportSession(blockedStorage)).not.toThrow();
  });
});
