import { createFileRoute } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Coins, Plus, Download, Gift, Crown, Star,
  Lock, LockOpen, BadgeCheck, FileArchive, X, Hash, Zap,
  Send, MessageSquareText, CheckCircle2, Loader2,
} from "lucide-react";
import { PREMIUM_PLANS, INTEREST_TAGS, getUser } from "@/lib/mock-data";
import { useApp, planLimits } from "@/lib/store";
import { isAdmin } from "@/lib/admin";
import { showMonetagInterstitial, showPageInterstitial } from "@/lib/monetag";
import UserAvatar from "@/components/user-avatar";
import VerifiedTick from "@/components/verified-tick";
import SubmissionStatus from "@/components/submission-status";
import DepositModal from "@/components/deposit-modal";
import PremiumPayModal from "@/components/premium-pay-modal";
import BanBanner from "@/components/ban-banner";
import ContactOwnerModal from "@/components/contact-owner-modal";
import ChatModal from "@/components/chat-modal";
import clsx from "clsx";

const TX_ICON = {
  earn: "text-emerald-300 bg-emerald-500/15 border-emerald-400/20",
  spend: "text-violet-300 bg-violet-500/15 border-violet-400/20",
  reject: "text-rose-300 bg-rose-500/15 border-rose-400/20",
  referral: "text-amber-300 bg-amber-500/15 border-amber-400/20",
  deposit: "text-cyan-300 bg-cyan-500/15 border-cyan-400/20",
  withdraw: "text-sky-300 bg-sky-500/15 border-sky-400/20",
  premium: "text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-400/20",
  bonus: "text-emerald-300 bg-emerald-500/15 border-emerald-400/20",
} as const;

