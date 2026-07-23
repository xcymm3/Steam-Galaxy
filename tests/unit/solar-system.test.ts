import { describe, expect, it } from "vitest";

import {
  createSolarSystemLayout,
  findSolarBodyAtPoint,
  projectSolarSystem,
} from "@/lib/report/solar-system";
import { createStarMapLayout } from "@/lib/report/star-map";

import { starMapFiveHundredFixture } from "../fixtures/report";

describe("solar system projection", () => {
  it("keeps the highest-playtime game as the central star", () => {
    const layout = createStarMapLayout(starMapFiveHundredFixture.games);
    const solarSystem = createSolarSystemLayout(layout);
    const core = solarSystem.bodies.find((body) => body.isCore);

    expect(core?.node).toMatchObject({
      kind: "top",
      rank: 1,
      name: "Far Orbit 1",
    });
    expect(core?.orbitRadius).toBe(0);
  });

  it("projects deterministic layered orbits and keeps the long tail outermost", () => {
    const layout = createStarMapLayout(starMapFiveHundredFixture.games);
    const solarSystem = createSolarSystemLayout(layout);
    const firstFrame = projectSolarSystem(solarSystem, 12, -0.45);
    const secondFrame = projectSolarSystem(solarSystem, 12, -0.45);
    const nebula = solarSystem.bodies.find(
      (body) => body.node.kind === "nebula",
    );

    expect(firstFrame).toStrictEqual(secondFrame);
    expect(nebula?.orbitalBand).toBe(7);
    expect(nebula?.orbitRadius).toBeGreaterThan(
      solarSystem.bodies.find((body) => body.node.kind === "played")
        ?.orbitRadius ?? 0,
    );
  });

  it("finds a selected body using its projected foreground position", () => {
    const layout = createStarMapLayout(starMapFiveHundredFixture.games);
    const solarSystem = createSolarSystemLayout(layout);
    const projections = projectSolarSystem(solarSystem, 0, 0);
    const core = projections.find((projection) => projection.body.isCore)!;

    expect(findSolarBodyAtPoint(projections, core.x, core.y)?.node.id).toBe(
      core.body.node.id,
    );
  });
});
