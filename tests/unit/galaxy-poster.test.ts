import { describe, expect, it } from "vitest";

import {
  createGalaxyPosterSummary,
  getMainStarRatio,
} from "@/lib/report/galaxy-poster";
import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import { ordinaryPlayerFixture } from "../fixtures/report";

describe("galaxy poster summary", () => {
  it("uses the leading game as the main star and the following eight as planets", () => {
    const report = analyzeSteamSnapshot(ordinaryPlayerFixture);
    const summary = createGalaxyPosterSummary(report);

    expect(summary.mainStar).toMatchObject({
      name: "Main Sequence",
      rank: 1,
    });
    expect(summary.planets.map((planet) => planet.name)).toEqual([
      "Second Orbit",
      "Two Hour Line",
      "Short Signal",
      "Dust Shelf",
      "Unlit Harbor",
    ]);
    expect(summary.persona).toBe("初启探索型玩家");
  });

  it("calculates the main star share from the report total", () => {
    const report = analyzeSteamSnapshot(ordinaryPlayerFixture);
    const summary = createGalaxyPosterSummary(report);

    expect(getMainStarRatio(summary)).toBeCloseTo(64.94, 2);
  });
});
