"use client";

"use client";

/**
 * Monetag Telegram Mini App SDK (docs.monetag.com).
 *
 * Zone: 11537060 · SDK global: show_11537060
 *
 * SIMPLE + OFFICIAL PATTERN (this is the fix):
 *   show_11537060().then(() => { /* reward the user *\/ })
 *
 * The previous implementation wrapped every call in a preload cycle, a global
 * "ad lock", passive page-open attempts and 12s/45s timeout races. Those
 * raced each other and made rewarded interstitials fail to load ("Ad timed
 * out" / nothing happens). All of that is gone: the SDK script is injected
 * once, and a rewarded interstitial is a single direct call awaited to
 * completion — exactly as Monetag documents it.
 *
 * The public API is unchanged, so no other file needs to be touched.
 */

import { useApp } from "@/lib/store";

const MONETAG_ZONE = "11537060";
const MONETAG_SDK = "show_11537060";
const MONETAG_SDK_SRC = "https://libtl.com/sdk.js";

type MonetagOptions = {
  ymid?: string;
  requestVar?: string;
  /** Background attempt without a user gesture (page opens): never toasts. */
  passive?: boolean;
};

declare global {
  interface Window {
    show_11537060?: (opts?: MonetagOptions) => Promise<unknown>;
  }
}

/* ------------------------------------------------------------------ */
/*  Ad health — why an ad didn't play, surfaced to the user            */
/* ------------------------------------------------------------------ */

export type AdFailReason =
  | "sdk-blocked" // SDK script failed to load (network / ad blocker)
  | "sdk-timeout" // SDK script loaded but never became usable
  | "not-ready" // SDK global missing at the moment of the attempt
  | "no-fill" // SDK responded but had no ad available (rejected)
  | "timeout" // reserved (no artificial timeout is applied anymore)
  | "error" // unexpected exception while showing the ad
  | "locked" // another ad is still playing — silent, by design
  | "cooldown"; // rate-limited skip — silent, by design

export type MonetagSdkStatus = "idle" | "loading" | "ready" | "blocked";

const PERSISTENT_FAILURES: AdFailReason[] = ["sdk-blocked", "sdk-timeout", "not-ready"];

export const AD_FAIL_MESSAGES: Record<
  Exclude<AdFailReason, "locked" | "cooldown">,
  { title: string; description: string }
> = {
  "sdk-blocked": {
    title: "Ads can't load",
    description: "The ad network is blocked or unreachable — check your connection or turn off your ad blocker.",
  },
  "sdk-timeout": {
    title: "Ads aren't ready",
    description: "The ad network took too long to respond — try again in a moment.",
  },
  "not-ready": {
    title: "Ads aren't ready",
    description: "The ad network hasn't finished loading — try again in a second.",
  },
  "no-fill": {
    title: "No ads right now",
    description: "There are no ads available at the moment — try again in a few minutes.",
  },
  timeout: {
    title: "Ad timed out",
    description: "The ad took too long to load — try again.",
  },
  error: {
    title: "Ad failed",
    description: "Something went wrong while loading the ad — try again.",
  },
};

let sdkStatus: MonetagSdkStatus = "idle";
let sdkFailReason: AdFailReason | null = null;
type StatusListener = (status: MonetagSdkStatus, reason: AdFailReason | null) => void;
const statusListeners = new Set<StatusListener>();

const lastToastAt: Partial<Record<AdFailReason, number>> = {};
const TOAST_DEDUP_MS = 20_000;

function setStatus(status: MonetagSdkStatus, reason: AdFailReason | null = null) {
  sdkStatus = status;
  if (status === "ready") sdkFailReason = null;
  else if (status === "blocked" && reason) sdkFailReason = reason;
  statusListeners.forEach((cb) => cb(sdkStatus, sdkFailReason));
}

export function getMonetagStatus(): { status: MonetagSdkStatus; reason: AdFailReason | null } {
  return { status: sdkStatus, reason: sdkFailReason };
}

export function onMonetagStatusChange(cb: StatusListener): () => void {
  statusListeners.add(cb);
  cb(sdkStatus, sdkFailReason);
  return () => {
    statusListeners.delete(cb);
  };
}

function notifyAdFailure(reason: AdFailReason) {
  if (reason === "locked" || reason === "cooldown") return;
  if (PERSISTENT_FAILURES.includes(reason)) setStatus("blocked", reason);
  const now = Date.now();
  if (now - (lastToastAt[reason] ?? 0) < TOAST_DEDUP_MS) return;
  lastToastAt[reason] = now;
  const msg = AD_FAIL_MESSAGES[reason];
  try {
    useApp.getState().addToast({
      type: reason === "no-fill" ? "info" : "warning",
      title: msg.title,
      description: msg.description,
    });
  } catch {
    /* store not mounted (SSR / tests) — degrade silently */
  }
}

/* ------------------------------------------------------------------ */
/*  SDK loading                                                        */
/* ------------------------------------------------------------------ */

let sdkPromise: Promise<void> | null = null;
let adInFlight = false;

/** Best-effort stable user id for rewarded postbacks (ymid). */
function currentYmid(): string | undefined {
  try {
    const w = window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } };
    };
    const uid = w.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (uid) return String(uid);
  } catch {
    /* noop */
  }
  return undefined;
}

/**
 * Injects the Monetag SDK script exactly once and resolves once it is usable.
 * Never rejects — a blocked SDK degrades to "no ad" and records the reason.
 */
