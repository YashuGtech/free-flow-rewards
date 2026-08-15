
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Coins,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  TriangleAlert,
  FlaskConical,
  Wallet,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { fmtUsdt } from "@/lib/format";
import { qrSvg } from "@/lib/qrcode";
import clsx from "clsx";
import {
  DEPOSIT_ADDRESS,
  DEPOSIT_NETWORKS,
  DEPOSIT_PACKAGES,
  NOWPAY_NETWORKS,
  CUSTOM_BONUS_MIN,
  customDeposit,
  hasFirstDepositBonus,
} from "@/lib/payments";
import { isSupabaseReady } from "@/lib/supabase";

type Step = "method" | "network" | "package" | "pay" | "done";
type Method = "nowpayments" | "wallet";

interface PayOrder {
  trackId: string;
  paymentUrl: string;
  payAddress?: string;
  payAmount?: number;
  payCurrency?: string;
  status?: string;
}

const fmtCrypto = (n: number) =>
  (Math.round(n * 1_000_000) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 });

/**
 * QR for the deposit address — rendered locally as SVG (lib/qrcode). No
 * external QR API, so the code always shows even where third-party image
 * hosts are blocked. White box keeps the code scannable everywhere.
 */
function QrImage({ data }: { data: string }) {
  return (
    <div className="mt-3 flex justify-center">
      <div
        className="rounded-2xl bg-white p-2.5"
        dangerouslySetInnerHTML={{ __html: qrSvg(data) }}
      />
    </div>
  );
}

