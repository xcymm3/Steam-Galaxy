import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import { createStarMapLayout } from "@/lib/report/star-map";
import {
  createThreeStarSystem,
  getPlanetRadiusForPlaytime,
  solarSystemRoles,
  THREE_STAR_SYSTEM_LIMIT,
} from "@/lib/report/three-star-system";

import {
  starMapHundredFixture,
  thousandHourSingleFixture,
} from "../fixtures/report";

function reportGames(snapshot: Parameters<typeof analyzeSteamSnapshot>[0]) {
  return analyzeSteamSnapshot(snapshot).games;
}

describe("three star system", () => {
  it("maps playtime to sphere volume without a visual minimum", () => {
    const hundredHourRadius = getPlanetRadiusForPlaytime(100 * 60);
    const thousandHourRadius = getPlanetRadiusForPlaytime(1_000 * 60);
    const hundredHourVolume = (4 / 3) * Math.PI * hundredHourRadius ** 3;
    const thousandHourVolume = (4 / 3) * Math.PI * thousandHourRadius ** 3;

    expect(thousandHourVolume / hundredHourVolume).toBeCloseTo(10, 10);
    expect(getPlanetRadiusForPlaytime(0)).toBe(0);
  });

  it("keeps the highest-playtime game at the solar core", () => {
    const layout = createStarMapLayout(reportGames(thousandHourSingleFixture));
    const system = createThreeStarSystem(layout);
    const core = system.bodies.find((body) => body.isCore);

    expect(core?.node.name).toBe("Endless Anchor");
    expect(core?.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("produces a deterministic orbital layout", () => {
    const layout = createStarMapLayout(reportGames(thousandHourSingleFixture));

    expect(createThreeStarSystem(layout)).toStrictEqual(
      createThreeStarSystem(layout),
    );
  });

  it("only renders the ten longest-played games as the solar system", () => {
    const layout = createStarMapLayout(reportGames(starMapHundredFixture));
    const system = createThreeStarSystem(layout);

    expect(system.bodies).toHaveLength(THREE_STAR_SYSTEM_LIMIT);
    expect(system.bodies.map((body) => body.solarSystemRole)).toEqual(
      solarSystemRoles,
    );
    expect(system.bodies.every((body) => body.node.rank! <= 10)).toBe(true);
  });
});
