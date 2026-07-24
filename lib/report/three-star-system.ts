import { getGalaxyPlanetRadius } from "./galaxy";
import type { StarMapLayout, StarMapNode } from "./star-map";

export const THREE_STAR_SYSTEM_LIMIT = 10;

export { getGalaxyPlanetRadius as getPlanetRadiusForPlaytime } from "./galaxy";

export const solarSystemRoles = [
  "太阳",
  "水星",
  "金星",
  "地球",
  "火星",
  "木星",
  "土星",
  "天王星",
  "海王星",
  "冥王星",
] as const;

export type SolarSystemRole = (typeof solarSystemRoles)[number];

export interface ThreeStarBody {
  node: StarMapNode;
  isCore: boolean;
  solarSystemRole: SolarSystemRole;
  position: {
    x: number;
    y: number;
    z: number;
  };
  radius: number;
  orbitRadius: number;
  phase: number;
}

export interface ThreeStarSystem {
  bodies: ThreeStarBody[];
  cameraDistance: number;
}

const fullTurn = Math.PI * 2;

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

function getOrbitRadius(index: number, radius: number) {
  const ring = Math.floor(index / 7);
  const withinRing = index % 7;

  return 11 + ring * 9 + withinRing * 1.1 + radius * 1.8;
}

export function createThreeStarSystem(layout: StarMapLayout): ThreeStarSystem {
  const visibleNodes = layout.nodes
    .filter(
      (node) =>
        (node.kind === "top" || node.kind === "played") &&
        node.playtimeMinutes > 0,
    )
    .sort((left, right) => (left.rank ?? Infinity) - (right.rank ?? Infinity))
    .slice(0, THREE_STAR_SYSTEM_LIMIT);

  const bodies = visibleNodes.map((node, index) => {
    const isCore = index === 0;
    const seed = normalizedHash(node.id);
    const phase = seed * fullTurn;
    const radius = getGalaxyPlanetRadius(node.playtimeMinutes);
    const solarSystemRole = solarSystemRoles[index];

    if (!solarSystemRole) {
      throw new Error("太阳系角色数量与可见星球数量不一致。");
    }

    if (isCore) {
      return {
        node,
        isCore: true,
        solarSystemRole,
        position: { x: 0, y: 0, z: 0 },
        radius,
        orbitRadius: 0,
        phase,
      };
    }

    const orbitalIndex = index - 1;
    const orbitRadius = getOrbitRadius(orbitalIndex, radius);
    const orbitPhase = phase + orbitalIndex * 1.31;
    const verticalOffset = (seed - 0.5) * Math.min(7, orbitRadius * 0.14);

    return {
      node,
      isCore: false,
      solarSystemRole,
      position: {
        x: Math.cos(orbitPhase) * orbitRadius,
        y: verticalOffset,
        z: Math.sin(orbitPhase) * orbitRadius,
      },
      radius,
      orbitRadius,
      phase: orbitPhase,
    };
  });
  const furthestEdge = bodies.reduce(
    (furthest, body) => Math.max(furthest, body.orbitRadius + body.radius),
    16,
  );

  return {
    bodies,
    cameraDistance: Math.max(31, Math.min(126, furthestEdge * 1.55 + 13)),
  };
}
