"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, ShieldCheck, X, MessageSquareText } from "lucide-react";
import { useApp } from "@/lib/store";

/**
 * In-app chat between an ad owner and a lead (thread = submission id).
 * Premium feature — runs under the anti-abuse security guard.
 */
export default function ChatModal({
  threadId,
  peer,
  onClose,
}: {
  threadId: string;
  peer: string;
  onClose: () => void;
}) {
  const { chats, sendChat, addToast, isPremium, handle } = useApp();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const msgs = chats[threadId] ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, threadId]);

  const send = () => {
    const r = sendChat(threadId, text);
    if (r.ok) setText("");
    else addToast({ type: "warning", title: "Can't send", description: r.error });
  };

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
        className="glass-strong rounded-3xl w-full max-w-md h-[70vh] flex flex-col border border-white/10 shadow-card relative overflow-hidden"
      >
        <div className="relative px-5 pt-5 pb-3 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center">
            <MessageSquareText className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-sm truncate">Chat with @{peer}</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-300" /> Secure in-app chat · Premium
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="relative flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {msgs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
              <MessageSquareText className="w-8 h-8 mb-2 opacity-40" />
              <div className="text-xs">No messages yet. Say hi and close the deal!</div>
            </div>
          )}
          {msgs.map((m) => {
            const mine = m.sender === handle;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm " +
                    (mine
                      ? "bg-gradient-to-br from-brand-cyan to-brand-violet text-white rounded-br-md"
                      : "bg-white/[0.06] border border-white/10 text-gray-200 rounded-bl-md")
                  }
                >
                  {!mine && <div className="text-[10px] font-bold text-cyan-300 mb-0.5">@{m.sender}</div>}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="text-[9px] opacity-60 mt-1 text-right">
                    {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative px-4 pb-4 pt-2 border-t border-white/5">
          {!isPremium ? (
            <div className="rounded-xl p-3 border border-amber-400/25 bg-amber-500/10 text-[11px] text-amber-200 text-center">
              In-app chat is a <b>Premium</b> feature — contact the owner on Telegram to chat.
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message…"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-400/40"
              />
              <button onClick={send} className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-glow hover:opacity-90 transition-all">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
