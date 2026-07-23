import type { SteamSnapshot } from "@/lib/steam/types";

import {
  calculateReportMetrics,
  groupOwnedGames,
  sortOwnedGames,
} from "./metrics";
import { createEmptyGameMetadataProfile } from "./game-metadata";
import { selectPlayerTitle } from "./titles";
import type { ReportData } from "./types";

export function analyzeSteamSnapshot(snapshot: SteamSnapshot): ReportData {
  const games = sortOwnedGames(snapshot.games);
  const { playedGames, unplayedGames, lowPlaytimeGames } =
    groupOwnedGames(games);
  const metrics = calculateReportMetrics(
    games,
    snapshot.player.createdAt,
    snapshot.retrievedAt,
  );
  const topGames = playedGames.slice(0, 5);

  return {
    player: { ...snapshot.player },
    metrics,
    games,
    playedGames,
    topGames,
    unplayedGames,
    lowPlaytimeGames,
    gameMetadata: createEmptyGameMetadataProfile(),
    title: selectPlayerTitle(metrics, topGames[0] ?? null),
    retrievedAt: snapshot.retrievedAt,
    diagnostics: { ...snapshot.diagnostics },
  };
}
