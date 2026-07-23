import type { OwnedGame } from "@/lib/report/types";
import type { SteamPlayer, SteamSnapshot } from "@/lib/steam/types";

const retrievedAt = "2026-07-21T08:00:00.000Z";

const basePlayer: SteamPlayer = {
  steamId: "76561198000000001",
  displayName: "夜航员_01",
  profileUrl: "https://steamcommunity.com/profiles/76561198000000001/",
  avatarUrl: "https://avatars.example.test/report-player.jpg",
  createdAt: "2015-08-20T00:00:00.000Z",
  lastLogoffAt: "2026-07-20T00:00:00.000Z",
};

function game(
  appId: number,
  playtimeMinutes: number,
  name = `Fixture Game ${appId}`,
): OwnedGame {
  return {
    appId,
    name,
    playtimeMinutes,
    iconHash: `fixture-icon-${appId}`,
    lastPlayedAt: playtimeMinutes > 0 ? "2026-07-01T00:00:00.000Z" : null,
  };
}

function snapshot(
  games: OwnedGame[],
  player: SteamPlayer = basePlayer,
): SteamSnapshot {
  return {
    player: { ...player },
    games,
    gameCount: games.length,
    retrievedAt,
    diagnostics: {
      reportedGameCount: games.length,
      skippedGameCount: 0,
    },
  };
}

export const ordinaryPlayerFixture = snapshot([
  game(106, 0, "Unlit Harbor"),
  game(103, 119, "Short Signal"),
  game(101, 6_000, "Main Sequence"),
  game(105, 0, "Dust Shelf"),
  game(104, 120, "Two Hour Line"),
  game(102, 3_000, "Second Orbit"),
]);

export const thousandHourSingleFixture = snapshot([
  game(201, 60_000, "Endless Anchor"),
]);

export const cyberSingleFixture = snapshot([
  game(301, 12_000, "Gravity Well"),
  game(302, 6_000, "Outer Moon"),
]);

export const hugeInventoryFixture = snapshot([
  ...Array.from({ length: 150 }, (_, index) => game(1_000 + index, 120)),
  ...Array.from({ length: 351 }, (_, index) => game(2_000 + index, 0)),
]);

export const twoHourPatrolFixture = snapshot([
  ...Array.from({ length: 30 }, (_, index) => game(3_000 + index, 60)),
  ...Array.from({ length: 10 }, (_, index) => game(4_000 + index, 120)),
]);

export const wideOrbitFixture = snapshot(
  Array.from({ length: 80 }, (_, index) => game(5_000 + index, 180)),
);

export const emptyInventoryFixture = snapshot([]);

export const allUnplayedFixture = snapshot(
  Array.from({ length: 20 }, (_, index) => game(6_000 + index, 0)),
);

export const starMapHundredFixture = snapshot(
  Array.from({ length: 100 }, (_, index) =>
    game(
      8_000 + index,
      index < 80 ? (80 - index) * 120 : 0,
      `Hundred Orbit ${index + 1}`,
    ),
  ),
);

export const starMapFiveHundredFixture = snapshot(
  Array.from({ length: 500 }, (_, index) =>
    game(
      9_000 + index,
      index < 160 ? (160 - index) * 120 : 0,
      `Far Orbit ${index + 1}`,
    ),
  ),
);

export const overTenThousandHoursFixture = snapshot([
  game(7_001, 600_060, "Long Horizon"),
]);

export const missingCreatedAtFixture = snapshot(
  ordinaryPlayerFixture.games.map((ownedGame) => ({ ...ownedGame })),
  { ...basePlayer, createdAt: null },
);

export const longChineseNicknameFixture = snapshot(
  ordinaryPlayerFixture.games.map((ownedGame) => ({ ...ownedGame })),
  {
    ...basePlayer,
    displayName:
      "这是一位拥有非常非常非常非常非常非常长中文昵称的匿名宇航员🚀✨",
  },
);
