
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { X, ExternalLink, Send, Clock, ShieldAlert, CheckCircle2, Image as ImgIcon, Gift, Star, Link2 } from "lucide-react";
import { type Task, PLATFORM_META, getUser } from "@/lib/mock-data";
import PlatformIcon from "./platform-icon";
import FollowButton from "./follow-button";
import { useApp } from "@/lib/store";
import { isTelegramWebApp } from "@/lib/supabase";
import clsx from "clsx";

export default function TaskModal({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const { submitClaim, isPremium } = useApp();
  const inTelegram = isTelegramWebApp();
  const [timer, setTimer] = useState(600);
  const [proof, setProof] = useState<{ file?: string; handle?: string; note?: string; link?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTimer(600);
    // Proof = the user's Telegram username (e.g. @URexfrnd), pre-filled from
    // the Mini App session so no Telegram ID is ever used as proof.
    let tgHandle = "";
    try {
      const w = window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { user?: { username?: string } } } };
      };
      const u = w.Telegram?.WebApp?.initDataUnsafe?.user;
      if (u && typeof u.username === "string" && u.username) tgHandle = `@${u.username}`;
    } catch {
      /* noop */
    }
    setProof({ handle: tgHandle });
    setSubmitted(false);
    const t = setInterval(() => {
      setTimer((x) => (x > 0 ? x - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [task]);

  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");
  const meta = task ? PLATFORM_META[task.platform] : null;
  const targetHandle = task?.target ?? "";
  const handle = targetHandle.replace(/^@/, "");
  // The URL the advertiser entered wins — redirect there directly instead of
  // building a deep-link / search fallback (only non-URL targets get one).
  const isUrlTarget = /^https?:\/\//i.test(targetHandle);
  const deepLink = isUrlTarget
    ? targetHandle
    : !task
    ? ""
    : task.platform === "Instagram"
      ? `instagram://user?username=${handle}`
      : task.platform === "Telegram"
      ? `tg://resolve?domain=${handle}`
      : task.platform === "YouTube"
      ? `https://www.youtube.com/${targetHandle}`
      : task.platform === "Twitter"
      ? `twitter://user?screen_name=${handle}`
      : `https://www.tiktok.com/${targetHandle}`;

  const expired = timer === 0;
  const isReferral = task?.mode === "referral";
  const canSubmit =
    (((proof.handle && proof.handle.length > 1) || (isReferral && proof.note && proof.note.length > 2 && proof.link && proof.link.length > 4)) &&
      !submitted &&
      !expired);

  const poster = task?.posterHandle ? getUser(task.posterHandle) : null;
  // Screenshots go straight to the advertiser's Telegram — they verify there.
  // profiles.tg holds the advertiser's REAL Telegram username; "tg-<id>" is a
  // DB identity fallback and is NOT a valid t.me username — never link to it.
  const rawTg = (poster?.tg || "").replace(/^@/, "");
  const posterTg = /^tg-\d+$/i.test(rawTg) ? "" : rawTg;
  const proofMsg = task
    ? `Hi! I just completed your PromoPulse task "${task.title}" (${task.action} ${task.target}) — here is my proof screenshot.`
    : "";

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl w-full max-w-lg p-6 border border-white/10 shadow-card relative overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-thin"
            style={{ background: "linear-gradient(180deg, #131A29 0%, #0E1422 100%)" }}
          >
            {/* Glow accents */}
            <div
              className="absolute -top-24 -right-16 w-60 h-60 rounded-full blur-3xl opacity-40 pointer-events-none"
              style={{ background: meta?.hex }}
            />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative flex items-start gap-4">
              <PlatformIcon platform={task.platform} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                    {task.platform} · {task.action}
                  </span>
                  {isReferral && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/25 text-[10px] font-bold">
                      <Gift className="w-3 h-3" /> Referral exchange
                    </span>
                  )}
                </div>
                <div className="font-bold text-lg mt-1 leading-snug">
                  {task.title}
                </div>
                <div className="text-sm text-gray-400 mt-0.5 font-mono">
                  {task.target}
                </div>
              </div>
            </div>

            {/* Poster meta */}
            {poster && task.posterHandle && (
              <div className="relative mt-4 flex items-center justify-between gap-3 rounded-2xl glass border border-white/5 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                    {task.poster.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{task.poster}</div>
                    <div className="text-[11px] text-gray-400 inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        {task.rating?.toFixed(1) ?? "4.5"} ({task.ratingCount ?? 0})
                      </span>
                      <span className="text-emerald-300 font-semibold">
                        {task.successRate ?? 90}% followers kept
                      </span>
                    </div>
                  </div>
                </div>
                <FollowButton handle={task.posterHandle} size="sm" />
              </div>
            )}

            {/* Reward + Timer */}
            <div className="relative mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent border border-emerald-400/20">
                <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">
                  Reward
                </div>
                <div className="font-extrabold text-2xl tabular text-emerald-300 mt-1">
                  +${task.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-gray-400">USDT</div>
              </div>
              <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-500/20 via-violet-500/5 to-transparent border border-violet-400/20">
                <div className="text-[10px] uppercase tracking-widest text-violet-300/80 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time Left
                </div>
                <div
                  className="font-extrabold text-2xl tabular mt-1"
                  style={{ color: expired ? "#EF4444" : "#DDD6FE" }}
                >
                  {expired ? "00:00" : `${mm}:${ss}`}
                </div>
                <div className="text-[11px] text-gray-400">
                  {expired ? (
                    <span className="text-rose-300 font-semibold">
                      Expired — close &amp; try another
                    </span>
                  ) : timer < 60 ? (
                    "Hurry!"
                  ) : (
                    "Complete in"
                  )}
                </div>
              </div>
            </div>

            {/* Instructions + Deep Link */}
            <div className="relative mt-5 rounded-2xl p-4 glass border border-white/5">
              <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-semibold mb-2">
                Instructions
              </div>
              {isReferral ? (
                <div className="rounded-xl p-3 border border-amber-400/20 bg-amber-500/[0.06] text-sm text-gray-200 leading-relaxed">
                  <span className="font-bold text-amber-300">Referral task:</span> {task.instructions}
                </div>
              ) : (
                <ol className="text-sm text-gray-300 space-y-1.5 list-decimal pl-4">
                  <li>
                    {task.action} <span className="font-mono text-white">{task.target}</span>{" "}
                    on {task.platform}.
                  </li>
                  <li>
                    Do not unfollow / unsubscribe for at least{" "}
                    <span className="text-semantic-warning font-semibold">7 days</span>.
                  </li>
                  <li>
                    {inTelegram ? "Take a screenshot and send it to the advertiser on Telegram as proof." : "Complete the action, then enter a short proof note or the handle/link you used below."}
                  </li>
                </ol>
              )}
              <a
                href={deepLink}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-violet text-white font-semibold text-sm shadow-glow hover:shadow-glow-violet transition-all"
              >
                Open {task.platform} App
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Anti-unfollow warning — referral exchanges have no follow/unfollow,
                so the penalty (and its $-amount) is meaningless for them. */}
            {!isReferral && (
              <div className="relative mt-4 rounded-xl p-3 border border-semantic-warning/30 bg-gradient-to-br from-semantic-warning/15 to-transparent flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-semantic-warning shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300 leading-relaxed">
                  <span className="font-bold text-semantic-warning">
                    Anti-unfollow penalty:
                  </span>{" "}
                  Unfollowing within 7 days triggers account suspension and a
                  <span className="text-semantic-danger font-bold"> −${(task.reward * 2).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>{" "}
                  USDT deduction.
                </div>
              </div>
            )}

            {/* Stay-in-app safety warning */}
            <div className="relative mt-4 rounded-xl p-3 border border-rose-400/25 bg-gradient-to-br from-rose-500/10 to-transparent flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-300 leading-relaxed">
                <span className="font-bold text-rose-300">Stay inside the app.</span> Never move chats to
                Telegram / WhatsApp — PromoPulse is <span className="font-bold text-white">not responsible</span> for
                any loss outside the app.
                {!isPremium && (
                  <>
                    {" "}
                    <a
                      href="/profile"
                      className="font-bold text-violet-300 underline decoration-violet-400/40 underline-offset-2 hover:text-violet-200"
                    >
                      Go Premium for secure in-app chat
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Proof input */}
            <div className="relative mt-5">
              <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-semibold mb-2">
                {isReferral ? "Proof of Referral" : "Submit Proof"}
              </div>

              {inTelegram && posterTg ? (
                <a
                  href={`https://t.me/${posterTg}?text=${encodeURIComponent(proofMsg)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-2xl py-3 px-4 bg-sky-500/15 border border-sky-400/30 text-sky-300 text-sm font-bold hover:bg-sky-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send screenshot to @{posterTg}
                </a>
              ) : (
                <div className="rounded-2xl py-3 px-4 bg-cyan-500/10 border border-cyan-400/25 text-xs text-cyan-200/80 flex items-start gap-2">
                  <Send className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {inTelegram ? "No advertiser Telegram on file — submit your proof below and follow up through Leads → Contact." : "Browser account: submit proof directly in PromoPulse. No Telegram account is required."}
                  </span>
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-500 flex items-start gap-1.5">
                <Send className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {inTelegram ? "Screenshots can be shared with the advertiser on Telegram, then verified here in the app." : "Your proof is sent to the advertiser in-app for review."}
              </p>

              {isReferral ? (
                <>
                  <div className="mt-3 relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      value={proof.link ?? ""}
                      onChange={(e) => setProof((p) => ({ ...p, link: e.target.value }))}
                      placeholder="Your referral link (e.g. https://t.me/yourname or @yourhandle)"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/30 font-mono"
                    />
                  </div>
                  <div className="mt-3 relative">
                    <textarea
                      rows={2}
                      value={proof.note ?? ""}
                      onChange={(e) => setProof((p) => ({ ...p, note: e.target.value }))}
                      placeholder="Describe how you completed the referral (e.g. joined with code CA7X)…"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30 resize-none"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-amber-200/70 flex items-start gap-1.5">
                    <Gift className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Your link &amp; description are shown to the ad owner so they can verify your referral.
                  </p>
                </>
              ) : (
                <div className="mt-3 relative">
                  <ImgIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    placeholder={inTelegram ? "Your @handle used for this task" : "Proof note, handle, or link used for this task"}
                    value={proof.handle ?? ""}
                    onChange={(e) => setProof((p) => ({ ...p, handle: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30"
                  />
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="relative mt-6 flex items-center gap-3">
              <button
                onClick={onClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                disabled={!canSubmit}
                onClick={() => {
                  setSubmitted(true);
                  setTimeout(() => {
                    // Referral: the description (proof.note) is the proof the
                    // owner reads — never substitute the pre-filled @handle.
                    submitClaim(
                      task.id,
                      isReferral ? proof.note || proof.handle || "" : proof.handle || proof.note || "",
                      isReferral ? proof.note || "" : proof.handle || "",
                      proof.link
                    );
                    onClose();
                  }, 700);
                }}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Submitted
                  </>
                ) : (
                  <>
                    Submit Claim · +${task.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
