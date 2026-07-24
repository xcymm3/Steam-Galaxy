"use client";

import { useState, type RefObject } from "react";

import type { OwnedGame, ReportData } from "@/lib/report/types";

import { StarMap } from "./star-map";
import styles from "./story-player.module.css";

interface StorySlideProps {
  pageIndex: number;
  report: ReportData;
  headingRef: RefObject<HTMLHeadingElement | null>;
  poster: PosterPresentation;
  onSharePoster: (() => void) | null;
}

export interface PosterPresentation {
  status: "idle" | "generating" | "ready" | "error";
  url: string | null;
  message: string;
}

interface SlideHeadingProps {
  number: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  children: React.ReactNode;
}

function formatHours(minutes: number) {
  return (minutes / 60).toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
  });
}

function formatPercent(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("zh-CN", {
        maximumFractionDigits: 1,
        style: "percent",
      });
}

function SlideHeading({ number, headingRef, children }: SlideHeadingProps) {
  return (
    <div className={styles.slideHeading}>
      <span className={styles.stageNumber} aria-hidden="true">
        {String(number).padStart(2, "0")}
      </span>
      <h1 id="story-slide-title" ref={headingRef} tabIndex={-1}>
        {children}
      </h1>
    </div>
  );
}

function PlayerAvatar({ report }: { report: ReportData }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = report.player.avatarUrl;
  const fallback = !avatarUrl || failed;

  const avatar = fallback ? (
    <div className={styles.avatarFallback} aria-label="头像不可用">
      {Array.from(report.player.displayName.trim())[0] || "S"}
    </div>
  ) : (
    // Steam avatars are remote user content; a plain img keeps failure fallback explicit.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.playerAvatar}
      src={avatarUrl}
      width={320}
      height={320}
      alt={`${report.player.displayName} 的 Steam 头像`}
      fetchPriority="high"
      onError={() => setFailed(true)}
    />
  );

  return (
    <div className={styles.avatarBlock}>
      {avatar}
      {fallback && (
        <p className={styles.avatarMessage} role="status">
          Steam 头像不可用，已改用昵称首字。
        </p>
      )}
    </div>
  );
}

const modeLabels = {
  "single-player": "单人",
  multiplayer: "多人",
  "co-op": "合作",
} as const;

function getGameSignals(report: ReportData, game: OwnedGame) {
  const metadata = report.gameMetadata.games[String(game.appId)];
  if (!metadata) {
    return [];
  }

  return [
    ...metadata.genres.slice(0, 2),
    ...metadata.modes.map((mode) => modeLabels[mode]),
  ];
}

function GameSignalLine({
  report,
  game,
}: {
  report: ReportData;
  game: OwnedGame;
}) {
  const signals = getGameSignals(report, game);

  return signals.length > 0 ? (
    <p className={styles.gameSignalLine}>{signals.join(" · ")}</p>
  ) : null;
}

