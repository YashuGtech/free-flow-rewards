
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Star,
  Gift,
  ArrowRight,
  Users,
  Megaphone,
  MessageSquareText,
  Send,
  Flag,
  ShieldAlert,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { getUser } from "@/lib/mock-data";
import { showMonetagInterstitial, showPageInterstitial } from "@/lib/monetag";
import type { Submission } from "@/lib/types";
import PlatformIcon from "@/components/platform-icon";
import RateDialog from "@/components/rate-dialog";
import ChatModal from "@/components/chat-modal";
import ReportDialog from "@/components/report-dialog";
import clsx from "clsx";

function StatusBadge({ status, rated }: { status: Submission["status"]; rated?: boolean }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-500/15 border-emerald-400/25 text-emerald-300 text-[11px] font-bold">
        <CheckCircle2 className="w-3.5 h-3.5" /> Done{rated ? " · Rated" : ""}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-rose-500/15 border-rose-400/25 text-rose-300 text-[11px] font-bold">
        <XCircle className="w-3.5 h-3.5" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-amber-500/15 border-amber-400/25 text-amber-300 text-[11px] font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Pending review
    </span>
  );
}

/**
 * One-tap Contact: opens the peer's Telegram with a prefilled message that
 * names the ad id (PP-XXXXXX) and asks to verify the proof photo.
 */
function tgContactUrl(handle: string, adId: string): string {
  const raw = (getUser(handle).tg || handle).replace(/^@/, "");
  // "tg-<id>" is a DB identity fallback, not a Telegram username — no link.
  const tg = /^tg-\d+$/i.test(raw) ? "" : raw;
  if (!tg) return "";
  const msg = `Hi! Regarding ad ${adId} — the submission photo is here, please verify. Thank you!`;
  return `https://t.me/${tg}?text=${encodeURIComponent(msg)}`;
}

function ContactButton({ handle, adId }: { handle: string; adId: string }) {
  const url = tgContactUrl(handle, adId);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Open their Telegram with a pre-filled verify message"
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500/15 border border-sky-400/25 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all"
    >
      <Send className="w-3.5 h-3.5" /> Contact
    </a>
  );
}

function ReferralReveal({ link, note }: { link: string; note?: string }) {
  return (
    <div className="mt-2.5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
        <Gift className="w-3.5 h-3.5" /> User&apos;s referral link &amp; description
      </div>
      {link && (
        <a
          href={link.startsWith("http") ? link : undefined}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block font-mono text-xs text-cyan-200 break-all hover:underline"
        >
          {link}
        </a>
      )}
      {note && <p className="mt-1 text-xs text-gray-300 leading-relaxed">{note}</p>}
    </div>
  );
}

