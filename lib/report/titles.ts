import type {
  OwnedGame,
  PlayerTitle,
  PlayerTitleId,
  ReportMetrics,
} from "./types";

interface TitleContext {
  metrics: ReportMetrics;
  topGame: OwnedGame | null;
}

interface TitleCopy {
  name: string;
  explain: (context: TitleContext) => string;
}

interface TitleRule {
  id: PlayerTitleId;
  priority: number;
  matches: (context: TitleContext) => boolean;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

const titleCopy: Record<PlayerTitleId, TitleCopy> = {
  "time-lost": {
    name: "时间管理失踪人口",
    explain: ({ metrics }) =>
      `你在 Steam 里留下了 ${formatHours(metrics.totalPlaytimeMinutes)} 小时。`,
  },
  "thousand-hour-resident": {
    name: "千小时钉子户",
    explain: ({ topGame }) =>
      topGame
        ? `光是《${topGame.name}》就留住了你 ${formatHours(topGame.playtimeMinutes)} 小时。`
        : "你的主星仍在等待点亮。",
  },
  "single-game-orbit": {
    name: "赛博单推人",
    explain: ({ topGame }) =>
      topGame
        ? `你超过一半的时间都交给了《${topGame.name}》。`
        : "你的主星仍在等待点亮。",
  },
  "library-keeper": {
    name: "库存守门员",
    explain: ({ metrics }) =>
      `你守护着 ${metrics.unplayedGameCount} 个还没真正打开的世界。`,
  },
  "two-hour-patrol": {
    name: "两小时巡逻员",
    explain: () => "你的足迹遍布库存，但很多只停留了两小时。",
  },
  "wide-orbit": {
    name: "雨露均沾型宇航员",
    explain: () => "没有一颗星球能独占你的全部注意力。",
  },
  "first-ignition": {
    name: "宇宙刚刚点火",
    explain: () => "你的游戏宇宙还在继续扩张。",
  },
};

const titleRules: readonly TitleRule[] = [
  {
    id: "time-lost",
    priority: 100,
    matches: ({ metrics }) => metrics.totalPlaytimeMinutes >= 5_000 * 60,
  },
  {
    id: "thousand-hour-resident",
    priority: 90,
    matches: ({ topGame }) => (topGame?.playtimeMinutes ?? 0) >= 1_000 * 60,
  },
  {
    id: "single-game-orbit",
    priority: 80,
    matches: ({ metrics }) =>
      metrics.totalPlaytimeMinutes >= 300 * 60 &&
      (metrics.topOneRatio ?? 0) >= 0.55,
  },
  {
    id: "library-keeper",
    priority: 70,
    matches: ({ metrics }) =>
      metrics.totalGameCount >= 200 && (metrics.unplayedRatio ?? 0) >= 0.6,
  },
  {
    id: "two-hour-patrol",
    priority: 60,
    matches: ({ metrics }) =>
      metrics.playedGameCount >= 30 && (metrics.lowPlaytimeRatio ?? 0) >= 0.65,
  },
  {
    id: "wide-orbit",
    priority: 50,
    matches: ({ metrics }) =>
      metrics.playedGameCount >= 80 &&
      metrics.topOneRatio !== null &&
      metrics.topOneRatio < 0.2,
  },
  {
    id: "first-ignition",
    priority: 10,
    matches: () => true,
  },
];

export function selectPlayerTitle(
  metrics: ReportMetrics,
  topGame: OwnedGame | null,
): PlayerTitle {
  const context = { metrics, topGame };
  const matchedRule = [...titleRules]
    .sort((left, right) => right.priority - left.priority)
    .find((rule) => rule.matches(context));

  if (!matchedRule) {
    throw new Error("The player title rules must include a fallback.");
  }

  const copy = titleCopy[matchedRule.id];
  return {
    id: matchedRule.id,
    priority: matchedRule.priority,
    name: copy.name,
    explanation: copy.explain(context),
  };
}
