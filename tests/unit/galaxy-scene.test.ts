import { describe, expect, it } from "vitest";

import { createGalaxyModel } from "@/lib/report/galaxy";
import { createGalaxyScene } from "@/lib/report/galaxy-scene";

import {
  allUnplayedFixture,
  starMapFiveHundredFixture,
} from "../fixtures/report";

describe("galaxy scene", () => {
  it("stages every individually selectable game body from the top-one-hundred model", () => {
    const model = createGalaxyModel(starMapFiveHundredFixture.games);
    const scene = createGalaxyScene(model);

    expect(scene.bodies).toHaveLength(100);
    expect(scene.bodies[0]).toMatchObject({
      isCore: true,
      node: { appId: 9_000, rank: 1 },
      orbitRadius: 0,
    });
    expect(scene.bodies[1]?.orbitBand).toBe(1);
    expect(scene.bodies[8]?.orbitBand).toBe(1);
    expect(scene.bodies[9]?.orbitBand).toBe(2);
    expect(scene.cameraDistance).toBeGreaterThan(44);
  });

  it("preserves strict planet radii while giving zero-hour archive signals a pickable render size", () => {
    const model = createGalaxyModel(allUnplayedFixture.games);
    const scene = createGalaxyScene(model);

    expect(scene.bodies).toHaveLength(20);
    expect(scene.bodies.every((body) => !body.isCore)).toBe(true);
    expect(scene.bodies.every((body) => body.node.physicalRadius === 0)).toBe(
      true,
    );
    expect(scene.bodies.every((body) => body.radius > 0)).toBe(true);
  });

  it("keeps the same library layout deterministic", () => {
    const model = createGalaxyModel(starMapFiveHundredFixture.games);

    expect(createGalaxyScene(model)).toStrictEqual(createGalaxyScene(model));
  });
});
