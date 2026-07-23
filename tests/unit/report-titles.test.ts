import { describe, expect, it } from "vitest";

import { analyzeSteamSnapshot } from "@/lib/report/analyze";

import {
  allUnplayedFixture,
  cyberSingleFixture,
  hugeInventoryFixture,
  ordinaryPlayerFixture,
  overTenThousandHoursFixture,
  thousandHourSingleFixture,
  twoHourPatrolFixture,
  wideOrbitFixture,
} from "../fixtures/report";

describe("player title rules", () => {
  it.each([
    [ordinaryPlayerFixture, "first-ignition", "宇宙刚刚点火"],
    [allUnplayedFixture, "first-ignition", "宇宙刚刚点火"],
    [wideOrbitFixture, "wide-orbit", "雨露均沾型宇航员"],
    [twoHourPatrolFixture, "two-hour-patrol", "两小时巡逻员"],
    [hugeInventoryFixture, "library-keeper", "库存守门员"],
    [cyberSingleFixture, "single-game-orbit", "赛博单推人"],
    [thousandHourSingleFixture, "thousand-hour-resident", "千小时钉子户"],
    [overTenThousandHoursFixture, "time-lost", "时间管理失踪人口"],
  ] as const)("selects a stable title for %#", (fixture, id, name) => {
    expect(analyzeSteamSnapshot(fixture).title).toMatchObject({ id, name });
  });

  it("uses the highest priority when several rules match", () => {
    const thousandHourReport = analyzeSteamSnapshot(thousandHourSingleFixture);
    const tenThousandHourReport = analyzeSteamSnapshot(
      overTenThousandHoursFixture,
    );

    expect(thousandHourReport.metrics.topOneRatio).toBe(1);
    expect(thousandHourReport.title).toMatchObject({
      id: "thousand-hour-resident",
      priority: 90,
    });
    expect(tenThousandHourReport.title).toMatchObject({
      id: "time-lost",
      priority: 100,
    });
  });

  it("builds explanations only from report data", () => {
    const thousandHourReport = analyzeSteamSnapshot(thousandHourSingleFixture);
    const keeperReport = analyzeSteamSnapshot(hugeInventoryFixture);

    expect(thousandHourReport.title.explanation).toBe(
      "光是《Endless Anchor》就留住了你 1000 小时。",
    );
    expect(keeperReport.title.explanation).toContain(
      String(keeperReport.metrics.unplayedGameCount),
    );
  });

  it("includes exact threshold values", () => {
    const exactCyberThreshold = {
      ...cyberSingleFixture,
      games: [
        { ...cyberSingleFixture.games[0]!, playtimeMinutes: 9_900 },
        { ...cyberSingleFixture.games[1]!, playtimeMinutes: 8_100 },
      ],
    };
    const report = analyzeSteamSnapshot(exactCyberThreshold);

    expect(report.metrics.totalPlaytimeHours).toBe(300);
    expect(report.metrics.topOneRatio).toBe(0.55);
    expect(report.title.id).toBe("single-game-orbit");
  });
});
