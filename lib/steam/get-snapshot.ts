import type { SteamGateway } from "./client";
import { SteamGatewayError } from "./errors";
import { normalizeGames, normalizePlayer } from "./normalizers";
import { resolveSteamId } from "./resolve-id";
import type { SteamSnapshot } from "./types";

interface GetSteamSnapshotOptions {
  gateway: SteamGateway;
  now?: () => Date;
}

export async function getSteamSnapshot(
  input: string,
  { gateway, now = () => new Date() }: GetSteamSnapshotOptions,
): Promise<SteamSnapshot> {
  const steamId = await resolveSteamId(input, (vanity) =>
    gateway.resolveVanity(vanity),
  );

  const [playerPayload, ownedGamesPayload] = await Promise.all([
    gateway.getPlayerSummary(steamId),
    gateway.getOwnedGames(steamId),
  ]);

  const { game_count: reportedGameCount, games: rawGames } =
    ownedGamesPayload.response;

  if (reportedGameCount === undefined && rawGames === undefined) {
    throw new SteamGatewayError("GAME_DETAILS_PRIVATE");
  }

  if (reportedGameCount && rawGames === undefined) {
    throw new SteamGatewayError("STEAM_BAD_RESPONSE");
  }

  const { games, skippedGameCount } = normalizeGames(rawGames ?? []);

  if (games.length === 0) {
    throw new SteamGatewayError("EMPTY_LIBRARY");
  }

  return {
    player: normalizePlayer(playerPayload),
    games,
    gameCount: games.length,
    retrievedAt: now().toISOString(),
    diagnostics: {
      reportedGameCount: reportedGameCount ?? rawGames?.length ?? 0,
      skippedGameCount,
    },
  };
}
