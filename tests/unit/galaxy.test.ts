import { describe, expect, it } from "vitest";

import {
  createGalaxyModel,
  GALAXY_INTERACTIVE_GAME_LIMIT,
  getGalaxyPlanetRadius,
} from "@/lib/report/galaxy";
import type { OwnedGame } from "@/lib/report/types";

import {
  allUnplayedFixture,
  starMapFiveHundredFixture,
} from "../fixtures/report";

function game(appId: number, playtimeMinutes: number): OwnedGame {
  return {
    appId,
    name: `Galaxy Game ${appId}`,
    playtimeMinutes,
    iconHash: null,
    lastPlayedAt: null,
  };
}

describe("galaxy model", () => {
  it("keeps the top one hundred games individually selectable and aggregates the rest", () => {
    const model = createGalaxyModel(starMapFiveHundredFixture.games);

    expect(model.totalGameCount).toBe(500);
    expect(model.games).toHaveLength(GALAXY_INTERACTIVE_GAME_LIMIT);
    expect(model.games[0]).toMatchObject({
      appId: 9_000,
      coverImageUrl:
        "https://cdn.cloudflare.steamstatic.com/steam/apps/9000/header.jpg",
      rank: 1,
    });
    expect(model.games.at(-1)).toMatchObject({ appId: 9_099, rank: 100 });
    expect(model.longTail).toMatchObject({
      id: "aggregate:long-tail",
      gameCount: 400,
      playedGameCount: 60,
      unplayedGameCount: 340,
    });
  });

  it("represents zero-hour games as selectable archive signals with zero physical volume", () => {
    const model = createGalaxyModel(allUnplayedFixture.games);

    expect(model.games).toHaveLength(20);
    expect(model.games.every((node) => node.kind === "archive-signal")).toBe(
      true,
    );
    expect(model.games.every((node) => node.physicalRadius === 0)).toBe(true);
    expect(model.unplayedGameCount).toBe(20);
  });

  it("keeps positive-playtime planet volume strictly proportional to playtime", () => {
    const smallRadius = getGalaxyPlanetRadius(100 * 60);
    const largeRadius = getGalaxyPlanetRadius(1_000 * 60);

    expect(largeRadius ** 3 / smallRadius ** 3).toBeCloseTo(10, 12);
  });

  it("uses AppID as the deterministic tiebreaker and does not mutate input", () => {
    const games = [game(30, 60), game(10, 60), game(20, 0)];
    const originalOrder = games.map((item) => item.appId);
    const model = createGalaxyModel(games);

    expect(model.games.map((node) => node.appId)).toEqual([10, 30, 20]);
    expect(games.map((item) => item.appId)).toEqual(originalOrder);
  });
});
