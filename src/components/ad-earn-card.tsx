
import { useEffect, useState } from "react";
import { Zap, Play, Loader2, WifiOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { getMonetagStatus, onMonetagStatusChange, showMonetagRewarded, type MonetagSdkStatus } from "@/lib/monetag";

/**
 * Earn-page tile: watch a rewarded interstitial → +1 page credit. The credit
 * is granted ONLY when the SDK confirms the ad completed (the Monetag
 * ".then() = reward" pattern). Every gated page open spends 1 credit.
 */
export default function AdEarnCard() {
  const pageCredits = useApp((s) => s.pageCredits);
  const isPremium = useApp((s) => s.isPremium);
  const grantPageCredits = useApp((s) => s.grantPageCredits);
  const [busy, setBusy] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<MonetagSdkStatus>("idle");

  useEffect(() => {
    // Immediately check current status, then subscribe for changes.
    const { status } = getMonetagStatus();
    setSdkStatus(status);
    const unsub = onMonetagStatusChange((status) => setSdkStatus(status));
    return unsub;
  }, []);

  async function watch() {
    if (busy) return;
    setBusy(true);
    const completed = await showMonetagRewarded();
    setBusy(false);
    if (completed) grantPageCredits(1);
  }

  const sdkReady = sdkStatus === "ready";

  // Premium users never need to watch ads for page credits.
  if (isPremium) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl glass-strong border border-amber-400/20 p-4 flex items-center gap-4 flex-wrap">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-brand-cyan/10 pointer-events-none" />
      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-glow shrink-0">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <div className="relative flex-1 min-w-[200px]">
        <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Page credits
        </div>
        <div className="font-extrabold text-2xl tabular mt-0.5 flex items-baseline gap-2">
          {pageCredits}
          <span className="text-xs font-semibold text-gray-500">left</span>
        </div>
        <div className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
          {sdkReady
            ? "Every page you open costs 1 credit. Watch a short rewarded ad to earn +1 — no limit."
            : "Your ads are not loaded yet — the ad network may be blocked or still connecting. Check your connection or disable your ad blocker."}
        </div>
      </div>
      {sdkReady ? (
        <button
          onClick={() => void watch()}
          disabled={busy}
          className="relative btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Unlocking…
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Watch ad · +1 credit
            </>
          )}
        </button>
      ) : (
        <div className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs font-semibold">
          <WifiOff className="w-4 h-4" />
          <span>Your ads are not loaded</span>
        </div>
      )}
    </div>
  );
}
