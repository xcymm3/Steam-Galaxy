"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  clearReportSession,
  saveReportSession,
} from "@/components/report/report-session";
import type { ReportData } from "@/lib/report/types";
import { steamErrorCodes } from "@/lib/steam/errors";
import type {
  SteamLookupErrorPayload,
  SteamLookupResponse,
} from "@/lib/steam/types";

import { getReportErrorPresentation } from "./report-state";

type ConsoleState =
  | { status: "idle" }
  | { status: "loading"; input: string }
  | { status: "success"; input: string; report: ReportData }
  | { status: "error"; input: string; error: SteamLookupErrorPayload };

const networkError: SteamLookupErrorPayload = {
  code: "UNKNOWN_UPSTREAM_ERROR",
  message: "浏览器没有收到有效的服务端响应。请检查网络或稍后重试。",
  retryable: true,
};

type SteamAuthStatus =
  "cancelled" | "configuration" | "expired" | "failed" | "success" | "timeout";

const steamAuthNotices: Partial<Record<SteamAuthStatus, string>> = {
  cancelled: "已取消 Steam 登录。你也可以继续手动输入 SteamID。",
  configuration: "Steam 登录暂未配置完成，请稍后再试或手动输入 SteamID。",
  expired: "本次 Steam 登录已过期。请重新发起登录。",
  failed: "Steam 没有确认这次登录。请重新发起登录。",
  timeout: "Steam 登录验证超时了。请稍后重新发起登录。",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSteamLookupResponse(
  value: unknown,
): value is SteamLookupResponse<ReportData> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return (
      isRecord(value.data) &&
      isRecord(value.data.player) &&
      isRecord(value.data.metrics) &&
      Array.isArray(value.data.games) &&
      Array.isArray(value.data.topGames) &&
      isRecord(value.data.gameMetadata) &&
      isRecord(value.data.galaxy) &&
      Array.isArray(value.data.galaxy.games) &&
      isRecord(value.data.title)
    );
  }

  if (!isRecord(value.error)) {
    return false;
  }

  const error = value.error;

  return (
    typeof error.code === "string" &&
    steamErrorCodes.some((code) => code === error.code) &&
    typeof error.message === "string" &&
    typeof error.retryable === "boolean"
  );
}

async function readLookupResponse(response: Response) {
  const payload: unknown = await response.json();
  if (!isSteamLookupResponse(payload)) {
    throw new Error("Unexpected Steam report response");
  }

  return payload;
}

