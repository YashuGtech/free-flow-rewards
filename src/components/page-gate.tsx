
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Zap, Play, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { showMonetagRewarded } from "@/lib/monetag";

/** Routes that cost 1 page credit per open. The Earn page (/) and the admin
 *  panel stay free — Earn is where users watch rewarded ads to bank credits. */
const GATED = ["/promote", "/campaigns", "/leads", "/profile", "/users"];

export default function PageGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const gated = GATED.some((p) => path === p || path.startsWith(`${p}/`));
  const pageCredits = useApp((s) => s.pageCredits);
  const isPremium = useApp((s) => s.isPremium);
  const spendPageCredit = useApp((s) => s.spendPageCredit);
  const grantPageCredits = useApp((s) => s.grantPageCredits);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastPath = useRef(path);
  const spentPath = useRef<string | null>(null);

  // Charge exactly ONE credit per navigation to a gated route. Safe under
  // StrictMode double-effects (spentPath guards) and re-visits (each new
  // navigation to the same route charges again — that's the paywall loop).
  useEffect(() => {
    if (lastPath.current !== path) {
      lastPath.current = path;
      spentPath.current = null;
      setUnlocked(false);
    }
    if (!gated || isPremium) return;
    if (spentPath.current === path) return;
    if (pageCredits > 0 && spendPageCredit()) {
      spentPath.current = path;
      setUnlocked(true);
    }
  }, [path, gated, isPremium, pageCredits, spendPageCredit]);

  async function watchAd() {
    if (busy) return;
    setBusy(true);
    const completed = await showMonetagRewarded();
    setBusy(false);
    // Only a COMPLETED ad pays out — that's the "reward function" the Monetag
    // snippet points to. A failed/skipped ad leaves the paywall up (the ad
    // lib already toasted why).
    if (completed) {
      grantPageCredits(1);
      // The effect above sees the new balance, spends 1 and unlocks.
    }
  }

  if (!gated || isPremium || unlocked) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative max-w-lg mx-auto"
    >
      <div className="relative overflow-hidden rounded-3xl glass-strong border border-white/10 p-8 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-brand-cyan/10 pointer-events-none" />
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-brand-cyan/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-glow">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Page locked</h1>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed max-w-sm">
            Opening this page costs <b className="text-amber-300">1 page credit</b>.
            You have <b className="tabular text-white">{pageCredits}</b> left — watch
            a short rewarded ad to earn <b className="text-amber-300">+1 credit</b> and
            unlock it instantly.
          </p>

          <button
            onClick={() => void watchAd()}
            disabled={busy}
            className="mt-6 w-full btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unlocking…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Watch ad · +1 page credit
              </>
            )}
          </button>

          <Link
            href="/"
            className="mt-3 text-xs font-semibold text-gray-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Earn
          </Link>

          <div className="mt-6 flex items-center gap-2 text-[11px] text-gray-500">
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            Bank credits on the Earn page — watch ads anytime, spend them to open pages.
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
