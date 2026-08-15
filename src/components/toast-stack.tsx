
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, Coins } from "lucide-react";
import { useApp } from "@/lib/store";
import clsx from "clsx";

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

const COLORS = {
  success: "from-emerald-500/30 via-emerald-500/10 to-transparent border-emerald-400/30 text-emerald-300",
  info: "from-cyan-500/30 via-cyan-500/10 to-transparent border-cyan-400/30 text-cyan-300",
  warning: "from-amber-500/30 via-amber-500/10 to-transparent border-amber-400/30 text-amber-300",
  danger: "from-rose-500/30 via-rose-500/10 to-transparent border-rose-400/30 text-rose-300",
};

export default function ToastStack() {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className={clsx(
                "pointer-events-auto glass-strong rounded-2xl p-4 border shadow-card flex items-start gap-3 bg-gradient-to-br",
                COLORS[t.type]
              )}
            >
              <div className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white flex items-center gap-2">
                  {t.title}
                  {typeof t.amount === "number" && (
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 font-bold tabular",
                        t.amount >= 0 ? "text-emerald-300" : "text-rose-300"
                      )}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      {t.amount >= 0 ? `+$${t.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `−$${Math.abs(t.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
                    </span>
                  )}
                </div>
                {t.description && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.description}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
