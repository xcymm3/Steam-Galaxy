"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ReportData } from "@/lib/report/types";

import { generatePosterPng } from "./poster-generator";
import { saveReportProgress } from "./report-session";
import { type PosterPresentation, StorySlide } from "./story-slides";
import styles from "./story-player.module.css";

const storyPageCount = 10;
const swipeThreshold = 52;

interface StoryPlayerProps {
  report: ReportData;
  initialPage?: number;
  storage?: Storage;
}

interface TouchOrigin {
  x: number;
  y: number;
}

interface PosterState extends PosterPresentation {
  blob: Blob | null;
}

const initialPosterState: PosterState = {
  status: "idle",
  url: null,
  blob: null,
  message: "",
};

function clampPage(pageIndex: number) {
  if (!Number.isFinite(pageIndex)) {
    return 0;
  }

  return Math.min(storyPageCount - 1, Math.max(0, pageIndex));
}

export function StoryPlayer({
  report,
  initialPage = 0,
  storage,
}: StoryPlayerProps) {
  const [currentPage, setCurrentPage] = useState(() => clampPage(initialPage));
  const [poster, setPoster] = useState<PosterState>(initialPosterState);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewportRef = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);
  const touchOrigin = useRef<TouchOrigin | null>(null);
  const posterUrlRef = useRef<string | null>(null);

  const navigateTo = useCallback(
    (pageIndex: number) => {
      const nextPage = clampPage(pageIndex);
      if (nextPage === currentPage) {
        return;
      }

      focusAfterNavigation.current = true;
      setCurrentPage(nextPage);
    },
    [currentPage],
  );

  const goBack = useCallback(() => {
    navigateTo(currentPage - 1);
  }, [currentPage, navigateTo]);

  const goForward = useCallback(() => {
    navigateTo(currentPage + 1);
  }, [currentPage, navigateTo]);

  useEffect(() => {
    if (storage) {
      saveReportProgress(storage, currentPage);
    }

    if (focusAfterNavigation.current) {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
      }
      headingRef.current?.focus({ preventScroll: true });
      focusAfterNavigation.current = false;
    }
  }, [currentPage, storage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.matches("input, textarea, select, [role='textbox']")))
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && currentPage > 0) {
        event.preventDefault();
        goBack();
      }

      if (event.key === "ArrowRight" && currentPage < storyPageCount - 1) {
        event.preventDefault();
        goForward();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, goBack, goForward]);

  useEffect(() => {
    return () => {
      if (posterUrlRef.current) {
        URL.revokeObjectURL(posterUrlRef.current);
      }
    };
  }, []);

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (event.touches.length > 1) {
      touchOrigin.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    touchOrigin.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchCancel() {
    touchOrigin.current = null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = touchOrigin.current;
    const touch = event.changedTouches[0];
    touchOrigin.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (
      Math.abs(deltaX) < swipeThreshold ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0 && currentPage < storyPageCount - 1) {
      goForward();
    } else if (deltaX > 0 && currentPage > 0) {
      goBack();
    }
  }

  async function handlePosterGeneration() {
    if (poster.status === "generating") {
      return;
    }

    setPoster({
      status: "generating",
      url: poster.url,
      blob: poster.blob,
      message: "正在生成 1080 × 1440 PNG 海报…",
    });

    try {
      const result = await generatePosterPng(report, window.location.origin);
      const url = URL.createObjectURL(result.blob);

      if (posterUrlRef.current) {
        URL.revokeObjectURL(posterUrlRef.current);
      }
      posterUrlRef.current = url;
      setPoster({
        status: "ready",
        url,
        blob: result.blob,
        message: result.usedImageFallback
          ? "海报已生成；部分外部图片不可用，已使用文字降级。"
          : "海报已生成，可下载 PNG 或使用系统分享。",
      });
    } catch {
      setPoster((current) => ({
        ...current,
        status: "error",
        message: "海报生成失败，请重试。报告数据仍保留在当前标签页。",
      }));
    }
  }

  async function handleSharePoster() {
    if (!poster.blob || !navigator.share) {
      setPoster((current) => ({
        ...current,
        message: "当前浏览器不支持系统分享，请下载 PNG。",
      }));
      return;
    }

    const file = new File([poster.blob], "steam-game-universe.png", {
      type: "image/png",
    });

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      setPoster((current) => ({
        ...current,
        message: "当前浏览器不能分享图片文件，请下载 PNG。",
      }));
      return;
    }

    try {
      await navigator.share({
        files: [file],
        title: "我的 Steam 游戏宇宙",
        text: "看看时间都去了哪里。",
      });
      setPoster((current) => ({
        ...current,
        message: "海报已交给系统分享。",
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setPoster((current) => ({
        ...current,
        message: "系统分享没有完成，你仍可下载 PNG。",
      }));
    }
  }

  function handlePrimaryAction() {
    if (currentPage < storyPageCount - 1) {
      goForward();
      return;
    }

    void handlePosterGeneration();
  }

  const primaryButtonLabel =
    currentPage < storyPageCount - 1
      ? "下一页"
      : poster.status === "generating"
        ? "正在生成"
        : poster.status === "ready"
          ? "重新生成"
          : "生成分享图";

  return (
    <main className={styles.storyRoot}>
      <header className={styles.storyHeader}>
        <Link className={styles.storyWordmark} href="/" aria-label="返回首页">
          HOURS?
        </Link>
        <Link className={styles.exitLink} href="/">
          退出报告
        </Link>
      </header>

      <div className={styles.progressRow}>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="报告阅读进度"
          aria-valuemin={1}
          aria-valuemax={storyPageCount}
          aria-valuenow={currentPage + 1}
          aria-valuetext={`第 ${currentPage + 1} 页，共 ${storyPageCount} 页`}
        >
          {Array.from({ length: storyPageCount }, (_, index) => (
            <span
              key={index}
              className={styles.progressSegment}
              data-state={
                index < currentPage
                  ? "complete"
                  : index === currentPage
                    ? "current"
                    : "upcoming"
              }
              aria-hidden="true"
            />
          ))}
        </div>
        <span className={styles.pageCounter} aria-hidden="true">
          {String(currentPage + 1).padStart(2, "0")} / {storyPageCount}
        </span>
      </div>

      <section
        ref={viewportRef}
        className={styles.storyViewport}
        aria-labelledby="story-slide-title"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <StorySlide
          key={currentPage}
          pageIndex={currentPage}
          report={report}
          headingRef={headingRef}
          poster={poster}
          onSharePoster={poster.status === "ready" ? handleSharePoster : null}
        />
      </section>

      <nav className={styles.storyControls} aria-label="报告翻页">
        <button
          className={styles.backButton}
          type="button"
          onClick={goBack}
          disabled={currentPage === 0}
          aria-label="上一页"
          aria-keyshortcuts={currentPage > 0 ? "ArrowLeft" : undefined}
        >
          上一页
        </button>
        <p className={styles.controlHint}>方向键或左右滑动</p>
        <button
          className={styles.nextButton}
          type="button"
          onClick={handlePrimaryAction}
          disabled={
            currentPage === storyPageCount - 1 && poster.status === "generating"
          }
          data-state={
            currentPage === storyPageCount - 1
              ? poster.status === "generating"
                ? "loading"
                : poster.status === "ready"
                  ? "success"
                  : poster.status === "error"
                    ? "error"
                    : "default"
              : "default"
          }
          aria-keyshortcuts={
            currentPage < storyPageCount - 1 ? "ArrowRight" : undefined
          }
          aria-busy={
            currentPage === storyPageCount - 1 && poster.status === "generating"
          }
        >
          {primaryButtonLabel}
        </button>
      </nav>
    </main>
  );
}
