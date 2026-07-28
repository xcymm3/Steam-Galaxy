"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import {
  createGalaxyPosterSummary,
  getMainStarRatio,
  type GalaxyPosterSummary,
} from "@/lib/report/galaxy-poster";
import type { ReportData } from "@/lib/report/types";

import { loadPosterImageSession, loadReportSession } from "./report-session";
import styles from "./galaxy-poster.module.css";

type ShareState = "default" | "error" | "loading" | "success";

interface PosterCanvasOptions {
  origin: string;
  qrDataUrl: string;
  screenshotDataUrl: string | null;
  summary: GalaxyPosterSummary;
}

function formatHours(hours: number) {
  return hours.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function formatRatio(ratio: number) {
  return ratio.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function trimText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function getCanvasToken(name: string) {
  return window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function getCanvasTokenHex(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas color parsing is unavailable");
  }

  context.fillStyle = getCanvasToken(name);
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

async function createPosterImage({
  origin,
  qrDataUrl,
  screenshotDataUrl,
  summary,
}: PosterCanvasOptions) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");

  if (!context || !summary.mainStar) {
    throw new Error("Poster canvas is unavailable");
  }

  const paper = getCanvasToken("--color-story-paper");
  const surface = getCanvasToken("--color-story-surface");
  const rule = getCanvasToken("--color-story-rule");
  const ink = getCanvasToken("--color-story-ink");
  const muted = getCanvasToken("--color-story-muted");
  const accent = getCanvasToken("--color-story-accent");
  const accentInk = getCanvasToken("--color-story-accent-ink");
  const overlay = getCanvasToken("--color-story-poster-overlay");

  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = surface;
  context.fillRect(48, 48, canvas.width - 96, canvas.height - 96);
  context.strokeStyle = rule;
  context.lineWidth = 2;
  context.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  context.fillStyle = accent;
  context.fillRect(80, 82, 12, 58);
  context.fillStyle = ink;
  context.font = '700 42px "Microsoft YaHei", sans-serif';
  context.fillText("STEAM GALAXY", 116, 124);
  context.fillStyle = muted;
  context.font = '400 24px "Microsoft YaHei", sans-serif';
  context.fillText("PERSONAL ORBIT ARCHIVE", 116, 164);

  context.fillStyle = accent;
  context.font = '700 50px "Microsoft YaHei", sans-serif';
  context.fillText(trimText(summary.mainStar.name, 24), 80, 250);
  context.fillStyle = ink;
  context.font = '700 66px "Microsoft YaHei", sans-serif';
  context.fillText("是你的主恒星。", 80, 326);
  context.fillStyle = muted;
  context.font = '400 30px "Microsoft YaHei", sans-serif';
  context.fillText(
    `${formatHours(summary.mainStar.hours)} 小时，占 Steam 宇宙累计航程的 ${formatRatio(getMainStarRatio(summary))}%。`,
    80,
    378,
  );

  context.fillStyle = paper;
  context.fillRect(80, 428, 920, 380);
  if (screenshotDataUrl) {
    const screenshot = await loadImage(screenshotDataUrl);
    drawImageCover(context, screenshot, 80, 428, 920, 380);
  }
  context.fillStyle = overlay;
  context.fillRect(80, 428, 920, 380);
  context.strokeStyle = accent;
  context.strokeRect(80, 428, 920, 380);
  context.fillStyle = ink;
  context.font = '700 24px "Microsoft YaHei", sans-serif';
  context.fillText("当前星图快照", 104, 776);

  context.fillStyle = ink;
  context.font = '700 34px "Microsoft YaHei", sans-serif';
  context.fillText("你的八大行星太阳系", 80, 874);
  context.fillStyle = muted;
  context.font = '400 23px "Microsoft YaHei", sans-serif';
  context.fillText("按累计时长排序", 80, 910);

  summary.planets.forEach((planet, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 80 + column * 470;
    const y = 968 + row * 68;
    context.fillStyle = accent;
    context.fillRect(x, y - 25, 8, 36);
    context.fillStyle = ink;
    context.font = '700 25px "Microsoft YaHei", sans-serif';
    context.fillText(
      `${String(index + 1).padStart(2, "0")}  ${trimText(planet.name, 16)}`,
      x + 22,
      y,
    );
    context.fillStyle = muted;
    context.font = '400 22px "Microsoft YaHei", sans-serif';
    context.fillText(`${formatHours(planet.hours)} 小时`, x + 22, y + 30);
  });

  context.strokeStyle = rule;
  context.beginPath();
  context.moveTo(80, 1262);
  context.lineTo(1000, 1262);
  context.stroke();
  context.fillStyle = accent;
  context.font = '700 30px "Microsoft YaHei", sans-serif';
  context.fillText(`你属于：${summary.persona}`, 80, 1320);
  context.fillStyle = muted;
  context.font = '400 22px "Microsoft YaHei", sans-serif';
  context.fillText(`总航程 ${formatHours(summary.totalHours)} 小时`, 80, 1360);
  context.fillText(`库存 ${summary.totalGameCount} 款`, 332, 1360);
  context.fillText(`未启动 ${summary.unplayedGameCount} 款`, 554, 1360);

  const qrCode = await loadImage(qrDataUrl);
  context.fillStyle = accentInk;
  context.fillRect(836, 1278, 164, 114);
  context.drawImage(qrCode, 850, 1292, 86, 86);
  context.fillStyle = accent;
  context.font = '400 17px "Microsoft YaHei", sans-serif';
  context.fillText("扫码创建", 944, 1328);
  context.fillText("你的星系", 944, 1354);
  context.fillText(origin.replace(/^https?:\/\//u, ""), 80, 1408);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to encode poster"));
    }, "image/png");
  });
}

