// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GalaxyWorkbench } from "@/components/report/galaxy-workbench";
import { ReportExperience } from "@/components/report/report-experience";
import { saveReportSession } from "@/components/report/report-session";
import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import { ordinaryPlayerFixture } from "../fixtures/report";

const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("GalaxyWorkbench", () => {
  it("makes the interactive galaxy the only primary report surface", () => {
    render(<GalaxyWorkbench report={report} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "夜航员_01 的游戏星系",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "星图",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: /Three\.js Steam 星系，展示时长最高的 6 款游戏/,
      }),
    ).toBeTruthy();
    expect(screen.queryByText("时间不是标签，是质量。")).toBeNull();
    expect(screen.queryByText(/06\s*\/\s*10/)).toBeNull();
  });

  it("restores a saved galaxy session through the report route shell", async () => {
    saveReportSession(window.sessionStorage, report);

    render(<ReportExperience />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "夜航员_01 的游戏星系",
      }),
    ).toBeTruthy();
  });

  it("offers recovery when the current tab has no galaxy session", async () => {
    render(<ReportExperience />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "当前标签页里没有星系。",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "返回首页读取数据" })
        .getAttribute("href"),
    ).toBe("/");
  });

  it("filters the interactive bodies by name and cumulative duration", async () => {
    const user = userEvent.setup();

    render(<GalaxyWorkbench report={report} />);

    const search = screen.getByRole("searchbox", { name: "寻找星体" });
    await user.type(search, "Main Sequence");
    expect(await screen.findByText("1 / 6")).toBeTruthy();

    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "100 小时+" }));
    expect(await screen.findByText("1 / 6")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "2 小时内" }));
    expect(await screen.findByText("3 / 6")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "100 小时内" }));
    expect(await screen.findByText("2 / 6")).toBeTruthy();
    await user.type(search, "Main Sequence");
    expect(await screen.findByText("0 / 6")).toBeTruthy();
    expect(
      screen.getByText(
        "没有可匹配的可探索星体。试试清空筛选，或搜索另一款游戏。",
      ),
    ).toBeTruthy();

    expect(screen.queryByRole("button", { name: "已点亮" })).toBeNull();
    expect(screen.queryByRole("button", { name: "未点亮" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "清空筛选" }));
    expect(await screen.findByText("6 / 6")).toBeTruthy();
  });

  it("starts with compact filters and no keyboard navigator", () => {
    render(<GalaxyWorkbench report={report} />);

    const filterDock = screen.getByText("缩小星图").closest("details");
    expect(filterDock).toBeTruthy();
    expect(filterDock?.hasAttribute("open")).toBe(false);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