export default function Leads() {
  const { submissions, approveSubmission, rejectSubmission, rateSubmission, addToast, isPremium, handle, refreshSubmissions } = useApp();

  // In-app interstitial when the user opens the Leads page (rate-limited).
  useEffect(() => {
    if (!isPremium) void showPageInterstitial();
    // Pull the latest submissions from the DB so new claims reach the
    // publisher immediately and approved payouts land in the wallet
    // (bypasses the 15-min marketplace cache).
    void refreshSubmissions();
  }, [refreshSubmissions]);
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [rate, setRate] = useState<{ sub: Submission; target: string; targetName: string; who: "user" | "publisher" } | null>(null);
  const [chatThread, setChatThread] = useState<{ id: string; peer: string } | null>(null);
  const [report, setReport] = useState<{ handle: string; name: string } | null>(null);

  const incoming = useMemo(() => submissions.filter((s) => s.posterHandle === handle), [submissions]);
  const outgoing = useMemo(() => submissions.filter((s) => s.handle === handle), [submissions]);
  const pendingIncoming = incoming.filter((s) => s.status === "pending").length;

  const confirmReject = () => {
    if (!rejecting || !reason.trim()) return;
    rejectSubmission(rejecting.id, reason.trim());
    setRejecting(null);
    setReason("");
  };

  const openRate = (sub: Submission, target: string, targetName: string, who: "user" | "publisher") => {
    setRate({ sub, target, targetName, who });
  };

  const incomingCards = [...incoming.filter((s) => s.status === "pending"), ...incoming.filter((s) => s.status !== "pending")];

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto">
      {/* Stay-in-app safety warning — the app is not responsible for losses outside */}
      <div className="rounded-2xl border border-rose-400/25 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 leading-relaxed">
          <span className="font-bold text-rose-300">Stay inside the app.</span> Never move chats to Telegram / WhatsApp
          to discuss a deal — PromoPulse is <span className="font-bold text-white">not responsible</span> for any loss
          outside the app.{" "}
          {!isPremium && (
            <a
              href="/profile"
              className="font-bold text-violet-300 underline decoration-violet-400/40 underline-offset-2 hover:text-violet-200"
            >
              Go Premium for secure in-app chat
            </a>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl glass-strong border border-white/10 p-6 lg:p-8 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-brand-cyan/10 pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-widest text-amber-300 font-semibold">
              <FileCheck2 className="w-3 h-3" /> Leads · Claims &amp; submissions
            </div>
            <h1 className="mt-4 text-3xl lg:text-4xl font-extrabold tracking-tight">
              Review <span className="gradient-text">your Leads</span>
            </h1>
            <p className="mt-2 text-sm text-gray-400 max-w-2xl">
              Claims users submitted to <span className="font-semibold text-cyan-300">your ads</span>, and your own
              submissions to <span className="font-semibold text-amber-300">publishers</span>. Mark a claim{" "}
              <span className="font-semibold text-white">done</span> and rate the person on the other side.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("incoming")} className={clsx("chip", tab === "incoming" ? "chip-active" : "text-gray-400 hover:text-white")}>
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Users&apos; claims ({incoming.length})
              </span>
            </button>
            <button onClick={() => setTab("outgoing")} className={clsx("chip", tab === "outgoing" ? "chip-active" : "text-gray-400 hover:text-white")}>
              <span className="inline-flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5" /> My claims ({outgoing.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {tab === "incoming" ? (
        <>
          {pendingIncoming > 0 && (
            <div className="glass rounded-2xl border border-amber-400/20 px-5 py-3.5 flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-gray-300">
                <span className="font-bold text-amber-300">{pendingIncoming}</span> claim{pendingIncoming === 1 ? "" : "s"} waiting
                — approve to pay out from your balance and rate the user.
              </span>
            </div>
          )}

          <div className="space-y-2.5">
            {incomingCards.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-2xl border border-white/5 p-4 hover:border-white/15 transition-all"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-sm font-bold shrink-0">
                    {s.name.slice(0, 1)}
                  </div>
                  <div className="min-w-[180px]">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {s.name} <span className="text-gray-500 font-mono text-xs">@{s.handle}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {s.platform}{s.mode === "referral" ? " · referral exchange" : ""} · submitted {s.submittedAt} · proof:{" "}
                      <span className="font-mono">{s.proof}</span>
                    </div>
                  </div>
                  <PlatformIcon platform={s.platform} size="sm" />
                  <div className="flex-1 min-w-[160px] text-xs text-gray-300">
                    {s.action} <span className="font-mono">{s.target}</span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-300 tabular shrink-0">+${s.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  <StatusBadge status={s.status} rated={s.rated} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.status === "pending" ? (
                    <>
                      <button
                        onClick={() => {
                          const res = approveSubmission(s.id);
                          if (!res.ok) {
                            addToast({ type: "warning", title: "Can't approve", description: res.error });
                            return;
                          }
                          // Monetag interstitial on "check" — then the rating dialog opens.
                          void (isPremium ? Promise.resolve() : showMonetagInterstitial()).then(() => openRate(s, s.handle, s.name, "user"));
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done — approve &amp; rate @{s.handle}
                      </button>
                      <button
                        onClick={() => {
                          setRejecting(s);
                          setReason("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/15 border border-rose-400/25 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  ) : s.status === "approved" ? (
                    s.rated ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-current" /> You rated @{s.handle} — thanks!
                      </span>
                    ) : (
                      <button
                        onClick={() => openRate(s, s.handle, s.name, "user")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500/15 border border-amber-400/25 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all"
                      >
                        <Star className="w-3.5 h-3.5" /> Rate @{s.handle}
                      </button>
                    )
                  ) : (
                    s.reason && (
                      <p className="text-xs text-rose-200/80 leading-snug">
                        <span className="font-semibold text-rose-300">Reason:</span> {s.reason}
                      </p>
                    )
                  )}
                  <ContactButton handle={s.handle} adId={s.postId ?? s.id} />
                  {/* Once rated, the claim is closed — reporting is no longer available. */}
                  {!s.rated && (
                    <button
                      onClick={() => setReport({ handle: s.handle, name: s.name })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-400/20 text-rose-300 text-xs font-bold hover:bg-rose-500/20 transition-all"
                    >
                      <Flag className="w-3.5 h-3.5" /> Report
                    </button>
                  )}
                  {isPremium && (
                    <button
                      onClick={() => setChatThread({ id: s.id, peer: s.handle })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-all"
                    >
                      <MessageSquareText className="w-3.5 h-3.5" /> Chat
                    </button>
                  )}
                </div>
                {s.mode === "referral" && (s.link || s.note) && (
                  <ReferralReveal link={s.link ?? ""} note={s.note} />
                )}
              </motion.div>
            ))}
            {incoming.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-gray-400">
                No claims submitted to your ads yet. Publish a campaign on the Promote page to start receiving leads.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2.5">
            {outgoing.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={clsx(
                  "glass rounded-2xl border p-4 hover:border-white/15 transition-all",
                  s.status === "approved" && !s.rated ? "border-emerald-400/30 bg-emerald-500/[0.04]" : "border-white/5"
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-sm font-bold shrink-0">
                    {s.poster.slice(0, 1)}
                  </div>
                  <div className="min-w-[180px]">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {s.poster} <span className="text-gray-500 font-mono text-xs">@{s.posterHandle}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {s.platform}{s.mode === "referral" ? " · referral exchange" : ""} · submitted {s.submittedAt} · proof:{" "}
                      <span className="font-mono">{s.proof}</span>
                    </div>
                  </div>
                  <PlatformIcon platform={s.platform} size="sm" />
                  <div className="flex-1 min-w-[160px] text-xs text-gray-300">
                    {s.action} <span className="font-mono">{s.target}</span>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-300 tabular shrink-0">+${s.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  <StatusBadge status={s.status} rated={s.rated} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.status === "approved" ? (
                    s.rated ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-semibold">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-current" /> You rated @{s.posterHandle} — thanks!
                      </span>
                    ) : (
                      <button
                        onClick={() => openRate(s, s.posterHandle, s.poster, "publisher")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done — rate @{s.posterHandle}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )
                  ) : s.status === "pending" ? (
                    <span className="text-[11px] text-gray-400 inline-flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5" /> Awaiting approval from @{s.posterHandle}
                    </span>
                  ) : (
                    s.reason && (
                      <p className="text-xs text-rose-200/80 leading-snug">
                        <span className="font-semibold text-rose-300">Reason:</span> {s.reason}
                      </p>
                    )
                  )}
                  <ContactButton handle={s.posterHandle ?? s.poster} adId={s.postId ?? s.id} />
                  {/* Once rated, the claim is closed — reporting is no longer available. */}
                  {!s.rated && (
                    <button
                      onClick={() => setReport({ handle: s.posterHandle ?? s.poster, name: s.poster })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-400/20 text-rose-300 text-xs font-bold hover:bg-rose-500/20 transition-all"
                    >
                      <Flag className="w-3.5 h-3.5" /> Report
                    </button>
                  )}
                  {isPremium && (
                    <button
                      onClick={() => setChatThread({ id: s.id, peer: s.posterHandle ?? s.poster })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-all"
                    >
                      <MessageSquareText className="w-3.5 h-3.5" /> Chat
                    </button>
                  )}
                </div>
                {s.mode === "referral" && (s.link || s.note) && (
                  <ReferralReveal link={s.link ?? ""} note={s.note} />
                )}
              </motion.div>
            ))}
            {outgoing.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-gray-400">
                You haven&apos;t submitted any claims yet. Start completing tasks on the Earn page.
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-center text-xs text-gray-500">
        Every time a claim is marked done, you&apos;re asked to rate the other side — keeping the marketplace honest.
      </p>

      {/* Reject dialog */}
      <AnimatePresence>
        {rejecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setRejecting(null)}
          >
            <motion.div
              initial={{ y: 24, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-md p-6 border border-white/10 shadow-card relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
              <div className="relative flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-400/25 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <div className="font-extrabold text-lg leading-tight">Reject claim</div>
                  <div className="text-xs text-gray-400 mt-1">
                    @{rejecting.handle} · {rejecting.platform} · +${rejecting.reward}
                  </div>
                </div>
              </div>

              <div className="relative mt-4 rounded-xl p-3 border border-white/10 bg-white/[0.02] text-xs text-gray-300">
                {rejecting.action} <span className="font-mono">{rejecting.target}</span> — proof:{" "}
                <span className="font-mono">{rejecting.proof}</span>
              </div>

              <div className="relative mt-4">
                <div className="text-[10px] uppercase tracking-widest text-rose-300 font-semibold mb-2">
                  Rejection reason (required — sent to the claimer)
                </div>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Screenshot does not show the follow — please retake it…"
                  className="w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm placeholder:text-gray-500 focus:outline-none focus:border-rose-400/50 focus:ring-1 focus:ring-rose-400/30 resize-none"
                />
              </div>

              <div className="relative mt-5 flex items-center gap-3">
                <button onClick={() => setRejecting(null)} className="btn-ghost flex-1">Cancel</button>
                <button
                  disabled={!reason.trim()}
                  onClick={confirmReject}
                  className="btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject with reason
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rate dialog */}
      <AnimatePresence>
        {rate && (
          <RateDialog
            title={`Rate @${rate.target}`}
            subtitle={
              rate.who === "user"
                ? `How was @${rate.target} as a claimer on your ad?`
                : `How was @${rate.target} as a publisher on ${rate.sub.platform}?`
            }
            onSubmit={(stars, comment) => rateSubmission(rate.sub.id, rate.target, stars, comment)}
            onClose={() => setRate(null)}
          />
        )}
      </AnimatePresence>

      {/* In-app chat (deal-closing, premium) */}
      <AnimatePresence>
        {chatThread && (
          <ChatModal threadId={chatThread.id} peer={chatThread.peer} onClose={() => setChatThread(null)} />
        )}
      </AnimatePresence>

      {/* Report user */}
      <AnimatePresence>
        {report && (
          <ReportDialog handle={report.handle} name={report.name} onClose={() => setReport(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