export function loadMonetagSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    if (typeof window[MONETAG_SDK] === "function") {
      setStatus("ready");
      resolve();
      return;
    }
    setStatus("loading");
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof window[MONETAG_SDK] === "function") setStatus("ready");
      resolve();
    };
    // The SDK defines the global a tick after the script executes — poll
    // briefly so "ready" isn't reported before show_11537060 exists.
    const waitForGlobal = (tries = 20) => {
      if (typeof window[MONETAG_SDK] === "function" || tries <= 0) return finish();
      setTimeout(() => waitForGlobal(tries - 1), 100);
    };

    let el = document.querySelector<HTMLScriptElement>(`script[data-sdk="${MONETAG_SDK}"]`);
    if (el) {
      el.addEventListener("load", () => waitForGlobal());
      el.addEventListener("error", () => {
        setStatus("blocked", "sdk-blocked");
        finish();
      });
      waitForGlobal();
    } else {
      el = document.createElement("script");
      el.src = MONETAG_SDK_SRC;
      el.setAttribute("data-zone", MONETAG_ZONE);
      el.setAttribute("data-sdk", MONETAG_SDK);
      el.async = true;
      el.onload = () => waitForGlobal();
      el.onerror = () => {
        setStatus("blocked", "sdk-blocked");
        finish();
      };
      document.head.appendChild(el);
    }

    // Hard cap on SDK *script* loading only (never on ad playback).
    setTimeout(() => {
      if (typeof window[MONETAG_SDK] !== "function") setStatus("blocked", "sdk-timeout");
      finish();
    }, 15_000);
  });
  return sdkPromise;
}

/** Re-injects the SDK script (banner "Retry" button). */
export function retryMonetagSdk(): void {
  if (typeof window === "undefined") return;
  sdkPromise = null;
  autoStarted = false;
  setStatus("loading", null);
  document.querySelectorAll(`script[data-sdk="${MONETAG_SDK}"]`).forEach((s) => s.remove());
  try {
    delete (window as unknown as Record<string, unknown>)[MONETAG_SDK];
  } catch {
    /* noop */
  }
  startMonetagAutoAds();
}

/* ------------------------------------------------------------------ */
/*  Showing a rewarded interstitial                                    */
/* ------------------------------------------------------------------ */

/**
 * CENTRAL rewarded-interstitial entry point. Every eligible click / action in
 * the app routes through here. Resolves true only when the SDK confirms the
 * user watched the ad to completion; a failed or skipped ad resolves false —
 * it NEVER rejects, so the requested action always continues.
 *
 * No preload, no lock races, no artificial playback timeout: one direct
 * `show_11537060({...})` call, awaited to completion.
 */
export async function showRewardedAd(opts?: MonetagOptions): Promise<boolean> {
  const passive = !!opts?.passive;
  const fail = (reason: AdFailReason) => {
    if (!passive) notifyAdFailure(reason);
    return false;
  };

  if (typeof window === "undefined") return false;
  // Only guard against two ads playing at literally the same time.
  if (adInFlight) return false;

  if (typeof window[MONETAG_SDK] !== "function") {
    await loadMonetagSdk();
  }
  const play = window[MONETAG_SDK];
  if (typeof play !== "function") {
    return fail(
      sdkFailReason && PERSISTENT_FAILURES.includes(sdkFailReason) ? sdkFailReason : "not-ready"
    );
  }
  setStatus("ready");

  const sdkOpts: Record<string, unknown> = {};
  if (opts?.requestVar) sdkOpts.requestVar = opts.requestVar;
  const ymid = opts?.ymid || currentYmid();
  if (ymid) sdkOpts.ymid = ymid;

  adInFlight = true;
  try {
    await play(Object.keys(sdkOpts).length ? sdkOpts : undefined);
    console.log("Rewarded Interstitial completed.");
    return true;
  } catch (error) {
    console.log("Rewarded Interstitial failed:", error);
    return fail("no-fill");
  } finally {
    adInFlight = false;
  }
}

/** Rewarded interstitial — fullscreen ad the user watches to completion. */
export function showMonetagInterstitial(opts?: MonetagOptions): Promise<boolean> {
  return showRewardedAd({ requestVar: "rewarded_interstitial", ...opts });
}

/** Rewarded interstitial for task unlocks — same format, tagged for analytics. */
export function showMonetagRewarded(): Promise<boolean> {
  return showRewardedAd({ requestVar: "rewarded_button" });
}

/** Minimum gap between page-open interstitials. */
const PAGE_AD_MIN_GAP_MS = 30_000;
let lastPageAdAt = 0;

/**
 * Rate-limited rewarded interstitial for gated page opens. Page opens have no
 * user gesture, so they are best-effort and silent — and they never run while
 * another ad is in flight, so they can't steal a "Start Task" ad.
 */
export function showPageInterstitial(): Promise<boolean> {
  const now = Date.now();
  if (adInFlight) return Promise.resolve(false);
  if (now - lastPageAdAt < PAGE_AD_MIN_GAP_MS) return Promise.resolve(false);
  lastPageAdAt = now;
  return showMonetagInterstitial({ passive: true });
}

/** Boot: load the SDK once so the first tap shows an ad immediately. */
let autoStarted = false;
export function startMonetagAutoAds(): void {
  if (autoStarted || typeof window === "undefined") return;
  autoStarted = true;
  void loadMonetagSdk();
}
