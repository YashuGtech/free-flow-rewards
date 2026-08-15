
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Coins, Gift, CheckCircle2, ArrowRight, Crown, Clock, Megaphone, Hash, X, Zap, Wallet, CreditCard } from "lucide-react";
import { PLATFORMS, TASK_ACTIONS, PREMIUM_PLANS, PLATFORM_META, SUGGESTED_TAGS } from "@/lib/mock-data";
import { useApp, planLimits } from "@/lib/store";
import { showMonetagInterstitial, showPageInterstitial } from "@/lib/monetag";
import type { Platform, TaskAction } from "@/lib/types";
import PlatformIcon from "@/components/platform-icon";
import BanBanner from "@/components/ban-banner";
import PremiumPayModal from "@/components/premium-pay-modal";
import clsx from "clsx";

function genPostId(): string {
  return `PP-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
}

export default function Promote() {
  const { usdt, promoBalance, publishAd, isPremium, premiumPlanId, isBanned, buyPremium, postsLeftToday, handle, displayHandle } = useApp();
  const banned = isBanned(handle);

  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [action, setAction] = useState<TaskAction>("Follow");
  const [target, setTarget] = useState("");
  const [reward, setReward] = useState(5);
  const [quantity, setQuantity] = useState(50);
  const [mode, setMode] = useState<"paid" | "referral">("paid");
  const [instructions, setInstructions] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [postId, setPostId] = useState(() => genPostId());
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [premiumPay, setPremiumPay] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // In-app interstitial when the user opens the Promote page (rate-limited).
  useEffect(() => {
    if (!isPremium) void showPageInterstitial();
  }, [isPremium]);

  const budget = Math.round(reward * quantity * 100) / 100;
  // Paid campaigns can't be published without enough balance — block the button.
  const balance = usdt + promoBalance;
  const lowBalance = mode === "paid" && budget > balance && budget > 0;
  const meta = PLATFORM_META[platform];
  const limits = planLimits(isPremium, premiumPlanId);
  const postsLeft = postsLeftToday();

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#/, "");
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const publish = async () => {
    if (publishing) return; // an ad is already playing for this publish
    setError(null);
    // Monetag rewarded interstitial before the ad goes live (routed through
    // the centralized showRewardedAd) — the user watches it to completion,
    // then the campaign is published. A failed/no-fill ad still publishes
    // (graceful degradation — never blocks publishing).
    setPublishing(true);
    try {
      if (!isPremium) await showMonetagInterstitial();
    } finally {
      setPublishing(false);
    }
    const res = publishAd({
      title: title.trim(),
      platform,
      action,
      target: target.trim() || `@${displayHandle || handle || "you"}`,
      reward,
      quantity,
      mode,
      instructions: instructions.trim() || undefined,
      tags,
    });
    if (!res.ok) {
      setError(res.error || "Could not publish");
      return;
    }
    setPublishedId(res.id ?? "ok");
    setTitle("");
    setTarget("");
    setInstructions("");
    setTags([]);
    setPostId(genPostId());
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <BanBanner />

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl glass-strong border border-white/10 p-6 lg:p-8 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/15 via-transparent to-brand-cyan/10 pointer-events-none" />
        <div className="relative grid lg:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-widest text-violet-300 font-semibold">
              <Rocket className="w-3 h-3" /> Promote · Grow your audience
            </div>
            <h1 className="mt-4 text-3xl lg:text-4xl font-extrabold tracking-tight">
              Launch an <span className="gradient-text">Ad Campaign</span> in seconds
            </h1>
            <p className="mt-3 text-gray-400 max-w-lg">
              Pay per approved lead with USDT, or use a <span className="text-amber-300 font-semibold">referral exchange</span> —
              get real people to follow, join and engage with your brand.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 border bg-gradient-to-br from-emerald-500/20 to-transparent border-emerald-400/20">
              <div className="text-[10px] uppercase tracking-widest text-gray-400">Your balance</div>
              <div className="font-extrabold text-2xl tabular text-emerald-300 mt-1">
                ${usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-gray-400">USDT</div>
            </div>
            <div className="rounded-2xl p-4 border bg-gradient-to-br from-violet-500/20 to-transparent border-violet-400/20">
              <div className="text-[10px] uppercase tracking-widest text-gray-400">Estimated max budget</div>
              <div className="font-extrabold text-2xl tabular mt-1 gradient-text">
                ${budget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-gray-400">{reward} USDT × {quantity} · per approved lead</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily quota strip */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10 text-gray-400">
          <Zap className="w-3.5 h-3.5 text-cyan-300" />
          <span className="font-bold text-cyan-200 tabular">{postsLeft}</span> of{" "}
          <span className="font-bold tabular">{limits.postsPerDay}</span> posts left today · {limits.label}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10 text-gray-400">
          Leads per post / day: <span className="font-bold text-cyan-200 tabular">{limits.leadsPerPostPerDay}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10 text-gray-400">
          Hitting the cap pauses the ad for 1 week
        </span>
      </div>

      {/* Free-plan upsell: posts auto-delete after 9h — Premium keeps them forever */}
      {!isPremium && (
        <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Clock className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300 leading-relaxed">
              <span className="font-bold text-amber-300">Free posts auto-delete after 9h.</span>{" "}
              Go <span className="font-bold text-violet-300">Premium</span> to keep your posts{" "}
              <span className="font-bold text-white">permanently</span> — no more 9h auto-deletion, plus up to
              100 posts/day, 100 leads per post/day and priority approvals.
            </div>
          </div>
          <button
            onClick={() => setPremiumPay("week")}
            className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-violet text-white text-xs font-bold hover:opacity-90 transition-all inline-flex items-center gap-1.5"
          >
            <Crown className="w-3.5 h-3.5" /> Get Premium — permanent posts
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Publish form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl border border-white/10 p-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-violet/15 border border-violet-400/25 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <div className="font-extrabold text-lg">Publish a new ad</div>
              <div className="text-xs text-gray-400">Appears instantly in the marketplace · followers get notified</div>
            </div>
          </div>

          {publishedId && (
            <div className="mt-5 rounded-2xl p-4 border border-emerald-400/25 bg-emerald-500/10 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-200">
                <span className="font-bold">Ad published!</span> Your followers have been notified. Track performance in
                My Campaigns.
              </div>
            </div>
          )}

          <div className="mt-6 space-y-5">
            {/* Title */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Ad title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Follow @yourbrand for daily drops"
                className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30"
              />
            </div>

            {/* Platform */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Platform</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={clsx(
                      "chip flex items-center gap-1.5",
                      platform === p ? "chip-active" : "text-gray-400 hover:text-white"
                    )}
                  >
                    <PlatformIcon platform={p} size="sm" className="!w-5 !h-5 !rounded-md" />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Action */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Action</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TASK_ACTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={clsx("chip", action === a ? "chip-active" : "text-gray-400 hover:text-white")}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Target */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Target account / link</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`@yourhandle or ${platform} link`}
                className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30 font-mono"
              />
            </div>

            {/* Post ID + Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Post ID (unique)</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white/[0.03] border border-dashed border-white/15 px-3.5 py-3">
                  <Hash className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span className="font-mono font-bold text-sm text-cyan-200 tabular">{postId}</span>
                  <button
                    onClick={() => setPostId(genPostId())}
                    className="ml-auto text-[10px] font-bold text-gray-500 hover:text-white transition-colors"
                  >
                    Regenerate
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-gray-500">Unique public ID for this post — used in search &amp; shares.</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Tags (max 5)</label>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2 min-h-[46px]">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-brand-cyan/25 to-brand-violet/25 border border-brand-cyan/30 text-[11px] font-bold text-cyan-200">
                      #{t}
                      <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-rose-300">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    onBlur={() => addTag(tagInput)}
                    placeholder={tags.length >= 5 ? "Max 5 tags" : "Add tag + Enter"}
                    className="flex-1 min-w-[90px] bg-transparent text-sm placeholder:text-gray-600 focus:outline-none"
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
                    <button key={t} onClick={() => addTag(t)} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-colors">
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reward + quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Reward (USDT / completion)</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={reward}
                  onChange={(e) => setReward(Number(e.target.value))}
                  className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm tabular focus:outline-none focus:border-brand-cyan/40"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Quantity</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1.5 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm tabular focus:outline-none focus:border-brand-cyan/40"
                />
              </div>
            </div>

            {/* Mode */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Payment method</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("paid")}
                  className={clsx(
                    "rounded-2xl p-4 border text-left transition-all",
                    mode === "paid"
                      ? "border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-300" />
                    <span className="font-bold text-sm">Paid · USDT</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                    No upfront charge. <span className="text-emerald-300 font-semibold">${reward.toFixed(2)} USDT</span> is
                    debited per lead only when you approve it.
                  </p>
                </button>
                <button
                  onClick={() => setMode("referral")}
                  className={clsx(
                    "rounded-2xl p-4 border text-left transition-all",
                    mode === "referral"
                      ? "border-amber-400/40 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-300" />
                    <span className="font-bold text-sm">Referral exchange</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                    No USDT charged. Users complete your referral instead — you provide the instructions.
                  </p>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {mode === "referral" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl p-4 border border-amber-400/20 bg-amber-500/[0.05]">
                    <label className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold">
                      Instructions for users
                    </label>
                    <textarea
                      rows={3}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Join @yourbrand on Telegram and enter their username @yourbrand in your profile as the referral code…"
                      className="mt-2 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/30 resize-none"
                    />
                    <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                      Users complete the referral and submit proof. You get notified of every completed referral.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200">{error}</div>
            )}

            {lowBalance && (
              <div className="rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200 leading-relaxed">
                <span className="font-bold">Insufficient balance.</span> This campaign needs{" "}
                <b className="tabular">${budget.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT</b> but your
                balance is <b className="tabular">${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b>{" "}
                (wallet + promo). Top up to publish.
              </div>
            )}

            {banned ? (
              <div className="rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200">
                You are suspended — publishing is disabled until your ban expires.
              </div>
            ) : (
              <button
                onClick={publish}
                disabled={lowBalance || publishing}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {publishing
                  ? "Watching rewarded ad…"
                  : `Publish ad${mode === "paid" ? " · pay per approved lead" : " · referral exchange"}`}
                {!publishing && <ArrowRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </motion.div>

        {/* Premium packs — every plan, clearly explained */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl glass-strong border border-violet-400/20 p-5">
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-extrabold">Premium membership</div>
                <div className="text-[11px] text-gray-400">
                  {isPremium ? "Active — enjoy the perks" : "Pick a pack · every plan explained below"}
                </div>
              </div>
            </div>

            <div className="relative mt-4 space-y-3">
              {PREMIUM_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition-all hover:border-violet-400/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold">{plan.label}</span>
                    <span className="text-sm font-black gradient-text tabular">${plan.price.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {plan.days} days · {plan.postsPerDay} posts/day · {plan.leadsPerPostPerDay} leads/post/day
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="text-[11px] text-gray-300 flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" /> {perk}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      disabled={isPremium}
                      onClick={() => buyPremium(plan.id)}
                      className="rounded-xl px-2.5 py-2 text-[11px] font-bold bg-gradient-to-r from-brand-cyan to-brand-violet text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Wallet className="w-3 h-3" /> Balance
                    </button>
                    <button
                      disabled={isPremium}
                      onClick={() => setPremiumPay(plan.id)}
                      className="rounded-xl px-2.5 py-2 text-[11px] font-bold bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 hover:border-violet-400/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-3 h-3" /> NOWPayments
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {isPremium ? (
              <div className="relative mt-3 rounded-xl p-2.5 border border-emerald-400/25 bg-emerald-500/10 text-[11px] text-emerald-300 font-semibold text-center">
                Premium active ✓ — unlimited growth
              </div>
            ) : (
              <div className="relative mt-3 rounded-xl p-3 border border-white/10 bg-white/[0.02] text-[11px] text-gray-400 leading-relaxed">
                <span className="font-bold text-gray-200">Why go Premium?</span> Verified blue tick, up to 100 posts/day,
                leads never expire, softer ban threshold (10+ reports/hour → 72h instead of 1 week) and priority
                approvals. Pay with your USDT balance or NOWPayments (card / crypto).
              </div>
            )}
          </div>

          <div className="glass rounded-2xl border border-white/10 p-4 text-xs text-gray-400 leading-relaxed">
            <span className="font-bold text-gray-200">Did you know?</span> Followers you gain via referral-exchange ads
            are notified every time you post. 98.4% of claims are approved within 20 minutes.
          </div>
        </div>
      </div>

      <AnimatePresence>
        {premiumPay && <PremiumPayModal planId={premiumPay} onClose={() => setPremiumPay(null)} />}
      </AnimatePresence>
    </div>
  );
}
