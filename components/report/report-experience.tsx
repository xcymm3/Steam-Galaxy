"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import type { ReportData } from "@/lib/report/types";

import { GalaxyWorkbench } from "./galaxy-workbench";
import { loadReportSession } from "./report-session";
import styles from "./galaxy-workbench.module.css";

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
        <p>正在恢复这片星系…</p>
      </main>
    );
  }

  const report: ReportData | null = loadReportSession(window.sessionStorage);

  if (!report) {
    return (
      <main className={styles.recoveryState}>
        <div>
          <p className={styles.recoveryCode}>GALAXY / MISSING</p>
          <h1>当前标签页里没有星系。</h1>
          <p>先回到首页读取一次公开 Steam 数据，再打开你的游戏星系。</p>
          <Link className={styles.recoveryLink} href="/">
            返回首页读取数据
          </Link>
        </div>
      </main>
    );
  }

  return <GalaxyWorkbench report={report} />;
}
