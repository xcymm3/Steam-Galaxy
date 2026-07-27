import { describe, expect, it } from "vitest";

import { createGalaxyModel } from "@/lib/report/galaxy";
import {
  createGalaxyScene,
  getGalaxyFocusDistance,
} from "@/lib/report/galaxy-scene";

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
    expect(scene.bodies[1]).toMatchObject({ orbitBand: 1, orbitCapacity: 6 });
    expect(scene.bodies[6]).toMatchObject({ orbitBand: 1, orbitCapacity: 6 });
    expect(scene.bodies[7]).toMatchObject({ orbitBand: 2, orbitCapacity: 9 });
    expect(scene.bodies[15]).toMatchObject({ orbitBand: 2, orbitCapacity: 9 });
    expect(scene.bodies[16]).toMatchObject({
      orbitBand: 3,
      orbitCapacity: 10,
    });
    expect(scene.cameraDistance).toBeGreaterThan(44);
  });

  it("keeps higher-playtime ranks in inner, non-overlapping time bands", () => {
    const model = createGalaxyModel(starMapFiveHundredFixture.games);
    const scene = createGalaxyScene(model);
    const orbitBodies = scene.bodies.filter((body) => !body.isCore);
    const orbitRadii = [
      ...new Set(orbitBodies.map((body) => body.orbitRadius)),
    ];
    const bands = orbitBodies.reduce((allBands, body) => {
      const bodies = allBands.get(body.orbitBand) ?? [];

      bodies.push(body);
      allBands.set(body.orbitBand, bodies);
      return allBands;
    }, new Map<number, typeof orbitBodies>());
    const orderedBands = [...bands.values()];

    expect(orbitBodies.map((body) => body.node.rank)).toStrictEqual(
      [...orbitBodies.map((body) => body.node.rank)].sort(
        (left, right) => left - right,
      ),
    );
    expect(orbitRadii).toStrictEqual(
      [...orbitRadii].sort((left, right) => left - right),
    );
    expect(orbitBodies.at(-1)?.orbitBand).toBe(9);
    orderedBands.slice(1).forEach((band, index) => {
      const previousBand = orderedBands[index];
      const previousRadius = previousBand?.[0]?.orbitRadius ?? 0;
      const currentRadius = band[0]?.orbitRadius ?? 0;
      const previousMaximum = Math.max(
        ...(previousBand?.map((body) => body.radius) ?? [0]),
      );
      const currentMaximum = Math.max(...band.map((body) => body.radius));

      expect(currentRadius - previousRadius).toBeGreaterThanOrEqual(
        previousMaximum + currentMaximum + 4 - Number.EPSILON * 32,
      );
    });
  });

  it("keeps zero-hour games as small, pickable planets", () => {
    const model = createGalaxyModel(allUnplayedFixture.games);
    const scene = createGalaxyScene(model);

    expect(scene.bodies).toHaveLength(20);
    expect(scene.bodies[0]?.isCore).toBe(true);
    expect(scene.bodies.every((body) => body.node.kind === "planet")).toBe(
      true,
    );
    expect(scene.bodies.every((body) => body.radius > 0)).toBe(true);
  });

  it("keeps the same library layout deterministic", () => {
    const model = createGalaxyModel(starMapFiveHundredFixture.games);

    expect(createGalaxyScene(model)).toStrictEqual(createGalaxyScene(model));
  });

  it("provides a bounded close-up distance without changing planet scale", () => {
    const model = createGalaxyModel(starMapFiveHundredFixture.games);
    const scene = createGalaxyScene(model);
    const core = scene.bodies[0];

    expect(core).toBeDefined();
    expect(getGalaxyFocusDistance(scene, core!)).toBeGreaterThanOrEqual(9);
    expect(getGalaxyFocusDistance(scene, core!)).toBeLessThanOrEqual(
      scene.cameraDistance * 0.76,
    );
    expect(core?.radius).toBe(model.games[0]?.physicalRadius);
  });
});
