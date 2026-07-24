// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GalaxyWorkbench } from "@/components/report/galaxy-workbench";
import { ReportExperience } from "@/components/report/report-experience";
import { saveReportSession } from "@/components/report/report-session";
import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import { ordinaryPlayerFixture } from "../fixtures/report";

const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
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
});
