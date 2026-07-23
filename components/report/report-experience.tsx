"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import type { ReportData } from "@/lib/report/types";

import { loadReportProgress, loadReportSession } from "./report-session";
import { StoryPlayer } from "./story-player";
import styles from "./story-player.module.css";

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ReportExperience() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!hydrated) {
    return (
      <main className={styles.recoveryState} aria-busy="true">
        <p>正在恢复这次报告…</p>
      </main>
    );
  }

  const report: ReportData | null = loadReportSession(window.sessionStorage);

  if (!report) {
    return (
      <main className={styles.recoveryState}>
        <div>
          <p className={styles.recoveryCode}>REPORT / MISSING</p>
          <h1>当前标签页里没有报告。</h1>
          <p>先回到首页读取一次公开 Steam 数据，再进入十页故事。</p>
          <Link className={styles.recoveryLink} href="/">
            返回首页读取数据
          </Link>
        </div>
      </main>
    );
  }

  return (
    <StoryPlayer
      report={report}
      initialPage={loadReportProgress(window.sessionStorage)}
      storage={window.sessionStorage}
    />
  );
}
