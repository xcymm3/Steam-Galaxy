import { randomBytes, timingSafeEqual } from "node:crypto";

export const steamOpenIdEndpoint = "https://steamcommunity.com/openid/login";
export const steamOpenIdNamespace = "http://specs.openid.net/auth/2.0";
export const steamOpenIdIdentifierSelect =
  "http://specs.openid.net/auth/2.0/identifier_select";
export const steamOpenIdStateCookieName = "steam-openid-state";
export const steamOpenIdSteamIdCookieName = "steam-openid-steam-id";
export const steamOpenIdStateMaxAgeSeconds = 10 * 60;
export const steamOpenIdSteamIdMaxAgeSeconds = 2 * 60;

export type SteamOpenIdErrorCode =
  "configuration" | "state" | "timeout" | "verification";

export class SteamOpenIdError extends Error {
  readonly code: SteamOpenIdErrorCode;

  constructor(code: SteamOpenIdErrorCode, options?: ErrorOptions) {
    super(`Steam OpenID ${code} error`, options);
    this.name = "SteamOpenIdError";
    this.code = code;
  }
}

export interface SteamOpenIdState {
  state: string;
  issuedAt: number;
  cookieValue: string;
}

interface VerifySteamOpenIdAssertionOptions {
  expectedReturnTo: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function isLocalHttpOrigin(url: URL) {
  return url.protocol === "http:" && url.hostname === "localhost";
}

function hasSecureOrigin(url: URL) {
  return url.protocol === "https:" || isLocalHttpOrigin(url);
}

function normalizeOrigin(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new SteamOpenIdError("configuration", { cause: error });
  }

  if (
    !hasSecureOrigin(url) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new SteamOpenIdError("configuration");
  }

  return url.origin;
}

export function getSteamOpenIdAppOrigin(requestUrl: string) {
  const configuredOrigin = process.env.APP_ORIGIN;

  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  let requestOrigin: URL;

  try {
    requestOrigin = new URL(requestUrl);
  } catch (error) {
    throw new SteamOpenIdError("configuration", { cause: error });
  }

  if (!isLocalHttpOrigin(requestOrigin)) {
    throw new SteamOpenIdError("configuration");
  }

  return requestOrigin.origin;
}

export function createSteamOpenIdState(now = Date.now()): SteamOpenIdState {
  const state = randomBytes(32).toString("base64url");

  return {
    state,
    issuedAt: now,
    cookieValue: `${state}.${now}`,
  };
}

function parseStateCookie(value: string, now: number): SteamOpenIdState {
  const [state, issuedAtText, extra] = value.split(".");
  const issuedAt = Number(issuedAtText);

  if (
    !state ||
    !/^[A-Za-z0-9_-]{43}$/u.test(state) ||
    !Number.isInteger(issuedAt) ||
    extra !== undefined ||
    issuedAt > now + 10_000 ||
    now - issuedAt > steamOpenIdStateMaxAgeSeconds * 1_000
  ) {
    throw new SteamOpenIdError("state");
  }

  return { state, issuedAt, cookieValue: value };
}

export function verifySteamOpenIdState(
  cookieValue: string | undefined,
  returnedState: string | null,
  now = Date.now(),
) {
  if (!cookieValue || !returnedState) {
    throw new SteamOpenIdError("state");
  }

  const stored = parseStateCookie(cookieValue, now);
  const storedValue = Buffer.from(stored.state);
  const returnedValue = Buffer.from(returnedState);

  if (
    storedValue.length !== returnedValue.length ||
    !timingSafeEqual(storedValue, returnedValue)
  ) {
    throw new SteamOpenIdError("state");
  }

  return stored;
}

export function createSteamOpenIdCallbackUrl(origin: string, state: string) {
  const callbackUrl = new URL("/api/auth/steam/callback", origin);
  callbackUrl.searchParams.set("state", state);
  return callbackUrl.toString();
}

export function createSteamOpenIdLoginUrl(origin: string, state: string) {
  const authorizationUrl = new URL(steamOpenIdEndpoint);
  const callbackUrl = createSteamOpenIdCallbackUrl(origin, state);

  authorizationUrl.searchParams.set("openid.ns", steamOpenIdNamespace);
  authorizationUrl.searchParams.set("openid.mode", "checkid_setup");
  authorizationUrl.searchParams.set("openid.return_to", callbackUrl);
  authorizationUrl.searchParams.set("openid.realm", origin);
  authorizationUrl.searchParams.set(
    "openid.claimed_id",
    steamOpenIdIdentifierSelect,
  );
  authorizationUrl.searchParams.set(
    "openid.identity",
    steamOpenIdIdentifierSelect,
  );

  return authorizationUrl.toString();
}

function parseSteamId(claimedId: string, identity: string) {
  if (claimedId !== identity) {
    throw new SteamOpenIdError("verification");
  }

  let url: URL;

  try {
    url = new URL(claimedId);
  } catch (error) {
    throw new SteamOpenIdError("verification", { cause: error });
  }

  const result = /^\/openid\/id\/(\d{17})$/u.exec(url.pathname);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.hostname !== "steamcommunity.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !result
  ) {
    throw new SteamOpenIdError("verification");
  }

  return result[1]!;
}

function hasRequiredSignedFields(parameters: URLSearchParams) {
  const signed = new Set((parameters.get("openid.signed") ?? "").split(","));
  return [
    "op_endpoint",
    "claimed_id",
    "identity",
    "return_to",
    "response_nonce",
  ].every((field) => signed.has(field));
}

export async function verifySteamOpenIdAssertion(
  callbackUrl: URL,
  {
    expectedReturnTo,
    fetchImpl = fetch,
    timeoutMs = 20_000,
  }: VerifySteamOpenIdAssertionOptions,
) {
  const parameters = callbackUrl.searchParams;
  const claimedId = parameters.get("openid.claimed_id");
  const identity = parameters.get("openid.identity");

  if (
    parameters.get("openid.ns") !== steamOpenIdNamespace ||
    parameters.get("openid.mode") !== "id_res" ||
    parameters.get("openid.op_endpoint") !== steamOpenIdEndpoint ||
    parameters.get("openid.return_to") !== expectedReturnTo ||
    !claimedId ||
    !identity ||
    !hasRequiredSignedFields(parameters)
  ) {
    throw new SteamOpenIdError("verification");
  }

  const steamId = parseSteamId(claimedId, identity);
  const verificationParameters = new URLSearchParams();
  parameters.forEach((value, key) => {
    if (key.startsWith("openid.")) {
      verificationParameters.append(key, value);
    }
  });
  verificationParameters.set("openid.mode", "check_authentication");

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(steamOpenIdEndpoint, {
      body: verificationParameters.toString(),
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      signal: controller.signal,
    });
    const responseText = await response.text();

    if (!response.ok || !/^is_valid:true$/mu.test(responseText)) {
      throw new SteamOpenIdError("verification");
    }

    return steamId;
  } catch (error) {
    if (timedOut) {
      throw new SteamOpenIdError("timeout", { cause: error });
    }

    if (error instanceof SteamOpenIdError) {
      throw error;
    }

    throw new SteamOpenIdError("verification", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
