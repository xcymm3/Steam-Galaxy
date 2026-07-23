import { createStarMapLayout, type StarMapNode } from "./star-map";
import type { OwnedGame, ReportData } from "./types";

export const POSTER_WIDTH = 1_080;
export const POSTER_HEIGHT = 1_440;
export const POSTER_HOME_PATH = "/";

export interface PosterGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  iconUrl: string | null;
}

export interface PosterModel {
  width: typeof POSTER_WIDTH;
  height: typeof POSTER_HEIGHT;
  brand: string;
  homeUrl: string;
  displayName: string;
  avatarUrl: string | null;
  titleName: string;
  titleExplanation: string;
  totalHours: number;
  totalGameCount: number;
  playedGameCount: number;
  topGames: PosterGame[];
  starNodes: StarMapNode[];
}

export interface PosterAssets<TImage> {
  avatar: TImage | null;
  topGameIcons: Map<number, TImage>;
  failedAssetCount: number;
}

export type PosterImageLoader<TImage> = (url: string) => Promise<TImage>;

export function createPosterHomeUrl(origin: string) {
  const base = new URL(origin);
  return new URL(POSTER_HOME_PATH, base).toString();
}

export function getSteamGameIconUrl(game: OwnedGame): string | null {
  if (!game.iconHash) {
    return null;
  }

  return `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appId}/${game.iconHash}.jpg`;
}

export function createPosterModel(
  report: ReportData,
  origin: string,
): PosterModel {
  const starMap = createStarMapLayout(report.games);
  const nebula = starMap.nodes.find((node) => node.kind === "nebula");
  const visibleStars = starMap.nodes
    .filter((node) => node.kind !== "nebula")
    .slice(0, nebula ? 31 : 32);

  return {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    brand: "WHERE DID THE HOURS GO?",
    homeUrl: createPosterHomeUrl(origin),
    displayName: report.player.displayName,
    avatarUrl: report.player.avatarUrl,
    titleName: report.title.name,
    titleExplanation: report.title.explanation,
    totalHours: report.metrics.totalPlaytimeHours,
    totalGameCount: report.metrics.totalGameCount,
    playedGameCount: report.metrics.playedGameCount,
    topGames: report.topGames.slice(0, 3).map((game) => ({
      appId: game.appId,
      name: game.name,
      playtimeMinutes: game.playtimeMinutes,
      iconUrl: getSteamGameIconUrl(game),
    })),
    starNodes: nebula ? [...visibleStars, nebula] : visibleStars,
  };
}

export async function loadPosterAssets<TImage>(
  model: PosterModel,
  loadImage: PosterImageLoader<TImage>,
): Promise<PosterAssets<TImage>> {
  const topGameIcons = new Map<number, TImage>();
  let avatar: TImage | null = null;
  let failedAssetCount = 0;

  if (model.avatarUrl) {
    try {
      avatar = await loadImage(model.avatarUrl);
    } catch {
      failedAssetCount += 1;
    }
  }

  await Promise.all(
    model.topGames.map(async (game) => {
      if (!game.iconUrl) {
        return;
      }

      try {
        topGameIcons.set(game.appId, await loadImage(game.iconUrl));
      } catch {
        failedAssetCount += 1;
      }
    }),
  );

  return { avatar, topGameIcons, failedAssetCount };
}
