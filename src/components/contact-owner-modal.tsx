"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, ShieldCheck, ShieldAlert, Check, X, MessageSquareText } from "lucide-react";
import { useApp } from "@/lib/store";

const OWNER_TG = process.env.NEXT_PUBLIC_OWNER_TG || "owner";

export default function ContactOwnerModal({ onClose }: { onClose: () => void }) {
  const { isPremium, contactSaved, markContactSaved } = useApp();
  const [savedJustNow, setSavedJustNow] = useState(false);
  const url = `https://t.me/${OWNER_TG.replace(/^@/, "")}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
        <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center">
            <Send className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <div className="font-extrabold text-lg leading-tight">Contact the owner</div>
            <div className="text-xs text-gray-400">Chat &amp; support · @{OWNER_TG.replace(/^@/, "")}</div>
          </div>
        </div>

        {!isPremium ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="relative mt-5 btn-primary w-full flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Open owner's Telegram
            </a>

            <div className="relative mt-4 rounded-xl p-3.5 border border-amber-400/25 bg-amber-500/10 text-[12px] text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <b>Important:</b> not saving the owner&apos;s contact can result in a{" "}
                <b>ban</b>. Open Telegram, add the contact, then confirm below.
              </span>
            </div>

            {contactSaved ? (
              <div className="relative mt-3 rounded-xl p-3 border border-emerald-400/25 bg-emerald-500/10 text-xs text-emerald-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Contact saved — you&apos;re safe. {savedJustNow ? "" : "✓"}
              </div>
            ) : (
              <button
                onClick={() => {
                  markContactSaved();
                  setSavedJustNow(true);
                }}
                className="relative mt-3 w-full rounded-xl px-3 py-2.5 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> I&apos;ve saved the owner&apos;s contact
              </button>
            )}

            <p className="relative mt-3 text-center text-[10px] text-gray-500">
              Premium members chat safely inside the app — no redirect needed.
            </p>
          </>
        ) : (
          <>
            <div className="relative mt-5 rounded-xl p-4 border border-emerald-400/25 bg-emerald-500/10 text-[12px] text-emerald-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <b>Premium security:</b> you chat inside the app under the anti-abuse
                guard. Open any lead and press <b>Chat</b> to talk to the advertiser
                and close the deal — no external redirects.
              </span>
            </div>
            <div className="relative mt-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-xs text-gray-300">
              <MessageSquareText className="w-4 h-4 text-cyan-300 shrink-0" />
              Go to <b className="text-cyan-200">Leads</b> or <b className="text-cyan-200">Profile → Submissions</b> and press Chat.
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="relative mt-3 text-[11px] text-gray-500 hover:text-sky-300 transition-colors inline-flex items-center gap-1.5">
              <Send className="w-3 h-3" /> Prefer Telegram? Open @{OWNER_TG.replace(/^@/, "")}
            </a>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
