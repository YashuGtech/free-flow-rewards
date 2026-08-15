
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Crown, Loader2, CheckCircle2, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { useApp } from "@/lib/store";
import { PREMIUM_PLANS } from "@/lib/mock-data";
import { fmtUsdt } from "@/lib/format";

interface PayOrder {
  trackId: string;
  paymentUrl: string;
  payAddress?: string;
  payAmount?: number;
  payCurrency?: string;
  status?: string;
}

/** Pay for a Premium plan with NOWPayments — activates Premium once confirmed. */
export default function PremiumPayModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const plan = PREMIUM_PLANS.find((p) => p.id === planId);
  const { createDeposit, checkDeposit } = useApp();
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!plan) return;
    let active = true;
    setBusy(true);
    createDeposit(plan.price, {
      purpose: "premium",
      planId: plan.id,
      description: `PromoPulse Premium · ${plan.label}`,
    }).then((r) => {
      if (!active) return;
      setBusy(false);
      if (r.ok && r.trackId) {
        setOrder({
          trackId: r.trackId,
          paymentUrl: r.paymentUrl || "#",
          payAddress: r.payAddress,
          payAmount: r.payAmount,
          payCurrency: r.payCurrency,
          status: r.status,
        });
      } else {
        setError(r.error || "Could not create payment");
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const check = async () => {
    if (!order || done || busy) return;
    setBusy(true);
    const r = await checkDeposit(order.trackId);
    setBusy(false);
    if (r.ok && (r.status === "paid" || r.status === "manual_accept")) {
      setDone(true);
    } else if (r.ok) {
      setOrder((o) => (o ? { ...o, status: r.status } : o));
    } else {
      setError(r.error || "Check failed");
    }
  };

  useEffect(() => {
    if (!order || done) return;
    const t = setInterval(() => void check(), 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, done]);

  if (!plan) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 24, scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl w-full max-w-md p-6 border border-white/10 shadow-card relative overflow-hidden"
      >
        <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
            {done ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Crown className="w-5 h-5 text-white" />}
          </div>
          <div>
            <div className="font-extrabold text-lg leading-tight">Premium · {plan.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {done ? "Premium activated" : `Pay with NOWPayments · ${fmtUsdt(plan.price)} USDT`}
            </div>
          </div>
        </div>

        {done ? (
          <div className="relative mt-6 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-300" />
            </motion.div>
            <div className="mt-4 text-xl font-black">Premium activated ✓</div>
            <div className="mt-1 text-xs text-gray-400">
              {plan.label} · {plan.days} days · verified blue tick added
            </div>
            <button onClick={onClose} className="relative mt-6 btn-primary w-full flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Done
            </button>
          </div>
        ) : !order ? (
          <div className="relative mt-6">
            <div className="flex items-center gap-3 rounded-2xl p-4 glass border border-white/10">
              <Loader2 className="w-5 h-5 animate-spin text-violet-300" />
              <div>
                <div className="text-sm font-bold">Creating payment…</div>
                <div className="text-[11px] text-gray-400">Contacting NOWPayments for {fmtUsdt(plan.price)} USDT</div>
              </div>
            </div>
            {error && (
              <div className="relative mt-3 rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
            <button onClick={onClose} className="relative mt-3 w-full text-center text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="relative mt-5 rounded-2xl p-4 glass border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Payment</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-500/20 text-violet-300 border border-violet-400/25">
                  #{order.trackId.slice(0, 10)}
                </span>
              </div>
              <div className="mt-2 text-xl font-black tabular text-violet-300">{fmtUsdt(plan.price)} USDT</div>
              <div className="mt-2 text-[11px] text-gray-400 leading-relaxed flex items-start gap-2">
                <Crown className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                Premium activates the moment the payment confirms — verified blue tick, softer ban threshold, priority approvals.
              </div>
            </div>

            {order.paymentUrl && order.paymentUrl !== "#" && (
              <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="relative mt-4 btn-primary w-full flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> Open secure payment page
              </a>
            )}
            {order.paymentUrl && order.paymentUrl !== "#" && (
              <p className="relative mt-2 text-center text-[11px] text-gray-500 leading-relaxed">
                NOWPayments opens in a new tab (payment pages can&apos;t be embedded) — complete payment there, then press
                &quot;I&apos;ve paid — check status&quot; to confirm.
              </p>
            )}
            <button
              onClick={() => void check()}
              disabled={busy}
              className="relative mt-2 btn-ghost w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {busy ? "Checking…" : "I've paid — check status"}
            </button>
            <div className="relative mt-3 text-center text-[11px] text-gray-500">
              {order.status ? (
                <>
                  Status: <b className="text-violet-300 capitalize">{order.status}</b> · auto-refreshes
                </>
              ) : (
                "Awaiting payment…"
              )}
            </div>
            {error && (
              <div className="relative mt-3 rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
