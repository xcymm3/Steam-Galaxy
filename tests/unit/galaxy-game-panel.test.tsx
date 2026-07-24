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
  it("renders the selected game's cover, Steam link and cached store signals", () => {
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
    expect(screen.getByText("A fast orbital archive run.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Steam 商店" }).getAttribute("href"),
    ).toBe("https://store.steampowered.com/app/424242/");

    fireEvent.click(screen.getByRole("button", { name: "返回全景" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("explains when a selected game has no cached store signals yet", () => {
    render(
      <GalaxyGamePanel body={body} metadata={undefined} onReset={vi.fn()} />,
    );

    expect(screen.getByText(/暂无已缓存的 Steam 商店标签/)).toBeTruthy();
    expect(
      (
        screen.getByRole("img", {
          name: "Archive Runner 的 Steam 封面",
        }) as HTMLImageElement
      ).src,
    ).toBe(
      "https://cdn.cloudflare.steamstatic.com/steam/apps/424242/header.jpg",
    );
  });
});
