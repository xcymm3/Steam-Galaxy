import { describe, expect, it, vi } from "vitest";

import {
  parseSteamIdentityInput,
  resolveSteamId,
} from "@/lib/steam/resolve-id";

const fixtureSteamId = "76561198000000001";

describe("Steam identity resolver", () => {
  it.each([
    fixtureSteamId,
    `https://steamcommunity.com/profiles/${fixtureSteamId}/`,
    `steamcommunity.com/profiles/${fixtureSteamId}`,
  ])("extracts SteamID64 from %s", (input) => {
    expect(parseSteamIdentityInput(input)).toEqual({
      kind: "steam-id-64",
      value: fixtureSteamId,
    });
  });

  it.each(["night-pilot", "https://steamcommunity.com/id/night-pilot/"])(
    "resolves a vanity identity from %s",
    async (input) => {
      const resolveVanity = vi.fn().mockResolvedValue(fixtureSteamId);

      await expect(resolveSteamId(input, resolveVanity)).resolves.toBe(
        fixtureSteamId,
      );
      expect(resolveVanity).toHaveBeenCalledWith("night-pilot");
    },
  );

  it.each([
    "http://steamcommunity.com/id/night-pilot",
    "https://example.com/id/night-pilot",
    "https://steamcommunity.com/groups/night-pilot",
    "[U:1:39734273]",
  ])("rejects unsupported identity input %s", (input) => {
    expect(() => parseSteamIdentityInput(input)).toThrowError(
      expect.objectContaining({ code: "INVALID_STEAM_ID" }),
    );
  });
});
