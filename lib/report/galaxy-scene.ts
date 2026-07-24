import type { GalaxyGameNode, GalaxyModel } from "./galaxy";

const fullTurn = Math.PI * 2;
const bodiesPerOrbit = 8;
const archiveSignalRadius = 0.26;
const minimumOrbitRadius = 16;
const orbitBandGap = 10;
const textureVariantCount = 4;

export interface GalaxySceneBody {
  isCore: boolean;
  node: GalaxyGameNode;
  orbitBand: number;
  orbitRadius: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  radius: number;
  textureVariant: number;
}

export interface GalaxyScene {
  bodies: GalaxySceneBody[];
  cameraDistance: number;
}

function stableHash(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function normalizedHash(value: string) {
  return stableHash(value) / 4_294_967_295;
}

function getRenderRadius(node: GalaxyGameNode) {
  return node.kind === "planet" ? node.physicalRadius : archiveSignalRadius;
}

/**
 * Produces a stable, bounded 3D staging layout for the individually selectable
 * part of a player's galaxy. Camera choreography and level-of-detail controls
 * are intentionally kept outside this data-only model.
 */
export function createGalaxyScene(model: GalaxyModel): GalaxyScene {
  const coreNode = model.games.find((node) => node.kind === "planet") ?? null;
  const coreRadius = coreNode ? getRenderRadius(coreNode) : 0;
  const firstOrbitRadius = Math.max(
    minimumOrbitRadius,
    coreRadius + minimumOrbitRadius,
  );
  let orbitIndex = 0;

  const bodies = model.games.map((node) => {
    const isCore = node.id === coreNode?.id;
    const radius = getRenderRadius(node);
    const textureVariant = stableHash(node.id) % textureVariantCount;

    if (isCore) {
      return {
        isCore,
        node,
        orbitBand: 0,
        orbitRadius: 0,
        position: { x: 0, y: 0, z: 0 },
        radius,
        textureVariant,
      };
    }

    const band = Math.floor(orbitIndex / bodiesPerOrbit) + 1;
    const withinBand = orbitIndex % bodiesPerOrbit;
    const seed = normalizedHash(node.id);
    const orbitRadius = firstOrbitRadius + (band - 1) * orbitBandGap;
    const angle =
      (withinBand / bodiesPerOrbit) * fullTurn + seed * 0.46 + band * 0.19;
    const verticalOffset =
      (seed - 0.5) * Math.min(6, orbitRadius * 0.075) +
      Math.sin(angle * 2) * 0.72;
    orbitIndex += 1;

    return {
      isCore,
      node,
      orbitBand: band,
      orbitRadius,
      position: {
        x: Math.cos(angle) * orbitRadius,
        y: verticalOffset,
        z: Math.sin(angle) * orbitRadius,
      },
      radius,
      textureVariant,
    };
  });
  const furthestEdge = bodies.reduce(
    (furthest, body) => Math.max(furthest, body.orbitRadius + body.radius),
    minimumOrbitRadius,
  );

  return {
    bodies,
    cameraDistance: Math.max(44, Math.min(230, furthestEdge * 1.38 + 18)),
  };
}
