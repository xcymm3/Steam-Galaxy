import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import {
  createPosterHomeUrl,
  createPosterModel,
  getSteamGameIconUrl,
  loadPosterAssets,
  POSTER_HEIGHT,
  POSTER_WIDTH,
} from "@/lib/report/poster";

import { ordinaryPlayerFixture } from "../fixtures/report";

const report = analyzeSteamSnapshot(ordinaryPlayerFixture);

describe("poster model", () => {
  it("uses a fixed 1080 by 1440 canvas and a homepage-only QR target", () => {
    const model = createPosterModel(
      report,
      "https://report.example/somewhere?steamId=76561198000000001",
    );

    expect(model.width).toBe(POSTER_WIDTH);
    expect(model.height).toBe(POSTER_HEIGHT);
    expect(model.homeUrl).toBe("https://report.example/");
    expect(model.homeUrl).not.toContain(report.player.steamId);
    expect(model.topGames).toHaveLength(3);
    expect(model.starNodes.length).toBeGreaterThan(0);
  });

  it("constructs a Steam icon URL only when an icon hash exists", () => {
    expect(getSteamGameIconUrl(report.topGames[0]!)).toContain(
      `/apps/${report.topGames[0]!.appId}/`,
    );
    expect(
      getSteamGameIconUrl({ ...report.topGames[0]!, iconHash: null }),
    ).toBeNull();
  });

  it("loads available avatar and game icons while preserving a usable fallback", async () => {
    const model = createPosterModel(report, "https://report.example/");
    const loadedUrl = model.topGames[0]!.iconUrl;
    const assets = await loadPosterAssets(model, async (url) => {
      if (url === loadedUrl) {
        return { url };
      }

      throw new Error("image unavailable");
    });

    expect(assets.avatar).toBeNull();
    expect(assets.topGameIcons.get(model.topGames[0]!.appId)).toEqual({
      url: loadedUrl,
    });
    expect(assets.failedAssetCount).toBe(3);
  });

  it("always removes paths, search parameters and fragments from the homepage QR", () => {
    expect(
      createPosterHomeUrl("https://report.example/report?fixture=yes#share"),
    ).toBe("https://report.example/");
  });
});
