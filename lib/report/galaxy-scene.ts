import type { GalaxyGameNode, GalaxyModel } from "./galaxy";

const fullTurn = Math.PI * 2;
const archiveSignalRadius = 0.26;
const minimumOrbitRadius = 16;
const orbitBandGap = 10;
const textureVariantCount = 4;
const focusMinimumDistance = 9;
const focusPadding = 4;
const orbitCapacities = [6, 9, 10, 11, 12, 12, 13, 13, 13] as const;

export interface GalaxySceneBody {
  isCore: boolean;
  node: GalaxyGameNode;
  orbitBand: number;
  orbitCapacity: number;
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

interface OrbitPlan {
  capacity: number;
  maxBodyRadius: number;
  radius: number;
  startIndex: number;
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

function createOrbitPlans(nodes: GalaxyGameNode[], coreRadius: number) {
  const plans: OrbitPlan[] = [];
  let startIndex = 0;
  let previousPlan: OrbitPlan | null = null;

  orbitCapacities.forEach((capacity) => {
    const bandNodes = nodes.slice(startIndex, startIndex + capacity);

    if (bandNodes.length === 0) {
      return;
    }

    const maxBodyRadius = bandNodes.reduce(
      (maximum, node) => Math.max(maximum, getRenderRadius(node)),
      archiveSignalRadius,
    );
    const radius = previousPlan
      ? previousPlan.radius +
        Math.max(
          orbitBandGap,
          previousPlan.maxBodyRadius + maxBodyRadius + focusPadding,
        )
      : Math.max(minimumOrbitRadius, coreRadius + maxBodyRadius + orbitBandGap);
    const plan = { capacity, maxBodyRadius, radius, startIndex };

    plans.push(plan);
    previousPlan = plan;
    startIndex += capacity;
  });

  return plans;
}

/**
 * Produces a stable, bounded 3D staging layout for the individually selectable
 * part of a player's galaxy. Games are already ordered by playtime, so the
 * inner bands always represent the highest-time tier without inventing any
 * genre or popularity signal.
 */
export function createGalaxyScene(model: GalaxyModel): GalaxyScene {
  const coreNode = model.games.find((node) => node.kind === "planet") ?? null;
  const coreRadius = coreNode ? getRenderRadius(coreNode) : 0;
  const orbitNodes = model.games.filter((node) => node.id !== coreNode?.id);
  const orbitIndexById = new Map(
    orbitNodes.map((node, index) => [node.id, index]),
  );
  const orbitPlans = createOrbitPlans(orbitNodes, coreRadius);

  const bodies = model.games.map((node) => {
    const isCore = node.id === coreNode?.id;
    const radius = getRenderRadius(node);
    const textureVariant = stableHash(node.id) % textureVariantCount;

    if (isCore) {
      return {
        isCore,
        node,
        orbitBand: 0,
        orbitCapacity: 0,
        orbitRadius: 0,
        position: { x: 0, y: 0, z: 0 },
        radius,
        textureVariant,
      };
    }

    const orbitIndex = orbitIndexById.get(node.id);

    if (orbitIndex === undefined) {
      throw new Error("Galaxy orbit index is missing a selectable body.");
    }

    const plan = orbitPlans.find(
      (orbitPlan) =>
        orbitIndex >= orbitPlan.startIndex &&
        orbitIndex < orbitPlan.startIndex + orbitPlan.capacity,
    );

    if (!plan) {
      throw new Error("Galaxy orbit plan is missing a selectable body.");
    }

    const band = orbitPlans.indexOf(plan) + 1;
    const withinBand = orbitIndex - plan.startIndex;
    const seed = normalizedHash(node.id);
    const angle =
      (withinBand / plan.capacity) * fullTurn + seed * 0.46 + band * 0.19;
    const verticalOffset =
      (seed - 0.5) * Math.min(6, plan.radius * 0.075) +
      Math.sin(angle * 2) * 0.72;

    return {
      isCore,
      node,
      orbitBand: band,
      orbitCapacity: plan.capacity,
      orbitRadius: plan.radius,
      position: {
        x: Math.cos(angle) * plan.radius,
        y: verticalOffset,
        z: Math.sin(angle) * plan.radius,
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

/**
 * Keeps a selected body comfortably inside the field of view. This distance is
 * only a camera instruction; it never alters the playtime-derived body size.
 */
export function getGalaxyFocusDistance(
  scene: GalaxyScene,
  body: GalaxySceneBody,
) {
  const desiredDistance = Math.max(
    focusMinimumDistance,
    body.radius * 7 + focusPadding,
  );
  const maximumDistance = Math.max(
    focusMinimumDistance,
    scene.cameraDistance * 0.76,
  );

  return Math.min(desiredDistance, maximumDistance);
}
