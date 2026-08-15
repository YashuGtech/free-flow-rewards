
import Link from "@/components/link";
import { useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Zap,
  Rocket,
  ClipboardList,
  FileCheck2,
  User,
  Sparkles,
  Send,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { isAdmin } from "@/lib/admin";

const OWNER_TG = import.meta.env.VITE_OWNER_TG || "owner";

const NAV = [
  { href: "/", label: "Earn Tasks", icon: Zap, accent: "from-cyan-400 to-violet-500" },
  { href: "/promote", label: "Promote", icon: Rocket, accent: "from-violet-500 to-fuchsia-500" },
  { href: "/campaigns", label: "My Campaigns", icon: ClipboardList, accent: "from-emerald-400 to-cyan-500" },
  { href: "/leads", label: "Leads", icon: FileCheck2, accent: "from-amber-400 to-orange-500" },
  { href: "/profile", label: "Profile & Wallet", icon: User, accent: "from-pink-400 to-rose-500" },
];

export default function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[244px] z-30 flex-col p-4 border-r border-white/5 glass-strong">
      <Link href="/" className="flex items-center gap-3 px-2 py-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-violet blur-xl opacity-40 -z-10" />
        </div>
        <div>
          <div className="font-extrabold text-lg leading-none gradient-text">
            PromoPulse
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mt-1">
            P2P Social Growth
          </div>
        </div>
      </Link>

      <nav className="mt-8 flex-1 flex flex-col gap-1.5">
        <a
          href={`https://t.me/${OWNER_TG.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-gray-400 hover:text-white"
        >
          <div className="relative w-9 h-9 rounded-lg bg-white/[0.03] border border-white/5 group-hover:border-sky-400/40 flex items-center justify-center transition-all">
            <Send className="w-4 h-4 text-sky-300" />
          </div>
          <span className="relative text-sm font-semibold tracking-wide">Contact owner</span>
        </a>

        {isAdmin() && (
          <Link
            href="/admin"
            className={clsx(
              "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
              path.startsWith("/admin") ? "text-white" : "text-gray-400 hover:text-white"
            )}
          >
            {path.startsWith("/admin") && (
              <motion.div
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl bg-white/5 border border-white/10 shadow-card"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <div
              className={clsx(
                "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                path.startsWith("/admin")
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-glow"
                  : "bg-white/[0.03] border border-white/5 group-hover:border-white/15"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="relative text-sm font-semibold tracking-wide">Admin panel</span>
          </Link>
        )}

        {NAV.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                active ? "text-white" : "text-gray-400 hover:text-white"
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-white/5 border border-white/10 shadow-card"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <div
                className={clsx(
                  "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                  active
                    ? `bg-gradient-to-br ${item.accent} shadow-glow`
                    : "bg-white/[0.03] border border-white/5 group-hover:border-white/15"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="relative text-sm font-semibold tracking-wide">
                {item.label}
              </span>
              {active && (
                <div className="relative ml-auto w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 p-4 rounded-2xl glass border border-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_#10B981]" />
          Realtime online
        </div>
        <div className="text-sm font-semibold mt-2 gradient-text">
          WebSocket • Supabase
        </div>
        <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          Approvals &amp; toasts stream live across all sessions.
        </div>
      </div>
    </aside>
  );
}
