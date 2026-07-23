import { describe, expect, it } from "vitest";

import { getReportErrorPresentation } from "@/components/landing/report-state";
import {
  getSteamErrorHttpStatus,
  SteamGatewayError,
  type SteamErrorCode,
} from "@/lib/steam/errors";

const expectedHttpStatuses: Record<SteamErrorCode, number> = {
  INVALID_STEAM_ID: 400,
  PROFILE_UNAVAILABLE: 502,
  GAME_DETAILS_PRIVATE: 403,
  EMPTY_LIBRARY: 422,
  STEAM_TIMEOUT: 504,
  STEAM_RATE_LIMITED: 429,
  STEAM_UNAUTHORIZED: 502,
  STEAM_BAD_RESPONSE: 502,
  CONFIGURATION_ERROR: 503,
  OPENID_STATE_INVALID: 400,
  OPENID_VERIFICATION_FAILED: 401,
  OPENID_TIMEOUT: 504,
  UNKNOWN_UPSTREAM_ERROR: 502,
};

describe("Steam error presentation", () => {
  it.each(Object.entries(expectedHttpStatuses) as [SteamErrorCode, number][])(
    "maps %s to HTTP %i",
    (code, status) => {
      expect(getSteamErrorHttpStatus(code)).toBe(status);
    },
  );

  it.each([
    ["INVALID_STEAM_ID", "invalid", "修改后重试"],
    ["GAME_DETAILS_PRIVATE", "private", "已公开，重新读取"],
    ["EMPTY_LIBRARY", "empty", null],
    ["CONFIGURATION_ERROR", "configuration", null],
    ["STEAM_TIMEOUT", "upstream", "重新连接 Steam"],
    ["OPENID_STATE_INVALID", "invalid", null],
    ["OPENID_TIMEOUT", "upstream", null],
  ] as const)(
    "gives %s a distinct actionable state",
    (code, kind, retryLabel) => {
      const error = new SteamGatewayError(code);
      const presentation = getReportErrorPresentation({
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      });

      expect(presentation).toMatchObject({ kind, retryLabel });
      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.guidance.length).toBeGreaterThan(0);
    },
  );

  it("includes the exact Steam privacy path in the private-library guidance", () => {
    const error = new SteamGatewayError("GAME_DETAILS_PRIVATE");
    const presentation = getReportErrorPresentation({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });

    expect(presentation.guidance).toContain("编辑个人资料 → 隐私设置");
    expect(presentation.guidance).toContain("游戏详情");
  });
});
