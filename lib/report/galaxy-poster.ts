import type { ReportData } from "./types";

export interface GalaxyPosterBody {
  appId: number;
  hours: number;
  name: string;
  rank: number;
}

export interface GalaxyPosterSummary {
  mainStar: GalaxyPosterBody | null;
  preference: GalaxyPosterPreference;
  planets: GalaxyPosterBody[];
  tier: GalaxyPosterTier;
  totalHours: number;
  totalGameCount: number;
  unplayedGameCount: number;
}

export interface GalaxyPosterTier {
  description: string;
  label: string;
}

export interface GalaxyPosterPreference {
  description: string;
  label: string;
}

function getPosterTier(totalHours: number): GalaxyPosterTier {
  if (totalHours >= 5_000) {
    return { label: "深空", description: "累计时长 5,000 小时+" };
  }

  if (totalHours >= 2_000) {
    return { label: "银河", description: "累计时长 2,000–4,999 小时" };
  }

  if (totalHours >= 1_000) {
    return { label: "太阳系", description: "累计时长 1,000–1,999 小时" };
  }

  if (totalHours >= 700) {
    return { label: "卫星", description: "累计时长 700–999 小时" };
  }

  if (totalHours >= 300) {
    return { label: "行星", description: "累计时长 300–699 小时" };
  }

  if (totalHours >= 100) {
    return { label: "近地", description: "累计时长 100–299 小时" };
  }

  return { label: "点火", description: "累计时长 0–99 小时" };
}

function getPosterPreference(report: ReportData): GalaxyPosterPreference {
  const { metrics, topGames } = report;
  const topGameHours = (topGames[0]?.playtimeMinutes ?? 0) / 60;

  if (metrics.totalGameCount >= 200 && (metrics.unplayedRatio ?? 0) >= 0.6) {
    return {
      label: "收藏型",
      description: "库存 ≥ 200 款，且未启动比例 ≥ 60%",
    };
  }

  if (
    metrics.playedGameCount >= 30 &&
    (metrics.lowPlaytimeRatio ?? 0) >= 0.65
  ) {
    return {
      label: "试水型",
      description: "已玩游戏 ≥ 30 款，且不足 2 小时的游戏比例 ≥ 65%",
    };
  }

  if (metrics.totalPlaytimeHours >= 300 && (metrics.topOneRatio ?? 0) >= 0.55) {
    return {
      label: "专注型",
      description: "时长最高游戏占累计时长 ≥ 55%",
    };
  }

  if (
    (metrics.topThreeRatio ?? 0) >= 0.7 &&
    (metrics.topOneRatio ?? 0) < 0.55
  ) {
    return {
      label: "深耕型",
      description: "前三款游戏占累计时长 ≥ 70%",
    };
  }

  if (
    metrics.playedGameCount >= 80 &&
    metrics.topOneRatio !== null &&
    metrics.topOneRatio < 0.2
  ) {
    return {
      label: "开拓型",
      description: "已玩游戏 ≥ 80 款，且最高一款占比 < 20%",
    };
  }

  if (topGameHours >= 1_000) {
    return {
      label: "定居型",
      description: "时长最高的一款游戏 ≥ 1,000 小时",
    };
  }

  return {
    label: "漫游型",
    description: "没有明显的单一游玩偏好",
  };
}

function toPosterBody(
  node: ReportData["galaxy"]["games"][number],
): GalaxyPosterBody {
  return {
    appId: node.appId,
    hours: node.game.playtimeMinutes / 60,
    name: node.game.name,
    rank: node.rank,
  };
}

export function createGalaxyPosterSummary(
  report: ReportData,
): GalaxyPosterSummary {
  const visibleBodies = report.galaxy.games.map(toPosterBody);

  return {
    mainStar: visibleBodies[0] ?? null,
    preference: getPosterPreference(report),
    planets: visibleBodies.slice(1, 9),
    tier: getPosterTier(report.metrics.totalPlaytimeHours),
    totalGameCount: report.metrics.totalGameCount,
    totalHours: report.metrics.totalPlaytimeHours,
    unplayedGameCount: report.metrics.unplayedGameCount,
  };
}

export function getMainStarRatio(summary: GalaxyPosterSummary) {
  if (!summary.mainStar || summary.totalHours <= 0) {
    return 0;
  }

  return (summary.mainStar.hours / summary.totalHours) * 100;
}