export function SteamReportConsole({
  authStatus,
}: {
  authStatus?: SteamAuthStatus;
}) {
  const [state, setState] = useState<ConsoleState>({ status: "idle" });
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController>(null);
  const openIdAttemptedRef = useRef(false);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (state.status === "success" || state.status === "error") {
      resultRef.current?.focus();
    }
  }, [state.status]);

  async function lookUpSteamIdentity(input: string) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: "loading", input });

    try {
      const response = await fetch("/api/steam/report", {
        body: JSON.stringify({ steamIdInput: input }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const payload = await readLookupResponse(response);

      if (payload.ok) {
        setState({ status: "success", input, report: payload.data });
        return;
      }

      setState({ status: "error", input, error: payload.error });
    } catch {
      if (!controller.signal.aborted) {
        setState({ status: "error", input, error: networkError });
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  async function consumeSteamOpenIdIdentity() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: "loading", input: "Steam 登录" });

    try {
      const response = await fetch("/api/auth/steam/consume", {
        cache: "no-store",
        method: "POST",
        signal: controller.signal,
      });
      const payload = await readLookupResponse(response);

      if (payload.ok) {
        setState({
          status: "success",
          input: "Steam 登录",
          report: payload.data,
        });
        return;
      }

      setState({ status: "error", input: "", error: payload.error });
    } catch {
      if (!controller.signal.aborted) {
        setState({ status: "error", input: "", error: networkError });
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  useEffect(() => {
    if (authStatus !== "success" || openIdAttemptedRef.current) {
      return;
    }

    openIdAttemptedRef.current = true;
    router.replace("/", { scroll: false });
    void consumeSteamOpenIdIdentity();
  }, [authStatus, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = String(formData.get("steamIdInput") ?? "").trim();

    if (!input) {
      setState({
        status: "error",
        input: "",
        error: {
          code: "INVALID_STEAM_ID",
          message: "请先输入一个 SteamID 或个人资料链接。",
          retryable: false,
        },
      });
      return;
    }

    void lookUpSteamIdentity(input);
  }

  function handleRetry() {
    if (state.status === "error" && state.input) {
      void lookUpSteamIdentity(state.input);
    } else {
      inputRef.current?.focus();
    }
  }

  function handleReset() {
    requestRef.current?.abort();
    clearReportSession(window.sessionStorage);
    setState({ status: "idle" });
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  const isLoading = state.status === "loading";

  return (
    <section
      className="lookupPanel"
      aria-labelledby="lookup-title"
      data-status={state.status}
    >
      <h2 id="lookup-title">连接你的 Steam 游戏库</h2>

      <form
        className="lookupForm"
        aria-busy={isLoading}
        onSubmit={handleSubmit}
      >
        <label htmlFor="steam-id-input">SteamID 或个人资料链接</label>
        <div className="inputRow">
          <input
            ref={inputRef}
            id="steam-id-input"
            name="steamIdInput"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="go"
            maxLength={256}
            placeholder="76561198… / custom-id / steamcommunity.com/id/…"
            required
            spellCheck={false}
          />
          <button className="submitButton" type="submit" disabled={isLoading}>
            {isLoading ? "正在读取…" : "读取公开数据"}
          </button>
        </div>
      </form>

      <div className="steamLoginDivider" aria-hidden="true">
        <span />
        <b>或</b>
        <span />
      </div>
      <a className="steamLoginButton" href="/api/auth/steam/start">
        使用 Steam 登录
      </a>
      {authStatus &&
        authStatus !== "success" &&
        steamAuthNotices[authStatus] && (
          <p className="steamAuthNotice" role="status">
            {steamAuthNotices[authStatus]}
          </p>
        )}

      <div className="lookupResult" aria-live="polite">
        {state.status === "loading" && <LoadingState input={state.input} />}
        {state.status === "success" && (
          <SuccessState
            ref={resultRef}
            report={state.report}
            onReset={handleReset}
          />
        )}
        {state.status === "error" && (
          <ErrorState
            ref={resultRef}
            error={state.error}
            onReset={handleReset}
            onRetry={handleRetry}
          />
        )}
      </div>
    </section>
  );
}

function LoadingState({ input }: { input: string }) {
  return (
    <div className="loadingState" role="status">
      <span className="loadingMark" aria-hidden="true" />
      <div>
        <p>正在穿过 Steam 星门</p>
        <span>{input}</span>
      </div>
    </div>
  );
}

interface SuccessStateProps {
  ref: React.Ref<HTMLElement>;
  report: ReportData;
  onReset: () => void;
}

function SuccessState({ ref, report, onReset }: SuccessStateProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [launchError, setLaunchError] = useState("");

  function handleOpenGalaxy() {
    setLaunchError("");

    if (!saveReportSession(window.sessionStorage, report)) {
      setLaunchError("浏览器没有允许保存这次星系快照。请检查隐私设置后再试。");
      return;
    }

    startNavigation(() => router.push("/report"));
  }

  return (
    <article ref={ref} className="successState" tabIndex={-1}>
      <div className="resultHeading">
        <div>
          <p className="resultEyebrow">SNAPSHOT / READY</p>
          <h3>{report.player.displayName}，星系数据就绪</h3>
        </div>
        <span className="successBadge">Public</span>
      </div>

      <dl className="snapshotFacts">
        <div>
          <dt>SteamID64</dt>
          <dd>{report.player.steamId}</dd>
        </div>
        <div>
          <dt>有效游戏</dt>
          <dd>{report.metrics.totalGameCount}</dd>
        </div>
        <div>
          <dt>累计小时</dt>
          <dd>
            {report.metrics.totalPlaytimeHours.toLocaleString("zh-CN", {
              maximumFractionDigits: 1,
            })}
          </dd>
        </div>
      </dl>

      <div className="resultActions">
        <button
          className="storyButton"
          type="button"
          onClick={handleOpenGalaxy}
          disabled={isNavigating}
          data-state={
            isNavigating ? "loading" : launchError ? "error" : "default"
          }
          aria-busy={isNavigating}
          aria-describedby={launchError ? "galaxy-launch-error" : undefined}
        >
          {isNavigating ? "正在打开…" : "打开游戏星系"}
        </button>
        <button className="textButton" type="button" onClick={onReset}>
          验证另一个 SteamID
        </button>
      </div>
      {launchError && (
        <p id="galaxy-launch-error" className="launchError" role="alert">
          {launchError}
        </p>
      )}
    </article>
  );
}

interface ErrorStateProps {
  ref: React.Ref<HTMLElement>;
  error: SteamLookupErrorPayload;
  onReset: () => void;
  onRetry: () => void;
}

function ErrorState({ ref, error, onReset, onRetry }: ErrorStateProps) {
  const presentation = getReportErrorPresentation(error);

  return (
    <article
      ref={ref}
      className={`errorState errorState-${presentation.kind}`}
      role="alert"
      tabIndex={-1}
    >
      <p className="resultEyebrow">{presentation.eyebrow}</p>
      <h3>{presentation.title}</h3>
      <p>{presentation.detail}</p>
      <p className="errorGuidance">{presentation.guidance}</p>
      <div className="resultActions">
        {presentation.retryLabel && (
          <button className="retryButton" type="button" onClick={onRetry}>
            {presentation.retryLabel}
          </button>
        )}
        <button className="textButton" type="button" onClick={onReset}>
          换一个 SteamID
        </button>
      </div>
      <span className="errorCode">{error.code}</span>
    </article>
  );
}
