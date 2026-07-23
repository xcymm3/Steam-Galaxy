import type { GameGroups, OwnedGame, ReportMetrics } from "./types";

export const LOW_PLAYTIME_LIMIT_MINUTES = 120;

export function safeRatio(
  numerator: number,
  denominator: number,
): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function sortOwnedGames(games: readonly OwnedGame[]): OwnedGame[] {
  return games
    .map((game) => ({ ...game }))
    .sort(
      (left, right) =>
        right.playtimeMinutes - left.playtimeMinutes ||
        left.appId - right.appId,
    );
}

export function groupOwnedGames(games: readonly OwnedGame[]): GameGroups {
  const playedGames: OwnedGame[] = [];
  const unplayedGames: OwnedGame[] = [];
  const lowPlaytimeGames: OwnedGame[] = [];

  games.forEach((game) => {
    if (game.playtimeMinutes === 0) {
      unplayedGames.push(game);
      return;
    }

    playedGames.push(game);
    if (game.playtimeMinutes < LOW_PLAYTIME_LIMIT_MINUTES) {
      lowPlaytimeGames.push(game);
    }
  });

  return { playedGames, unplayedGames, lowPlaytimeGames };
}

export function calculateSteamAgeYears(
  createdAt: string | null,
  asOf: string,
): number | null {
  if (!createdAt) {
    return null;
  }

  const created = new Date(createdAt);
  const current = new Date(asOf);

  if (
    !Number.isFinite(created.getTime()) ||
    !Number.isFinite(current.getTime()) ||
    current < created
  ) {
    return null;
  }

  let years = current.getUTCFullYear() - created.getUTCFullYear();
  const anniversary = new Date(created);
  anniversary.setUTCFullYear(current.getUTCFullYear());

  if (current < anniversary) {
    years -= 1;
  }

  return years;
}

export function calculateReportMetrics(
  games: readonly OwnedGame[],
  playerCreatedAt: string | null,
  retrievedAt: string,
): ReportMetrics {
  const sortedGames = sortOwnedGames(games);
  const { playedGames, unplayedGames, lowPlaytimeGames } =
    groupOwnedGames(sortedGames);
  const totalPlaytimeMinutes = sortedGames.reduce(
    (sum, game) => sum + game.playtimeMinutes,
    0,
  );
  const topOneMinutes = playedGames[0]?.playtimeMinutes ?? 0;
  const topThreeMinutes = playedGames
    .slice(0, 3)
    .reduce((sum, game) => sum + game.playtimeMinutes, 0);

  return {
    totalGameCount: sortedGames.length,
    playedGameCount: playedGames.length,
    unplayedGameCount: unplayedGames.length,
    lowPlaytimeGameCount: lowPlaytimeGames.length,
    totalPlaytimeMinutes,
    totalPlaytimeHours: totalPlaytimeMinutes / 60,
    reachRatio: safeRatio(playedGames.length, sortedGames.length),
    unplayedRatio: safeRatio(unplayedGames.length, sortedGames.length),
    topOneRatio: safeRatio(topOneMinutes, totalPlaytimeMinutes),
    topThreeRatio: safeRatio(topThreeMinutes, totalPlaytimeMinutes),
    lowPlaytimeRatio: safeRatio(lowPlaytimeGames.length, playedGames.length),
    steamAgeYears: calculateSteamAgeYears(playerCreatedAt, retrievedAt),
  };
}
