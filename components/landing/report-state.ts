import type { SteamLookupErrorPayload } from "@/lib/steam/types";

export type ReportErrorKind =
  "configuration" | "empty" | "invalid" | "private" | "upstream";

export interface ReportErrorPresentation {
  kind: ReportErrorKind;
  eyebrow: string;
  title: string;
  detail: string;
  guidance: string;
  retryLabel: string | null;
}

export function getReportErrorPresentation(
  error: SteamLookupErrorPayload,
): ReportErrorPresentation {
  switch (error.code) {
    case "INVALID_STEAM_ID":
      return {
        kind: "invalid",
        eyebrow: "INPUT / CHECK",
        title: "没有找到这个 Steam 身份",
        detail: error.message,
        guidance:
          "可以输入 17 位 SteamID64、自定义 ID，或完整的 steamcommunity.com 个人资料链接。",
        retryLabel: "修改后重试",
      };
    case "GAME_DETAILS_PRIVATE":
      return {
        kind: "private",
        eyebrow: "PRIVACY / CLOSED",
        title: "游戏详情还没有公开",
        detail: error.message,
        guidance:
          "在 Steam 的“编辑个人资料 → 隐私设置”中，将“游戏详情”设为公开。保存后回到这里重试即可。",
        retryLabel: "已公开，重新读取",
      };
    case "EMPTY_LIBRARY":
      return {
        kind: "empty",
        eyebrow: "LIBRARY / EMPTY",
        title: "这片宇宙还没有可读取的游戏",
        detail: error.message,
        guidance:
          "这是公开的空库存，不是隐私错误。当前没有足够数据生成报告，可以换一个 SteamID 验证链路。",
        retryLabel: null,
      };
    case "CONFIGURATION_ERROR":
    case "STEAM_UNAUTHORIZED":
      return {
        kind: "configuration",
        eyebrow: "SERVER / CONFIG",
        title: "服务端还没有接通 Steam",
        detail: error.message,
        guidance:
          "开发环境需要设置 STEAM_WEB_API_KEY；密钥只保留在服务端，不能使用 NEXT_PUBLIC_ 前缀。",
        retryLabel: null,
      };
    case "OPENID_STATE_INVALID":
      return {
        kind: "invalid",
        eyebrow: "LOGIN / EXPIRED",
        title: "Steam 登录状态已失效",
        detail: error.message,
        guidance:
          "请重新点击“使用 Steam 登录”，完成验证后会继续读取公开游戏详情。",
        retryLabel: null,
      };
    case "OPENID_VERIFICATION_FAILED":
    case "OPENID_TIMEOUT":
      return {
        kind: "upstream",
        eyebrow: "LOGIN / RETRY",
        title: "Steam 登录没有完成",
        detail: error.message,
        guidance: "可以重新发起 Steam 登录，或继续手动输入 SteamID。",
        retryLabel: null,
      };
    case "PROFILE_UNAVAILABLE":
    case "STEAM_BAD_RESPONSE":
    case "STEAM_RATE_LIMITED":
    case "STEAM_TIMEOUT":
    case "UNKNOWN_UPSTREAM_ERROR":
      return {
        kind: "upstream",
        eyebrow: "STEAM / RETRY",
        title: "Steam 这次没有完整回应",
        detail: error.message,
        guidance: error.retryable
          ? "你的输入已经保留，可以稍后直接重试。"
          : "请检查服务端配置后再试。",
        retryLabel: error.retryable ? "重新连接 Steam" : null,
      };
  }
}
