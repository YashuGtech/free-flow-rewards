"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, UserPlus, Megaphone, FileCheck2, Flag, Gift, Coins, CheckCheck, Info } from "lucide-react";
import { useApp } from "@/lib/store";
import type { NotificationType } from "@/lib/types";
import clsx from "clsx";

const ICONS: Record<NotificationType, { Icon: any; cls: string }> = {
  follow: { Icon: UserPlus, cls: "bg-cyan-500/15 text-cyan-300 border-cyan-400/20" },
  new_ad: { Icon: Megaphone, cls: "bg-violet-500/15 text-violet-300 border-violet-400/20" },
  claim: { Icon: FileCheck2, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20" },
  report: { Icon: Flag, cls: "bg-rose-500/15 text-rose-300 border-rose-400/20" },
  referral: { Icon: Gift, cls: "bg-amber-500/15 text-amber-300 border-amber-400/20" },
  system: { Icon: Info, cls: "bg-sky-500/15 text-sky-300 border-sky-400/20" },
  withdraw: { Icon: Coins, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20" },
};

export default function NotificationDropdown() {
  const { notifications, markAllRead } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 rounded-xl glass border border-white/10 hover:border-white/20 transition-all flex items-center justify-center"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-semantic-danger text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_#EF4444]">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] glass-strong rounded-2xl border border-white/10 shadow-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="font-bold text-sm">Notifications</div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet</div>
              )}
              {notifications.map((n) => {
                const { Icon, cls } = ICONS[n.type];
                return (
                  <div
                    key={n.id}
                    className={clsx(
                      "flex items-start gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors",
                      !n.read && "bg-brand-cyan/[0.04]"
                    )}
                  >
                    <div className={clsx("shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center", cls)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-snug flex items-center gap-2">
                        <span className="truncate">{n.title}</span>
                        {!n.read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-glow" />}
                      </div>
                      {n.description && <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{n.description}</div>}
                      <div className="text-[10px] text-gray-600 mt-1">{n.at}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
