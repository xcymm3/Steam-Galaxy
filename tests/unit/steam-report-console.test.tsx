// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SteamReportConsole } from "@/components/landing/steam-report-console";
import { loadReportSession } from "@/components/report/report-session";
import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import { ordinaryPlayerFixture } from "../fixtures/report";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  window.sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: report }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SteamReportConsole report entry", () => {
  it("stores successful ReportData before navigating to the Galaxy Workbench", async () => {
    const user = userEvent.setup();
    render(<SteamReportConsole />);

    await user.type(
      screen.getByRole("textbox", { name: "SteamID 或个人资料链接" }),
      "76561198000000001",
    );
    await user.click(screen.getByRole("button", { name: "读取公开数据" }));

    await screen.findByRole("heading", {
      level: 3,
      name: "夜航员_01，星系数据就绪",
    });
    await user.click(screen.getByRole("button", { name: "打开游戏星系" }));

    expect(loadReportSession(window.sessionStorage)).toEqual(report);
    expect(pushMock).toHaveBeenCalledWith("/report");
  });

  it("stays on the result when browser session storage is unavailable", async () => {
    const user = userEvent.setup();
    render(<SteamReportConsole />);

    await user.type(
      screen.getByRole("textbox", { name: "SteamID 或个人资料链接" }),
      "76561198000000001",
    );
    await user.click(screen.getByRole("button", { name: "读取公开数据" }));
    await screen.findByRole("heading", {
      level: 3,
      name: "夜航员_01，星系数据就绪",
    });

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await user.click(screen.getByRole("button", { name: "打开游戏星系" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "浏览器没有允许保存这次星系快照",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("offers Steam OpenID and explains a cancelled login", () => {
    render(<SteamReportConsole authStatus="cancelled" />);

    expect(
      screen
        .getByRole("link", { name: "使用 Steam 登录" })
        .getAttribute("href"),
    ).toBe("/api/auth/steam/start");
    expect(screen.getByRole("status").textContent).toContain(
      "已取消 Steam 登录",
    );
  });

  it("opens the author's fixed Steam galaxy without requiring a visitor login", async () => {
    const user = userEvent.setup();
    render(<SteamReportConsole />);

    await user.click(
      screen.getByRole("button", { name: "查看作者的 Steam 星系" }),
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/report"));
    expect(loadReportSession(window.sessionStorage)).toEqual(report);
    expect(fetch).toHaveBeenCalledWith(
      "/api/steam/report",
      expect.objectContaining({
        body: JSON.stringify({ steamIdInput: "76561198209530389" }),
        method: "POST",
      }),
    );
  });

  it("consumes a verified Steam login through the existing report flow", async () => {
    render(<SteamReportConsole authStatus="success" />);

    await screen.findByRole("heading", {
      level: 3,
      name: "夜航员_01，星系数据就绪",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/steam/consume",
      expect.objectContaining({ method: "POST" }),
    );
    expect(replaceMock).toHaveBeenCalledWith("/", { scroll: false });
  });

  it.each([
    ["INVALID_STEAM_ID", "没有找到这个 Steam 身份", "修改后重试"],
    ["GAME_DETAILS_PRIVATE", "游戏详情还没有公开", "已公开，重新读取"],
    ["STEAM_TIMEOUT", "Steam 这次没有完整回应", "重新连接 Steam"],
  ] as const)(
    "keeps %s actionable without losing the submitted identity",
    async (code, title, retryLabel) => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code,
                  message: "fixture error",
                  retryable: code !== "INVALID_STEAM_ID",
                },
              }),
              { headers: { "Content-Type": "application/json" }, status: 400 },
            ),
          ),
        ),
      );
      render(<SteamReportConsole />);

      await user.type(
        screen.getByRole("textbox", { name: "SteamID 或个人资料链接" }),
        "76561198000000001",
      );
      await user.click(screen.getByRole("button", { name: "读取公开数据" }));

      expect(
        await screen.findByRole("heading", { level: 3, name: title }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: retryLabel })).toBeTruthy();
    },
  );

  it("explains a genuinely empty public library without presenting a retry", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: "EMPTY_LIBRARY",
                message: "empty fixture",
                retryable: false,
              },
            }),
            { headers: { "Content-Type": "application/json" }, status: 422 },
          ),
        ),
      ),
    );
    render(<SteamReportConsole />);

    await user.type(
      screen.getByRole("textbox", { name: "SteamID 或个人资料链接" }),
      "76561198000000001",
    );
    await user.click(screen.getByRole("button", { name: "读取公开数据" }));

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "这片宇宙还没有可读取的游戏",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "重新连接 Steam" })).toBeNull();
    expect(screen.getByRole("button", { name: "换一个 SteamID" })).toBeTruthy();
  });
});
