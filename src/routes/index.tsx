
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Sparkles, Flame, Clock, BadgeCheck, Users, ArrowUpRight, Star, Heart, Rocket, Hash, X, Loader2 } from "lucide-react";
import { type Platform, type Task, PLATFORM_META, getUser, INTEREST_TAGS } from "@/lib/mock-data";
import { useApp } from "@/lib/store";
import { showMonetagInterstitial, showPageInterstitial } from "@/lib/monetag";
import PlatformIcon from "@/components/platform-icon";
import TaskModal from "@/components/task-modal";
import AdEarnCard from "@/components/ad-earn-card";
import BanBanner from "@/components/ban-banner";
import ReferralBanner from "@/components/referral-banner";
import FollowButton from "@/components/follow-button";
import VerifiedTick from "@/components/verified-tick";
import clsx from "clsx";

const FILTERS: { id: "All" | Platform; label: string }[] = [
  { id: "All", label: "All Tasks" },
  { id: "Instagram", label: "Instagram" },
  { id: "Telegram", label: "Telegram" },
  { id: "YouTube", label: "YouTube" },
  { id: "Twitter", label: "Twitter/X" },
  { id: "TikTok", label: "TikTok" },
  { id: "Play Store", label: "Play Store" },
  { id: "App Store", label: "App Store" },
  { id: "Browser", label: "Browser" },
];

function isBoostedNow(t: Task): boolean {
  return !!t.boosted && !!t.boostUntil && t.boostUntil > Date.now();
}

const SORTS = [
  { id: "reward", label: "Highest Reward", icon: Sparkles },
  { id: "fastest", label: "Fastest Approval", icon: Flame },
  { id: "newest", label: "Newest", icon: Clock },
] as const;

