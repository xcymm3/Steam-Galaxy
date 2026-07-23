import { sortOwnedGames } from "./metrics";
import type { OwnedGame } from "./types";

export const STAR_MAP_WIDTH = 1_000;
export const STAR_MAP_HEIGHT = 640;
export const STAR_MAP_GAME_LIMIT = 100;

const centerX = STAR_MAP_WIDTH / 2;
const centerY = STAR_MAP_HEIGHT / 2;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const minimumPlanetRadius = 7;
const maximumPlanetRadius = 44;

export type StarMapState = "ready" | "empty" | "unlit";
export type StarMapNodeKind = "top" | "played" | "dust" | "nebula";

export interface StarMapNode {
  id: string;
  kind: StarMapNodeKind;
  appId: number | null;
  name: string;
  playtimeMinutes: number;
  gameCount: number;
  rank: number | null;
  x: number;
  y: number;
  radius: number;
}

export interface StarMapLayout {
  state: StarMapState;
  width: number;
  height: number;
  nodes: StarMapNode[];
  totalGameCount: number;
  renderedGameCount: number;
  aggregatedGameCount: number;
  unplayedGameCount: number;
}

interface PositionedNode {
  x: number;
  y: number;
  radius: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
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

function isInsideBounds(candidate: PositionedNode) {
  const padding = 8;

  return (
    candidate.x - candidate.radius >= padding &&
    candidate.x + candidate.radius <= STAR_MAP_WIDTH - padding &&
    candidate.y - candidate.radius >= padding &&
    candidate.y + candidate.radius <= STAR_MAP_HEIGHT - padding
  );
}

function overlapsExisting(
  candidate: PositionedNode,
  positioned: PositionedNode[],
) {
  return positioned.some((node) => {
    const distance = Math.hypot(candidate.x - node.x, candidate.y - node.y);
    return distance < candidate.radius + node.radius + 7;
  });
}

function placePlanet(
  game: OwnedGame,
  index: number,
  radius: number,
  positioned: PositionedNode[],
): PositionedNode {
  if (index === 0) {
    return { x: centerX, y: centerY, radius };
  }

  const seed = normalizedHash(`${game.appId}:${game.playtimeMinutes}`);
  const baseAngle = goldenAngle * index + seed * Math.PI * 2;

  for (let attempt = 0; attempt < 220; attempt += 1) {
    const angle = baseAngle + goldenAngle * attempt;
    const ring = 68 + Math.sqrt(index + 1) * 45 + Math.floor(attempt / 18) * 16;
    const candidate = {
      x: centerX + Math.cos(angle) * ring,
      y: centerY + Math.sin(angle) * ring * 0.68,
      radius,
    };

    if (isInsideBounds(candidate) && !overlapsExisting(candidate, positioned)) {
      return candidate;
    }
  }

  const fallbackAngle = baseAngle + Math.PI / 4;
  return {
    x: clamp(
      centerX + Math.cos(fallbackAngle) * 370,
      radius + 8,
      STAR_MAP_WIDTH - radius - 8,
    ),
    y: clamp(
      centerY + Math.sin(fallbackAngle) * 250,
      radius + 8,
      STAR_MAP_HEIGHT - radius - 8,
    ),
    radius,
  };
}

function placeDust(game: OwnedGame, index: number): PositionedNode {
  const seed = normalizedHash(`${game.appId}:dust`);
  const angle = goldenAngle * (index + 1) + seed * Math.PI * 2;
  const ring = 250 + (index % 7) * 17 + seed * 22;
  const radius = 2 + seed * 1.5;

  return {
    x: clamp(
      centerX + Math.cos(angle) * ring,
      radius + 8,
      STAR_MAP_WIDTH - radius - 8,
    ),
    y: clamp(
      centerY + Math.sin(angle) * ring * 0.72,
      radius + 8,
      STAR_MAP_HEIGHT - radius - 8,
    ),
    radius,
  };
}

function planetRadius(
  game: OwnedGame,
  minimumRoot: number,
  maximumRoot: number,
) {
  if (minimumRoot === maximumRoot) {
    return 34;
  }

  const position =
    (Math.sqrt(game.playtimeMinutes) - minimumRoot) /
    (maximumRoot - minimumRoot);

  return (
    minimumPlanetRadius +
    clamp(position, 0, 1) * (maximumPlanetRadius - minimumPlanetRadius)
  );
}

function emptyLayout(games: readonly OwnedGame[]): StarMapLayout {
  return {
    state: "empty",
    width: STAR_MAP_WIDTH,
    height: STAR_MAP_HEIGHT,
    nodes: [],
    totalGameCount: games.length,
    renderedGameCount: 0,
    aggregatedGameCount: 0,
    unplayedGameCount: 0,
  };
}

/**
 * Produces a deterministic, data-only star-map layout. Game type is deliberately
 * absent from this model: visual emphasis only represents playtime and rank.
 */
export function createStarMapLayout(
  games: readonly OwnedGame[],
): StarMapLayout {
  if (games.length === 0) {
    return emptyLayout(games);
  }

  const orderedGames = sortOwnedGames(games);
  const renderedGames = orderedGames.slice(0, STAR_MAP_GAME_LIMIT);
  const aggregatedGames = orderedGames.slice(STAR_MAP_GAME_LIMIT);
  const playedGames = renderedGames.filter((game) => game.playtimeMinutes > 0);
  const unplayedGames = orderedGames.filter(
    (game) => game.playtimeMinutes === 0,
  );
  const allUnplayed = playedGames.length === 0;
  const roots = playedGames.map((game) => Math.sqrt(game.playtimeMinutes));
  const minimumRoot = roots.at(-1) ?? 0;
  const maximumRoot = roots[0] ?? 0;
  const positionedPlanets: PositionedNode[] = [];
  let playedIndex = 0;
  let dustIndex = 0;

  const nodes: StarMapNode[] = renderedGames.map((game) => {
    if (game.playtimeMinutes === 0) {
      const position = placeDust(game, dustIndex);
      dustIndex += 1;

      return {
        id: `game:${game.appId}`,
        kind: "dust" as const,
        appId: game.appId,
        name: game.name,
        playtimeMinutes: 0,
        gameCount: 1,
        rank: null,
        ...position,
      };
    }

    const position = placePlanet(
      game,
      playedIndex,
      planetRadius(game, minimumRoot, maximumRoot),
      positionedPlanets,
    );
    positionedPlanets.push(position);
    playedIndex += 1;

    return {
      id: `game:${game.appId}`,
      kind: playedIndex <= 5 ? ("top" as const) : ("played" as const),
      appId: game.appId,
      name: game.name,
      playtimeMinutes: game.playtimeMinutes,
      gameCount: 1,
      rank: playedIndex,
      ...position,
    };
  });

  if (aggregatedGames.length > 0) {
    const aggregateMinutes = aggregatedGames.reduce(
      (total, game) => total + game.playtimeMinutes,
      0,
    );
    const seedGame = aggregatedGames[0];
    const seed = normalizedHash(`nebula:${seedGame?.appId ?? 0}`);
    const radius = clamp(18 + Math.sqrt(aggregatedGames.length) * 2, 24, 56);

    nodes.push({
      id: "nebula:long-tail",
      kind: "nebula",
      appId: null,
      name: "远端星云",
      playtimeMinutes: aggregateMinutes,
      gameCount: aggregatedGames.length,
      rank: null,
      x: 790 + seed * 110,
      y: 485 + seed * 80,
      radius,
    });
  }

  return {
    state: allUnplayed ? "unlit" : "ready",
    width: STAR_MAP_WIDTH,
    height: STAR_MAP_HEIGHT,
    nodes,
    totalGameCount: orderedGames.length,
    renderedGameCount: renderedGames.length,
    aggregatedGameCount: aggregatedGames.length,
    unplayedGameCount: unplayedGames.length,
  };
}
