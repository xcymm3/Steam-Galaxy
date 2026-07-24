// @vitest-environment jsdom

import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StorySlide } from "@/components/report/story-slides";
import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import { ordinaryPlayerFixture } from "../fixtures/report";

const report = {
  ...analyzeSteamSnapshot(ordinaryPlayerFixture),
  gameMetadata: {
    requestedGameCount: 4,
    resolvedGameCount: 4,
    games: {
      101: {
        appId: 101,
        appType: "game",
        developers: [],
        genres: ["角色扮演"],
        headerImageUrl: null,
        modes: ["single-player" as const],
        publishers: [],
        shortDescription: null,
      },
    },
    modes: [
      { label: "单人", playtimeMinutes: 9_000 },
      { label: "合作", playtimeMinutes: 240 },
    ],
    series: [{ name: "Fixture Saga", gameCount: 2, playtimeMinutes: 7_200 }],
    topGenres: [{ label: "角色扮演", playtimeMinutes: 9_000 }],
  },
};

const idlePoster = { status: "idle" as const, url: null, message: "" };

function renderSlide(pageIndex: number) {
  return render(
    <StorySlide
      headingRef={createRef<HTMLHeadingElement>()}
      onSharePoster={null}
      pageIndex={pageIndex}
      poster={idlePoster}
      report={report}
    />,
  );
}

describe("story slide metadata presentation", () => {
  it("shows the top game's genre and mode in the ten-page story", () => {
    renderSlide(3);

    expect(screen.getByText("角色扮演 · 单人")).toBeTruthy();
  });

  it("dedicates page five to gameplay signals and keeps series signals explicit", () => {
    renderSlide(4);

    expect(screen.getAllByText("角色扮演")).toHaveLength(2);
    expect(screen.getByText("单人 / 合作")).toBeTruthy();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.textContent?.replace(/\s+/gu, "") ===
          "判读范围：时长最高的4款游戏；已补全4款。",
      ),
    ).toBeTruthy();

    renderSlide(8);
    expect(screen.getByText(/系列信号：Fixture Saga 已出现/u)).toBeTruthy();
  });
});
