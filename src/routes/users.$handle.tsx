
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Users, UserCheck, Clock, Ban, Megaphone, ArrowLeft } from "lucide-react";
import Link from "@/components/link";
import { getUser, PLATFORM_META } from "@/lib/mock-data";
import { useApp } from "@/lib/store";
import { showPageInterstitial } from "@/lib/monetag";
import UserAvatar from "@/components/user-avatar";
import VerifiedTick from "@/components/verified-tick";
import FollowButton from "@/components/follow-button";
import ReportDialog from "@/components/report-dialog";
import SubmissionStatus from "@/components/submission-status";
import PlatformIcon from "@/components/platform-icon";
import clsx from "clsx";

export default function UserPage({ params }: { params: { handle: string } }) {
  const handle = params.handle;
  const profile = getUser(handle);
  const { submissions, tasks, following, isPremiumUser, isBanned, handle: myHandle, isPremium: viewerIsPremium } = useApp();
  const isYou = handle === myHandle;
  const [tab, setTab] = useState<"submissions" | "ads">("submissions");
  const [report, setReport] = useState(false);

  // Rewarded interstitial when the user opens a profile page (rate-limited).
  useEffect(() => {
    if (!viewerIsPremium) void showPageInterstitial();
  }, [viewerIsPremium]);

  const userSubs = submissions.filter((s) => s.handle === handle);
  const userAds = tasks.filter((t) => t.posterHandle === handle);
  const premium = isPremiumUser(handle);
  const ban = isBanned(handle);
  const followerCount = profile.followers + (following.includes(handle) ? 1 : 0);

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to leads
      </Link>

      {/* Header card */}
      <div className="relative overflow-hidden glass-strong rounded-3xl border border-white/10 p-6 lg:p-8 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/10 via-transparent to-brand-violet/10 pointer-events-none" />
        {ban && (
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
        )}

        <div className="relative flex flex-wrap items-center gap-6">
          <UserAvatar name={profile.name} tier={profile.tier} size="xl" showBadge highlight={isYou} verified={premium} />

          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                {isYou ? "You" : profile.name}
              </h1>
              <VerifiedTick show={premium} className="w-5 h-5" />
              {isYou && (
                <span className="px-2 py-0.5 rounded-md bg-brand-cyan/15 border border-brand-cyan/30 text-[10px] font-bold text-cyan-300">
                  You
                </span>
              )}
              {ban && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-400/30 text-[10px] font-bold text-rose-300 flex items-center gap-1">
                  <Ban className="w-3 h-3" /> Suspended
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400 font-mono mt-0.5">@{handle}</div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                <span className="font-bold text-gray-200">{profile.rating.toFixed(1)}</span>
                <span className="text-gray-500">({profile.ratingCount.toLocaleString()} ratings)</span>
              </span>
              <span className="text-emerald-300 font-semibold">{profile.successRate}% followers kept</span>
              <span className="text-gray-400">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-bold tabular">{followerCount.toLocaleString()}</span> followers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-bold tabular">{profile.following.toLocaleString()}</span> following
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-bold tabular">{profile.tasksDone}</span> tasks done
              </span>
            </div>

            {ban && (
              <div className="mt-3 rounded-xl p-3 border border-rose-400/25 bg-rose-500/10 text-xs text-rose-200">
                @{handle} is currently suspended ({ban.reason}). Their ads are still visible but publishing is disabled.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <FollowButton handle={handle} />
            {!isYou && (
              <button
                onClick={() => setReport(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/25 text-rose-300 text-xs font-semibold transition-all"
              >
                <Ban className="w-3.5 h-3.5" /> Report
              </button>
            )}
          </div>
        </div>

        {premium && !ban && (
          <div className="relative mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-400/25 text-[11px] text-violet-200 font-semibold">
            <VerifiedTick show className="w-3.5 h-3.5" /> Premium member — blue tick verified
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab("submissions")} className={clsx("chip", tab === "submissions" ? "chip-active" : "text-gray-400 hover:text-white")}>
          Submissions ({userSubs.length})
        </button>
        <button onClick={() => setTab("ads")} className={clsx("chip", tab === "ads" ? "chip-active" : "text-gray-400 hover:text-white")}>
          Published ads ({userAds.length})
        </button>
      </div>

      {tab === "submissions" ? (
        <div className="space-y-2.5">
          {userSubs.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-2xl border border-white/5 p-4 hover:border-white/15 transition-all"
            >
              <div className="flex flex-wrap items-center gap-3">
                <PlatformIcon platform={s.platform} size="sm" />
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-semibold">
                    {s.action} <span className="font-mono text-gray-300">{s.target}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {s.platform} · submitted {s.submittedAt} · proof: {s.proof} · ad by {s.poster}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-extrabold text-emerald-300 tabular">
                    +${s.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </span>
                  <SubmissionStatus status={s.status} reason={s.reason} />
                </div>
              </div>
            </motion.div>
          ))}
          {userSubs.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-gray-400">
              @{handle} hasn't submitted any claims yet.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userAds.map((t, i) => {
            const meta = PLATFORM_META[t.platform];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-2xl border border-white/5 p-4 hover:border-white/15 transition-all"
              >
                <div className="flex items-start gap-3">
                  <PlatformIcon platform={t.platform} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500">
                      {t.platform} · {t.action} {t.mode === "referral" && <span className="text-amber-300">· Referral exchange</span>}
                    </div>
                    <div className="font-bold text-sm mt-1 leading-snug line-clamp-2">{t.title}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{t.target}</div>
                  </div>
                  <span className="font-extrabold text-emerald-300 tabular shrink-0">+${t.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="tabular">{t.completions}/{t.limit} completed</span>
                  <span className="inline-flex items-center gap-1"><Megaphone className="w-3 h-3" /> posted {t.minutesAgo}m ago</span>
                </div>
              </motion.div>
            );
          })}
          {userAds.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-gray-400 col-span-full">
              @{handle} hasn't published any ads yet.
            </div>
          )}
        </div>
      )}

      {report && <ReportDialog handle={handle} name={profile.name} onClose={() => setReport(false)} />}
    </div>
  );
}
