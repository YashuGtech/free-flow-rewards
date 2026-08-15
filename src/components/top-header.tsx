
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ChevronDown, Settings, ShieldAlert, ShieldCheck, Zap, LogOut } from "lucide-react";
import { useApp } from "@/lib/store";
import { emailUserInfo, signOutEmail } from "@/lib/supabase";
import { reasonLabel } from "@/lib/security";
import UserAvatar from "@/components/user-avatar";
import NotificationDropdown from "@/components/notification-dropdown";
import VerifiedTick from "@/components/verified-tick";
import DepositModal from "@/components/deposit-modal";
import clsx from "clsx";

const TIER_GRADIENT = {
  Bronze: "from-amber-600 to-orange-700",
  Silver: "from-slate-300 to-slate-500",
  Gold: "from-yellow-400 to-amber-500",
  Platinum: "from-cyan-200 via-violet-300 to-fuchsia-300",
} as const;

export default function TopHeader() {
  const { usdt, isLiveTick, lastDelta, tier, isPremium, security, displayHandle, pageCredits } = useApp();
  const [deposit, setDeposit] = useState(false);
  const [emailAccount, setEmailAccount] = useState<string | null>(null);
  const restricted = security.status === "restricted";

  useEffect(() => {
    setEmailAccount(emailUserInfo()?.email ?? null);
  }, []);

  return (
    <header className="sticky top-0 z-20 lg:ml-[244px] px-4 lg:px-8 py-4 backdrop-blur-xl bg-bg-base/60 border-b border-white/5">
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              placeholder="Search tasks, campaigns, handles..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30 transition-all"
            />
          </div>
        </div>

        <div className="md:hidden">
          <div className="font-extrabold text-lg gradient-text">PromoPulse</div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* Page credits — earned by watching rewarded ads on Earn, spent to open pages */}
          <Link
            href="/"
            title="Page credits — watch ads on Earn to earn more"
            className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-amber-400/20 hover:border-amber-400/40 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_12px_#F59E0B]">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">Credits</div>
              <div className="font-bold tabular text-base">{pageCredits}</div>
            </div>
          </Link>

          {/* Live USDT widget */}
          <div className="relative">
            <motion.div
              animate={isLiveTick ? { scale: [1, 1.07, 1] } : { scale: 1 }}
              transition={{ duration: 0.6 }}
              className={clsx(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl glass border border-white/10 cursor-pointer hover:border-white/20 transition-all",
                isLiveTick && "shadow-[0_0_24px_rgba(6,182,212,0.5)]"
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-xs font-black shadow-[0_0_12px_#10B981]">
                ₮
              </div>
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-widest text-gray-500">
                  USDT
                </div>
                <div className="font-bold tabular text-base">
                  ${usdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => setDeposit(true)}
                title="Deposit USDT"
                className="ml-1 w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/10 flex items-center justify-center transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </motion.div>
            <AnimatePresence>
              {isLiveTick && lastDelta !== 0 && (
                <motion.div
                  key={lastDelta}
                  initial={{ opacity: 0, y: 8, scale: 0.8 }}
                  animate={{ opacity: 1, y: -32, scale: 1 }}
                  exit={{ opacity: 0, y: -60 }}
                  transition={{ duration: 0.9 }}
                  className="absolute left-1/2 -translate-x-1/2 top-0 font-extrabold text-xl pointer-events-none whitespace-nowrap tabular"
                  style={{ color: lastDelta > 0 ? "#10B981" : "#FB7185" }}
                >
                  {lastDelta > 0 ? `+$${lastDelta.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `−$${Math.abs(lastDelta).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Security status (Telegram Mini App anti-abuse) */}
          {security.status !== "ok" && (
            <button
              title={security.reasons.length ? security.reasons.map(reasonLabel).join(" · ") : "Security warning"}
              className={clsx(
                "hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                restricted
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              )}
            >
              {restricted ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span className="text-[10px] font-extrabold uppercase tracking-widest">
                {restricted ? "Blocked" : "Limited"}
              </span>
            </button>
          )}

          {/* Tier badge */}
          <div
            className={clsx(
              "hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br border border-white/10",
              TIER_GRADIENT[tier]
            )}
          >
            <span className="text-xs font-extrabold uppercase tracking-widest text-bg-base">
              {tier}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-bg-base" />
          </div>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Settings */}
          <button className="hidden sm:flex w-10 h-10 rounded-xl glass border border-white/10 hover:border-white/20 transition-all items-center justify-center">
            <Settings className="w-4 h-4" />
          </button>

          {/* Browser account sign-out. Telegram users continue to use their Mini App session. */}
          {emailAccount && (
            <button
              onClick={() => void signOutEmail().then(() => window.location.reload())}
              title={`Sign out ${emailAccount}`}
              className="hidden sm:flex w-10 h-10 rounded-xl glass border border-white/10 hover:border-rose-400/30 hover:text-rose-300 transition-all items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          {/* Avatar */}
          <button className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-xl glass border border-white/10 hover:border-white/20 transition-all">
            <UserAvatar name={displayHandle || "you"} tier={tier} size="sm" showBadge highlight verified={isPremium} />
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                @{displayHandle || "you"}
                <VerifiedTick show={isPremium} className="w-3.5 h-3.5" />
              </div>
              <div className="text-[10px] text-gray-500">{isPremium ? "Premium member" : "Gold member"}</div>
            </div>
          </button>
        </div>
      </div>
      <AnimatePresence>{deposit && <DepositModal onClose={() => setDeposit(false)} />}</AnimatePresence>
    </header>
  );
}
