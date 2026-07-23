// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/report/poster-generator", () => ({
  generatePosterPng: vi.fn(),
}));

import { generatePosterPng } from "@/components/report/poster-generator";
import { ReportExperience } from "@/components/report/report-experience";
import {
  saveReportProgress,
  saveReportSession,
} from "@/components/report/report-session";
import { StoryPlayer } from "@/components/report/story-player";
import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import { createPosterModel } from "@/lib/report/poster";

import {
  longChineseNicknameFixture,
  ordinaryPlayerFixture,
} from "../fixtures/report";

const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StoryPlayer", () => {
  it("restores a saved report and its last page through ReportExperience", async () => {
    saveReportSession(window.sessionStorage, report);
    saveReportProgress(window.sessionStorage, 4);

    render(<ReportExperience />);

    await screen.findByRole("heading", {
      level: 1,
      name: "玩法信号仍在追踪。",
    });
    expect(
      screen
        .getByRole("progressbar", { name: "报告阅读进度" })
        .getAttribute("aria-valuenow"),
    ).toBe("5");
  });

  it("offers a route back when the current tab has no report", async () => {
    render(<ReportExperience />);

    await screen.findByRole("heading", {
      level: 1,
      name: "当前标签页里没有报告。",
    });
    expect(
      screen
        .getByRole("link", { name: "返回首页读取数据" })
        .getAttribute("href"),
    ).toBe("/");
  });

  it("advances, persists progress and focuses the new page heading", async () => {
    const user = userEvent.setup();
    render(<StoryPlayer report={report} storage={window.sessionStorage} />);

    const progress = screen.getByRole("progressbar", {
      name: "报告阅读进度",
    });
    expect(progress.getAttribute("aria-valuenow")).toBe("1");

    await user.click(screen.getByRole("button", { name: "下一页" }));

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "时间都留在这里了。",
    });
    expect(progress.getAttribute("aria-valuenow")).toBe("2");
    expect(window.sessionStorage.getItem("steam-report:page:v1")).toBe("1");
    expect(document.activeElement).toBe(heading);
  });

  it("supports arrow keys without hijacking text inputs or browser shortcuts", () => {
    render(<StoryPlayer report={report} />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    screen.getByRole("heading", {
      level: 1,
      name: "时间都留在这里了。",
    });

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(window, { altKey: true, key: "ArrowRight" });

    screen.getByRole("heading", {
      level: 1,
      name: "时间都留在这里了。",
    });
    input.remove();
  });

  it("uses a horizontal swipe but ignores a mostly vertical gesture", () => {
    render(<StoryPlayer report={report} />);
    const viewport = screen.getByRole("region", { name: "夜航员_01" });

    fireEvent.touchStart(viewport, {
      changedTouches: [{ clientX: 240, clientY: 100 }],
      touches: [{ clientX: 240, clientY: 100 }],
    });
    fireEvent.touchEnd(viewport, {
      changedTouches: [{ clientX: 230, clientY: 180 }],
      touches: [],
    });
    screen.getByRole("heading", { level: 1, name: "夜航员_01" });

    fireEvent.touchStart(viewport, {
      changedTouches: [{ clientX: 240, clientY: 100 }],
      touches: [{ clientX: 240, clientY: 100 }],
    });
    fireEvent.touchEnd(viewport, {
      changedTouches: [{ clientX: 120, clientY: 104 }],
      touches: [],
    });
    screen.getByRole("heading", {
      level: 1,
      name: "时间都留在这里了。",
    });
  });

  it("renders the data-driven star map with a text alternative", () => {
    render(<StoryPlayer report={report} initialPage={5} />);

    expect(
      screen.getByRole("group", {
        name: /Three\.js 游戏太阳系，展示时长最高的 4 款游戏/,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/《Main Sequence》累计 100 小时/)).toBeNull();
    expect(
      screen.getByText(/1000 小时的星球体积是 100 小时的 10 倍/),
    ).toBeTruthy();
  });

  it("keeps the report readable when poster generation fails and allows recovery", async () => {
    const user = userEvent.setup();
    vi.mocked(generatePosterPng).mockRejectedValueOnce(
      new Error("canvas unavailable"),
    );
    const model = createPosterModel(report, "https://report.example/");
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:poster-retry"),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(generatePosterPng).mockResolvedValueOnce({
      blob: new Blob(["poster"], { type: "image/png" }),
      model,
      failedAssetCount: 0,
      usedImageFallback: false,
    });
    render(<StoryPlayer report={report} initialPage={9} />);

    screen.getByRole("heading", {
      level: 1,
      name: "这就是你当前可见的游戏宇宙。",
    });
    expect(
      screen.getByRole("button", { name: "上一页" }).hasAttribute("disabled"),
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "生成分享图" }));
    expect(
      await screen.findByText(
        "海报生成失败，请重试。报告数据仍保留在当前标签页。",
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "生成分享图" }));
    expect(await screen.findByRole("link", { name: "下载 PNG" })).toBeTruthy();
  });

  it("shows a download preview after generating a fixed-size poster", async () => {
    const user = userEvent.setup();
    const model = createPosterModel(report, "https://report.example/");
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:poster-preview"),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(generatePosterPng).mockResolvedValueOnce({
      blob: new Blob(["poster"], { type: "image/png" }),
      model,
      failedAssetCount: 0,
      usedImageFallback: false,
    });
    render(<StoryPlayer report={report} initialPage={9} />);

    await user.click(screen.getByRole("button", { name: "生成分享图" }));

    expect(
      await screen.findByRole("img", {
        name: "这份 Steam 游戏宇宙的生成海报预览",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "下载 PNG" }).getAttribute("download"),
    ).toBe("steam-game-universe.png");
  });

  it("falls back to a readable initial and visible message when the avatar fails", () => {
    render(<StoryPlayer report={report} />);

    fireEvent.error(
      screen.getByRole("img", { name: "夜航员_01 的 Steam 头像" }),
    );

    expect(screen.getByLabelText("头像不可用").textContent).toBe("夜");
    expect(screen.getByRole("status").textContent).toContain(
      "Steam 头像不可用，已改用昵称首字。",
    );
  });

  it("keeps an extremely long Chinese nickname intact in the accessible story heading", () => {
    const longNicknameReport = analyzeSteamSnapshot(longChineseNicknameFixture);
    render(<StoryPlayer report={longNicknameReport} />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: longChineseNicknameFixture.player.displayName,
    });

    expect(heading.textContent).toBe(
      longChineseNicknameFixture.player.displayName,
    );
  });
});
