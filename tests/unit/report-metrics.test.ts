import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import {
  calculateReportMetrics,
  calculateSteamAgeYears,
  sortOwnedGames,
} from "@/lib/report/metrics";
import type { OwnedGame } from "@/lib/report/types";

import {
  allUnplayedFixture,
  emptyInventoryFixture,
  hugeInventoryFixture,
  longChineseNicknameFixture,
  missingCreatedAtFixture,
  ordinaryPlayerFixture,
  thousandHourSingleFixture,
} from "../fixtures/report";

describe("report metrics", () => {
  it("calculates totals, groups and concentration for an ordinary player", () => {
    const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

    expect(report.metrics).toMatchObject({
      totalGameCount: 6,
      playedGameCount: 4,
      unplayedGameCount: 2,
      lowPlaytimeGameCount: 1,
      totalPlaytimeMinutes: 9_239,
      totalPlaytimeHours: 9_239 / 60,
      steamAgeYears: 10,
    });
    expect(report.metrics.reachRatio).toBeCloseTo(4 / 6);
    expect(report.metrics.unplayedRatio).toBeCloseTo(2 / 6);
    expect(report.metrics.topOneRatio).toBeCloseTo(6_000 / 9_239);
    expect(report.metrics.topThreeRatio).toBeCloseTo(9_120 / 9_239);
    expect(report.metrics.lowPlaytimeRatio).toBeCloseTo(1 / 4);
    expect(report.topGames.map((game) => game.appId)).toEqual([
      101, 102, 104, 103,
    ]);
    expect(report.lowPlaytimeGames.map((game) => game.appId)).toEqual([103]);
    expect(report.unplayedGames.map((game) => game.appId)).toEqual([105, 106]);
  });

  it("returns null ratios instead of illegal numbers for an empty inventory", () => {
    const report = analyzeSteamSnapshot(emptyInventoryFixture);

    expect(report.metrics).toMatchObject({
      totalGameCount: 0,
      playedGameCount: 0,
      unplayedGameCount: 0,
      lowPlaytimeGameCount: 0,
      totalPlaytimeMinutes: 0,
      totalPlaytimeHours: 0,
      reachRatio: null,
      unplayedRatio: null,
      topOneRatio: null,
      topThreeRatio: null,
      lowPlaytimeRatio: null,
    });
    expect(report.topGames).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/NaN|Infinity/u);
  });

  it("does not rank unplayed games as Top games", () => {
    const report = analyzeSteamSnapshot(allUnplayedFixture);

    expect(report.metrics.reachRatio).toBe(0);
    expect(report.metrics.unplayedRatio).toBe(1);
    expect(report.metrics.topOneRatio).toBeNull();
    expect(report.metrics.lowPlaytimeRatio).toBeNull();
    expect(report.playedGames).toEqual([]);
    expect(report.topGames).toEqual([]);
    expect(report.unplayedGames).toHaveLength(20);
  });

  it("handles one game and a 500+ game inventory without illegal values", () => {
    const singleReport = analyzeSteamSnapshot(thousandHourSingleFixture);
    const hugeReport = analyzeSteamSnapshot(hugeInventoryFixture);

    expect(singleReport.metrics).toMatchObject({
      totalGameCount: 1,
      playedGameCount: 1,
      topOneRatio: 1,
      topThreeRatio: 1,
    });
    expect(singleReport.topGames).toHaveLength(1);
    expect(hugeReport.metrics).toMatchObject({
      totalGameCount: 501,
      playedGameCount: 150,
      unplayedGameCount: 351,
      lowPlaytimeGameCount: 0,
    });
    expect(hugeReport.metrics.unplayedRatio).toBeCloseTo(351 / 501);
    expect(JSON.stringify(hugeReport)).not.toMatch(/NaN|Infinity/u);
  });

  it("sorts ties by AppID without mutating the source array", () => {
    const games: OwnedGame[] = [
      { ...ordinaryPlayerFixture.games[0]!, appId: 9, playtimeMinutes: 60 },
      { ...ordinaryPlayerFixture.games[0]!, appId: 3, playtimeMinutes: 60 },
      { ...ordinaryPlayerFixture.games[0]!, appId: 7, playtimeMinutes: 120 },
    ];
    const originalOrder = games.map((game) => game.appId);

    const sorted = sortOwnedGames(games);

    expect(sorted.map((game) => game.appId)).toEqual([7, 3, 9]);
    expect(games.map((game) => game.appId)).toEqual(originalOrder);
    expect(sorted[0]).not.toBe(games[2]);
  });

  it("calculates Top ratios correctly even with unsorted input", () => {
    const metrics = calculateReportMetrics(
      ordinaryPlayerFixture.games,
      ordinaryPlayerFixture.player.createdAt,
      ordinaryPlayerFixture.retrievedAt,
    );

    expect(metrics.topOneRatio).toBeCloseTo(6_000 / 9_239);
    expect(metrics.topThreeRatio).toBeCloseTo(9_120 / 9_239);
  });

  it("limits Top games to five and preserves an extremely long nickname", () => {
    const hugeReport = analyzeSteamSnapshot(hugeInventoryFixture);
    const longNameReport = analyzeSteamSnapshot(longChineseNicknameFixture);

    expect(hugeReport.topGames).toHaveLength(5);
    expect(longNameReport.player.displayName).toBe(
      longChineseNicknameFixture.player.displayName,
    );
  });

  it("calculates completed Steam years and degrades missing dates to null", () => {
    expect(
      calculateSteamAgeYears(
        "2015-08-20T00:00:00.000Z",
        "2026-08-19T23:59:59.000Z",
      ),
    ).toBe(10);
    expect(
      calculateSteamAgeYears(
        "2015-08-20T00:00:00.000Z",
        "2026-08-20T00:00:00.000Z",
      ),
    ).toBe(11);
    expect(
      calculateSteamAgeYears(null, ordinaryPlayerFixture.retrievedAt),
    ).toBe(null);
    expect(
      analyzeSteamSnapshot(missingCreatedAtFixture).metrics.steamAgeYears,
    ).toBeNull();
  });
});