export default function EarnTasks() {
  const [filter, setFilter] = useState<"All" | Platform>("All");
  const [sort, setSort] = useState<typeof SORTS[number]["id"]>("reward");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Task | null>(null);
  const storeTasks = useApp((s) => s.tasks);
  const submissions = useApp((s) => s.submissions);
  const myHandle = useApp((s) => s.handle);
  const isPremium = useApp((s) => s.isPremium);
  const liked = useApp((s) => s.liked);
  const toggleLike = useApp((s) => s.toggleLike);
  const boostTask = useApp((s) => s.boostTask);
  const addToast = useApp((s) => s.addToast);
  const interests = useApp((s) => s.interests);
  const addInterest = useApp((s) => s.addInterest);
  const removeInterest = useApp((s) => s.removeInterest);
  const [interestInput, setInterestInput] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  // Rewarded interstitial when the user opens the Earn page (rate-limited).
  useEffect(() => {
    if (!isPremium) void showPageInterstitial();
  }, [isPremium]);

  const tasks = useMemo(() => {
    let list = storeTasks.slice();
    // Ads auto-disabled (daily lead cap reached) are hidden for one week.
    list = list.filter((t) => !(t.disabledUntil && t.disabledUntil > Date.now()));
    // Admin-banned ads are hidden from the marketplace.
    list = list.filter((t) => !t.banned);
    // Tasks the user already claimed (completed) never reappear on the feed.
    const claimed = new Set(submissions.filter((s) => s.handle === myHandle && s.taskId).map((s) => s.taskId));
    if (claimed.size) list = list.filter((t) => !claimed.has(t.id));
    if (filter !== "All") list = list.filter((t) => t.platform === filter);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.target.toLowerCase().includes(s) ||
          t.platform.toLowerCase().includes(s) ||
          (t.posterHandle ?? "").toLowerCase().includes(s) ||
          (t.postId ?? "").toLowerCase().includes(s) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(s))
      );
    }
    // Rank: boosted → tag-match vs my interests → chosen sort.
    const overlap = (t: Task) => (t.tags ?? []).filter((tag) => interests.includes(tag)).length;
    list.sort((a, b) => {
      const boostDiff = (isBoostedNow(b) ? 1 : 0) - (isBoostedNow(a) ? 1 : 0);
      if (boostDiff) return boostDiff;
      const matchDiff = overlap(b) - overlap(a);
      if (matchDiff) return matchDiff;
      if (sort === "reward") return b.reward - a.reward;
      // Fastest approval: verified brand accounts get top priority, then by reward desc
      if (sort === "fastest") {
        if ((a.verified ?? false) !== (b.verified ?? false)) return a.verified ? -1 : 1;
        return b.reward - a.reward;
      }
      if (sort === "newest") return a.minutesAgo - b.minutesAgo;
      return 0;
    });
    return list;
  }, [filter, sort, q, storeTasks, interests, submissions, myHandle]);

  /**
   * "Start Task" unlocks behind a Monetag rewarded interstitial (routed
   * through the centralized showRewardedAd): the user watches the ad, and on
   * completion the task modal opens. If the ad fails / has no fill, the task
   * still opens (graceful degradation — never blocks earning).
   */
  async function openTask(t: Task) {
    if (startingId) return; // an ad is already playing for another task
    setStartingId(t.id);
    try {
      if (!isPremium) await showMonetagInterstitial();
    } finally {
      setStartingId(null);
    }
    setActive(t);
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <BanBanner />

      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-3xl glass-strong border border-white/10 p-6 lg:p-8 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/15 via-transparent to-brand-violet/15 pointer-events-none" />
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-brand-violet/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-cyan/20 blur-3xl pointer-events-none" />

        <div className="relative grid lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-widest text-cyan-300 font-semibold">
              <Flame className="w-3 h-3" />
              Marketplace · Live
              <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                362 earners online
              </span>
            </div>
            <h1 className="mt-4 text-3xl lg:text-4xl font-extrabold tracking-tight">
              Earn <span className="gradient-text">USDT</span> by Promoting Real People
            </h1>
            <p className="mt-3 text-gray-400 max-w-2xl">
              Complete social tasks — follow, join, retweet, like — and get
              USDT paid to your wallet after the publisher approves. Every claim goes
              through reviewer approval with screenshot proof.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button className="btn-primary">Start Earning</button>
              <button className="btn-ghost">Browse by Platform</button>
            </div>
          </div>

          {/* Stats panel — platform growth numbers */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            <Stat icon={<BadgeCheck className="w-4 h-4" />} label="Leads done" value="1k+" suffix="successful leads" tone="cyan" />
            <Stat icon={<Sparkles className="w-4 h-4" />} label="Posts published" value="397" suffix="campaigns" tone="violet" />
            <Stat icon={<Users className="w-4 h-4" />} label="USDT generated" value="$3,467" suffix="paid to earners" tone="emerald" />
          </div>
        </div>
      </div>

      {/* Referral program banner */}
      <ReferralBanner />

      {/* Feed interests — tag-based matching */}
      <div className="glass rounded-2xl border border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[11px] font-bold text-gray-300 inline-flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-cyan-300" /> My feed:
          </span>
          {interests.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-brand-cyan/25 to-brand-violet/25 border border-brand-cyan/30 text-[11px] font-bold text-cyan-200"
            >
              #{t}
              <button onClick={() => removeInterest(t)} className="hover:text-rose-300 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {interests.length === 0 && (
            <span className="text-[11px] text-gray-500">Add interests — matching ads rank higher here &amp; in search.</span>
          )}
          <input
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInterest(interestInput);
                setInterestInput("");
              }
            }}
            placeholder="+ add interest"
            className="w-28 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs placeholder:text-gray-600 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30"
          />
          <div className="flex flex-wrap gap-1">
            {INTEREST_TAGS.filter((t) => !interests.includes(t))
              .slice(0, 6)
              .map((t) => (
                <button
                  key={t}
                  onClick={() => addInterest(t)}
                  className="text-[10px] px-2 py-1 rounded-md bg-white/[0.03] border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-colors"
                >
                  + {t}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Watch a rewarded ad → +1 page credit (gated pages cost 1 credit each) */}
      <AdEarnCard />

      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "chip whitespace-nowrap flex items-center gap-1.5",
                filter === f.id ? "chip-active" : "text-gray-400 hover:text-white"
              )}
            >
              {f.id !== "All" && <PlatformIcon platform={f.id} size="sm" className="!w-5 !h-5 !rounded-md" />}
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, @handles, keywords..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/30"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="appearance-none pl-4 pr-9 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-sm focus:outline-none focus:border-brand-cyan/40"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id} className="bg-bg-card">
                  {s.label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tasks.map((t, i) => {
          const meta = PLATFORM_META[t.platform];
          const pct = Math.min(100, Math.round((t.completions / t.limit) * 100));
          const poster = t.posterHandle ? getUser(t.posterHandle) : null;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => void openTask(t)}
              className={clsx(
                "group text-left relative glass rounded-2xl p-5 border transition-all hover:-translate-y-0.5 hover:shadow-glow overflow-hidden cursor-pointer",
                isBoostedNow(t) ? "border-violet-400/40 shadow-glow" : "border-white/5 hover:border-white/15"
              )}
            >
              <div
                className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none"
                style={{ background: meta.hex }}
              />
              <div className="flex items-start gap-3">
                <PlatformIcon platform={t.platform} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                      {t.platform} · {t.action}
                    </span>
                    {(t.verified || poster?.isPremium) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/20 flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                    {t.mode === "referral" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-400/20">
                        Referral exchange
                      </span>
                    )}
                    {isBoostedNow(t) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-400/30 inline-flex items-center gap-1">
                        <Rocket className="w-3 h-3" /> Boosted
                      </span>
                    )}
                  </div>
                  <div className="font-bold mt-1.5 leading-snug line-clamp-2">
                    {t.title}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {t.target}
                  </div>
                  {t.postId && <div className="text-[10px] font-mono text-gray-600 mt-1">ID {t.postId}</div>}
                  {(t.tags ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.tags!.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-gray-400"
                        >
                          <Hash className="w-2.5 h-2.5" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Poster meta: rating + success rate + follow */}
              {poster && t.posterHandle && (
                <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {t.poster.slice(0, 1)}
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">
                        {t.poster}
                        <VerifiedTick show={!!t.verified || poster.isPremium} className="w-3 h-3" />
                      </div>
                      <div className="text-[10px] text-gray-500 inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-current" />
                          <span className="tabular">{t.rating?.toFixed(1)}</span>
                        </span>
                        <span className="text-emerald-400/80 font-semibold">{t.successRate}% kept</span>
                      </div>
                    </div>
                  </div>
                  <FollowButton handle={t.posterHandle} size="sm" />
                </div>
              )}

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">
                    Reward
                  </div>
                  <div className="font-extrabold text-2xl tabular gradient-text">
                    +${t.reward.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">
                    By
                  </div>
                  <div className="text-xs text-gray-300">{t.poster}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                  <span className="tabular">
                    {t.completions}/{t.limit} done
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(t.id);
                  }}
                  className={clsx(
                    "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors",
                    liked[t.id]
                      ? "text-rose-400 border-rose-400/40 bg-rose-500/10"
                      : "text-gray-400 border-white/10 hover:text-rose-300 hover:border-rose-400/30"
                  )}
                  title={liked[t.id] ? "Unlike this post" : "Like this post"}
                >
                  <Heart className={clsx("w-3.5 h-3.5", liked[t.id] && "fill-current")} />
                  <span className="tabular">{(t.likes ?? 0).toLocaleString()}</span>
                </button>
                {t.posterHandle === myHandle &&
                  (isBoostedNow(t) ? (
                    <span className="text-[11px] font-semibold text-violet-300 inline-flex items-center gap-1">
                      <Rocket className="w-3 h-3" />
                      Pinned top · {Math.max(0, Math.ceil(((t.boostUntil ?? 0) - Date.now()) / 3600000))}h
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = boostTask(t.id);
                        if (!r.ok)
                          addToast({ type: "warning", title: "Can't boost", description: r.error });
                      }}
                      className="text-[11px] font-bold inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-violet-400/30 text-violet-300 hover:bg-violet-500/10 transition-colors"
                    >
                      <Rocket className="w-3 h-3" /> Boost $2/6h
                    </button>
                  ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t.minutesAgo < 60 ? `${t.minutesAgo}m ago` : `${Math.round(t.minutesAgo / 60)}h ago`}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {startingId === t.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Unlocking…
                    </>
                  ) : (
                    <>
                      Start Task
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </>
                  )}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-gray-400">
          No tasks match your filters. Try a different platform or keyword.
        </div>
      )}

      <TaskModal task={active} onClose={() => setActive(null)} />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  tone: "cyan" | "violet" | "emerald";
}) {
  const toneBg = {
    cyan: "from-cyan-500/20 to-transparent border-cyan-400/20",
    violet: "from-violet-500/20 to-transparent border-violet-400/20",
    emerald: "from-emerald-500/20 to-transparent border-emerald-400/20",
  }[tone];
  return (
    <div className={clsx("rounded-2xl p-4 border bg-gradient-to-br", toneBg)}>
      <div className="text-[10px] uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-extrabold text-2xl tabular mt-1">
        {value}
        {suffix && <span className="text-sm text-gray-400 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
