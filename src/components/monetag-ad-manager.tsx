
import { useEffect, useRef, useState } from "react";
import { WifiOff, RotateCw, X } from "lucide-react";
import {
  AD_FAIL_MESSAGES,
  onMonetagStatusChange,
  retryMonetagSdk,
  startMonetagAutoAds,
  type AdFailReason,
} from "@/lib/monetag";
import { useApp } from "@/lib/store";

/**
 * Global Monetag warm-up + ad-health banner, mounted once in the root layout.
 * - Warms up the SDK shortly after boot so "Start Task" and other gated
 *   actions open instantly (the app only ever shows rewarded interstitials).
 * - Shows a dismissible "Ads unavailable" banner when the ad network can't
 *   load (blocked / unreachable), so users see WHY no ads are showing —
 *   with a Retry button that re-injects the SDK.
 * Renders nothing when the ad network is fine.
 */
export default function MonetagAdManager() {
  const [blocked, setBlocked] = useState<AdFailReason | null>(null);
  const dismissed = useRef(false);
  // Premium is ad-free: never warm up or auto-run ads for a paying member.
  const isPremium = useApp((s) => s.isPremium);

  useEffect(() => {
    if (isPremium) return;
    startMonetagAutoAds();
    const unsubscribe = onMonetagStatusChange((status, reason) => {
      if (status === "ready" || status === "loading" || status === "idle") {
        dismissed.current = false;
        setBlocked(null);
      } else if (status === "blocked" && reason && !dismissed.current) {
        setBlocked(reason);
      }
    });
    return unsubscribe;
  }, [isPremium]);

  if (isPremium || !blocked) return null;
  const msg = AD_FAIL_MESSAGES[blocked];
  if (!msg) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-lg">
      <div className="glass-strong rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-transparent px-4 py-3 flex items-center gap-3 shadow-card">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-300">
          <WifiOff className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{msg.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{msg.description}</div>
        </div>
        <button
          onClick={() => retryMonetagSdk()}
          title="Retry loading the ad network"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-amber-200 hover:bg-white/10 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Retry
        </button>
        <button
          onClick={() => {
            dismissed.current = true;
            setBlocked(null);
          }}
          title="Dismiss"
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
