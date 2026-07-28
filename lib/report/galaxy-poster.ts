import type { ReportData } from "./types";

export interface GalaxyPosterBody {
  appId: number;
  hours: number;
  name: string;
  rank: number;
}

export interface GalaxyPosterSummary {
  dominantGenre: string | null;
  mainStar: GalaxyPosterBody | null;
  persona: string;
  planets: GalaxyPosterBody[];
  totalHours: number;
  totalGameCount: number;
  unplayedGameCount: number;
}

const posterPersonaByTitle = {
  "first-ignition": "初启探索型玩家",
  "library-keeper": "收藏守望型玩家",
  "single-game-orbit": "单恒星专注型玩家",
  "thousand-hour-resident": "长期定居型玩家",
  "time-lost": "深空常驻型玩家",
  "two-hour-patrol": "短途巡航型玩家",
  "wide-orbit": "广域探索型玩家",
} as const;

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
    dominantGenre: report.gameMetadata.topGenres[0]?.label ?? null,
    mainStar: visibleBodies[0] ?? null,
    persona: posterPersonaByTitle[report.title.id],
    planets: visibleBodies.slice(1, 9),
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
