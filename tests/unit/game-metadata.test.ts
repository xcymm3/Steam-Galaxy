import { describe, expect, it } from "vitest";

import { buildGameMetadataProfile } from "@/lib/report/game-metadata";
import type { SteamGame } from "@/lib/steam/types";
import type { SteamStoreGameMetadata } from "@/lib/steam/store-metadata";

const games: SteamGame[] = [
  {
    appId: 292030,
    iconHash: null,
    lastPlayedAt: null,
    name: "The Witcher 3: Wild Hunt",
    playtimeMinutes: 900,
  },
  {
    appId: 20920,
    iconHash: null,
    lastPlayedAt: null,
    name: "The Witcher 2: Assassins of Kings",
    playtimeMinutes: 300,
  },
  {
    appId: 548430,
    iconHash: null,
    lastPlayedAt: null,
    name: "Deep Rock Galactic",
    playtimeMinutes: 120,
  },
];

const metadata: SteamStoreGameMetadata[] = [
  {
    appId: 292030,
    appType: "game",
    developers: ["CD PROJEKT RED"],
    genres: ["角色扮演", "动作"],
    modes: ["single-player"],
    publishers: ["CD PROJEKT RED"],
  },
  {
    appId: 20920,
    appType: "game",
    developers: ["CD PROJEKT RED"],
    genres: ["角色扮演"],
    modes: ["single-player"],
    publishers: ["CD PROJEKT RED"],
  },
  {
    appId: 548430,
    appType: "game",
    developers: ["Ghost Ship Games"],
    genres: ["动作"],
    modes: ["multiplayer", "co-op"],
    publishers: ["Coffee Stain Publishing"],
  },
];

describe("game metadata profile", () => {
  it("weights genres and modes by playtime and exposes repeated series", () => {
    const profile = buildGameMetadataProfile(games, metadata);

    expect(profile).toMatchObject({
      requestedGameCount: 3,
      resolvedGameCount: 3,
      topGenres: [
        { label: "角色扮演", playtimeMinutes: 1_200 },
        { label: "动作", playtimeMinutes: 1_020 },
      ],
      modes: [
        { label: "单人", playtimeMinutes: 1_200 },
        { label: "多人", playtimeMinutes: 120 },
        { label: "合作", playtimeMinutes: 120 },
      ],
      series: [{ name: "The Witcher", gameCount: 2, playtimeMinutes: 1_200 }],
    });
  });

  it("does not invent a series from one standalone game", () => {
    const profile = buildGameMetadataProfile([games[2]!], [metadata[2]!]);

    expect(profile.series).toEqual([]);
  });

  it("keeps hyphenated series names intact while grouping installments", () => {
    const profile = buildGameMetadataProfile(
      [
        { ...games[0]!, appId: 70, name: "Half-Life", playtimeMinutes: 80 },
        { ...games[1]!, appId: 220, name: "Half-Life 2", playtimeMinutes: 160 },
      ],
      [],
    );

    expect(profile.series).toEqual([
      { name: "Half-Life", gameCount: 2, playtimeMinutes: 240 },
    ]);
  });
});
