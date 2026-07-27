// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GalaxyGamePanel } from "@/components/report/star-map";
import { createGalaxyModel } from "@/lib/report/galaxy";
import { createGalaxyScene } from "@/lib/report/galaxy-scene";

afterEach(() => {
  cleanup();
});

const model = createGalaxyModel([
  {
    appId: 424242,
    name: "Archive Runner",
    playtimeMinutes: 9_000,
    iconHash: null,
    lastPlayedAt: null,
  },
]);
const body = createGalaxyScene(model).bodies[0]!;

describe("GalaxyGamePanel", () => {
  it("renders the selected game's concise archive, cover, type and actions", () => {
    const onReset = vi.fn();

    render(
      <GalaxyGamePanel
        body={body}
        metadata={{
          appId: 424242,
          appType: "game",
          genres: ["Action", "Adventure"],
          headerImageUrl: "https://cdn.example.com/archive-runner.jpg",
          modes: ["single-player", "multiplayer"],
          developers: ["Orbit Works"],
          publishers: ["Orbit Works"],
          shortDescription: "A fast orbital archive run.",
        }}
        onReset={onReset}
      />,
    );

    expect(
      (
        screen.getByRole("img", {
          name: "Archive Runner 的 Steam 宣传图",
        }) as HTMLImageElement
      ).src,
    ).toBe("https://cdn.example.com/archive-runner.jpg");
    expect(screen.getByText("150 小时")).toBeTruthy();
    expect(screen.getByText("恒星档案")).toBeTruthy();
    expect(screen.getByText("Action / Adventure")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Steam 商店" }).getAttribute("href"),
    ).toBe("https://store.steampowered.com/app/424242/");

    fireEvent.click(screen.getByRole("button", { name: "返回全景" }));
    expect(onReset).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "关闭星体档案" }));
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it("shows a compact fallback type when Store metadata is unavailable", () => {
    render(
      <GalaxyGamePanel
        body={body}
        metadata={undefined}
        metadataStatus="unavailable"
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText("暂无类型")).toBeTruthy();
  });
});
