import { SteamGatewayError } from "./errors";
import {
  steamOwnedGameSchema,
  type SteamOwnedGamePayload,
  type SteamPlayerPayload,
} from "./schemas";
import type { SteamGame, SteamPlayer } from "./types";

function unixSecondsToIso(value: number | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Date(value * 1_000).toISOString();
}

export function normalizePlayer(player: SteamPlayerPayload): SteamPlayer {
  return {
    steamId: player.steamid,
    displayName: player.personaname,
    profileUrl: player.profileurl,
    avatarUrl: player.avatarfull ?? null,
    createdAt: unixSecondsToIso(player.timecreated),
    lastLogoffAt: unixSecondsToIso(player.lastlogoff),
  };
}

function normalizeGame(game: SteamOwnedGamePayload): SteamGame {
  return {
    appId: game.appid,
    name: game.name,
    playtimeMinutes: game.playtime_forever,
    iconHash: game.img_icon_url || null,
    lastPlayedAt: unixSecondsToIso(game.rtime_last_played),
  };
}

export interface NormalizedGames {
  games: SteamGame[];
  skippedGameCount: number;
}

export function normalizeGames(rawGames: unknown[]): NormalizedGames {
  const games: SteamGame[] = [];
  let skippedGameCount = 0;

  rawGames.forEach((rawGame) => {
    const result = steamOwnedGameSchema.safeParse(rawGame);
    if (!result.success) {
      skippedGameCount += 1;
      return;
    }

    games.push(normalizeGame(result.data));
  });

  games.sort(
    (left, right) =>
      right.playtimeMinutes - left.playtimeMinutes || left.appId - right.appId,
  );

  if (games.length === 0 && skippedGameCount > 0) {
    throw new SteamGatewayError("STEAM_BAD_RESPONSE");
  }

  return { games, skippedGameCount };
}
