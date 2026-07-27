"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import type { GalaxyModel } from "@/lib/report/galaxy";
import type { ReportData } from "@/lib/report/types";

import { StarMap } from "./star-map";
import styles from "./galaxy-workbench.module.css";

interface GalaxyWorkbenchProps {
  report: ReportData;
}

type DurationFilter = "all" | "under-two" | "under-hundred" | "hundred-plus";

const durationFilters: ReadonlyArray<{
  id: DurationFilter;
  label: string;
}> = [
  { id: "all", label: "全部" },
  { id: "under-two", label: "2 小时内" },
  { id: "under-hundred", label: "100 小时内" },
  { id: "hundred-plus", label: "100 小时+" },
];

function formatHours(hours: number) {
  return hours.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function matchesDuration(
  playtimeMinutes: number,
  durationFilter: DurationFilter,
) {
  switch (durationFilter) {
    case "under-two":
      return playtimeMinutes < 120;
    case "under-hundred":
      return playtimeMinutes >= 120 && playtimeMinutes < 6_000;
    case "hundred-plus":
      return playtimeMinutes >= 6_000;
    default:
      return true;
  }
}

function createFilteredGalaxy(
  galaxy: GalaxyModel,
  search: string,
  durationFilter: DurationFilter,
): GalaxyModel {
  return {
    ...galaxy,
    games: galaxy.games.filter((node) => {
      const matchesSearch =
        !search ||
        node.game.name.toLocaleLowerCase("zh-CN").includes(search) ||
        String(node.appId).includes(search);
      return (
        matchesSearch &&
        matchesDuration(node.game.playtimeMinutes, durationFilter)
      );
    }),
  };
}

export function GalaxyWorkbench({ report }: GalaxyWorkbenchProps) {
  const { galaxy, metrics, player } = report;
  const [searchInput, setSearchInput] = useState("");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [isFilterDockOpen, setFilterDockOpen] = useState(false);
  const deferredSearch = useDeferredValue(normalizeSearch(searchInput));
  const filteredGalaxy = useMemo(
    () => createFilteredGalaxy(galaxy, deferredSearch, durationFilter),
    [deferredSearch, durationFilter, galaxy],
  );
  const hasActiveFilters = Boolean(searchInput) || durationFilter !== "all";
  const visibleGameCount = filteredGalaxy.games.length;

  const resetFilters = () => {
    setSearchInput("");
    setDurationFilter("all");
  };

  return (
    <main className={styles.workbenchRoot}>
      <header className={styles.workbenchHeader}>
        <Link className={styles.wordmark} href="/" aria-label="返回首页">
          STEAM GALAXY
        </Link>
        <div className={styles.playerIdentity}>
          <strong>{player.displayName}</strong>
        </div>
        <Link className={styles.changeLibraryLink} href="/">
          换个库存
        </Link>
      </header>

      <section className={styles.workbenchIntro} aria-labelledby="galaxy-title">
        <div>
          <h1 id="galaxy-title">{player.displayName} 的游戏星系</h1>
        </div>
        <dl className={styles.summaryMetrics} aria-label="星系概览">
          <div>
            <dt>累计航程</dt>
            <dd>{formatHours(metrics.totalPlaytimeHours)} 小时</dd>
          </div>
          <div>
            <dt>库存游戏</dt>
            <dd>{metrics.totalGameCount} 款</dd>
          </div>
          <div>
            <dt>星图星体</dt>
            <dd>{galaxy.games.length} 个</dd>
          </div>
        </dl>
      </section>

      <div className={styles.workbenchContent}>
        <section className={styles.mapPanel} aria-labelledby="map-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="map-title">星图</h2>
            </div>
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
                />
              </label>
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
      </div>
    </main>
  );
}
