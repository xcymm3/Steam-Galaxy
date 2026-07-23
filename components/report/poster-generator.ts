"use client";

import { create as createQrCode } from "qrcode";

import {
  createPosterModel,
  loadPosterAssets,
  type PosterAssets,
  type PosterModel,
} from "@/lib/report/poster";
import type { ReportData } from "@/lib/report/types";

interface PosterColors {
  paper: string;
  surface: string;
  ink: string;
  muted: string;
  rule: string;
  accent: string;
}

export interface PosterRenderResult {
  blob: Blob;
  model: PosterModel;
  failedAssetCount: number;
  usedImageFallback: boolean;
}

function formatHours(hours: number) {
  return hours.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function getInitial(value: string) {
  return Array.from(value.trim())[0] || "S";
}

function readPosterColors(): PosterColors {
  const computed = window.getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) =>
    computed.getPropertyValue(token).trim() || fallback;

  return {
    paper: read("--color-story-paper", "#11151f"),
    surface: read("--color-story-surface-raised", "#202735"),
    ink: read("--color-story-ink", "#f3f1ec"),
    muted: read("--color-story-muted", "#aab0bc"),
    rule: read("--color-story-rule", "#5c6575"),
    accent: read("--color-story-accent", "#efaa31"),
  };
}

function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error("image load timeout"));
    }, 6_000);

    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("image load failed"));
    };
    image.src = url;
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maximumWidth: number,
  lineHeight: number,
  maximumLines: number,
) {
  const lines: string[] = [];
  let currentLine = "";

  for (const character of value) {
    const candidate = currentLine + character;
    if (context.measureText(candidate).width <= maximumWidth || !currentLine) {
      currentLine = candidate;
      continue;
    }

    if (lines.length === maximumLines - 1) {
      const ellipsis = "…";
      while (
        currentLine.length > 0 &&
        context.measureText(`${currentLine}${ellipsis}`).width > maximumWidth
      ) {
        currentLine = currentLine.slice(0, -1);
      }
      lines.push(`${currentLine}${ellipsis}`);
      currentLine = "";
      break;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = character;
    }
  }

  if (currentLine && lines.length < maximumLines) {
    lines.push(currentLine);
  }

  lines.slice(0, maximumLines).forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return lines.length * lineHeight;
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawAvatar(
  context: CanvasRenderingContext2D,
  model: PosterModel,
  assets: PosterAssets<HTMLImageElement>,
  colors: PosterColors,
) {
  const x = 812;
  const y = 106;
  const size = 180;

  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();

  if (assets.avatar) {
    drawImageCover(context, assets.avatar, x, y, size, size);
  } else {
    context.fillStyle = colors.surface;
    context.fillRect(x, y, size, size);
    context.fillStyle = colors.ink;
    context.font = "500 76px ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getInitial(model.displayName), x + size / 2, y + size / 2);
  }

  context.restore();
  context.strokeStyle = colors.rule;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.stroke();
}

function drawTopGames(
  context: CanvasRenderingContext2D,
  model: PosterModel,
  assets: PosterAssets<HTMLImageElement>,
  colors: PosterColors,
) {
  const startY = 690;

  context.fillStyle = colors.muted;
  context.font = "500 22px ui-sans-serif, system-ui, sans-serif";
  context.fillText("TOP GAMES", 64, startY);

  model.topGames.forEach((game, index) => {
    const y = startY + 42 + index * 92;
    const icon = assets.topGameIcons.get(game.appId);

    drawRoundedRect(context, 64, y, 68, 68, 12);
    context.fillStyle = colors.surface;
    context.fill();

    if (icon) {
      context.save();
      drawRoundedRect(context, 64, y, 68, 68, 12);
      context.clip();
      drawImageCover(context, icon, 64, y, 68, 68);
      context.restore();
    } else {
      context.fillStyle = colors.accent;
      context.font = "500 24px ui-sans-serif, system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(index + 1), 98, y + 34);
    }

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = colors.ink;
    context.font = "500 27px ui-sans-serif, system-ui, sans-serif";
    drawWrappedText(context, game.name, 154, y + 28, 500, 30, 1);
    context.fillStyle = colors.muted;
    context.font = "400 21px ui-sans-serif, system-ui, sans-serif";
    context.fillText(
      `${formatHours(game.playtimeMinutes / 60)} 小时`,
      154,
      y + 57,
    );
  });
}

function drawSimplifiedStarMap(
  context: CanvasRenderingContext2D,
  model: PosterModel,
  colors: PosterColors,
) {
  const x = 64;
  const y = 1_006;
  const width = 650;
  const height = 270;

  context.strokeStyle = colors.rule;
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);

  model.starNodes.forEach((node) => {
    const nodeX = x + (node.x / 1_000) * width;
    const nodeY = y + (node.y / 640) * height;
    const radius = Math.max(2, Math.min(26, node.radius * 0.45));

    context.beginPath();
    context.arc(nodeX, nodeY, radius, 0, Math.PI * 2);
    context.fillStyle =
      node.kind === "top"
        ? colors.accent
        : node.kind === "dust"
          ? colors.muted
          : colors.ink;
    context.globalAlpha =
      node.kind === "dust" ? 0.45 : node.kind === "nebula" ? 0.24 : 0.82;
    context.fill();
  });

  context.globalAlpha = 1;
  context.fillStyle = colors.muted;
  context.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  context.fillText("简化游戏星图", x, y - 16);
}

