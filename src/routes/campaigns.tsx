
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Pause, Play, CheckCircle2, XCircle, Gift, Star, Clock, Users, BadgeCheck, Hash, Trash2, Send, Link2, ShieldAlert } from "lucide-react";
import { PLATFORM_META, getUser } from "@/lib/mock-data";
import { useApp, planLimits } from "@/lib/store";
import { showPageInterstitial } from "@/lib/monetag";
import type { Campaign, Submission } from "@/lib/types";
import PlatformIcon from "@/components/platform-icon";
import SubmissionStatus from "@/components/submission-status";
import VerifiedTick from "@/components/verified-tick";
import clsx from "clsx";

const STATUS_STYLE = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
  paused: "bg-amber-500/15 text-amber-300 border-amber-400/25",
  completed: "bg-sky-500/15 text-sky-300 border-sky-400/25",
} as const;

export default function Campaigns() {
  const { campaigns, submissions, setCampaignStatus, deleteAd, approveSubmission, rejectSubmission, addToast, daily, isPremium, premiumPlanId, handle, refreshSubmissions } = useApp();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Rewarded interstitial when the user opens the Campaigns page (rate-limited).
  useEffect(() => {
    if (!isPremium) void showPageInterstitial();
    // Pull the latest submissions from the DB so new claims reach the
    // publisher immediately (bypasses the 15-min marketplace cache).
    void refreshSubmissions();
  }, [refreshSubmissions]);

  const limits = planLimits(isPremium, premiumPlanId);
  const mine = campaigns.filter((c) => c.posterHandle === handle);
  // Admin-banned ads are hidden from user-facing lists (the admin panel sees them).
  const list = tab === "mine" ? mine : campaigns.filter((c) => !c.banned);

  const approve = (id: string) => {
    const res = approveSubmission(id);
    if (!res.ok) addToast({ type: "warning", title: "Can't approve", description: res.error });
  };

  const pendingForYou = useMemo(
    () => submissions.filter((s) => s.posterHandle === handle && s.status === "pending"),
    [submissions, handle]
  );

  /** One-tap Contact: opens the claimer's Telegram with a pre-filled verify message. */
  const tgContactUrl = (s: Submission) => {
    const raw = (getUser(s.handle).tg || s.handle).replace(/^@/, "");
    // "tg-<id>" is a DB identity fallback, not a Telegram username — no link.
    const tg = /^tg-\d+$/i.test(raw) ? "" : raw;
    if (!tg) return "";
    const msg = `Hi! Regarding ad ${s.postId ?? s.id} — please verify my submission. Thank you!`;
    return `https://t.me/${tg}?text=${encodeURIComponent(msg)}`;
  };

  const confirmReject = () => {
    if (!rejecting || !reason.trim()) return;
    rejectSubmission(rejecting.id, reason.trim());
    setRejecting(null);
    setReason("");
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
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
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-brand-cyan/10 pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-widest text-emerald-300 font-semibold">
              <ClipboardList className="w-3 h-3" /> Campaigns
            </div>
            <h1 className="mt-4 text-3xl lg:text-4xl font-extrabold tracking-tight">
              Track your <span className="gradient-text">Ad Performance</span>
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              {mine.length} active campaigns · {pendingForYou.length} claims waiting for review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("mine")} className={clsx("chip", tab === "mine" ? "chip-active" : "text-gray-400 hover:text-white")}>
              My ads ({mine.length})
            </button>
            <button onClick={() => setTab("all")} className={clsx("chip", tab === "all" ? "chip-active" : "text-gray-400 hover:text-white")}>
              All campaigns
            </button>
          </div>
        </div>
      </div>

      {/* Pending review */}
      {pendingForYou.length > 0 && (
        <div className="glass rounded-3xl border border-amber-400/20 p-6">
          <div className="flex items-center justify-between">
            <div className="font-extrabold">Claims waiting for your review</div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-[11px] font-bold text-amber-300">
              {pendingForYou.length} pending
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingForYou.map((s) => (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-xs font-bold">
                    {s.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] text-gray-500">@{s.handle} · {s.platform}</div>
                  </div>
                  <span className="ml-auto text-xs font-extrabold text-emerald-300 tabular">+${s.reward}</span>
                </div>
                <div className="mt-2.5 text-xs text-gray-300 leading-relaxed">
                  {s.action} <span className="font-mono">{s.target}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-gray-500">
                  {s.mode === "referral" ? "Referral proof" : "Proof"}: <span className="font-mono">{s.proof}</span> · {s.submittedAt}
                </div>
                {s.mode === "referral" && (s.link || s.note) && (
                  <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2">
                    {s.link && (
                      <a
                        href={s.link.startsWith("http") ? s.link : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-1.5 font-mono text-[11px] text-cyan-200 break-all hover:underline"
                      >
                        <Link2 className="w-3 h-3 shrink-0 mt-0.5" /> {s.link}
                      </a>
                    )}
                    {s.note && <p className="mt-1 text-[11px] text-gray-300 leading-relaxed">{s.note}</p>}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {tgContactUrl(s) ? (
                    <a
                      href={tgContactUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-400/25 text-sky-300 text-xs font-bold hover:bg-sky-500/25 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" /> Contact
                    </a>
                  ) : null}
                  <button
                    onClick={() => approve(s.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(s);
                      setReason("");
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-400/25 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((c, i) => {
          const meta = PLATFORM_META[c.platform];
          const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
          const done = Math.min(100, Math.round((c.completions / c.quantity) * 100));
          const poster = getUser(c.posterHandle);
          const isMine = c.posterHandle === handle;
          const autoDisabled = !!c.disabledUntil && c.disabledUntil > Date.now();
          const disableDays = autoDisabled ? Math.max(1, Math.ceil(((c.disabledUntil ?? 0) - Date.now()) / 86_400_000)) : 0;
          const leadsToday = daily.leadsOutPerPost[c.id.replace(/^c-/, "")] ?? 0;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative overflow-hidden glass rounded-2xl p-5 border border-white/5 hover:border-white/15 transition-all"
            >
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: meta.hex }} />
              <div className="relative flex items-start gap-3">
                <PlatformIcon platform={c.platform} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                      {c.platform} · {c.action}
                    </span>
                    {c.mode === "referral" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/20 text-[10px] font-bold">
                        <Gift className="w-3 h-3" /> Referral exchange
                      </span>
                    )}
                    <span className={clsx("px-1.5 py-0.5 rounded-md border text-[10px] font-bold", STATUS_STYLE[c.status])}>
                      {c.status}
                    </span>
                  </div>
                  <div className="font-bold mt-1.5 leading-snug line-clamp-2">{c.title}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{c.target}</div>
                  {c.postId && <div className="text-[10px] font-mono text-gray-600 mt-1">ID {c.postId}</div>}
                  {(c.tags ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.tags!.slice(0, 4).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-gray-400">
                          <Hash className="w-2.5 h-2.5" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Poster meta */}
              <div className="relative mt-3.5 flex items-center justify-between gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {c.poster.slice(0, 1)}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="text-xs font-semibold truncate flex items-center gap-1">
                      {c.poster}
                      <VerifiedTick show={!!c.verified || poster.isPremium} className="w-3 h-3" />
                    </div>
                    <div className="text-[10px] text-gray-500 inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-current" />
                        <span className="tabular">{c.rating?.toFixed(1)}</span>
                      </span>
                      <span className="text-emerald-400/80 font-semibold">{c.successRate}% kept</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs font-extrabold gradient-text tabular">${c.reward}</span>
              </div>

              {/* Numbers */}
              <div className="relative mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl p-2.5 bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Reward</div>
                  <div className="font-bold text-sm tabular text-emerald-300">${c.reward.toFixed(2)}</div>
                </div>
                <div className="rounded-xl p-2.5 bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Completions</div>
                  <div className="font-bold text-sm tabular">{c.completions}/{c.quantity}</div>
                </div>
                <div className="rounded-xl p-2.5 bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Spent</div>
                  <div className="font-bold text-sm tabular">{pct}%</div>
                </div>
              </div>

              <div className="relative mt-3">
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-500 tabular">
                  <span>${c.spent.toLocaleString()} spent</span>
                  <span>${c.budget.toLocaleString()} max budget</span>
                </div>
              </div>

              {/* Daily lead cap progress for this post */}
              <div className="relative mt-2.5 rounded-xl p-2.5 border border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>
                    Leads today: <span className="font-bold text-cyan-300 tabular">{leadsToday}/{limits.leadsPerPostPerDay}</span>
                  </span>
                  <span className="text-gray-600">cap → pause 1 week</span>
                </div>
                <div className="mt-1.5 progress-track !h-1.5">
                  <div
                    className={clsx("h-full rounded-full", leadsToday >= limits.leadsPerPostPerDay ? "bg-amber-400" : "bg-gradient-to-r from-amber-400 to-orange-500")}
                    style={{ width: `${Math.min(100, (leadsToday / limits.leadsPerPostPerDay) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="relative mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {c.approvers} approvers</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {c.createdDaysAgo}d ago</span>
                </div>
                {isMine && c.status !== "completed" &&
                  (autoDisabled ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                      <Pause className="w-3 h-3" /> Auto-disabled · {disableDays}d left
                    </span>
                  ) : (
                    <div className="flex gap-1.5">
                      {c.status === "active" ? (
                        <button
                          onClick={() => setCampaignStatus(c.id, "paused")}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 border border-white/10 text-[11px] font-semibold transition-all"
                        >
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => setCampaignStatus(c.id, "active")}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 border border-white/10 text-[11px] font-semibold transition-all"
                        >
                          <Play className="w-3 h-3" /> Resume
                        </button>
                      )}
                      <button
                        onClick={() => setCampaignStatus(c.id, "completed")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20 text-[11px] font-semibold text-emerald-300 transition-all"
                      >
                        <BadgeCheck className="w-3 h-3" /> Finish
                      </button>
                      <button
                        onClick={() => {
                          if (confirmDel === c.id) {
                            deleteAd(c.id);
                            setConfirmDel(null);
                          } else {
                            setConfirmDel(c.id);
                            setTimeout(() => setConfirmDel((x) => (x === c.id ? null : x)), 3000);
                          }
                        }}
                        title="Delete this ad permanently"
                        className={clsx(
                          "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all",
                          confirmDel === c.id
                            ? "bg-rose-500/20 border-rose-400/40 text-rose-200"
                            : "bg-white/[0.05] hover:bg-rose-500/10 border-white/10 text-gray-400 hover:text-rose-300"
                        )}
                      >
                        <Trash2 className="w-3 h-3" /> {confirmDel === c.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-gray-400">
          {tab === "mine"
            ? "You haven't published any ads yet. Head to Promote to launch your first campaign."
            : "No campaigns found."}
        </div>
      )}

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
                {rejecting.mode === "referral" && (rejecting.link || rejecting.note) && (
                  <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2.5 py-2">
                    {rejecting.link && (
                      <div className="font-mono text-cyan-200 break-all">
                        <span className="text-amber-300 font-semibold">Link:</span> {rejecting.link}
                      </div>
                    )}
                    {rejecting.note && (
                      <div className="mt-1 text-gray-300">
                        <span className="text-amber-300 font-semibold">Description:</span> {rejecting.note}
                      </div>
                    )}
                  </div>
                )}
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
    </div>
  );
}
