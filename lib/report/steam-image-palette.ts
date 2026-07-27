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

interface ColorBucket extends RgbColor {
  count: number;
}

const paletteCanvasWidth = 64;
const paletteCanvasHeight = 36;
const channelBucketSize = 32;
const minimumLuminance = 0.08;
const maximumLuminance = 0.94;
const minimumSaturation = 0.12;

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorDistance(left: RgbColor, right: RgbColor) {
  const red = left.red - right.red;
  const green = left.green - right.green;
  const blue = left.blue - right.blue;

  return Math.sqrt(red ** 2 + green ** 2 + blue ** 2);
}

function getLuminance({ red, green, blue }: RgbColor) {
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
}

function getSaturation({ red, green, blue }: RgbColor) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);

  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
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
  const primary = colors[0];

  if (!primary) {
    return null;
  }

  return {
    primary: toHex(primary),
    secondary: toHex(colors[1] ?? adjustColor(primary, -0.28)),
    accent: toHex(colors[2] ?? adjustColor(primary, 0.3)),
  };
}

/**
 * Builds three distinct theme colors from a down-sampled Steam header image.
 * Dark, white and low-saturation pixels are ignored first so title lettering
 * and Store page chrome do not dominate a planet's palette.
 */
export function extractSteamImagePalette(
  pixels: Uint8ClampedArray,
): SteamImagePalette | null {
  const buckets = new Map<string, ColorBucket>();

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3] ?? 0;
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const color = { red, green, blue };
    const luminance = getLuminance(color);

    if (
      alpha < 180 ||
      luminance < minimumLuminance ||
      luminance > maximumLuminance ||
      getSaturation(color) < minimumSaturation
    ) {
      continue;
    }

    const key = [red, green, blue]
      .map((channel) => Math.floor(channel / channelBucketSize))
      .join(":");
    const bucket = buckets.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      count: 0,
    };

    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .map((bucket) => {
      const color = {
        red: bucket.red / bucket.count,
        green: bucket.green / bucket.count,
        blue: bucket.blue / bucket.count,
      };

      return {
        color,
        score: bucket.count * (0.4 + getSaturation(color)),
      };
    })
    .sort((left, right) => right.score - left.score);
  const selected: RgbColor[] = [];

  ranked.forEach(({ color }) => {
    if (
      selected.length < 3 &&
      selected.every((existing) => colorDistance(existing, color) > 58)
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
