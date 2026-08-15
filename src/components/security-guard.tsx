"use client";

import { useEffect } from "react";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useApp } from "@/lib/store";
import { checkSecurity, reasonLabel } from "@/lib/security";

/**
 * Runs the Telegram Mini App anti-abuse check once on mount and reflects the
 * verdict into the store (which gates earning / publishing / payments).
 * Also renders a persistent banner when the device is flagged.
 */
export default function SecurityGuard() {
  const security = useApp((s) => s.security);
  const setSecurity = useApp((s) => s.setSecurity);

  useEffect(() => {
    let active = true;
    checkSecurity().then((v) => {
      if (active) setSecurity(v);
    });
    return () => {
      active = false;
    };
  }, [setSecurity]);

  if (security.status === "ok") return null;

  const restricted = security.status === "restricted";
  const Icon = restricted ? ShieldX : ShieldAlert;

  return (
    <div
      role="alert"
      className="fixed top-16 lg:top-4 left-4 lg:left-[260px] right-4 lg:right-8 z-40"
    >
      <div
        className={
          "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur-xl shadow-2xl " +
          (restricted
            ? "border-rose-500/30 bg-rose-950/80 text-rose-100"
            : "border-amber-500/30 bg-amber-950/80 text-amber-100")
        }
      >
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold">
            {restricted ? "Security restriction active" : "Security warning"}
          </div>
          <div className="mt-0.5 text-xs opacity-90 leading-relaxed">
            {security.reasons.length > 0
              ? security.reasons.map(reasonLabel).join(" · ")
              : "Please open the app from inside Telegram."}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest opacity-80">
          {restricted ? <ShieldX className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {restricted ? "Blocked" : "Limited"}
        </div>
      </div>
    </div>
  );
}
