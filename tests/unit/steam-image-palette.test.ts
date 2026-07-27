import { describe, expect, it } from "vitest";

import { extractSteamImagePalette } from "@/lib/report/steam-image-palette";

function createPixels(colors: Array<[number, number, number]>) {
  const pixels = new Uint8ClampedArray(colors.length * 16);

  colors.forEach(([red, green, blue], index) => {
    const offset = index * 16;
    pixels[offset] = red;
    pixels[offset + 1] = green;
    pixels[offset + 2] = blue;
    pixels[offset + 3] = 255;
  });

  return pixels;
}

describe("Steam image palette", () => {
  it("selects distinct saturated theme colors from Store art", () => {
    const palette = extractSteamImagePalette(
      createPixels([
        [211, 66, 66],
        [59, 112, 216],
        [55, 157, 114],
      ]),
    );

    expect(palette).not.toBeNull();
    expect(Object.values(palette!)).toEqual(
      expect.arrayContaining(["#d34242", "#3b70d8", "#379d72"]),
    );
  });

  it("creates tonal companions when artwork contains one dominant color", () => {
    const palette = extractSteamImagePalette(
      createPixels([
        [156, 79, 217],
        [156, 79, 217],
        [156, 79, 217],
      ]),
    );

    expect(palette?.primary).toBe("#9c4fd9");
    expect(palette?.secondary).not.toBe(palette?.primary);
    expect(palette?.accent).not.toBe(palette?.primary);
  });
});
