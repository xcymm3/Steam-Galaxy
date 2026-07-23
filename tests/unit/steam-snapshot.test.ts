import { describe, expect, it, vi } from "vitest";

import type { SteamGateway } from "@/lib/steam/client";
import { getSteamSnapshot } from "@/lib/steam/get-snapshot";
import {
  ownedGamesResponseSchema,
  playerSummariesResponseSchema,
} from "@/lib/steam/schemas";

import ownedGamesPrivateFixture from "../fixtures/steam/owned-games-private.json";
import ownedGamesPublicFixture from "../fixtures/steam/owned-games-public.json";
import playerPublicFixture from "../fixtures/steam/player-public.json";

const fixtureSteamId = "76561198000000001";
const fixedNow = new Date("2026-07-21T08:00:00.000Z");
const player =
  playerSummariesResponseSchema.parse(playerPublicFixture).response.players[0];
const publicLibrary = ownedGamesResponseSchema.parse(ownedGamesPublicFixture);
const privateLibrary = ownedGamesResponseSchema.parse(ownedGamesPrivateFixture);

if (!player) {
  throw new Error("The public player fixture must include one player.");
}

function createGateway(
  ownedGames: ReturnType<typeof ownedGamesResponseSchema.parse>,
): SteamGateway {
  return {
    resolveVanity: vi.fn().mockResolvedValue(fixtureSteamId),
    getPlayerSummary: vi.fn().mockResolvedValue(player),
    getOwnedGames: vi.fn().mockResolvedValue(ownedGames),
  };
}

describe("Steam snapshot", () => {
  it("normalizes and deterministically orders a public library", async () => {
    const gateway = createGateway(publicLibrary);

    const snapshot = await getSteamSnapshot("night-pilot", {
      gateway,
      now: () => fixedNow,
    });

    expect(snapshot).toMatchObject({
      player: {
        steamId: fixtureSteamId,
        displayName: "夜航员_01",
        createdAt: "2010-01-01T00:00:00.000Z",
      },
      gameCount: 3,
      retrievedAt: "2026-07-21T08:00:00.000Z",
      diagnostics: {
        reportedGameCount: 3,
        skippedGameCount: 0,
      },
    });
    expect(snapshot.games.map((game) => game.appId)).toEqual([
      41001, 41002, 41003,
    ]);
    expect(snapshot.games[1]).toMatchObject({
      iconHash: null,
      lastPlayedAt: null,
    });
  });

  it("does not misclassify a private library as empty", async () => {
    const gateway = createGateway(privateLibrary);

    await expect(
      getSteamSnapshot(fixtureSteamId, { gateway }),
    ).rejects.toMatchObject({
      code: "GAME_DETAILS_PRIVATE",
      retryable: false,
    });
  });

  it("maps a visible zero-game library to EMPTY_LIBRARY", async () => {
    const gateway = createGateway({
      response: { game_count: 0, games: [] },
    });

    await expect(
      getSteamSnapshot(fixtureSteamId, { gateway }),
    ).rejects.toMatchObject({
      code: "EMPTY_LIBRARY",
      retryable: false,
    });
  });

  it("skips malformed games while preserving diagnostics", async () => {
    const gateway = createGateway({
      response: {
        game_count: 2,
        games: [
          publicLibrary.response.games?.[0],
          { appid: "not-a-number", name: "Broken fixture" },
        ],
      },
    });

    const snapshot = await getSteamSnapshot(fixtureSteamId, { gateway });

    expect(snapshot.gameCount).toBe(1);
    expect(snapshot.diagnostics).toEqual({
      reportedGameCount: 2,
      skippedGameCount: 1,
    });
  });
});
