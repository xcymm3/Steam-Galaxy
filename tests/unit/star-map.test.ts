import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import {
  createStarMapLayout,
  STAR_MAP_GAME_LIMIT,
  STAR_MAP_HEIGHT,
  STAR_MAP_WIDTH,
} from "@/lib/report/star-map";

import {
  allUnplayedFixture,
  starMapFiveHundredFixture,
  starMapHundredFixture,
  thousandHourSingleFixture,
} from "../fixtures/report";

function reportGames(snapshot: Parameters<typeof analyzeSteamSnapshot>[0]) {
  return analyzeSteamSnapshot(snapshot).games;
}

describe("star-map layout", () => {
  it("centers a single played game with a stable rank", () => {
    const layout = createStarMapLayout(reportGames(thousandHourSingleFixture));

    expect(layout).toMatchObject({
      state: "ready",
      totalGameCount: 1,
      nodes: [
        {
          kind: "top",
          rank: 1,
          x: STAR_MAP_WIDTH / 2,
          y: STAR_MAP_HEIGHT / 2,
        },
      ],
    });
  });

  it("uses unranked dust for a twenty-game zero-hour library", () => {
    const layout = createStarMapLayout(reportGames(allUnplayedFixture));

    expect(layout.state).toBe("unlit");
    expect(layout.nodes).toHaveLength(20);
    expect(layout.nodes.every((node) => node.kind === "dust")).toBe(true);
    expect(layout.nodes.every((node) => node.rank === null)).toBe(true);
  });

  it("keeps all one hundred games distinct and places planets inside bounds", () => {
    const layout = createStarMapLayout(reportGames(starMapHundredFixture));
    const planets = layout.nodes.filter(
      (node) => node.kind === "top" || node.kind === "played",
    );

    expect(layout.nodes).toHaveLength(100);
    expect(layout.aggregatedGameCount).toBe(0);
    expect(planets).toHaveLength(80);

    planets.forEach((node) => {
      expect(node.x - node.radius).toBeGreaterThan(0);
      expect(node.x + node.radius).toBeLessThan(STAR_MAP_WIDTH);
      expect(node.y - node.radius).toBeGreaterThan(0);
      expect(node.y + node.radius).toBeLessThan(STAR_MAP_HEIGHT);
    });

    planets.forEach((node, index) => {
      planets.slice(index + 1).forEach((other) => {
        expect(
          Math.hypot(node.x - other.x, node.y - other.y),
        ).toBeGreaterThanOrEqual(node.radius + other.radius + 7);
      });
    });
  });

  it("aggregates the long tail after the one-hundred-game detail limit", () => {
    const layout = createStarMapLayout(reportGames(starMapFiveHundredFixture));
    const nebula = layout.nodes.find((node) => node.kind === "nebula");

    expect(layout.renderedGameCount).toBe(STAR_MAP_GAME_LIMIT);
    expect(layout.aggregatedGameCount).toBe(400);
    expect(layout.nodes).toHaveLength(STAR_MAP_GAME_LIMIT + 1);
    expect(nebula).toMatchObject({
      name: "远端星云",
      gameCount: 400,
      rank: null,
    });
  });

  it("produces the same layout for the same five-hundred-game fixture", () => {
    const games = reportGames(starMapFiveHundredFixture);

    expect(createStarMapLayout(games)).toStrictEqual(
      createStarMapLayout(games),
    );
  });

  it("lays out five hundred games within a small rendering budget", () => {
    const games = reportGames(starMapFiveHundredFixture);
    const startedAt = performance.now();
    const layout = createStarMapLayout(games);
    const elapsed = performance.now() - startedAt;

    expect(layout.nodes.length).toBeLessThanOrEqual(STAR_MAP_GAME_LIMIT + 1);
    expect(elapsed).toBeLessThan(150);
  });
});
