"use client";

import Link from "next/link";

import type { ReportData } from "@/lib/report/types";

import { StarMap } from "./star-map";
import styles from "./galaxy-workbench.module.css";

interface GalaxyWorkbenchProps {
  report: ReportData;
}

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

export function GalaxyWorkbench({ report }: GalaxyWorkbenchProps) {
  const { galaxy, metrics, player } = report;
  const longTail = galaxy.longTail;

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
            <p>
              点击星体查看游戏档案；拖动旋转，滚轮或双指缩放，Esc 返回全景。
            </p>
          </div>
          <StarMap
            galaxy={galaxy}
            gameMetadataByAppId={report.gameMetadata.games}
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
