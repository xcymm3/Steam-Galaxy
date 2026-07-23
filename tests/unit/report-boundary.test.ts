import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import { ordinaryPlayerFixture } from "../fixtures/report";

describe("report analysis boundary", () => {
  it("has no React or Next.js dependency", () => {
    const reportDirectory = new URL("../../lib/report/", import.meta.url);
    const sources = readdirSync(reportDirectory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .map((fileName) =>
        readFileSync(new URL(fileName, reportDirectory), "utf8"),
      )
      .join("\n");

    expect(sources).not.toMatch(/from\s+["'](?:next|react)(?:\/[^"']*)?["']/u);
  });

  it("is deterministic and does not mutate its Steam snapshot", () => {
    const snapshot = structuredClone(ordinaryPlayerFixture);
    const original = structuredClone(snapshot);

    const first = analyzeSteamSnapshot(snapshot);
    const second = analyzeSteamSnapshot(snapshot);

    expect(first).toEqual(second);
    expect(snapshot).toEqual(original);
    expect(first.player).not.toBe(snapshot.player);
    expect(first.games[0]).not.toBe(snapshot.games[0]);
  });
});
