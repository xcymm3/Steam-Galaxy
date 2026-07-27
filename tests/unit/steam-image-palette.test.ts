import { describe, expect, it } from "vitest";

import { extractSteamImagePalette } from "@/lib/report/steam-image-palette";

function createPixels(
  colors: ReadonlyArray<readonly [number, number, number]>,
) {
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

function getHexChannels(value: string) {
  return {
    blue: Number.parseInt(value.slice(5, 7), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    red: Number.parseInt(value.slice(1, 3), 16),
  };
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
    expect(Object.values(palette!)).toHaveLength(3);
  });

  it("creates tonal companions when artwork contains one dominant color", () => {
    const palette = extractSteamImagePalette(
      createPixels([
        [156, 79, 217],
        [156, 79, 217],
        [156, 79, 217],
      ]),
    );

    expect(palette?.primary).toMatch(/^#[\da-f]{6}$/u);
    expect(palette?.secondary).not.toBe(palette?.primary);
    expect(palette?.accent).not.toBe(palette?.primary);
  });

  it("keeps a large dark-green scene green when it contains smaller brown highlights", () => {
    const palette = extractSteamImagePalette(
      createPixels([
        ...Array.from({ length: 12 }, () => [13, 66, 42] as const),
        ...Array.from({ length: 3 }, () => [158, 94, 47] as const),
      ]),
    );
    const primary = getHexChannels(palette!.primary);

    expect(primary.green).toBeGreaterThan(primary.red);
    expect(primary.green).toBeGreaterThan(primary.blue);
  });
});
