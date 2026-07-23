export const steamErrorCodes = [
  "INVALID_STEAM_ID",
  "PROFILE_UNAVAILABLE",
  "GAME_DETAILS_PRIVATE",
  "EMPTY_LIBRARY",
  "STEAM_TIMEOUT",
  "STEAM_RATE_LIMITED",
  "STEAM_UNAUTHORIZED",
  "STEAM_BAD_RESPONSE",
  "CONFIGURATION_ERROR",
  "OPENID_STATE_INVALID",
  "OPENID_VERIFICATION_FAILED",
  "OPENID_TIMEOUT",
  "UNKNOWN_UPSTREAM_ERROR",
] as const;

export type SteamErrorCode = (typeof steamErrorCodes)[number];

interface SteamGatewayErrorOptions {
  cause?: unknown;
  retryable?: boolean;
}

const steamErrorMessages: Record<SteamErrorCode, string> = {
  INVALID_STEAM_ID:
    "没有找到这个 Steam 用户。请检查 SteamID 或个人资料链接后重试。",
  PROFILE_UNAVAILABLE: "Steam 暂时没有返回这位玩家的资料。请稍后重试。",
  GAME_DETAILS_PRIVATE:
    "这位玩家的“游戏详情”没有公开。请在 Steam 隐私设置中将游戏详情设为公开后重试。",
  EMPTY_LIBRARY: "这个公开库存里还没有可用于生成报告的游戏。",
  STEAM_TIMEOUT: "Steam 响应超时了。请稍后重试。",
  STEAM_RATE_LIMITED: "Steam 暂时拒绝了太多请求。请稍后再试。",
  STEAM_UNAUTHORIZED: "Steam API Key 无法完成这次请求。请检查服务端配置。",
  STEAM_BAD_RESPONSE: "Steam 返回了无法识别的数据。请稍后重试。",
  CONFIGURATION_ERROR: "服务端还没有配置 Steam Web API Key。",
  OPENID_STATE_INVALID: "Steam 登录状态已过期或不匹配。请重新发起登录。",
  OPENID_VERIFICATION_FAILED: "Steam 没有确认这次登录。请重新发起登录。",
  OPENID_TIMEOUT: "Steam 登录验证超时了。请稍后重新发起登录。",
  UNKNOWN_UPSTREAM_ERROR: "Steam 暂时没有完成这次请求。请稍后重试。",
};

const retryableByDefault: Record<SteamErrorCode, boolean> = {
  INVALID_STEAM_ID: false,
  PROFILE_UNAVAILABLE: true,
  GAME_DETAILS_PRIVATE: false,
  EMPTY_LIBRARY: false,
  STEAM_TIMEOUT: true,
  STEAM_RATE_LIMITED: true,
  STEAM_UNAUTHORIZED: false,
  STEAM_BAD_RESPONSE: true,
  CONFIGURATION_ERROR: false,
  OPENID_STATE_INVALID: false,
  OPENID_VERIFICATION_FAILED: true,
  OPENID_TIMEOUT: true,
  UNKNOWN_UPSTREAM_ERROR: true,
};

export class SteamGatewayError extends Error {
  readonly code: SteamErrorCode;
  readonly retryable: boolean;

  constructor(code: SteamErrorCode, options: SteamGatewayErrorOptions = {}) {
    super(steamErrorMessages[code], { cause: options.cause });
    this.name = "SteamGatewayError";
    this.code = code;
    this.retryable = options.retryable ?? retryableByDefault[code];
  }
}

export function toSteamGatewayError(error: unknown): SteamGatewayError {
  if (error instanceof SteamGatewayError) {
    return error;
  }

  return new SteamGatewayError("UNKNOWN_UPSTREAM_ERROR", { cause: error });
}

const steamErrorHttpStatuses: Record<SteamErrorCode, number> = {
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

export function getSteamErrorHttpStatus(code: SteamErrorCode): number {
  return steamErrorHttpStatuses[code];
}
