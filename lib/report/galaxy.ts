import { getSteamGameHeaderImageUrl } from "@/lib/steam/assets";

import { sortOwnedGames } from "./metrics";
import type { OwnedGame } from "./types";

export const GALAXY_INTERACTIVE_GAME_LIMIT = 100;
export const GALAXY_PLANET_RADIUS_SCALE = 0.5;
export const GALAXY_MINIMUM_PLANET_RADIUS = 0.3;

export type GalaxyGameKind = "planet";

export interface GalaxyGameNode {
  id: string;
  appId: number;
  coverImageUrl: string;
  game: OwnedGame;
  kind: GalaxyGameKind;
  rank: number;
  physicalRadius: number;
}

export interface GalaxyLongTail {
  id: "aggregate:long-tail";
  gameCount: number;
  playedGameCount: number;
  playtimeMinutes: number;
  unplayedGameCount: number;
}

export interface GalaxyModel {
  games: GalaxyGameNode[];
  longTail: GalaxyLongTail | null;
  playedGameCount: number;
  totalGameCount: number;
  totalPlaytimeMinutes: number;
  unplayedGameCount: number;
}

/**
 * A sphere's volume is 4/3πr³. Making r proportional to ∛hours means that
 * every positive-playtime planet has volume strictly proportional to playtime.
 * A zero-hour game receives the smallest visible planet so every owned game
 * belongs to the same navigable stellar system.
 */
export function getGalaxyPlanetRadius(playtimeMinutes: number) {
  if (playtimeMinutes <= 0) {
    return GALAXY_MINIMUM_PLANET_RADIUS;
  }

  return Math.cbrt(playtimeMinutes / 60) * GALAXY_PLANET_RADIUS_SCALE;
}

function summarizeLongTail(games: OwnedGame[]): GalaxyLongTail | null {
  if (games.length === 0) {
    return null;
  }

  const playedGameCount = games.filter(
    (game) => game.playtimeMinutes > 0,
  ).length;

  return {
    id: "aggregate:long-tail",
    gameCount: games.length,
    playedGameCount,
    playtimeMinutes: games.reduce(
      (total, game) => total + game.playtimeMinutes,
      0,
    ),
    unplayedGameCount: games.length - playedGameCount,
  };
}

/**
 * Separates a full Steam library into at most one hundred individually
 * selectable planets and an honest aggregate for the remaining games.
 *
 * Ordering is deterministic: higher playtime first, then lower AppID. Every
 * library game remains represented by either a selectable body or the long-tail
 * aggregate. Store metadata is deliberately absent and loaded only on demand.
 */
export function createGalaxyModel(games: readonly OwnedGame[]): GalaxyModel {
  const orderedGames = sortOwnedGames(games);
  const visibleGames = orderedGames.slice(0, GALAXY_INTERACTIVE_GAME_LIMIT);
  const longTailGames = orderedGames.slice(GALAXY_INTERACTIVE_GAME_LIMIT);
  const playedGameCount = orderedGames.filter(
    (game) => game.playtimeMinutes > 0,
  ).length;

  return {
    games: visibleGames.map((game, index) => ({
      id: `game:${game.appId}`,
      appId: game.appId,
      coverImageUrl: getSteamGameHeaderImageUrl(game.appId),
      game,
      kind: "planet",
      rank: index + 1,
      physicalRadius: getGalaxyPlanetRadius(game.playtimeMinutes),
    })),
    longTail: summarizeLongTail(longTailGames),
    playedGameCount,
    totalGameCount: orderedGames.length,
    totalPlaytimeMinutes: orderedGames.reduce(
      (total, game) => total + game.playtimeMinutes,
      0,
    ),
    unplayedGameCount: orderedGames.length - playedGameCount,
  };
}