export function StorySlide({
  pageIndex,
  report,
  headingRef,
  poster,
  onSharePoster,
}: StorySlideProps) {
  const { metrics } = report;
  const topGame = report.topGames[0] ?? null;
  const topGenre = report.gameMetadata.topGenres[0] ?? null;
  const commonModes = report.gameMetadata.modes.slice(0, 2);
  const topSeries = report.gameMetadata.series[0] ?? null;

  switch (pageIndex) {
    case 0:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <div className={styles.identityLayout}>
            <div>
              <SlideHeading number={1} headingRef={headingRef}>
                {report.player.displayName}
              </SlideHeading>
              <p className={styles.slideLead}>已连接到你的公开游戏宇宙。</p>
              <p className={styles.slideNote}>
                {metrics.steamAgeYears === null
                  ? "Steam 没有返回可用的账号创建时间。"
                  : `这颗信号已经持续了 ${metrics.steamAgeYears} 个完整年份。`}
              </p>
            </div>
            <PlayerAvatar report={report} />
          </div>
        </article>
      );
    case 1:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={2} headingRef={headingRef}>
            时间都留在这里了。
          </SlideHeading>
          <p className={styles.primaryMetric}>
            {metrics.totalPlaytimeHours.toLocaleString("zh-CN", {
              maximumFractionDigits: 1,
            })}
            <span>小时</span>
          </p>
          <p className={styles.metricCaption}>
            来自当前公开库存的累计记录，不是按年份重建的时间线。
          </p>
        </article>
      );
    case 2:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={3} headingRef={headingRef}>
            库存不等于足迹。
          </SlideHeading>
          <dl className={styles.inventoryStats}>
            <div>
              <dt>拥有</dt>
              <dd>{metrics.totalGameCount}</dd>
            </div>
            <div>
              <dt>真正玩过</dt>
              <dd>{metrics.playedGameCount}</dd>
            </div>
            <div>
              <dt>触达比例</dt>
              <dd>{formatPercent(metrics.reachRatio)}</dd>
            </div>
          </dl>
        </article>
      );
    case 3:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={4} headingRef={headingRef}>
            {topGame ? "引力中心已经出现。" : "主星还没有点亮。"}
          </SlideHeading>
          {topGame ? (
            <div className={styles.topGameLayout}>
              <span className={styles.mainStar} aria-hidden="true" />
              <div>
                <p className={styles.gameTitle}>{topGame.name}</p>
                <p className={styles.gameMeasure}>
                  {formatHours(topGame.playtimeMinutes)} 小时 · 占全部时长的{" "}
                  {formatPercent(metrics.topOneRatio)}
                </p>
                <GameSignalLine report={report} game={topGame} />
              </div>
            </div>
          ) : (
            <p className={styles.slideLead}>
              库存可见，但还没有记录到游玩时长。
            </p>
          )}
        </article>
      );
    case 4: {
      const hasGameplaySignals = Boolean(topGenre) || commonModes.length > 0;

      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={5} headingRef={headingRef}>
            {hasGameplaySignals
              ? "你的玩法有自己的引力。"
              : "玩法信号仍在追踪。"}
          </SlideHeading>
          {hasGameplaySignals ? (
            <>
              {topGenre && (
                <p className={styles.gameplayGenre}>{topGenre.label}</p>
              )}
              <dl className={styles.gameProfile}>
                {topGenre && (
                  <div>
                    <dt>高时长类型</dt>
                    <dd>{topGenre.label}</dd>
                  </div>
                )}
                {commonModes.length > 0 && (
                  <div>
                    <dt>常见模式</dt>
                    <dd>{commonModes.map((mode) => mode.label).join(" / ")}</dd>
                  </div>
                )}
              </dl>
              <p className={styles.slideLead}>
                这不是按游戏数量，而是按游玩时长汇总出的玩法信号。
              </p>
            </>
          ) : (
            <p className={styles.slideLead}>
              Steam 商店没有为这批高时长游戏返回可用的类型或玩法数据。
            </p>
          )}
          {report.gameMetadata.requestedGameCount > 0 && (
            <p className={styles.slideNote}>
              判读范围：时长最高的 {report.gameMetadata.requestedGameCount}{" "}
              款游戏； 已补全 {report.gameMetadata.resolvedGameCount} 款。
            </p>
          )}
        </article>
      );
    }
    case 5:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <div className={styles.starSlideLayout}>
            <div>
              <SlideHeading number={6} headingRef={headingRef}>
                {metrics.playedGameCount} 颗已点亮的星。
              </SlideHeading>
              <p className={styles.slideLead}>
                时长最高的 100
                款游戏构成可探索星系；已游玩星球的体积严格来自累计时长，0
                小时游戏则显示为档案信标。
              </p>
            </div>
            <StarMap galaxy={report.galaxy} />
          </div>
        </article>
      );
    case 6:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={7} headingRef={headingRef}>
            时间的集中度是 {formatPercent(metrics.topThreeRatio)}。
          </SlideHeading>
          <p className={styles.slideLead}>
            {metrics.topThreeRatio === null
              ? "总游玩时长为零，因此不做专注度判断。"
              : `前三款游戏共同占据了 ${formatPercent(metrics.topThreeRatio)} 的累计时长。`}
          </p>
          <p className={styles.slideNote}>
            Top 1 占比：{formatPercent(metrics.topOneRatio)} · 玩过{" "}
            {metrics.playedGameCount} 款
          </p>
        </article>
      );
    case 7: {
      const dustGames = [
        ...report.unplayedGames,
        ...report.lowPlaytimeGames,
      ].slice(0, 4);

      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={8} headingRef={headingRef}>
            还有 {metrics.unplayedGameCount} 个世界从未点亮。
          </SlideHeading>
          <p className={styles.slideLead}>
            另有 {metrics.lowPlaytimeGameCount} 款游戏的累计时长不足两小时。
          </p>
          {dustGames.length > 0 && (
            <ul className={styles.dustList} aria-label="未玩或低时长游戏示例">
              {dustGames.map((game) => (
                <li key={game.appId}>{game.name}</li>
              ))}
            </ul>
          )}
          <p className={styles.slideNote}>这里只描述时长，不推断购买动机。</p>
        </article>
      );
    }
    case 8:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={9} headingRef={headingRef}>
            你的称号是
          </SlideHeading>
          <p className={styles.playerTitle}>{report.title.name}</p>
          <p className={styles.titleExplanation}>{report.title.explanation}</p>
          {topSeries && (
            <p className={styles.slideNote}>
              系列信号：{topSeries.name} 已出现 {topSeries.gameCount} 款，累计{" "}
              {formatHours(topSeries.playtimeMinutes)} 小时。
            </p>
          )}
          <p className={styles.slideNote}>由明确指标和最高优先级规则生成。</p>
        </article>
      );
    case 9:
      return (
        <article
          className={styles.storySlide}
          aria-labelledby="story-slide-title"
        >
          <SlideHeading number={10} headingRef={headingRef}>
            这就是你当前可见的游戏宇宙。
          </SlideHeading>
          <p className={styles.closingStatement}>
            {formatHours(metrics.totalPlaytimeMinutes)} 小时，
            {metrics.playedGameCount} 款足迹，一个称号。
          </p>
          <div className={styles.closingMeta}>
            <span>WHERE DID THE HOURS GO?</span>
            <span>{report.title.name}</span>
            {topGenre && <span>高时长类型：{topGenre.label}</span>}
            {topSeries && <span>系列：{topSeries.name}</span>}
          </div>
          {poster.status === "ready" && poster.url && (
            <div className={styles.posterResult}>
              {/* Blob URL is generated from the current in-memory ReportData only. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.posterPreview}
                src={poster.url}
                alt="这份 Steam 游戏宇宙的生成海报预览"
              />
              <div className={styles.posterActions}>
                <a
                  className={styles.posterDownload}
                  href={poster.url}
                  download="steam-game-universe.png"
                >
                  下载 PNG
                </a>
                {onSharePoster && (
                  <button
                    className={styles.posterShare}
                    type="button"
                    onClick={onSharePoster}
                  >
                    系统分享
                  </button>
                )}
              </div>
            </div>
          )}
          {poster.message && (
            <p
              className={styles.posterNotice}
              data-state={poster.status}
              role="status"
              aria-live="polite"
            >
              {poster.message}
            </p>
          )}
        </article>
      );
    default:
      return null;
  }
}
