export interface SteamPlayer {
  steamId: string;
  displayName: string;
  profileUrl: string;
  avatarUrl: string | null;
  createdAt: string | null;
  lastLogoffAt: string | null;
}

export interface SteamGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  iconHash: string | null;
  lastPlayedAt: string | null;
}

export interface SteamSnapshotDiagnostics {
  reportedGameCount: number;
  skippedGameCount: number;
}

export interface SteamSnapshot {
  player: SteamPlayer;
  games: SteamGame[];
  gameCount: number;
  retrievedAt: string;
  diagnostics: SteamSnapshotDiagnostics;
}

export interface SteamLookupRequest {
  steamIdInput: string;
}

export interface SteamLookupErrorPayload {
  code: import("./errors").SteamErrorCode;
  message: string;
  retryable: boolean;
}

export type SteamLookupResponse<TData = SteamSnapshot> =
  { ok: true; data: TData } | { ok: false; error: SteamLookupErrorPayload };
