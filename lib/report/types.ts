import type {
  SteamGame,
  SteamPlayer,
  SteamSnapshotDiagnostics,
} from "@/lib/steam/types";

import type { GameMetadataProfile } from "./game-metadata";
import type { GalaxyModel } from "./galaxy";

export type OwnedGame = SteamGame;

export interface GameGroups {
  playedGames: OwnedGame[];
  unplayedGames: OwnedGame[];
  lowPlaytimeGames: OwnedGame[];
}

export interface ReportMetrics {
  totalGameCount: number;
  playedGameCount: number;
  unplayedGameCount: number;
  lowPlaytimeGameCount: number;
  totalPlaytimeMinutes: number;
  totalPlaytimeHours: number;
  reachRatio: number | null;
  unplayedRatio: number | null;
  topOneRatio: number | null;
  topThreeRatio: number | null;
  lowPlaytimeRatio: number | null;
  steamAgeYears: number | null;
}

export type PlayerTitleId =
  | "first-ignition"
  | "library-keeper"
  | "single-game-orbit"
  | "thousand-hour-resident"
  | "time-lost"
  | "two-hour-patrol"
  | "wide-orbit";

export interface PlayerTitle {
  id: PlayerTitleId;
  priority: number;
  name: string;
  explanation: string;
}

export interface ReportData {
  player: SteamPlayer;
  metrics: ReportMetrics;
  games: OwnedGame[];
  playedGames: OwnedGame[];
  topGames: OwnedGame[];
  unplayedGames: OwnedGame[];
  lowPlaytimeGames: OwnedGame[];
  gameMetadata: GameMetadataProfile;
  galaxy: GalaxyModel;
  title: PlayerTitle;
  retrievedAt: string;
  diagnostics: SteamSnapshotDiagnostics;
}