export default function Profile() {
  const {
    usdt, promoBalance, username, handle, displayHandle, tier, isPremium, premiumPlanId, premiumExpiry, rating, ratingCount, successRate,
    following, followers, transactions, referrals, submissions, withdrawals,
    withdrawalUnlocked, withdraw, buyPremium, activeBan, addToast,
    interests, addInterest, removeInterest, postsLeftToday,
    contactSaved,
    referralCodeEntered, invitedBy, enterReferralCode,
  } = useApp();
  const [contactOpen, setContactOpen] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  const doEnterRef = async () => {
    if (refBusy || referralCodeEntered) return;
    const c = refCode.trim();
    if (!c) {
      setRefError("Enter the referral code you were given.");
      return;
    }
    setRefBusy(true);
    setRefError(null);
    const r = await enterReferralCode(c);
    setRefBusy(false);
    if (!r.ok) setRefError(r.error || "That code isn't valid — check with your friend.");
    else setRefCode("");
  };

  // In-app interstitial when the user opens the Profile page (rate-limited).
  useEffect(() => {
    if (!isPremium) void showPageInterstitial();
  }, [isPremium]);
  const [chatThread, setChatThread] = useState<{ id: string; peer: string } | null>(null);
  const [premiumPay, setPremiumPay] = useState<string | null>(null);
  const ban = activeBan();
  const [deposit, setDeposit] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wAmount, setWAmount] = useState(5);
  const [wAddress, setWAddress] = useState("");
  const [wError, setWError] = useState<string | null>(null);
  const [wSubmitting, setWSubmitting] = useState(false);
  const [tab, setTab] = useState<"wallet" | "activity">("wallet");

  const me = getUser("you");
  const count = referrals.length;
  const total = Math.round((usdt + promoBalance) * 100) / 100;
  const unlocked = withdrawalUnlocked();
  const premiumDays = premiumExpiry ? Math.max(0, Math.ceil((premiumExpiry - Date.now()) / 86_400_000)) : 0;
  const limits = planLimits(isPremium, premiumPlanId);
  const postsLeft = postsLeftToday();

  const buyWithBalance = (planId: string) => {
    const res = buyPremium(planId);
    if (!res.ok) addToast({ type: "warning", title: "Can't buy premium", description: res.error });
  };

  const mySubs = submissions.filter((s) => s.handle === handle);

  const doWithdraw = async () => {
    setWError(null);
    if (!wAddress.trim()) return setWError("Enter a BNB Chain (BEP-20) address");
    setWSubmitting(true);
    const res = await withdraw(wAmount, wAddress.trim());
    setWSubmitting(false);
    if (!res.ok) setWError(res.error || "Withdrawal failed");
    else {
      setWithdrawOpen(false);
      setWAmount(20);
      setWAddress("");
    }
  };

  // Admin-only ZIP download: sends the Telegram initData to /api/app-zip,
  // which server-verifies the session and admin id before streaming the ZIP.
  const downloadZip = async () => {
    try {
      const w = (window as any).Telegram?.WebApp;
      const res = await fetch("/api/app-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: w?.initData ?? "" }),
      });
      if (!res.ok) throw new Error("restricted");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "promopulse-app.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ type: "warning", title: "Download blocked", description: "The app ZIP is available to admins only." });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <BanBanner />

      <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-4">
          {/* User card */}
          <div className="relative overflow-hidden glass-strong rounded-3xl border border-white/10 p-6">
            <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-brand-cyan/15 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col items-center text-center">
              <UserAvatar name={displayHandle || "you"} tier={tier} size="xl" showBadge highlight verified={isPremium} />
              <div className="mt-3 flex items-center gap-2">
                <div className="font-extrabold text-xl">@{displayHandle || handle}</div>
                <VerifiedTick show={isPremium} className="w-5 h-5" />
              </div>
              <div className="text-xs text-gray-400">
                {isPremium ? `${limits.label} · Premium plan` : "Free plan · 4 posts / 20 leads per post daily · posts removed after 9h"}
              </div>

              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                {rating.toFixed(1)} · {ratingCount} ratings
                <span className="text-emerald-300 font-bold">{successRate}% followers kept</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 w-full">
                <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Followers</div>
                  <div className="font-bold text-sm tabular">{(me.followers + followers.length).toLocaleString()}</div>
                </div>
                <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Following</div>
                  <div className="font-bold text-sm tabular">{following.length.toLocaleString()}</div>
                </div>
                <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Tasks</div>
                  <div className="font-bold text-sm tabular">{me.tasksDone}</div>
                </div>
              </div>

              {isPremium && (
                <div className="mt-4 w-full rounded-xl p-3 border border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-transparent flex items-center gap-2.5">
                  <Crown className="w-4 h-4 text-violet-300 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-violet-200 flex items-center gap-1.5">
                      Premium active
                      <VerifiedTick show className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {premiumDays > 0 ? `${premiumDays} days remaining` : "Lifetime"} · {limits.postsPerDay} posts/day · {limits.leadsPerPostPerDay} leads/post/day · 10+ reports/hour → 72h ban
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Balance card */}
          <div className="relative overflow-hidden glass rounded-3xl border border-white/10 p-6">
            <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-300" />
                </div>
                <span className="font-extrabold">Wallet</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-500">USDT</span>
            </div>
            <div className="relative mt-3 font-extrabold text-3xl tabular">
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="relative mt-1 text-[11px] text-gray-500">
              Withdrawable <span className="font-semibold text-emerald-300 tabular">${usdt.toFixed(2)}</span>
              {promoBalance > 0 && (
                <span className="text-amber-300/90 font-semibold tabular"> · ${promoBalance.toFixed(2)} Promo (referrals)</span>
              )}
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-2.5">
              <button onClick={() => setDeposit(true)} className="btn-primary flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Deposit
              </button>
              <button
                onClick={() => {
                  // Monetag interstitial before the Withdraw modal opens.
                  void (isPremium ? Promise.resolve() : showMonetagInterstitial()).then(() => {
                    setWError(null);
                    setWithdrawOpen(true);
                  });
                }}
                className={clsx(
                  "btn-ghost flex items-center justify-center gap-2",
                  !unlocked && "opacity-60"
                )}
              >
                <Download className="w-4 h-4" /> Withdraw
              </button>
            </div>

            <div
              className={clsx(
                "relative mt-3 rounded-xl p-3 border text-[11px] font-semibold flex items-center gap-2",
                unlocked
                  ? "bg-emerald-500/10 border-emerald-400/25 text-emerald-300"
                  : "bg-white/[0.02] border-white/10 text-gray-400"
              )}
            >
              {unlocked ? (
                <>
                  <LockOpen className="w-3.5 h-3.5" /> Withdrawals unlocked ✓
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Withdrawals unlock at 6 referrals ({count}/6)
                </>
              )}
            </div>
          </div>

          {/* Contact owner / support */}
          <div className="glass rounded-3xl border border-white/10 p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center">
                <Send className="w-4 h-4 text-sky-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Contact &amp; support</div>
                <div className="text-[11px] text-gray-400">
                  {isPremium
                    ? "Chat safely inside the app — no redirect needed"
                    : "Owner's Telegram · save the contact to avoid a ban"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setContactOpen(true)}
              className="mt-3 w-full rounded-xl px-3 py-2.5 text-xs font-bold bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-200 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {isPremium ? "Open support options" : "Contact owner on Telegram"}
            </button>
            {!isPremium && !contactSaved && (
              <p className="mt-2.5 text-[10px] text-amber-300/90 leading-relaxed">
                ⚠ Not saving the owner&apos;s contact can lead to a ban. Open the modal and confirm once saved.
              </p>
            )}
          </div>

          {/* Referral code entry — enter a friend's invite code once (locked forever) */}
          <div className="glass rounded-3xl border border-amber-400/20 p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center">
                <Gift className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Referral code</div>
                <div className="text-[11px] text-gray-400">Enter a friend&apos;s invite code</div>
              </div>
            </div>
            {referralCodeEntered ? (
              <div className="mt-3 rounded-xl p-3 border border-emerald-400/20 bg-emerald-500/10">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Code entered
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  You joined via <span className="font-mono text-gray-300">@{invitedBy || "—"}</span> — your inviter
                  got rewarded. Codes can never be changed once entered.
                </div>
              </div>
            ) : (
              <>
                <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
                  Have a referral code from a friend? Enter it now — one time only, can&apos;t be changed later.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <input
                    value={refCode}
                    onChange={(e) => {
                      setRefCode(e.target.value);
                      setRefError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && doEnterRef()}
                    placeholder="e.g. CA7X or @username"
                    autoComplete="off"
                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-mono placeholder:text-gray-500 focus:outline-none focus:border-amber-400/40"
                  />
                  <button
                    onClick={doEnterRef}
                    disabled={refBusy}
                    className="shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {refBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                    {refBusy ? "Checking…" : "Use code"}
                  </button>
                </div>
                {refError && <div className="mt-2 text-[11px] text-rose-300">{refError}</div>}
              </>
            )}
          </div>

          {/* Daily limits + feed interests */}
          <div className="glass rounded-3xl border border-white/10 p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center">
                <Zap className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Daily limits · {limits.label}</div>
                <div className="text-[11px] text-gray-400">
                  Resets at midnight · {isPremium ? "hitting the lead cap pauses the ad for 1 week" : "free posts are deleted after 9h or 20 leads/day"}
                </div>
              </div>
            </div>
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/5 text-center">
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Posts / day</div>
                <div className="font-bold text-lg tabular mt-0.5">{limits.postsPerDay}</div>
              </div>
              <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/5 text-center">
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Leads / post / day</div>
                <div className="font-bold text-lg tabular mt-0.5">{limits.leadsPerPostPerDay}</div>
              </div>
              <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/5 text-center">
                <div className="text-[10px] uppercase tracking-widest text-gray-500">Posts left</div>
                <div className="font-bold text-lg tabular mt-0.5 text-cyan-300">{postsLeft}</div>
              </div>
            </div>

            {/* Feed interests */}
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> My feed interests — matching ads rank higher
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {interests.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-brand-cyan/25 to-brand-violet/25 border border-brand-cyan/30 text-[11px] font-bold text-cyan-200">
                    #{t}
                    <button onClick={() => removeInterest(t)} className="hover:text-rose-300 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {interests.length === 0 && <span className="text-[11px] text-gray-500">No interests yet — pick some below.</span>}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {INTEREST_TAGS.filter((t) => !interests.includes(t)).slice(0, 8).map((t) => (
                  <button key={t} onClick={() => addInterest(t)} className="chip !px-2.5 !py-1 text-gray-400 hover:text-white">
                    + {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Premium plans */}
          <div className="glass rounded-3xl border border-violet-400/20 p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Premium membership</div>
                <div className="text-[11px] text-gray-400">Verified blue tick · priority approvals</div>
              </div>
            </div>
            <div className="mt-3.5 space-y-2">
              {PREMIUM_PLANS.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{plan.label}</span>
                    <span className="text-xs font-extrabold gradient-text tabular">${plan.price.toFixed(2)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-semibold text-gray-400">
                      {plan.postsPerDay} posts/day
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-semibold text-gray-400">
                      {plan.leadsPerPostPerDay} leads/post/day
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      disabled={isPremium}
                      onClick={() => {
                        // Monetag interstitial before the Premium purchase flow.
                        void (isPremium ? Promise.resolve() : showMonetagInterstitial()).then(() => buyWithBalance(plan.id));
                      }}
                      className="rounded-lg px-2 py-2 text-[11px] font-bold bg-gradient-to-r from-brand-cyan to-brand-violet text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isPremium ? "Active" : "Balance"}
                    </button>
                    <button
                      disabled={isPremium}
                      onClick={() => {
                        // Monetag interstitial before the Premium purchase flow.
                        void (isPremium ? Promise.resolve() : showMonetagInterstitial()).then(() => setPremiumPay(plan.id));
                      }}
                      className="rounded-lg px-2 py-2 text-[11px] font-bold bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 hover:border-violet-400/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      NOWPayments
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[10px] text-gray-500">
              Pay with your USDT balance or via NOWPayments (card / crypto) — Premium activates the moment payment confirms.
            </p>
            <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
              Premium ban policy: <span className="text-gray-300 font-semibold">10+ reports/hour → 72h suspension</span>{" "}
              instead of the standard 2+/hour → 1 week.
            </p>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Tabs: wallet activity + submissions */}
          <div className="glass rounded-3xl border border-white/10 p-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setTab("wallet")} className={clsx("chip", tab === "wallet" ? "chip-active" : "text-gray-400 hover:text-white")}>
                Transactions
              </button>
              <button onClick={() => setTab("activity")} className={clsx("chip", tab === "activity" ? "chip-active" : "text-gray-400 hover:text-white")}>
                My submissions ({mySubs.length})
              </button>
            </div>

            {tab === "wallet" ? (
              <div className="mt-4 space-y-1">
                {transactions.slice(0, 12).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                    <div className={clsx("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", TX_ICON[t.type])}>
                      <Coins className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{t.label}</div>
                      <div className="text-[11px] text-gray-500">{t.date}{t.meta ? ` · ${t.meta}` : ""}</div>
                    </div>
                    <span className={clsx("text-sm font-extrabold tabular", t.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      {t.amount >= 0 ? "+" : "−"}${Math.abs(t.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                {transactions.length === 0 && <div className="text-center text-gray-500 text-sm py-6">No transactions yet</div>}
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {mySubs.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.action} <span className="font-mono text-gray-300">{s.target}</span></div>
                        <div className="text-[11px] text-gray-500">{s.platform} · {s.submittedAt} · proof: {s.proof}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-extrabold text-emerald-300 tabular">+${s.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                        <SubmissionStatus status={s.status} reason={s.reason} compact />
                        {isPremium && s.status === "pending" && (
                          <button
                            onClick={() => setChatThread({ id: s.id, peer: s.poster })}
                            className="text-[10px] font-bold inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                          >
                            <MessageSquareText className="w-3 h-3" /> Chat
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {mySubs.length === 0 && <div className="text-center text-gray-500 text-sm py-6">No submissions yet — start earning on the marketplace!</div>}
              </div>
            )}
          </div>

          {/* Withdrawal history */}              {withdrawals.length > 0 && (
            <div className="glass rounded-3xl border border-white/10 p-5">
              <div className="font-extrabold text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-sky-300" /> Withdrawals
              </div>
              <div className="mt-3 space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-400 truncate">{w.address.slice(0, 18)}…</div>
                      <div className="text-[10px] text-gray-600">
                        {w.demo ? "Demo payout" : "Manual review"} · {w.network === "bnb" ? "BNB Chain" : "BNB Chain"} · {w.trackId?.slice(0, 10) ?? w.at} · {w.status}
                      </div>
                    </div>
                    <span className="font-extrabold tabular text-rose-300 shrink-0">−${w.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download app — admins only */}
          {isAdmin() && (
          <div className="relative overflow-hidden glass-strong rounded-3xl border border-white/10 p-6">
            <div className="absolute -top-20 -left-16 w-52 h-52 rounded-full bg-brand-cyan/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-glow">
                  <FileArchive className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-extrabold">Download app (HTML / CSS / JS)</div>
                  <div className="text-xs text-gray-400">Full standalone build of every page — works offline.</div>
                </div>
              </div>
              <button onClick={downloadZip} className="btn-primary inline-flex items-center gap-2">
                <Download className="w-4 h-4" /> Download ZIP
              </button>
            </div>
            <div className="relative mt-3 text-[11px] text-gray-500 leading-relaxed">
              Includes <span className="text-gray-300 font-semibold">Earn, Promote, Campaigns, Leads, Profile</span> and{" "}
              <span className="text-gray-300 font-semibold">user pages</span> as plain HTML/CSS/JS with your data saved
              locally. No server needed — open <span className="font-mono text-gray-300">index.html</span> and go.
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Deposit modal */}
      <AnimatePresence>
        {deposit && <DepositModal onClose={() => setDeposit(false)} />}
      </AnimatePresence>

      {/* Premium pay (NOWPayments) */}
      <AnimatePresence>
        {premiumPay && <PremiumPayModal planId={premiumPay} onClose={() => setPremiumPay(null)} />}
      </AnimatePresence>

      {/* Contact owner modal */}
      <AnimatePresence>
        {contactOpen && <ContactOwnerModal onClose={() => setContactOpen(false)} />}
      </AnimatePresence>

      {/* In-app chat (deal-closing, premium) */}
      <AnimatePresence>
        {chatThread && (
          <ChatModal threadId={chatThread.id} peer={chatThread.peer} onClose={() => setChatThread(null)} />
        )}
      </AnimatePresence>

      {/* Withdraw modal */}
      <AnimatePresence>
        {withdrawOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setWithdrawOpen(false)}
          >
            <motion.div
              initial={{ y: 24, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-md p-6 border border-white/10 shadow-card relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center">
                  <Download className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <div className="font-extrabold text-lg leading-tight">Withdraw USDT</div>
                  <div className="text-xs text-gray-400">
                    {unlocked ? "BNB Chain (BEP-20) only · min $5" : "Locked until 6 referrals"}
                  </div>
                </div>
              </div>

              {!unlocked ? (
                <>
                  <div className="relative mt-5 rounded-xl p-4 border border-amber-400/25 bg-amber-500/10 text-sm text-amber-200 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      Withdrawals unlock at <span className="font-bold">6 referrals</span>. You have{" "}
                      <span className="font-bold">{count}/6</span>. Refer {6 - count} more friends to withdraw your earnings.
                    </div>
                  </div>
                  <button onClick={() => setWithdrawOpen(false)} className="btn-primary w-full mt-5">Got it</button>
                </>
              ) : (
                <>
                  <div className="relative mt-5">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Amount (USDT) · min $5</div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-500">$</span>
                      <input
                        type="number"
                        min={5}
                        max={usdt}
                        value={wAmount}
                        onChange={(e) => setWAmount(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-2xl font-extrabold tabular focus:outline-none focus:border-sky-400/40"
                      />
                    </div>
                  </div>
                  <div className="relative mt-4">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">BNB Chain (BEP-20) address</div>
                    <input
                      value={wAddress}
                      onChange={(e) => setWAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm font-mono placeholder:text-gray-500 focus:outline-none focus:border-sky-400/40"
                    />
                  </div>
                  <div className="relative mt-3 text-[11px] text-gray-500 flex items-center justify-between">
                    <span>Withdrawable balance</span>
                    <span className="font-bold text-emerald-300 tabular">${usdt.toFixed(2)}</span>
                  </div>
                  {promoBalance > 0 && (
                    <div className="relative mt-2 rounded-lg px-3 py-2 border border-amber-400/20 bg-amber-500/[0.06] text-[11px] text-amber-200/90 flex items-start gap-2">
                      <Gift className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-bold tabular">${promoBalance.toFixed(2)}</span> Promo balance (referral
                        bonuses) stays in your wallet and is used to promote ads.
                      </span>
                    </div>
                  )}
                  {wError && (
                    <div className="relative mt-3 rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200">{wError}</div>
                  )}
                  <button onClick={doWithdraw} disabled={wSubmitting} className="btn-primary w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-60">
                    <Download className="w-4 h-4" /> {wSubmitting ? "Submitting…" : "Request withdrawal"}
                  </button>
                  <p className="relative mt-2 text-center text-[10px] text-gray-500">
                    Paid manually by the admin · BNB Chain (BEP-20) only · min $5
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const Route = createFileRoute("/profile")({
  component: Profile,
  head: () => ({
    meta: [
      { title: "Your Profile & Wallet — PromoPulse" },
      { name: "description", content: "Manage your wallet, USDT deposits, premium plan, referrals and completed task history." },
      { property: "og:title", content: "Your Profile & Wallet — PromoPulse" },
      { property: "og:description", content: "Manage your wallet, USDT deposits, premium plan, referrals and completed task history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
