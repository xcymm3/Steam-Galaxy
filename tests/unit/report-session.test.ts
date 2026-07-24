import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import {
  clearReportSession,
  loadReportSession,
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
  it("round-trips a galaxy report without storing reader progress", () => {
    const storage = new MemoryStorage();

    expect(saveReportSession(storage, report)).toBe(true);

    expect(loadReportSession(storage)).toEqual(report);
    expect(storage.getItem("steam-report:page:v1")).toBeNull();
  });

  it("removes corrupted or unsupported report payloads", () => {
    const storage = new MemoryStorage();

    storage.setItem("steam-report:data:v3", "{bad json");
    expect(loadReportSession(storage)).toBeNull();
    expect(storage.getItem("steam-report:data:v3")).toBeNull();

    storage.setItem(
      "steam-report:data:v3",
      JSON.stringify({ version: 4, report }),
    );
    expect(loadReportSession(storage)).toBeNull();
  });

  it("clears report data and the legacy reader progress key", () => {
    const storage = new MemoryStorage();

    expect(saveReportSession(storage, report)).toBe(true);
    storage.setItem("steam-report:page:v1", "4");
    clearReportSession(storage);

    expect(loadReportSession(storage)).toBeNull();
    expect(storage.getItem("steam-report:page:v1")).toBeNull();
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
    expect(() => clearReportSession(blockedStorage)).not.toThrow();
  });
});
