"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Loader2, CheckCircle2 } from "lucide-react";
import { useApp } from "@/lib/store";

/** localStorage key — once dismissed (skipped), the gate never shows again on
 *  this device. The code can still be entered later from the Profile card. */
export const REF_GATE_DISMISS_KEY = "pp-ref-gate-dismissed";

/**
 * One-time first-open prompt: friend2 enters friend1's referral code. Showed by
 * StoreHydrate after hydration only when no code has been entered yet (and the
 * user didn't skip before). Skipping is fine — the Profile page has the same
 * box, and a code can be added there anytime before one is locked in.
 */
export default function ReferralGate({
  open,
  initialCode = "",
  onClose,
}: {
  open: boolean;
  initialCode?: string;
  onClose: () => void;
}) {
  const enterReferralCode = useApp((s) => s.enterReferralCode);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(initialCode);
      setError(null);
      setDone(false);
    }
  }, [open, initialCode]);

  const dismiss = () => {
    try {
      localStorage.setItem(REF_GATE_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    onClose();
  };

  const submit = async () => {
    if (busy) return;
    const c = code.trim();
    if (!c) {
      setError("Enter the referral code you were given.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await enterReferralCode(c);
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.error || "That code isn't valid — check with your friend.");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong rounded-3xl w-full max-w-md p-6 border border-white/10 shadow-card relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
                <Gift className="w-7 h-7 text-amber-300" />
              </div>
              <h2 className="mt-4 font-extrabold text-xl">
                {initialCode ? "You were invited! 🎉" : "Join with a referral code"}
              </h2>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
                {initialCode
                  ? "A friend shared their invite code with you. Enter it once — it's locked forever after that."
                  : "Have a referral code from a friend? Enter it now (one time only). If you skip, you can add it later from your Profile."}
              </p>
            </div>

            {done ? (
              <div className="relative mt-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                </div>
                <div className="mt-3 font-extrabold text-emerald-300">Referral code accepted</div>
                <p className="mt-1 text-xs text-gray-400">
                  Your inviter earned <span className="text-amber-300 font-semibold">+$0.49</span> for inviting you.
                </p>
                <button onClick={onClose} className="btn-primary w-full mt-5">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="relative mt-5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">
                    Referral code
                  </div>
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="e.g. CA7X or @username"
                    autoFocus
                    autoComplete="off"
                    className="w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-mono placeholder:text-gray-500 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
                  />
                </div>

                {error && (
                  <div className="relative mt-3 rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200">
                    {error}
                  </div>
                )}

                <div className="relative mt-6 flex items-center gap-3">
                  <button onClick={dismiss} className="btn-ghost flex-1">
                    Skip
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    {busy ? "Saving…" : "Use this code"}
                  </button>
                </div>
                <p className="relative mt-3 text-center text-[10px] text-gray-500">
                  Your inviter earns <span className="text-amber-300 font-semibold">+$0.49</span> when your code is
                  linked · codes can never be changed once entered.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