export default function DepositModal({ onClose }: { onClose: () => void }) {
  const { deposits, createDeposit, checkDeposit, verifyUsdtDeposit, simulateDeposit } = useApp();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Method>("nowpayments");
  const [networkId, setNetworkId] = useState<string>("bsc");
  const [pkg, setPkg] = useState(DEPOSIT_PACKAGES[3]);
  const [customAmt, setCustomAmt] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customApplied, setCustomApplied] = useState(false);
  const [customMode, setCustomMode] = useState(false); // amount was custom-entered (not an exact package)
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayFallback, setGatewayFallback] = useState(false); // NOWPayments down → amber notice, not a red error
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [firstBonus, setFirstBonus] = useState(0);
  const [result, setResult] = useState<{ credited: number; bonus: number; explorer: string | null } | null>(null);

  const network = DEPOSIT_NETWORKS.find((n) => n.id === networkId) ?? DEPOSIT_NETWORKS[1];
  const nowpayNetwork = NOWPAY_NETWORKS.find((n) => n.id === networkId) ?? NOWPAY_NETWORKS[0];
  const netLabel = method === "nowpayments" ? nowpayNetwork.label : network.label;
  const netShort = method === "nowpayments" ? nowpayNetwork.short : network.short;
  const netColor = method === "nowpayments" ? nowpayNetwork.color : network.color;
  const bonusUsed = hasFirstDepositBonus(deposits);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  /** Lock in a custom deposit amount (above $5 → +75% cashback on every deposit). */
  const applyCustom = () => {
    const amt = Math.round(Number(customAmt) * 100) / 100;
    if (!isFinite(amt) || amt <= CUSTOM_BONUS_MIN) {
      setCustomError(`Custom deposits must be above $${CUSTOM_BONUS_MIN.toFixed(2)} (min $${(CUSTOM_BONUS_MIN + 0.01).toFixed(2)}).`);
      return;
    }
    const p = customDeposit(amt);
    if (!p) {
      setCustomError("Invalid amount.");
      return;
    }
    setPkg(p);
    setCustomMode(!DEPOSIT_PACKAGES.some((x) => x.amount === p.amount));
    setCustomError(null);
    setCustomApplied(true);
  };

  /** Create (or reuse) the NOWPayments order, then show the pay step. */
  const payWithNowpayments = async () => {
    setBusy(true);
    setError(null);
    if (!order) {
      // Custom deposits above $5 earn +75% cashback on EVERY deposit;
      // packages keep the first-deposit-only bonus.
      setFirstBonus(customMode ? pkg.bonus : !bonusUsed ? pkg.bonus : 0);
      const r = await createDeposit(pkg.amount, {
        purpose: "deposit",
        network: networkId,
        description: "PromoPulse wallet deposit",
      });
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
        // Gateway unavailable — fall back to the direct-wallet pay step so
        // the QR + deposit address ALWAYS render and the user can still pay
        // on-chain instead of hitting a dead end.
        setError(
          (r.error ? r.error + " — " : "") +
            "NOWPayments is unavailable right now — showing the direct wallet address below so you can still pay on-chain."
        );
        setGatewayFallback(true);
        setMethod("wallet");
        setStep("pay");
        return;
      }
    } else {
      setBusy(false);
    }
    setStep("pay");
  };

  const checkNowpayments = async () => {
    if (!order) return;
    const r = await checkDeposit(order.trackId);
    if (r.ok && (r.status === "paid" || r.status === "manual_accept")) {
      setResult({
        credited: Math.round((pkg.amount + firstBonus) * 100) / 100,
        bonus: firstBonus,
        explorer: null,
      });
      setStep("done");
    } else if (r.ok) {
      setOrder((o) => (o ? { ...o, status: r.status } : o));
    }
  };

  // Auto-poll the NOWPayments order every 6s while the pay step is open.
  useEffect(() => {
    if (!(step === "pay" && method === "nowpayments" && order)) return;
    const t = setInterval(() => {
      void checkNowpayments();
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, method, order]);

  const verify = async () => {
    const hash = txHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setError("Paste the full transaction hash (starts with 0x, 64 hex characters).");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await verifyUsdtDeposit(networkId, hash, pkg.amount);
    setBusy(false);
    if (res.ok && res.credited != null) {
      setResult({
        credited: res.credited,
        bonus: res.bonus ?? 0,
        explorer: res.explorer ?? `${network.explorer}${hash}`,
      });
      setStep("done");
    } else {
      setError(res.error || "Verification failed — try again.");
    }
  };

  const steps: Step[] = ["method", "network", "package", "pay"];
  const stepIdx = steps.indexOf(step);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
          <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center z-10">
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
              {step === "done" ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <Coins className="w-5 h-5 text-emerald-300" />}
            </div>
            <div>
              <div className="font-extrabold text-lg leading-tight">{step === "done" ? "Deposit confirmed" : "Deposit USDT"}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {step === "done"
                  ? method === "nowpayments"
                    ? "Paid via NOWPayments · instant credit"
                    : "Funds verified on-chain"
                  : method === "nowpayments"
                  ? "NOWPayments · pay by card or crypto"
                  : "Direct wallet · EVM networks (no TON)"}
              </div>
            </div>
          </div>

          {/* Stepper */}
          {step !== "done" && (
            <div className="relative mt-4 flex items-center gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={clsx(
                    "h-1 flex-1 rounded-full transition-colors",
                    i === 0 ? "bg-emerald-400/60" : "bg-white/5"
                  )}
                  style={stepIdx > i || step === s ? { background: "rgba(52,211,153,.6)" } : undefined}
                />
              ))}
            </div>
          )}

          {step === "method" && (
            <>
              <div className="relative mt-5 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                Choose how you want to pay
              </div>
              <div className="relative mt-3 grid gap-2.5">
                {(
                  [
                    {
                      id: "nowpayments" as Method,
                      icon: <Zap className="w-4 h-4 text-emerald-300" />,
                      title: "NOWPayments",
                      badge: "Fast",
                      desc: "Pay by card or crypto on the NOWPayments payment page — credited the moment payment confirms.",
                    },
                    {
                      id: "wallet" as Method,
                      icon: <Wallet className="w-4 h-4 text-sky-300" />,
                      title: "Direct wallet",
                      badge: null,
                      desc: "Send USDT yourself to the app's wallet address, then paste the transaction hash to verify on-chain.",
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMethod(m.id);
                      setNetworkId("bsc");
                      setOrder(null);
                      setError(null);
                      setGatewayFallback(false);
                    }}
                    className={clsx(
                      "rounded-2xl p-4 border text-left transition-all flex items-start gap-3",
                      method === m.id
                        ? "border-emerald-400/50 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                    )}
                  >
                    <span className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {m.icon}
                    </span>
                    <span>
                      <span className="text-sm font-bold flex items-center gap-2">
                        {m.title}
                        {m.badge && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/25">
                            {m.badge}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-gray-400 mt-1 leading-relaxed">{m.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep("network")} className="relative mt-5 btn-primary w-full flex items-center justify-center gap-2">
                <Coins className="w-4 h-4" /> Continue
              </button>
            </>
          )}

          {step === "network" && (
            <>
              <div className="relative mt-5 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                Select network
              </div>
              <div className="relative mt-3 grid grid-cols-2 gap-2.5">
                {(method === "nowpayments" ? NOWPAY_NETWORKS : DEPOSIT_NETWORKS).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setNetworkId(n.id)}
                    className={clsx(
                      "rounded-xl p-3 border text-left transition-all",
                      networkId === n.id
                        ? "border-emerald-400/50 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                        style={{ background: n.color }}
                      >
                        {n.label.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="text-sm font-bold">{n.label}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1.5 font-mono">{n.short} · USDT</div>
                  </button>
                ))}
              </div>
              <div className="relative mt-4 rounded-xl p-3 border border-white/10 bg-white/[0.02] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {method === "nowpayments"
                    ? "NOWPayments gives you a one-time pay address and the exact amount to send. Payments below the network minimum are rejected by the gateway."
                    : "One address accepts USDT on all EVM networks. TON is not supported — sending on the wrong network loses funds."}
                </p>
              </div>
              <button onClick={() => setStep("package")} className="relative mt-5 btn-primary w-full flex items-center justify-center gap-2">
                <Coins className="w-4 h-4" /> Choose an amount
              </button>
            </>
          )}

          {step === "package" && (
            <>
              <div className="relative mt-5 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Choose a package</div>
                {!bonusUsed && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-300">
                    First deposit only
                  </span>
                )}
              </div>
              <div className="relative mt-3 grid grid-cols-2 gap-2.5">
                {DEPOSIT_PACKAGES.map((p) => (
                  <button
                    key={p.amount}
                    onClick={() => {
                      setPkg(p);
                      setCustomMode(false);
                      setCustomApplied(false);
                    }}
                    className={clsx(
                      "rounded-2xl p-4 border text-left transition-all relative overflow-hidden",
                      pkg.amount === p.amount && !customApplied
                        ? "border-emerald-400/50 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                    )}
                  >
                    {!bonusUsed && p.bonusPct > 0 && (
                      <span className="absolute top-2.5 right-2.5 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/25">
                        +{p.bonusPct}%
                      </span>
                    )}
                    <div className="text-2xl font-black tabular">${p.amount}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      You get <b className="text-emerald-300 tabular">{fmtUsdt(p.credited)}</b>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {bonusUsed
                        ? "Standard credit"
                        : p.bonus > 0
                          ? `+${fmtUsdt(p.bonus)} bonus`
                          : "No bonus"}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom deposit — any amount above $5 gets +75% cashback on EVERY deposit */}
              <div className="relative mt-4 rounded-2xl border border-dashed border-amber-400/25 bg-amber-500/[0.04] p-3">
                <div className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold">Custom amount</div>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  Enter any amount above $5 — get <b className="text-amber-300">+75% cashback</b> on every custom deposit.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={CUSTOM_BONUS_MIN + 0.01}
                    step={0.01}
                    value={customAmt}
                    onChange={(e) => {
                      setCustomAmt(e.target.value);
                      setCustomError(null);
                      setCustomApplied(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                    placeholder={`Min $${(CUSTOM_BONUS_MIN + 0.01).toFixed(2)}`}
                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm tabular placeholder:text-gray-500 focus:outline-none focus:border-amber-400/40"
                  />
                  <button
                    onClick={applyCustom}
                    className="shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 transition-all"
                  >
                    Apply
                  </button>
                </div>
                {customError && <div className="mt-2 text-[11px] text-rose-300">{customError}</div>}
                {customApplied && !customError && (
                  <div className="mt-2 text-[11px] text-emerald-300 font-semibold">
                    Custom deposit set — pay {fmtUsdt(pkg.amount)} → you get {fmtUsdt(pkg.credited)}{" "}
                    {customMode
                      ? "(+75% cashback)"
                      : pkg.bonusPct > 0
                        ? `(+${pkg.bonusPct}% bonus)`
                        : "(no bonus)"}
                  </div>
                )}
              </div>
              <div className="relative mt-4 flex gap-2.5">
                <button onClick={() => setStep("network")} className="btn-ghost flex items-center justify-center gap-1.5 px-4">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (method === "nowpayments") {
                      void payWithNowpayments();
                    } else {
                      setStep("pay");
                    }
                  }}
                  disabled={busy}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating payment…
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" /> Pay ${pkg.amount} on {netLabel}
                    </>
                  )}
                </button>
              </div>
              {!isSupabaseReady() && (
                <button
                  onClick={() => {
                    simulateDeposit(pkg.amount);
                    onClose();
                  }}
                  className="relative mt-3 w-full text-center text-[11px] text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors flex items-center justify-center gap-1.5"
                >
                  <FlaskConical className="w-3 h-3" /> Demo: simulate this payment (offline preview only)
                </button>
              )}
            </>
          )}

          {step === "pay" && method === "nowpayments" && (
            <>
              {!order ? (
                <div className="relative mt-6">
                  <div className="flex items-center gap-3 rounded-2xl p-4 glass border border-white/10">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
                    <div>
                      <div className="text-sm font-bold">Creating payment…</div>
                      <div className="text-[11px] text-gray-400">Contacting NOWPayments for ${pkg.amount} USDT</div>
                    </div>
                  </div>
                  {error && (
                    <div className="relative mt-3 rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2">
                      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                    </div>
                  )}
                  <button onClick={() => setStep("package")} className="relative mt-3 w-full text-center text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                    ← Back to packages
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mt-5 rounded-2xl p-4 glass border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                        Send exactly
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                        style={{ background: netColor }}
                      >
                        {netShort}
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-black tabular text-emerald-300">
                      {order.payAmount != null ? fmtCrypto(order.payAmount) : fmtUsdt(pkg.amount)}{" "}
                      <span className="text-xs font-semibold text-gray-400">{order.payCurrency ?? "USDT"}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">One-time pay address (created just for this payment)</div>
                    <div className="mt-3 flex items-center gap-2">
                      <code className="flex-1 font-mono text-[11px] text-gray-300 break-all leading-relaxed select-all">
                        {order.payAddress ?? DEPOSIT_ADDRESS}
                      </code>
                      <button
                        onClick={() => void copyText(order.payAddress ?? DEPOSIT_ADDRESS)}
                        className={clsx(
                          "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                          copied ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 hover:bg-white/10 text-gray-300"
                        )}
                        title="Copy address"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {copied && <div className="mt-2 text-[11px] text-emerald-300 font-semibold">Address copied ✓</div>}
                    <QrImage data={order.payAddress ?? DEPOSIT_ADDRESS} />
                    <div className="mt-3 text-[11px] text-gray-400 leading-relaxed flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                      Pay by card or send crypto on the payment page below — the wallet credits automatically once confirmed.
                    </div>
                  </div>

                  {order.paymentUrl && order.paymentUrl !== "#" && (
                    <a
                      href={order.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="relative mt-4 btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Open secure payment page
                    </a>
                  )}
                  {order.paymentUrl && order.paymentUrl !== "#" && (
                    <p className="relative mt-2 text-center text-[11px] text-gray-500 leading-relaxed">
                      NOWPayments opens in a new tab (payment pages can&apos;t be embedded) — complete payment there, then
                      press &quot;I&apos;ve paid — check status&quot; to confirm.
                    </p>
                  )}
                  <button
                    onClick={() => void checkNowpayments()}
                    disabled={busy}
                    className="relative mt-2 btn-ghost w-full flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    I&apos;ve paid — check status
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
                  <button onClick={() => setStep("package")} className="relative mt-2 w-full text-center text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                    ← Back to packages
                  </button>
                </>
              )}
            </>
          )}

          {step === "pay" && method === "wallet" && (
            <>
              <div className="relative mt-5 rounded-2xl p-4 glass border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                    Send {fmtUsdt(pkg.amount)} USDT on {network.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: network.color }}>
                    {network.short}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 font-mono text-[11px] text-gray-300 break-all leading-relaxed select-all">
                    {DEPOSIT_ADDRESS}
                  </code>
                  <button
                    onClick={() => void copyText(DEPOSIT_ADDRESS)}
                    className={clsx(
                      "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                      copied ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 hover:bg-white/10 text-gray-300"
                    )}
                    title="Copy address"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {copied && <div className="mt-2 text-[11px] text-emerald-300 font-semibold">Address copied ✓</div>}
                <QrImage data={DEPOSIT_ADDRESS} />
                <div className="mt-3 text-[11px] text-gray-400 leading-relaxed flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                  Send <b className="text-white">exactly {fmtUsdt(pkg.amount)} USDT</b> on <b className="text-white">{network.label}</b> — not the
                  native coin, not another network. Scan the QR to copy the address, then paste the transaction hash below.
                </div>
              </div>

              <div className="relative mt-4">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">
                  Transaction hash (from the explorer)
                </div>
                <input
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x…"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-sm focus:outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/30"
                />
                <a
                  href={`${network.explorer}${txHash.trim()}`}
                  target="_blank"
                  rel="noreferrer"
                  className={clsx("mt-2 inline-flex items-center gap-1.5 text-[11px] text-sky-300 hover:text-sky-200", !txHash.trim() && "pointer-events-none opacity-40")}
                >
                  Open {network.label} explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {error && (
                <div
                  className={clsx(
                    "relative mt-3 rounded-xl p-3 border text-xs flex items-start gap-2",
                    gatewayFallback
                      ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
                      : "border-rose-400/25 bg-rose-500/10 text-rose-200"
                  )}
                >
                  <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <button
                onClick={() => void verify()}
                disabled={busy || !txHash.trim()}
                className="relative mt-5 btn-primary w-full flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying on {network.label} chain…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Verify payment on-chain
                  </>
                )}
              </button>
              <button onClick={() => setStep("package")} className="relative mt-2 w-full text-center text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                ← Back to packages
              </button>
            </>
          )}

          {step === "done" && result && (
            <div className="relative mt-6 text-center">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
              </motion.div>
              <div className="mt-4 text-3xl font-black tabular text-emerald-300">+{fmtUsdt(result.credited)}</div>
              <div className="mt-1 text-xs text-gray-400">credited to your PromoPulse wallet</div>

              <div className="relative mt-5 rounded-2xl p-4 glass border border-white/10 text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Package ({netLabel})</span>
                  <b className="text-white tabular">{fmtUsdt(pkg.amount)}</b>
                </div>
                {result.bonus > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-black">
                        {customMode ? "CUSTOM CASHBACK" : "FIRST DEPOSIT"}
                      </span>
                      {customMode ? "Cashback" : "Bonus"} (+{pkg.bonusPct}%)
                    </span>
                    <b className="text-emerald-300 tabular">+{fmtUsdt(result.bonus)}</b>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-300">Total credited</span>
                  <b className="text-emerald-300 tabular text-base">{fmtUsdt(result.credited)}</b>
                </div>
              </div>

              {result.explorer ? (
                <a
                  href={result.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="relative mt-4 inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200"
                >
                  View transaction on {network.label} explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="relative mt-4 text-xs text-gray-500 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Paid via NOWPayments · instant wallet credit
                </div>
              )}
              <button onClick={onClose} className="relative mt-4 btn-primary w-full flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Done
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
