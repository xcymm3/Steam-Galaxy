import { SteamGatewayError } from "./errors";

const steamId64Pattern = /^\d{17}$/u;
const vanityPattern = /^[A-Za-z0-9_-]{1,64}$/u;
const supportedHosts = new Set([
  "steamcommunity.com",
  "www.steamcommunity.com",
]);

export type ParsedSteamIdentity =
  { kind: "steam-id-64"; value: string } | { kind: "vanity"; value: string };

function invalidSteamIdentity(cause?: unknown): never {
  throw new SteamGatewayError("INVALID_STEAM_ID", { cause });
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    return invalidSteamIdentity(error);
  }
}

function parseSteamCommunityUrl(input: string): ParsedSteamIdentity {
  let url: URL;

  try {
    url = new URL(input);
  } catch (error) {
    return invalidSteamIdentity(error);
  }

  if (
    url.protocol !== "https:" ||
    !supportedHosts.has(url.hostname.toLowerCase()) ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return invalidSteamIdentity();
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return invalidSteamIdentity();
  }

  const [namespace, encodedIdentifier] = segments;
  if (!namespace || !encodedIdentifier) {
    return invalidSteamIdentity();
  }

  const identifier = decodePathSegment(encodedIdentifier);

  if (
    namespace.toLowerCase() === "profiles" &&
    steamId64Pattern.test(identifier)
  ) {
    return { kind: "steam-id-64", value: identifier };
  }

  if (namespace.toLowerCase() === "id" && vanityPattern.test(identifier)) {
    return { kind: "vanity", value: identifier };
  }

  return invalidSteamIdentity();
}

export function parseSteamIdentityInput(input: string): ParsedSteamIdentity {
  const normalized = input.trim();

  if (normalized.length === 0 || normalized.length > 256) {
    return invalidSteamIdentity();
  }

  if (steamId64Pattern.test(normalized)) {
    return { kind: "steam-id-64", value: normalized };
  }

  const isProtocolUrl = /^[A-Za-z][A-Za-z\d+.-]*:\/\//u.test(normalized);
  const isSteamCommunityPath = /^(?:www\.)?steamcommunity\.com\//iu.test(
    normalized,
  );

  if (isProtocolUrl || isSteamCommunityPath) {
    const urlInput = isSteamCommunityPath
      ? `https://${normalized}`
      : normalized;
    return parseSteamCommunityUrl(urlInput);
  }

  if (vanityPattern.test(normalized)) {
    return { kind: "vanity", value: normalized };
  }

  return invalidSteamIdentity();
}

export async function resolveSteamId(
  input: string,
  resolveVanity: (vanity: string) => Promise<string>,
): Promise<string> {
  const identity = parseSteamIdentityInput(input);

  if (identity.kind === "steam-id-64") {
    return identity.value;
  }

  const steamId = await resolveVanity(identity.value);
  if (!steamId64Pattern.test(steamId)) {
    return invalidSteamIdentity();
  }

  return steamId;
}
