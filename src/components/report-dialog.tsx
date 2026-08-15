
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, ShieldAlert, X, Ban, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import clsx from "clsx";

const REASONS = ["Scam / fraud", "Fake engagement", "Harassment", "Spam", "Invalid content"];

export default function ReportDialog({
  handle,
  name,
  onClose,
}: {
  handle: string;
  name: string;
  onClose: () => void;
}) {
  const reportUser = useApp((s) => s.reportUser);
  const isPremiumUser = useApp((s) => s.isPremiumUser);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ banned: boolean; durationLabel: string | null; count: number; threshold: number } | null>(null);

  const premium = isPremiumUser(handle);
  const threshold = premium ? 10 : 2;

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
          <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center z-10">
            <X className="w-4 h-4" />
          </button>

          {result ? (
            <div className="relative">
              <div
                className={clsx(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto",
                  result.banned ? "bg-rose-500/20 border border-rose-400/30" : "bg-amber-500/20 border border-amber-400/30"
                )}
              >
                {result.banned ? <Ban className="w-7 h-7 text-rose-300" /> : <Flag className="w-6 h-6 text-amber-300" />}
              </div>
              <div className="text-center mt-4">
                <div className="font-extrabold text-lg">
                  {result.banned ? `@${handle} was banned` : "Report submitted"}
                </div>
                <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                  {result.banned ? (
                    <>
                      Auto-moderation triggered at <span className="font-bold text-rose-300">{result.count}</span> reports
                      within an hour. @{handle} is banned for{" "}
                      <span className="font-bold text-rose-300">{result.durationLabel}</span>.
                    </>
                  ) : (
                    <>
                      This report counts toward @{handle}
                      {premium ? "s premium moderation (10 reports/hour → 72h ban)" : "s moderation (2 reports/hour → 7-day ban)"}.
                      <span className="font-bold text-amber-300"> {result.count}/{result.threshold}</span> in the last hour.
                    </>
                  )}
                </p>
              </div>
              <button onClick={onClose} className="btn-primary w-full mt-6">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="relative flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-400/20 flex items-center justify-center shrink-0">
                  <Flag className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <div className="font-extrabold text-lg leading-tight">Report @{handle}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {name} · {premium ? "Premium user" : "Standard user"}
                  </div>
                </div>
              </div>

              <div className="relative mt-5">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Reason</div>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={clsx(
                        "chip",
                        reason === r ? "chip-active" : "text-gray-400 hover:text-white"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mt-4">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Details (optional)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Anything we should know…"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-rose-400/40 focus:ring-1 focus:ring-rose-400/30 resize-none"
                />
              </div>

              <div className="relative mt-4 rounded-xl p-3 border border-white/10 bg-white/[0.02] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  <span className="font-semibold text-gray-300">Auto-moderation:</span>{" "}
                  {premium ? "10+ reports within an hour → 72-hour ban." : "2+ reports within an hour → 1-week ban."}
                </p>
              </div>

              <div className="relative mt-6 flex items-center gap-3">
                <button onClick={onClose} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (busy) return;
                    setBusy(true);
                    const res = await reportUser(handle, note.trim() ? `${reason} — ${note.trim()}` : reason);
                    setBusy(false);
                    setResult(res);
                  }}
                  disabled={busy}
                  className="btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                  {busy ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