function PosterRecovery() {
  return (
    <main className={styles.posterRecovery}>
      <h1>海报档案不在当前标签页。</h1>
      <p>请回到游戏星系，重新点击“一键生成海报”。</p>
      <Link href="/report">返回游戏星系</Link>
    </main>
  );
}

function GalaxyPoster({
  report,
  screenshotDataUrl,
}: {
  report: ReportData;
  screenshotDataUrl: string | null;
}) {
  const summary = useMemo(() => createGalaxyPosterSummary(report), [report]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shareState, setShareState] = useState<ShareState>("default");
  const [shareMessage, setShareMessage] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    void QRCode.toDataURL(origin, {
      color: {
        dark: getCanvasTokenHex("--color-story-ink"),
        light: getCanvasTokenHex("--color-story-paper"),
      },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    })
      .then(setQrDataUrl)
      .catch(() => {
        setShareState("error");
        setShareMessage("二维码生成失败，请返回星图后重试。");
      });
  }, [origin]);

  if (!summary.mainStar) {
    return <PosterRecovery />;
  }

  const mainStarRatio = getMainStarRatio(summary);
  const shareCopy = `${summary.mainStar.name} 是我的 Steam 主恒星，已占据 ${formatRatio(mainStarRatio)}% 的累计航程。你 Steam 宇宙的主恒星是哪一颗？`;

  async function handleShare() {
    if (!qrDataUrl || shareState === "loading") {
      return;
    }

    setShareState("loading");
    setShareMessage("");

    try {
      const posterImage = await createPosterImage({
        origin,
        qrDataUrl,
        screenshotDataUrl,
        summary,
      });
      const posterFile = new File([posterImage], "steam-galaxy-poster.png", {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare?.({ files: [posterFile] })) {
        await navigator.share({
          files: [posterFile],
          text: shareCopy,
          title: "我的 Steam 游戏星系",
        });
        setShareState("success");
        setShareMessage("已打开系统分享面板。");
        return;
      }

      await navigator.clipboard.writeText(`${shareCopy}\n${origin}`);
      setShareState("success");
      setShareMessage("分享文案已复制，可直接粘贴到社媒。\n");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareState("default");
        return;
      }

      setShareState("error");
      setShareMessage("暂时无法调用分享功能，请稍后重试。");
    }
  }

  return (
    <main className={styles.posterPage}>
      <header className={styles.posterHeader}>
        <Link className={styles.posterBackLink} href="/report">
          返回星图
        </Link>
        <button
          className={styles.posterShareButton}
          type="button"
          onClick={() => void handleShare()}
          disabled={!qrDataUrl || shareState === "loading"}
          data-state={shareState}
          aria-busy={shareState === "loading"}
        >
          {shareState === "loading" ? "正在准备…" : "分享海报"}
        </button>
      </header>

      <section className={styles.posterShell} aria-labelledby="poster-title">
        <article className={styles.posterCard}>
          <div className={styles.posterMasthead}>
            <span>STEAM GALAXY</span>
            <span>PERSONAL ORBIT ARCHIVE</span>
          </div>
          <div className={styles.posterHeadline}>
            <p id="poster-title">{summary.mainStar.name} 是你的主恒星。</p>
            <p>
              {formatHours(summary.mainStar.hours)} 小时，占 Steam
              宇宙累计航程的 {formatRatio(mainStarRatio)}%。
            </p>
          </div>

          <figure className={styles.posterScreenshot}>
            {screenshotDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- The canvas capture is a session-only data URL and cannot use the image optimizer.
              <img src={screenshotDataUrl} alt="当前 Steam 游戏星图截图" />
            ) : (
              <div>星图快照不可用</div>
            )}
            <figcaption>当前星图快照</figcaption>
          </figure>

          <section
            className={styles.posterPlanets}
            aria-labelledby="planets-title"
          >
            <div className={styles.posterSectionHead}>
              <h2 id="planets-title">你的八大行星太阳系</h2>
              <span>按累计时长排序</span>
            </div>
            <ol>
              {summary.planets.map((planet, index) => (
                <li key={planet.appId}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{planet.name}</strong>
                  <em>{formatHours(planet.hours)} 小时</em>
                </li>
              ))}
            </ol>
          </section>

          <footer className={styles.posterFooter}>
            <div>
              <p>你属于：{summary.persona}</p>
              <dl>
                <div>
                  <dt>总航程</dt>
                  <dd>{formatHours(summary.totalHours)} 小时</dd>
                </div>
                <div>
                  <dt>库存</dt>
                  <dd>{summary.totalGameCount} 款</dd>
                </div>
                <div>
                  <dt>未启动</dt>
                  <dd>{summary.unplayedGameCount} 款</dd>
                </div>
              </dl>
            </div>
            <aside>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- QR code is generated locally as a data URL for this session.
                <img src={qrDataUrl} alt="扫码创建自己的 Steam 游戏星系" />
              ) : (
                <span>生成二维码中</span>
              )}
              <small>扫码创建你的星系</small>
            </aside>
          </footer>
        </article>

        <aside className={styles.posterNotes}>
          <p>可分享档案</p>
          <h1>{report.player.displayName} 的游戏星系</h1>
          <dl>
            <div>
              <dt>主恒星</dt>
              <dd>{summary.mainStar.name}</dd>
            </div>
            <div>
              <dt>偏爱类型</dt>
              <dd>{summary.dominantGenre ?? "数据追踪中"}</dd>
            </div>
          </dl>
          <p className={styles.posterShareCopy}>{shareCopy}</p>
          {shareMessage && (
            <p
              className={styles.posterShareMessage}
              data-state={shareState}
              role={shareState === "error" ? "alert" : "status"}
            >
              {shareMessage}
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}

export function GalaxyPosterExperience() {
  const [session, setSession] = useState<
    | {
        report: ReportData;
        screenshotDataUrl: string | null;
      }
    | null
    | undefined
  >(undefined);

  useEffect(() => {
    const sessionFrame = window.requestAnimationFrame(() => {
      const report = loadReportSession(window.sessionStorage);

      if (!report) {
        setSession(null);
        return;
      }

      setSession({
        report,
        screenshotDataUrl: loadPosterImageSession(window.sessionStorage),
      });
    });

    return () => window.cancelAnimationFrame(sessionFrame);
  }, []);

  if (session === undefined) {
    return <main className={styles.posterLoading}>正在整理星系档案…</main>;
  }

  return session?.report ? (
    <GalaxyPoster
      report={session.report}
      screenshotDataUrl={session.screenshotDataUrl}
    />
  ) : (
    <PosterRecovery />
  );
}
