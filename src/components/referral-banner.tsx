
import { useState } from "react";
import { Gift, Copy, Check, Users, LockOpen, Lock, Crown, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { REFERRAL_MILESTONES } from "@/lib/mock-data";
import clsx from "clsx";

const MILESTONE_ICONS: Record<number, any> = {
  1: Gift,
  6: LockOpen,
  7: TrendingUp,
  10: Crown,
};

export default function ReferralBanner() {
  const { referrals, referralCode, referralLocked } = useApp();
  const [copied, setCopied] = useState(false);
  const count = referrals.length;
  const earned = count * 0.49;
  const unlocked = count >= 6;
  const bonusEarned = count >= 7;
  const premiumReached = count >= 10;
  const progress = Math.min(100, (count / 10) * 100);

  const copy = () => {
    const url = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl glass-strong border border-amber-400/15 p-5 lg:p-6">
      <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-brand-cyan/10 blur-3xl pointer-events-none" />

      <div className="relative grid lg:grid-cols-[1fr_auto] gap-5 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-[11px] uppercase tracking-widest text-amber-300 font-semibold">
            <Gift className="w-3.5 h-3.5" /> Referral Program
          </div>
          <h2 className="mt-3 text-xl lg:text-2xl font-extrabold tracking-tight">
            Earn <span className="gradient-text">$0.49 per referral</span> — get paid for every friend
          </h2>
          <p className="mt-1.5 text-sm text-gray-400 max-w-xl">
            Share your code. When a friend signs up you instantly earn{" "}
            <span className="text-amber-300 font-semibold">$0.49 USDT</span>.
            {" "}Withdrawals unlock at <span className="font-bold text-gray-200">6 refers</span> ·{" "}
            <span className="font-bold text-gray-200">+$5.00</span> extra at 7 ·{" "}
            <span className="font-bold text-gray-200">Premium</span> at 10. Each user's code
            auto-disables after 10 referrals.
          </p>
          {referralLocked && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-rose-400/30 bg-rose-500/10 text-xs font-bold text-rose-200">
              <Lock className="w-3.5 h-3.5" /> Your referral code is disabled — you reached 10 referrals
            </div>
          )}

          {/* Milestones */}
          <div className="mt-4 flex flex-wrap gap-2">
            {REFERRAL_MILESTONES.map((m) => {
              const Icon = MILESTONE_ICONS[m.count];
              const done = count >= m.count;
              return (
                <div
                  key={m.count}
                  className={clsx(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                    done
                      ? "bg-amber-400/15 border-amber-400/30 text-amber-200"
                      : "bg-white/[0.03] border-white/10 text-gray-400"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                  <span className={done ? "text-amber-300" : "text-gray-500"}>{m.reward}</span>
                  {done && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />}
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
              <span className="tabular">
                {count}/10 referrals · <span className="text-emerald-300 font-bold tabular">+${earned.toFixed(2)}</span>
                {bonusEarned && <span className="text-amber-300 font-bold"> · +$5 bonus</span>}
                {premiumReached && <span className="text-violet-300 font-bold"> · Premium ✓</span>}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{
                  width: `${progress}%`,
                  background: premiumReached
                    ? "linear-gradient(90deg,#F59E0B 0%,#7C3AED 100%)"
                    : undefined,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              {[1, 6, 7, 10].map((n) => (
                <span
                  key={n}
                  className={clsx(
                    "text-[10px] font-semibold",
                    count >= n ? "text-amber-300" : "text-gray-600"
                  )}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Code card */}
        <div className={clsx("relative w-full lg:w-72 rounded-2xl glass border p-4", referralLocked ? "border-rose-400/25 opacity-80" : "border-white/10")}>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Your referral code</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={clsx("flex-1 font-mono font-extrabold text-lg tracking-widest", referralLocked ? "text-gray-500 line-through" : "gradient-text")}>{referralCode}</span>
            <button
              onClick={copy}
              disabled={referralLocked}
              className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title={referralLocked ? "Referral code disabled" : "Copy invite link"}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-gray-300" />}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-gray-400 inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {count} referred
            </span>
            <span className="font-bold text-emerald-300 tabular">+${earned.toFixed(2)}</span>
          </div>
          <div
            className={clsx(
              "mt-3 rounded-xl p-2.5 text-[11px] font-semibold border flex items-center gap-2",
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
                <LockOpen className="w-3.5 h-3.5" /> Withdrawals unlock at 6 refers ({count}/6)
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
