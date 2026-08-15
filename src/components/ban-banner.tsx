
import { Ban, ShieldAlert, Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { isPermanentBan } from "@/lib/ban";

/**
 * Suspension banner. Banned users can appeal ("request a review") — the appeal
 * lands in the admin panel's Review requests tab and, when approved, the ban is
 * lifted immediately.
 */
export default function BanBanner() {
  const { activeBan, requestReview, reviewRequests } = useApp();
  const ban = activeBan();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  if (!ban) return null;

  const permanent = isPermanentBan(ban.until);
  const ms = Math.max(0, ban.until - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const remaining =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const myPending = reviewRequests.find((r) => r.status === "pending");
  const myApproved = reviewRequests.find((r) => r.status === "approved");

  const submit = () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = requestReview(text.trim());
    setSending(false);
    if (r.ok) {
      setText("");
      setOpen(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/20 via-rose-500/5 to-transparent p-4 flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center">
        <Ban className="w-5 h-5 text-rose-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-rose-200 flex items-center gap-2">
          {permanent ? "Account permanently banned" : "Account suspended"} <ShieldAlert className="w-4 h-4" />
        </div>
        <p className="text-sm text-rose-200/70 mt-1 leading-relaxed">
          {permanent ? (
            <>Your account is permanently banned for repeated misbehavior. Reason: {ban.reason}.</>
          ) : (
            <>
              Your account is suspended for{" "}
              <span className="font-bold text-rose-200">{remaining}</span>. Reason: {ban.reason}.
            </>
          )}
        </p>
        <p className="text-[11px] text-rose-200/50 mt-1">
          You can still browse the marketplace, but publishing, claiming and wallet actions are
          disabled until the suspension ends or an appeal is approved.
        </p>

        {myApproved ? (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/25 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4" /> Appeal approved — your ban was lifted
          </div>
        ) : myPending ? (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-400/25 rounded-lg px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Appeal under review — the admin will respond soon
          </div>
        ) : (
          <div className="mt-3">
            {!open && (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all"
              >
                <Send className="w-3.5 h-3.5" /> Appeal — request a review
              </button>
            )}
            {open && (
              <div className="mt-2 max-w-lg">
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Why should your ban be lifted? e.g. It was a misunderstanding — I kept every follower…"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-sm placeholder:text-gray-500 focus:outline-none focus:border-rose-400/50 focus:ring-1 focus:ring-rose-400/30 resize-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={submit}
                    disabled={!text.trim() || sending}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-rose-500/80 text-white hover:bg-rose-500 transition-all disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Submit for review
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
                <p className="text-[11px] text-rose-200/50 mt-1.5">
                  Approved appeals lift the ban immediately. The admin reviews every request.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
