import {
  STAR_MAP_HEIGHT,
  STAR_MAP_WIDTH,
  type StarMapLayout,
  type StarMapNode,
} from "./star-map";

const fullTurn = Math.PI * 2;
const centerX = STAR_MAP_WIDTH / 2;
const centerY = STAR_MAP_HEIGHT / 2;

export interface SolarSystemBody {
  node: StarMapNode;
  isCore: boolean;
  orbitalBand: number;
  orbitRadius: number;
  orbitTilt: number;
  phase: number;
  speed: number;
}

export interface SolarSystemLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  bodies: SolarSystemBody[];
}

export interface SolarProjection {
  body: SolarSystemBody;
  x: number;
  y: number;
  depth: number;
  radius: number;
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

function getOrbitalBand(
  node: StarMapNode,
  playedIndex: number,
  dustIndex: number,
) {
  if (node.kind === "nebula") {
    return 7;
  }

  if (node.kind === "dust") {
    return 6 + (dustIndex % 2);
  }

  return Math.min(5, 1 + Math.floor(Math.sqrt(Math.max(playedIndex, 1))));
}

export function createSolarSystemLayout(
  layout: StarMapLayout,
): SolarSystemLayout {
  const core =
    layout.nodes.find((node) => node.kind === "top" && node.rank === 1) ??
    layout.nodes[0] ??
    null;
  let playedIndex = 0;
  let dustIndex = 0;

  const bodies = layout.nodes.map((node) => {
    const isCore = node.id === core?.id;
    const band = isCore ? 0 : getOrbitalBand(node, playedIndex, dustIndex);
    const seed = normalizedHash(node.id);

    if (node.kind === "dust") {
      dustIndex += 1;
    } else if (!isCore && node.kind !== "nebula") {
      playedIndex += 1;
    }

    return {
      node,
      isCore,
      orbitalBand: band,
      orbitRadius: isCore ? 0 : 92 + band * 52,
      orbitTilt: isCore ? 0 : 0.2 + band * 0.017,
      phase: seed * fullTurn,
      speed: isCore ? 0 : (0.022 + seed * 0.016) / Math.max(band, 1),
    };
  });

  return {
    width: STAR_MAP_WIDTH,
    height: STAR_MAP_HEIGHT,
    centerX,
    centerY,
    bodies,
  };
}

export function projectSolarSystem(
  layout: SolarSystemLayout,
  elapsedSeconds: number,
  yaw: number,
): SolarProjection[] {
  return layout.bodies.map((body) => {
    if (body.isCore) {
      return {
        body,
        x: layout.centerX,
        y: layout.centerY,
        depth: 0.5,
        radius: Math.max(46, Math.min(70, body.node.radius + 28)),
      };
    }

    const phase = body.phase + yaw + elapsedSeconds * body.speed;
    const depth = (Math.sin(phase) + 1) / 2;
    const scale = 0.62 + depth * 0.55;
    const radius = Math.max(3, body.node.radius * 0.56 * scale);

    return {
      body,
      x: layout.centerX + Math.cos(phase) * body.orbitRadius,
      y: layout.centerY + Math.sin(phase) * body.orbitRadius * body.orbitTilt,
      depth,
      radius,
    };
  });
}

export function findSolarBodyAtPoint(
  projections: readonly SolarProjection[],
  x: number,
  y: number,
): SolarSystemBody | null {
  return (
    [...projections]
      .sort((left, right) => right.depth - left.depth)
      .find(
        (projection) =>
          Math.hypot(projection.x - x, projection.y - y) <=
          projection.radius + 10,
      )?.body ?? null
  );
}