function drawQrCode(
  context: CanvasRenderingContext2D,
  homeUrl: string,
  colors: PosterColors,
) {
  const code = createQrCode(homeUrl, { errorCorrectionLevel: "M" });
  const x = 790;
  const y = 1_110;
  const size = 218;
  const quietZone = 4;
  const modules = code.modules.size;
  const moduleSize = size / (modules + quietZone * 2);

  context.fillStyle = colors.ink;
  context.fillRect(x, y, size, size);
  context.fillStyle = colors.paper;

  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (code.modules.get(row, column)) {
        context.fillRect(
          x + (column + quietZone) * moduleSize,
          y + (row + quietZone) * moduleSize,
          Math.ceil(moduleSize),
          Math.ceil(moduleSize),
        );
      }
    }
  }

  context.fillStyle = colors.muted;
  context.font = "400 18px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("扫描查看你的游戏宇宙", x + size / 2, y + size + 34);
  context.textAlign = "left";
}

function drawPoster(
  canvas: HTMLCanvasElement,
  model: PosterModel,
  assets: PosterAssets<HTMLImageElement>,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("浏览器不支持海报画布。");
  }

  const colors = readPosterColors();
  canvas.width = model.width;
  canvas.height = model.height;
  context.fillStyle = colors.paper;
  context.fillRect(0, 0, model.width, model.height);

  context.fillStyle = colors.accent;
  context.fillRect(64, 66, 88, 8);
  context.fillStyle = colors.ink;
  context.font = "500 28px ui-sans-serif, system-ui, sans-serif";
  context.fillText(model.brand, 64, 122);

  drawAvatar(context, model, assets, colors);

  context.fillStyle = colors.ink;
  context.font = "500 66px ui-sans-serif, system-ui, sans-serif";
  drawWrappedText(context, model.displayName, 64, 228, 680, 78, 2);

  context.fillStyle = colors.muted;
  context.font = "400 28px ui-sans-serif, system-ui, sans-serif";
  drawWrappedText(context, model.titleName, 64, 404, 600, 36, 2);

  context.fillStyle = colors.ink;
  context.font = "500 178px ui-sans-serif, system-ui, sans-serif";
  context.fillText(formatHours(model.totalHours), 64, 600);
  context.fillStyle = colors.muted;
  context.font = "400 28px ui-sans-serif, system-ui, sans-serif";
  context.fillText("累计小时", 72, 642);

  context.strokeStyle = colors.rule;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(64, 668);
  context.lineTo(1_016, 668);
  context.stroke();

  context.fillStyle = colors.ink;
  context.font = "500 44px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`${model.totalGameCount} 款`, 710, 576);
  context.fillText(`${model.playedGameCount} 款已玩`, 710, 632);

  drawTopGames(context, model, assets, colors);
  drawSimplifiedStarMap(context, model, colors);
  drawQrCode(context, model.homeUrl, colors);

  context.fillStyle = colors.muted;
  context.font = "400 18px ui-sans-serif, system-ui, sans-serif";
  context.fillText("当前公开库存快照 · 不包含 SteamID", 64, 1_368);
  drawWrappedText(context, model.titleExplanation, 64, 1_398, 680, 20, 2);
}

function toPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("海报 PNG 编码失败。"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

export async function generatePosterPng(
  report: ReportData,
  origin: string,
): Promise<PosterRenderResult> {
  const model = createPosterModel(report, origin);
  const canvas = document.createElement("canvas");
  let assets = await loadPosterAssets(model, loadBrowserImage);

  try {
    drawPoster(canvas, model, assets);
    const blob = await toPngBlob(canvas);

    return {
      blob,
      model,
      failedAssetCount: assets.failedAssetCount,
      usedImageFallback: assets.failedAssetCount > 0,
    };
  } catch {
    const fallbackCanvas = document.createElement("canvas");
    assets = { avatar: null, topGameIcons: new Map(), failedAssetCount: 0 };
    drawPoster(fallbackCanvas, model, assets);
    const blob = await toPngBlob(fallbackCanvas);

    return {
      blob,
      model,
      failedAssetCount: 0,
      usedImageFallback: true,
    };
  }
}
