export interface SteamImagePalette {
  accent: string;
  primary: string;
  secondary: string;
}

interface RgbColor {
  blue: number;
  green: number;
  red: number;
}

interface HueBucket extends RgbColor {
  weight: number;
}

const paletteCanvasWidth = 64;
const paletteCanvasHeight = 36;
const hueBucketCount = 24;
const minimumLightness = 0.015;
const maximumLightness = 0.98;
const minimumSaturation = 0.16;

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHsl({ red, green, blue }: RgbColor) {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const maximum = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const minimum = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;

  if (delta === 0) {
    return { hue: 0, lightness, saturation: 0 };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hueOffset =
    maximum === normalizedRed
      ? (normalizedGreen - normalizedBlue) / delta
      : maximum === normalizedGreen
        ? (normalizedBlue - normalizedRed) / delta + 2
        : (normalizedRed - normalizedGreen) / delta + 4;

  return {
    hue: ((hueOffset * 60 + 360) % 360) / 360,
    lightness,
    saturation,
  };
}

function fromHsl(hue: number, saturation: number, lightness: number): RgbColor {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSegment = hue * 6;
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] =
    hueSegment < 1
      ? [chroma, secondary, 0]
      : hueSegment < 2
        ? [secondary, chroma, 0]
        : hueSegment < 3
          ? [0, chroma, secondary]
          : hueSegment < 4
            ? [0, secondary, chroma]
            : hueSegment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  return {
    red: (red + match) * 255,
    green: (green + match) * 255,
    blue: (blue + match) * 255,
  };
}

function hueDistance(left: number, right: number) {
  const difference = Math.abs(left - right);

  return Math.min(difference, 1 - difference);
}

function brightenForPlanet(color: RgbColor) {
  const { hue, lightness, saturation } = toHsl(color);

  return fromHsl(
    hue,
    Math.max(0.48, Math.min(0.86, saturation)),
    Math.max(0.34, Math.min(0.62, lightness)),
  );
}

function toHex({ red, green, blue }: RgbColor) {
  return `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function adjustColor(color: RgbColor, amount: number): RgbColor {
  const target = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);

  return {
    red: color.red + (target - color.red) * strength,
    green: color.green + (target - color.green) * strength,
    blue: color.blue + (target - color.blue) * strength,
  };
}

function toPalette(colors: RgbColor[]): SteamImagePalette | null {
  const primary = colors[0] ? brightenForPlanet(colors[0]) : undefined;

  if (!primary) {
    return null;
  }

  return {
    primary: toHex(primary),
    secondary: toHex(
      colors[1] ? brightenForPlanet(colors[1]) : adjustColor(primary, -0.28),
    ),
    accent: toHex(
      colors[2] ? brightenForPlanet(colors[2]) : adjustColor(primary, 0.3),
    ),
  };
}

/**
 * Builds three distinct theme colors from a down-sampled Steam header image.
 * Colors are grouped by hue before their brightness is considered, allowing a
 * large dark-green scene to outweigh a small but bright brown title treatment.
 */
export function extractSteamImagePalette(
  pixels: Uint8ClampedArray,
): SteamImagePalette | null {
  const buckets = new Map<number, HueBucket>();

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3] ?? 0;
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const color = { red, green, blue };
    const { hue, lightness, saturation } = toHsl(color);

    if (
      alpha < 180 ||
      lightness < minimumLightness ||
      lightness > maximumLightness ||
      saturation < minimumSaturation
    ) {
      continue;
    }

    const key = Math.min(hueBucketCount - 1, Math.floor(hue * hueBucketCount));
    const weight = saturation * (0.35 + lightness * 0.65);
    const bucket = buckets.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      weight: 0,
    };

    bucket.red += red * weight;
    bucket.green += green * weight;
    bucket.blue += blue * weight;
    bucket.weight += weight;
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .map((bucket) => {
      const color = {
        red: bucket.red / bucket.weight,
        green: bucket.green / bucket.weight,
        blue: bucket.blue / bucket.weight,
      };

      return {
        color,
        hue: toHsl(color).hue,
        score: bucket.weight,
      };
    })
    .sort((left, right) => right.score - left.score);
  const selected: RgbColor[] = [];

  ranked.forEach(({ color, hue }) => {
    if (
      selected.length < 3 &&
      selected.every(
        (existing) =>
          hueDistance(toHsl(existing).hue, hue) > 1 / hueBucketCount,
      )
    ) {
      selected.push(color);
    }
  });

  return toPalette(selected);
}

export async function loadSteamImagePalette(imageUrl: string) {
  if (!imageUrl || typeof Image === "undefined") {
    return null;
  }

  return new Promise<SteamImagePalette | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = paletteCanvasWidth;
      canvas.height = paletteCanvasHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        resolve(null);
        return;
      }

      try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(
          extractSteamImagePalette(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
          ),
        );
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}
