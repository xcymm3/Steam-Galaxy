import type {
  SteamStoreGameMetadata,
  SteamStoreGameMode,
} from "@/lib/steam/store-metadata";
import type { SteamGame } from "@/lib/steam/types";

const seriesSuffixPattern =
  /\s+(?:\d+|[ivxlcdm]+|[一二三四五六七八九十]+)(?:\s|$).*$/iu;
const editionSuffixPattern =
  /\s+(?:remastered|remake|definitive edition|complete edition|ultimate edition|deluxe edition|game of the year edition|director'?s cut|demo|soundtrack).*$/iu;

export interface GameMetadataMetric {
  label: string;
  playtimeMinutes: number;
}

export interface GameSeriesSignal {
  name: string;
  gameCount: number;
  playtimeMinutes: number;
}

export interface GameMetadataProfile {
  requestedGameCount: number;
  resolvedGameCount: number;
  games: Record<string, SteamStoreGameMetadata>;
  topGenres: GameMetadataMetric[];
  modes: GameMetadataMetric[];
  series: GameSeriesSignal[];
}

export const metadataGameLimit = 10;

const modeLabels: Record<SteamStoreGameMode, string> = {
  "single-player": "单人",
  multiplayer: "多人",
  "co-op": "合作",
};

export function createEmptyGameMetadataProfile(): GameMetadataProfile {
  return {
    requestedGameCount: 0,
    resolvedGameCount: 0,
    games: {},
    topGenres: [],
    modes: [],
    series: [],
  };
}

function normalizeSeriesName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[™®©]/gu, "")
    .replace(/[《》]/gu, "")
    .trim();
}

function getSeriesStem(name: string) {
  const normalized = normalizeSeriesName(name);
  const beforeSubtitle = normalized.split(/[:：—–]/u, 1)[0] ?? normalized;
  const withoutEdition = beforeSubtitle.replace(editionSuffixPattern, "");
  const withoutInstallment = withoutEdition.replace(seriesSuffixPattern, "");
  return withoutInstallment
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}

function getSeriesDisplayName(name: string) {
  const normalized = normalizeSeriesName(name);
  const beforeSubtitle = normalized.split(/[:：—–]/u, 1)[0] ?? normalized;
  const withoutEdition = beforeSubtitle.replace(editionSuffixPattern, "");
  return withoutEdition.replace(seriesSuffixPattern, "").trim();
}

function toMetrics(values: Map<string, number>) {
  return [...values.entries()]
    .map(([label, playtimeMinutes]) => ({ label, playtimeMinutes }))
    .sort(
      (left, right) =>
        right.playtimeMinutes - left.playtimeMinutes ||
        left.label.localeCompare(right.label, "zh-CN"),
    );
}

function buildSeriesSignals(games: SteamGame[]): GameSeriesSignal[] {
  const groups = new Map<
    string,
    { displayName: string; gameCount: number; playtimeMinutes: number }
  >();

  games.forEach((game) => {
    const stem = getSeriesStem(game.name);
    const displayName = getSeriesDisplayName(game.name);

    if (!stem || !displayName) {
      return;
    }

    const group = groups.get(stem) ?? {
      displayName,
      gameCount: 0,
      playtimeMinutes: 0,
    };

    group.gameCount += 1;
    group.playtimeMinutes += game.playtimeMinutes;
    groups.set(stem, group);
  });

  return [...groups.values()]
    .filter((group) => group.gameCount >= 2)
    .map((group) => ({
      name: group.displayName,
      gameCount: group.gameCount,
      playtimeMinutes: group.playtimeMinutes,
    }))
    .sort(
      (left, right) =>
        right.playtimeMinutes - left.playtimeMinutes ||
        right.gameCount - left.gameCount ||
        left.name.localeCompare(right.name, "zh-CN"),
    );
}

/**
 * Turns a bounded list of Store metadata into report-ready signals. Series are
 * intentionally a local name-based grouping: Steam Store app details do not
 * expose a stable, public franchise field for every app.
 */
export function buildGameMetadataProfile(
  games: SteamGame[],
  metadata: SteamStoreGameMetadata[],
): GameMetadataProfile {
  const byAppId = Object.fromEntries(
    metadata.map((item) => [String(item.appId), item]),
  );
  const topGenres = new Map<string, number>();
  const modes = new Map<string, number>();

  games.forEach((game) => {
    const gameMetadata = byAppId[String(game.appId)];
    if (!gameMetadata) {
      return;
    }

    gameMetadata.genres.forEach((genre) => {
      topGenres.set(genre, (topGenres.get(genre) ?? 0) + game.playtimeMinutes);
    });
    gameMetadata.modes.forEach((mode) => {
      const label = modeLabels[mode];
      modes.set(label, (modes.get(label) ?? 0) + game.playtimeMinutes);
    });
  });

  return {
    requestedGameCount: games.length,
    resolvedGameCount: metadata.length,
    games: byAppId,
    topGenres: toMetrics(topGenres),
    modes: toMetrics(modes),
    series: buildSeriesSignals(games),
  };
}
