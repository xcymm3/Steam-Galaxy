"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type { GalaxyModel } from "@/lib/report/galaxy";
import type { ReportData } from "@/lib/report/types";

import { StarMap } from "./star-map";
import styles from "./galaxy-workbench.module.css";

interface GalaxyWorkbenchProps {
  report: ReportData;
}

type ActivityFilter = "all" | "played" | "archive";
type DurationFilter = "all" | "brief" | "two-hours" | "hundred-hours";

const activityFilters: ReadonlyArray<{
  id: ActivityFilter;
  label: string;
}> = [
  { id: "all", label: "全部" },
  { id: "played", label: "已点亮" },
  { id: "archive", label: "未点亮" },
];

const durationFilters: ReadonlyArray<{
  id: DurationFilter;
  label: string;
}> = [
  { id: "all", label: "任意时长" },
  { id: "brief", label: "2 小时内" },
  { id: "two-hours", label: "2 小时+" },
  { id: "hundred-hours", label: "100 小时+" },
];

function formatHours(hours: number) {
  return hours.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function formatSnapshot(retrievedAt: string) {
  const date = new Date(retrievedAt);

  return Number.isNaN(date.getTime())
    ? "刚刚"
    : new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function matchesDuration(
  playtimeMinutes: number,
  durationFilter: DurationFilter,
) {
  switch (durationFilter) {
    case "brief":
      return playtimeMinutes > 0 && playtimeMinutes < 120;
    case "two-hours":
      return playtimeMinutes >= 120;
    case "hundred-hours":
      return playtimeMinutes >= 6_000;
    default:
      return true;
  }
}

function createFilteredGalaxy(
  galaxy: GalaxyModel,
  search: string,
  activityFilter: ActivityFilter,
  durationFilter: DurationFilter,
): GalaxyModel {
  return {
    ...galaxy,
    games: galaxy.games.filter((node) => {
      const matchesSearch =
        !search ||
        node.game.name.toLocaleLowerCase("zh-CN").includes(search) ||
        String(node.appId).includes(search);
      const matchesActivity =
        activityFilter === "all" ||
        (activityFilter === "played"
          ? node.game.playtimeMinutes > 0
          : node.game.playtimeMinutes === 0);

      return (
        matchesSearch &&
        matchesActivity &&
        matchesDuration(node.game.playtimeMinutes, durationFilter)
      );
    }),
  };
}

export function GalaxyWorkbench({ report }: GalaxyWorkbenchProps) {
  const { galaxy, metrics, player } = report;
  const longTail = galaxy.longTail;
  const [searchInput, setSearchInput] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [isFilterDockOpen, setFilterDockOpen] = useState(true);
  const deferredSearch = useDeferredValue(normalizeSearch(searchInput));
  const filteredGalaxy = useMemo(
    () =>
      createFilteredGalaxy(
        galaxy,
        deferredSearch,
        activityFilter,
        durationFilter,
      ),
    [activityFilter, deferredSearch, durationFilter, galaxy],
  );
  const hasActiveFilters =
    Boolean(searchInput) ||
    activityFilter !== "all" ||
    durationFilter !== "all";
  const visibleGameCount = filteredGalaxy.games.length;

  const resetFilters = () => {
    setSearchInput("");
    setActivityFilter("all");
    setDurationFilter("all");
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const compactViewport = window.matchMedia("(max-width: 43.99rem)");
    const syncFilterDock = () => setFilterDockOpen(!compactViewport.matches);

    syncFilterDock();
    compactViewport.addEventListener("change", syncFilterDock);

    return () => compactViewport.removeEventListener("change", syncFilterDock);
  }, []);

  return (
    <main className={styles.workbenchRoot}>
      <header className={styles.workbenchHeader}>
        <Link className={styles.wordmark} href="/" aria-label="返回首页">
          HOURS?
        </Link>
        <div className={styles.playerIdentity}>
          <span>已连接</span>
          <strong>{player.displayName}</strong>
        </div>
        <Link className={styles.changeLibraryLink} href="/">
          换个库存
        </Link>
      </header>

      <section className={styles.workbenchIntro} aria-labelledby="galaxy-title">
        <div>
          <p className={styles.eyebrow}>STEAM GALAXY / LIVE LIBRARY</p>
          <h1 id="galaxy-title">{player.displayName} 的游戏星系</h1>
          <p className={styles.introCopy}>
            每个已游玩游戏都按累计时长获得真实体积；时长前 100
            款可单独探索，其余库存以远处的档案信号汇入同一片星系。
          </p>
        </div>
        <dl className={styles.summaryMetrics} aria-label="星系概览">
          <div>
            <dt>累计航程</dt>
            <dd>{formatHours(metrics.totalPlaytimeHours)} 小时</dd>
          </div>
          <div>
            <dt>已点亮</dt>
            <dd>{metrics.playedGameCount} 款</dd>
          </div>
          <div>
            <dt>可探索星体</dt>
            <dd>{galaxy.games.length} 个</dd>
          </div>
        </dl>
      </section>

      <div className={styles.workbenchContent}>
        <section className={styles.mapPanel} aria-labelledby="map-title">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelIndex}>MAP / INDIVIDUAL BODIES</p>
              <h2 id="map-title">转动你的游戏宇宙</h2>
            </div>
            <p>按名称或 App ID 缩小星图；点击星体查看档案，Esc 返回全景。</p>
          </div>
          <details
            className={styles.filterDock}
            open={isFilterDockOpen}
            onToggle={(event) => setFilterDockOpen(event.currentTarget.open)}
          >
            <summary>
              <span>缩小星图</span>
              <strong>
                {visibleGameCount} / {galaxy.games.length}
              </strong>
            </summary>
            <div className={styles.filterContent}>
              <label className={styles.filterSearch}>
                <span>寻找星体</span>
                <input
                  className={styles.filterInput}
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="游戏名或 App ID"
                  aria-describedby="galaxy-filter-result"
                />
              </label>
              <fieldset className={styles.filterGroup}>
                <legend>档案状态</legend>
                <div className={styles.filterButtons}>
                  {activityFilters.map((filter) => (
                    <button
                      className={styles.filterButton}
                      key={filter.id}
                      type="button"
                      aria-pressed={activityFilter === filter.id}
                      onClick={() => setActivityFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.filterGroup}>
                <legend>累计时长</legend>
                <div className={styles.filterButtons}>
                  {durationFilters.map((filter) => (
                    <button
                      className={styles.filterButton}
                      key={filter.id}
                      type="button"
                      aria-pressed={durationFilter === filter.id}
                      onClick={() => setDurationFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className={styles.filterFooter}>
                <p id="galaxy-filter-result" aria-live="polite">
                  当前显示 {visibleGameCount} / {galaxy.games.length}{" "}
                  颗可探索星体
                </p>
                <button
                  className={styles.filterReset}
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                >
                  清空筛选
                </button>
              </div>
            </div>
          </details>
          <StarMap
            galaxy={filteredGalaxy}
            gameMetadataByAppId={report.gameMetadata.games}
            emptyMessage="没有可匹配的可探索星体。试试清空筛选，或搜索另一款游戏。"
          />
        </section>

        <aside className={styles.sideRail} aria-label="星系注记">
          <section className={styles.signalCard}>
            <p className={styles.cardIndex}>01 / 体积法则</p>
            <h2>时间不是标签，是质量。</h2>
            <p>
              半径按累计时长的立方根映射，因此 1000 小时星体的体积严格是 100
              小时的 10 倍。
            </p>
          </section>

          <section className={styles.signalCard}>
            <p className={styles.cardIndex}>02 / 库存边界</p>
            <h2>{galaxy.totalGameCount} 个游戏都在这里。</h2>
            <p>
              {longTail
                ? `前 ${galaxy.games.length} 款作为可点击星体；另有 ${longTail.gameCount} 款远处档案，合计 ${formatHours(longTail.playtimeMinutes / 60)} 小时。`
                : "当前公开库存中的每一款游戏都已作为可点击星体呈现。"}
            </p>
          </section>

          <section className={styles.signalCard}>
            <p className={styles.cardIndex}>03 / 档案状态</p>
            <h2>{galaxy.unplayedGameCount} 枚未点亮信号。</h2>
            <p>
              0
              小时游戏不会伪造行星体积，而会显示为可点击的档案信标；打开后可按需补齐
              Steam 商店资料。
            </p>
          </section>
        </aside>
      </div>

      <footer className={styles.workbenchFooter}>
        <span>公开库存快照 · {formatSnapshot(report.retrievedAt)}</span>
        <a href={player.profileUrl} target="_blank" rel="noreferrer">
          在 Steam 核对资料
        </a>
      </footer>
    </main>
  );
}
