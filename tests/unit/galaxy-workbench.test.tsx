// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
        name: "转动你的游戏宇宙",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: /Three\.js Steam 星系，展示时长最高的 6 款游戏/,
      }),
    ).toBeTruthy();
    expect(screen.getByText("6 个游戏都在这里。")).toBeTruthy();
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

  it("filters the interactive bodies by name, archive state and duration", async () => {
    const user = userEvent.setup();

    render(<GalaxyWorkbench report={report} />);

    const search = screen.getByRole("searchbox", { name: "寻找星体" });
    await user.type(search, "Main Sequence");
    expect(await screen.findByText("当前显示 1 / 6 颗可探索星体")).toBeTruthy();

    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "未点亮" }));
    expect(await screen.findByText("当前显示 2 / 6 颗可探索星体")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "100 小时+" }));
    expect(await screen.findByText("当前显示 0 / 6 颗可探索星体")).toBeTruthy();
    expect(
      screen.getByText(
        "没有可匹配的可探索星体。试试清空筛选，或搜索另一款游戏。",
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "清空筛选" }));
    expect(await screen.findByText("当前显示 6 / 6 颗可探索星体")).toBeTruthy();
  });

  it("provides a keyboard-accessible navigator for every explorable star", async () => {
    const user = userEvent.setup();

    render(<GalaxyWorkbench report={report} />);

    const navigator = screen.getByRole("combobox", { name: "键盘定位星体" });
    const options = screen.getAllByRole("option");

    expect(options).toHaveLength(7);
    expect(options[1]?.textContent).toContain("Main Sequence");

    await user.selectOptions(navigator, options[1]!.getAttribute("value")!);
    expect(
      screen.getByRole("region", { name: "Main Sequence 的游戏档案" }),
    ).toBeTruthy();

    await user.selectOptions(navigator, "");
    expect(
      screen.queryByRole("region", { name: "Main Sequence 的游戏档案" }),
    ).toBeNull();
  });

  it("collapses the filter dock by default on compact screens", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    render(<GalaxyWorkbench report={report} />);

    const filterDock = screen.getByText("缩小星图").closest("details");
    expect(filterDock).toBeTruthy();
    await waitFor(() => expect(filterDock?.hasAttribute("open")).toBe(false));
  });
});
