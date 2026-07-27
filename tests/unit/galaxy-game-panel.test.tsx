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
  it("renders the selected game's data panel, cover, Steam link and cached store signals", () => {
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
          name: "Archive Runner 的 Steam 封面",
        }) as HTMLImageElement
      ).src,
    ).toBe("https://cdn.example.com/archive-runner.jpg");
    expect(screen.getByText("150 小时")).toBeTruthy();
    expect(screen.getByText("Action / Adventure")).toBeTruthy();
    expect(screen.getByText("单人 / 多人")).toBeTruthy();
    expect(screen.getByText("Orbit Works")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Steam 商店" }).getAttribute("href"),
    ).toBe("https://store.steampowered.com/app/424242/");

    fireEvent.click(screen.getByRole("button", { name: "关闭星体档案" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("retries unavailable Store metadata and uses a fallback after the cover fails", () => {
    const onLoadMetadata = vi.fn();

    render(
      <GalaxyGamePanel
        body={body}
        metadata={undefined}
        metadataStatus="unavailable"
        onLoadMetadata={onLoadMetadata}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(/Steam 商店暂时没有返回可用详情/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试读取" }));
    expect(onLoadMetadata).toHaveBeenCalledOnce();

    const cover = screen.getByRole("img", {
      name: "Archive Runner 的 Steam 封面",
    }) as HTMLImageElement;
    fireEvent.error(cover);
    expect(
      screen.getByRole("img", {
        name: "Archive Runner 的 Steam 封面不可用",
      }),
    ).toBeTruthy();
  });
});
