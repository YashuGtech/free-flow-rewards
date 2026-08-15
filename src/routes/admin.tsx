
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Coins, ArrowDownToLine, Gift, Megaphone, Ban, ShieldCheck,
  RefreshCw, Lock, CheckCircle2, XCircle, Crown, Wallet, TrendingUp, Users, AlertTriangle, Unlock, Trash2,
  FileArchive, FileText, Download, Loader2, Flag, Star, Search,
} from "lucide-react";
import clsx from "clsx";
import { isAdmin, tryAdminPasscode, adminHint } from "@/lib/admin";
import {
  LOYALTY_5STAR_BONUS,
  LOYALTY_4STAR_BONUS,
  LOYALTY_MAX_RATE,
  LOYALTY_5STAR_ENV,
  LOYALTY_4STAR_ENV,
  LOYALTY_MAX_ENV,
  calcLoyaltyRate,
} from "@/lib/loyalty";
import { defaultBanDuration, formatBanDuration, PERMANENT_BAN_MS, isPermanentBan } from "@/lib/ban";
import {
  cachedQuery, getSupabase, invalidateCache, queueDelete, queueDeleteWhere, queueWrite, setAdminSecret,
} from "@/lib/supabase";

type Tab = "overview" | "deposits" | "withdrawals" | "referrals" | "loyalty" | "ads" | "users" | "reviews";

interface AdminData {
  deposits: any[];
  withdrawals: any[];
  tasks: any[];
  campaigns: any[];
  settings: Record<string, string>;
  profiles: any[];
  reports: any[];
  bans: any[];
  reviewRequests: any[];
  transactions: any[];
}

const EMPTY: AdminData = { deposits: [], withdrawals: [], tasks: [], campaigns: [], settings: {}, profiles: [], reports: [], bans: [], reviewRequests: [], transactions: [] };

function useAdminData() {
  const [data, setData] = useState<AdminData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let on = true;
    setLoading(true);
    // RLS (migration 0005) needs the admin header for cross-user reads of
    // reports/bans — set it BEFORE the client is built for this fetch.
    setAdminSecret(import.meta.env.VITE_ADMIN_PASSCODE || "admin1234");
    cachedQuery("admin:v1", 60_000, async (): Promise<AdminData | null> => {
      const sb = getSupabase();
      if (!sb) return null;
      const [d, w, t, c, s, p, r, b, rv, tx] = await Promise.all([
        sb.from("deposits").select("*").limit(300),
        sb.from("withdrawals").select("*").limit(300),
        sb.from("tasks").select("*").limit(500),
        sb.from("campaigns").select("*").limit(500),
        sb.from("settings").select("key,value"),
        sb.from("profiles").select("*").limit(1000),
        sb.from("reports").select("*").limit(1000),
        sb.from("bans").select("*").limit(500),
        sb.from("review_requests").select("*").limit(500),
        sb.from("transactions").select("*").limit(1000),
      ]);
      if (d.error || w.error || t.error || c.error || s.error || p.error || r.error || b.error || rv.error || tx.error) return null;
      const settings: Record<string, string> = {};
      (s.data ?? []).forEach((row: any) => (settings[row.key] = row.value));
      return {
        deposits: d.data ?? [],
        withdrawals: w.data ?? [],
        tasks: t.data ?? [],
        campaigns: c.data ?? [],
        settings,
        profiles: p.data ?? [],
        reports: r.data ?? [],
        bans: b.data ?? [],
        reviewRequests: rv.data ?? [],
        transactions: tx.data ?? [],
      };
    }).then((res) => {
      if (on) setData(res ?? EMPTY);
    }).finally(() => {
      if (on) setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rev]);

  const refresh = () => {
    invalidateCache("admin:v1");
    setRev((r) => r + 1);
  };

  return { data, loading, refresh };
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const { data, loading, refresh } = useAdminData();
  const [dlBusy, setDlBusy] = useState(false);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const [creditUser, setCreditUser] = useState<string | null>(null);
  const [creditAmt, setCreditAmt] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banMode, setBanMode] = useState<"auto" | "custom" | "permanent">("auto");
  const [banHours, setBanHours] = useState("");
  const [banReason, setBanReason] = useState("");

  // Full source code ZIP — admin-only. Sends the Telegram initData (when
  // inside Telegram) plus the panel passcode, so both TG-whitelisted and
  // passcode-unlocked admins can download it.
  const downloadSourceZip = async () => {
    if (dlBusy) return;
    setDlBusy(true);
    setDlErr(null);
    try {
      const w = (window as any).Telegram?.WebApp;
      const res = await fetch("/api/source-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: w?.initData ?? "",
          passcode: import.meta.env.VITE_ADMIN_PASSCODE || "admin1234",
        }),
      });
      if (!res.ok) throw new Error("restricted");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = m ? m[1] : "promopulse-source.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDlErr("Download blocked — this ZIP is available to admins only.");
    } finally {
      setDlBusy(false);
    }
  };

  // The RLS policies (migration 0005) require the admin header for cross-user
  // reads/writes — send it as soon as the panel is unlocked.
  useEffect(() => {
    if (isAdmin()) {
      setAdminSecret(import.meta.env.VITE_ADMIN_PASSCODE || "admin1234");
      setAuthed(true);
    }
  }, []);

  // After unlocking, re-run the data fetch with the admin header in place so
  // the Users tab (reports/bans) isn't stuck on a header-less first load.
  useEffect(() => {
    if (authed) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const submitPass = () => {
    if (tryAdminPasscode(pass)) {
      setAdminSecret(import.meta.env.VITE_ADMIN_PASSCODE || "admin1234");
      setAuthed(true);
    } else setErr(true);
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <div className="glass-strong rounded-3xl border border-white/10 p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="mt-4 font-extrabold text-xl">Admin panel</h1>
          <p className="mt-1 text-xs text-gray-500">Restricted area — funds, withdrawals, referrals &amp; ads.</p>
          <input
            type="password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(false); }}
            onKeyDown={(e) => e.key === "Enter" && submitPass()}
            placeholder="Admin passcode"
            className="mt-5 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-center font-mono text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-400/40"
          />
          {err && <div className="mt-2 text-[11px] text-rose-300">Wrong passcode</div>}
          <button onClick={submitPass} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Unlock
          </button>
          <p className="mt-4 text-[10px] text-gray-600">{adminHint()}</p>
        </div>
      </div>
    );
  }

  const paidDeposits = data.deposits.filter((d) => ["paid", "manual_accept"].includes(d.status));
  const totalDeposits = paidDeposits.reduce((a, d) => a + Number(d.amount || 0), 0);
  const doneWithdrawals = data.withdrawals.filter((w) => w.status === "done");
  const totalPaidOut = doneWithdrawals.reduce((a, w) => a + Number(w.amount || 0), 0);
  const pendingWithdrawals = data.withdrawals.filter((w) => w.status === "pending");
  const totalPending = pendingWithdrawals.reduce((a, w) => a + Number(w.amount || 0), 0);
  const inCirculation = Math.max(0, totalDeposits - totalPaidOut);
  const referralsEnabled = data.settings.referrals_enabled !== "false";
  const bannedCount = data.tasks.filter((t) => t.banned).length + data.campaigns.filter((c) => c.banned).length;

  // --- Users & reports (admin moderation) ---
  const userCount = data.profiles.filter((p) => p.handle && p.handle !== "you").length;
  const reportCounts = new Map<string, number>();
  data.reports.forEach((r: any) => {
    const t = String(r.target ?? "");
    if (t) reportCounts.set(t, (reportCounts.get(t) ?? 0) + 1);
  });
  const mostReported = Array.from(reportCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const activeBanHandles = new Set(
    data.bans.filter((b: any) => Date.parse(b.until) > Date.now()).map((b: any) => b.handle)
  );
  // Permanent bans (100-year marker) — shown distinctly in the Users tab.
  const permanentBanHandles = new Set(
    data.bans
      .filter((b: any) => isPermanentBan(Date.parse(b.until) || 0))
      .map((b: any) => b.handle)
  );
  const pendingReviews = data.reviewRequests.filter((r: any) => r.status === "pending").length;

  // Wallet ledger per owner — the same rule the app uses to derive balances:
  // wallet types (earn/spend/deposit/withdraw/premium) → USDT, referral/bonus → promo.
  const balanceByOwner = new Map<string, number>();
  const promoByOwner = new Map<string, number>();
  data.transactions.forEach((t: any) => {
    const o = String(t.owner ?? "");
    if (!o) return;
    const amt = Number(t.amount || 0);
    if (t.type === "referral" || t.type === "bonus") {
      promoByOwner.set(o, Math.round(((promoByOwner.get(o) ?? 0) + amt) * 100) / 100);
    } else {
      balanceByOwner.set(o, Math.round(((balanceByOwner.get(o) ?? 0) + amt) * 100) / 100);
    }
  });

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "deposits", label: "Deposits", icon: Coins, badge: data.deposits.filter((d) => d.status === "new").length },
    { id: "withdrawals", label: "Withdrawals", icon: ArrowDownToLine, badge: pendingWithdrawals.length },
    { id: "users", label: "Users", icon: Users, badge: data.bans.filter((b: any) => Date.parse(b.until) > Date.now()).length },
    { id: "referrals", label: "Referrals", icon: Gift },
    { id: "loyalty", label: "Loyalty", icon: Star },
    { id: "ads", label: "Ads", icon: Megaphone, badge: bannedCount },
    { id: "reviews", label: "Review requests", icon: Flag, badge: pendingReviews },
  ];

  // Admin ban — the duration follows the user's plan by default (free → 7 days,
  // premium → 72 hours) and the admin can override with a custom number of
  // hours plus a reason. Works for any user at any time; unban is one click.
  const confirmBan = () => {
    if (!banTarget) return;
    const profile = data.profiles.find((p) => p.handle === banTarget);
    const auto = defaultBanDuration(profile?.is_premium === true);
    const ms =
      banMode === "permanent"
        ? PERMANENT_BAN_MS
        : banMode === "custom"
          ? Math.max(1, Math.round(Number(banHours) || 1)) * 3600_000
          : auto.ms;
    queueWrite(
      "bans",
      {
        handle: banTarget,
        until: new Date(Date.now() + ms).toISOString(),
        reason:
          banReason.trim() ||
          (banMode === "permanent" ? "Permanent ban — misbehavior" : "Banned by admin"),
      },
      "handle"
    );
    setBanTarget(null);
    setBanHours("");
    setBanReason("");
    refresh();
  };
  const openBanModal = (handle: string) => {
    setBanTarget(handle);
    setBanMode("auto");
    setBanHours("");
    setBanReason("");
  };
  const unbanUser = (handle: string) => {
    queueDeleteWhere("bans", "handle", handle);
    refresh();
  };
  // Admin manual credit — written as an `earn` ledger transaction owned by the
  // target user. Their client derives the wallet balance from this ledger, so
  // the added USDT shows up on their next sync (and can never be double-paid).
  const addBalance = (handle: string) => {
    const amt = Math.round(Number(creditAmt) * 100) / 100;
    if (!isFinite(amt) || amt <= 0) return;
    queueWrite("transactions", {
      client_id: `adm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      owner: handle,
      type: "earn",
      label: "Admin credit",
      amount: amt,
      date_label: `Today, ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      meta: "Added by admin",
    });
    setCreditUser(null);
    setCreditAmt("");
    refresh();
  };

  const markDepositPaid = (d: any) => {
    queueWrite("deposits", { client_id: d.client_id ?? d.id, status: "manual_accept", amount: d.amount, track_id: d.track_id, payment_url: d.payment_url, purpose: d.purpose, plan_id: d.plan_id });
    refresh();
  };
  const approveWithdrawal = (w: any) => {
    queueWrite("withdrawals", { client_id: w.client_id ?? w.id, status: "done", amount: w.amount, address: w.address, track_id: w.track_id });
    refresh();
  };
  const cancelWithdrawal = (w: any) => {
    queueDelete("withdrawals", w.client_id ?? w.id);
    refresh();
  };
  const setReferrals = (v: boolean) => {
    queueWrite("settings", { key: "referrals_enabled", value: String(v) }, "key");
    refresh();
  };
  const setBanned = (table: "tasks" | "campaigns", id: string, banned: boolean) => {
    queueWrite(table, { client_id: id, banned }, "client_id");
    refresh();
  };
  // Review requests (ban appeals): approve lifts the ban immediately. Keep the
  // full row when upserting — Supabase replaces columns that are missing.
  const setReviewStatus = (req: any, status: "approved" | "rejected") => {
    queueWrite("review_requests", {
      client_id: req.client_id ?? req.id,
      handle: req.handle,
      reason: req.reason ?? "",
      at_label: req.at_label ?? req.created_at?.slice(0, 10) ?? "",
      status,
    });
    if (status === "approved") queueDeleteWhere("bans", "handle", req.handle);
    refresh();
  };
  // Hard-delete an ad (and its paired row) — tasks and campaigns mirror each
  // other: task `ad-…` ↔ campaign `c-ad-…`.
  const deleteAd = (table: "tasks" | "campaigns", id: string) => {
    if (table === "tasks") {
      queueDelete("tasks", id);
      queueDelete("campaigns", `c-${id}`);
    } else {
      queueDelete("campaigns", id);
      if (id.startsWith("c-")) queueDelete("tasks", id.slice(2));
    }
    refresh();
  };

  const StatCard = ({ label, value, sub, icon: Icon, tint }: any) => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
        <Icon className={clsx("w-3.5 h-3.5", tint)} /> {label}
      </div>
      <div className="mt-2 font-extrabold text-2xl tabular">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-extrabold text-2xl flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow-violet">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            Admin panel
          </h1>
          <p className="text-xs text-gray-500 mt-1">Funds, deposits, withdrawals, referrals &amp; ad moderation — frontend-only, cached.</p>
        </div>
        <button onClick={refresh} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "chip",
              tab === t.id ? "chip-active" : "text-gray-400 hover:text-white"
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            {!!t.badge && t.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">Loading…</div>
      ) : tab === "overview" ? (
        <>
          {/* Full source code — latest update */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-glow shrink-0">
                <FileArchive className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm">Full source code · latest update</div>
                <div className="text-[11px] text-gray-400 leading-relaxed">
                  Complete project — Next.js app, components, lib, static build, Supabase migrations
                  &amp; edge functions. Built &amp; cached server-side, so repeat downloads are instant.
                </div>
              </div>
            </div>
            <button
              onClick={downloadSourceZip}
              disabled={dlBusy}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {dlBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {dlBusy ? "Building ZIP…" : "Download source ZIP"}
            </button>
          </div>
          {dlErr && (
            <div className="rounded-xl px-4 py-3 text-xs text-rose-300 border border-rose-400/25 bg-rose-500/10">
              {dlErr}
            </div>
          )}

          {/* Product documentation — PRD (PDF / DOCX), served from /docs */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-400/[0.05] to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-glow shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm">Product documentation · PRD v1.0</div>
                <div className="text-[11px] text-gray-400 leading-relaxed">
                  Full product requirements: every feature, business rules and the complete A-to-Z
                  workflows for earners, publishers and admins. Generated from{" "}
                  <span className="font-mono text-gray-300">docs/PRD.md</span>.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/docs/PromoPulse-PRD.pdf"
                download
                className="btn-primary inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> PDF
              </a>
              <a
                href="/docs/PromoPulse-PRD.docx"
                download
                className="btn-ghost inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> DOCX
              </a>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total users" value={userCount} sub={`${data.profiles.length} profile rows`} icon={Users} tint="text-violet-300" />
            <StatCard label="Active bans" value={activeBanHandles.size} sub={`${data.bans.length} total ban records`} icon={Ban} tint="text-rose-300" />
            <StatCard label="Paid deposits" value={`$${totalDeposits.toFixed(2)}`} sub={`${paidDeposits.length} orders`} icon={Coins} tint="text-emerald-300" />
            <StatCard label="Paid out" value={`$${totalPaidOut.toFixed(2)}`} sub={`${doneWithdrawals.length} withdrawals`} icon={ArrowDownToLine} tint="text-sky-300" />
            <StatCard label="In circulation" value={`$${inCirculation.toFixed(2)}`} sub={`${pendingWithdrawals.length} pending (${totalPending.toFixed(2)})`} icon={Wallet} tint="text-cyan-300" />
            <StatCard label="Referral program" value={referralsEnabled ? "Active" : "Disabled"} sub="Each user's code auto-disables at 10 refers" icon={Gift} tint="text-amber-300" />
          </div>
          {mostReported ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.05] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-400/25 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Most reported user</div>
                <div className="font-extrabold text-lg truncate">@{mostReported[0]}</div>
                <div className="text-xs text-rose-300 font-semibold">{mostReported[1]} report{mostReported[1] === 1 ? "" : "s"} · {activeBanHandles.has(mostReported[0]) ? "currently banned" : "not banned yet"}</div>
              </div>
              {activeBanHandles.has(mostReported[0]) ? (
                <button onClick={() => unbanUser(mostReported[0])} className="btn-ghost flex items-center gap-1.5 shrink-0">
                  <Unlock className="w-4 h-4" /> Unban
                </button>
              ) : (
                <button onClick={() => openBanModal(mostReported[0])} className="btn-ghost flex items-center gap-1.5 shrink-0 !text-rose-300">
                  <Ban className="w-4 h-4" /> Ban
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-gray-500">
              No user reports yet — reported users show up here.
            </div>
          )}
        </>
      ) : tab === "deposits" ? (
        <AdminTable
          head={["Order", "Network", "Amount", "Bonus", "Status", "When", ""]}
          rows={data.deposits.map((d) => [
            d.tx_hash ? (
              <a
                key="o"
                href={d.payment_url || `https://etherscan.io/tx/${d.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-sky-300 hover:text-sky-200 underline underline-offset-2"
              >
                {String(d.tx_hash).slice(0, 10)}…
              </a>
            ) : (
              <span key="o" className="font-mono text-xs text-gray-400">{String(d.track_id ?? d.id).slice(0, 16)}</span>
            ),
            <span key="n" className="text-xs">{d.network ?? (d.purpose === "premium" ? "—" : "NOWPayments")}</span>,
            <span key="a" className="font-bold tabular text-emerald-300">${Number(d.amount).toFixed(2)}</span>,
            <span key="b" className="text-xs tabular text-amber-300">{Number(d.bonus ?? 0) > 0 ? `+${Number(d.bonus).toFixed(2)}` : "—"}</span>,
            <StatusPill key="s" status={d.status} />,
            <span key="w" className="text-xs text-gray-500">{d.at_label ?? d.created_at?.slice(0, 10) ?? "—"}</span>,
            ["paid", "manual_accept"].includes(d.status) ? null : (
              <button key="x" onClick={() => markDepositPaid(d)} className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200">
                Mark paid
              </button>
            ),
          ])}
        />
      ) : tab === "withdrawals" ? (
        <AdminTable
          head={["Address", "Amount", "Status", "When", ""]}
          rows={data.withdrawals.map((w) => [
            <span key="a" className="font-mono text-xs text-gray-400">{String(w.address).slice(0, 20)}…</span>,
            <span key="m" className="font-bold tabular text-rose-300">−${Number(w.amount).toFixed(2)}</span>,
            <StatusPill key="s" status={w.status} />,
            <span key="w" className="text-xs text-gray-500">{w.at_label ?? w.created_at?.slice(0, 10) ?? "—"}</span>,
            w.status === "pending" ? (
              <div key="x" className="flex gap-2">
                <button onClick={() => approveWithdrawal(w)} className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => cancelWithdrawal(w)} className="text-[11px] font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            ) : null,
          ])}
        />
      ) : tab === "users" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">User moderation</div>
                <div className="text-[11px] text-gray-500">
                  {userCount} users · {reportCounts.size} reported · {activeBanHandles.size} banned — bans apply immediately on next app load
                </div>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by handle, name or @tg…"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm placeholder:text-gray-500 focus:outline-none focus:border-violet-400/40"
              />
              {userQuery && (
                <button
                  onClick={() => setUserQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <AdminTable
            head={["User", "Loyalty", "Tier", "Premium", "Reports", "Status", "Balance", ""]}
            rows={data.profiles
              .filter((p) => p.handle && p.handle !== "you")
              .filter((p) => {
                const q = userQuery.trim().toLowerCase();
                if (!q) return true;
                return (
                  String(p.handle || "").toLowerCase().includes(q) ||
                  String(p.tg || "").toLowerCase().includes(q) ||
                  String(p.name || "").toLowerCase().includes(q)
                );
              })
              .slice()
              .sort((a: any, b: any) => (reportCounts.get(b.handle) ?? 0) - (reportCounts.get(a.handle) ?? 0))
              .map((p) => {
                const banned = activeBanHandles.has(p.handle);
                const reports = reportCounts.get(p.handle) ?? 0;
                const bal = Math.max(0, balanceByOwner.get(p.handle) ?? 0);
                const promo = Math.max(0, promoByOwner.get(p.handle) ?? 0);
                return [
                  <div key="u" className="min-w-0">
                    <div className="text-xs font-semibold truncate">@{p.handle}{p.tg ? ` · @${p.tg}` : ""}</div>
                    <div className="text-[10px] text-gray-500 truncate">{p.name}</div>
                  </div>,
                  // Loyal rater: base success rate + 1% per 5★ given + 0.5% per 4★ given, capped at max.
                  <span key="l" className="text-xs font-bold tabular text-amber-300">
                    {calcLoyaltyRate(p.success_rate ?? 0, { five: p.five_star_gives, four: p.four_star_gives })}%
                  </span>,
                  <span key="t" className="text-xs">{p.tier ?? "Silver"}</span>,
                  <span key="pr" className="text-xs">{p.is_premium ? <span className="text-violet-300 font-bold">Premium</span> : "—"}</span>,
                  <span key="r" className={`text-xs font-bold tabular ${reports > 0 ? "text-amber-300" : "text-gray-500"}`}>{reports || "0"}</span>,
                  banned ? (
                    <span
                      key="s"
                      className={clsx(
                        "px-2 py-0.5 rounded-md border border-rose-400/25 bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase flex items-center gap-1 w-fit",
                        permanentBanHandles.has(p.handle) && "border-rose-400/50 bg-rose-500/25 text-rose-200"
                      )}
                    >
                      <Ban className="w-3 h-3" /> {permanentBanHandles.has(p.handle) ? "Perm banned" : "Banned"}
                    </span>
                  ) : (
                    <span key="s" className="px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-gray-300 text-[10px] font-bold uppercase w-fit">Active</span>
                  ),
                  <div key="b" className="leading-tight">
                    <div className="text-xs font-bold tabular text-emerald-300">${bal.toFixed(2)}</div>
                    {promo > 0 && <div className="text-[10px] text-gray-500 tabular">+{promo.toFixed(2)} promo</div>}
                  </div>,
                  <div key="x" className="flex items-center justify-end gap-3">
                    <button onClick={() => { setCreditUser(p.handle); setCreditAmt(""); }} className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5" /> Add balance
                    </button>
                    {banned ? (
                      <button onClick={() => unbanUser(p.handle)} className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                        <Unlock className="w-3.5 h-3.5" /> Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => openBanModal(p.handle)}
                        title={`Bans for ${p.is_premium ? "72 hours (Premium)" : "7 days (Free)"} by default — custom duration available`}
                        className="text-[11px] font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" /> Ban · {p.is_premium ? "72h" : "7d"}
                      </button>
                    )}
                  </div>,
                ];
              })}
          />
        </div>
      ) : tab === "reviews" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-400/25 flex items-center justify-center">
                <Flag className="w-5 h-5 text-rose-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Ban appeals · review requests</div>
                <div className="text-[11px] text-gray-500">
                  {pendingReviews} pending · approve to lift the ban instantly
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
            {data.reviewRequests.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500">
                No review requests yet — banned users appeal from the suspension banner.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {data.reviewRequests
                  .slice()
                  .sort((a: any, b: any) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1))
                  .map((r: any) => {
                    const statusCls =
                      r.status === "pending"
                        ? "bg-amber-500/15 text-amber-300 border-amber-400/25"
                        : r.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/25"
                          : "bg-rose-500/15 text-rose-300 border-rose-400/25";
                    return (
                      <div key={r.client_id ?? r.id} className="p-4 flex flex-wrap items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                          @
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <div className="text-xs font-semibold truncate">
                            @{r.handle}{" "}
                            <span className="text-gray-500 font-mono text-[10px]">
                              {r.at_label ?? r.created_at?.slice(0, 10) ?? ""}
                            </span>
                          </div>
                          <div className="text-xs text-gray-300 mt-0.5 leading-relaxed">{r.reason ?? "—"}</div>
                        </div>
                        <span className={clsx("px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide", statusCls)}>
                          {r.status ?? "unknown"}
                        </span>
                        {r.status === "pending" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setReviewStatus(r, "approved")}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; unban
                            </button>
                            <button
                              onClick={() => setReviewStatus(r, "rejected")}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 hover:text-rose-200"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : tab === "referrals" ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center"><Gift className="w-4 h-4 text-amber-300" /></div>
              <div>
                <div className="font-extrabold text-sm">Referral program (global switch)</div>
                <div className="text-[11px] text-gray-500">Each user's own code auto-disables after 10 refers</div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 border text-sm font-bold tabular">
              {referralsEnabled ? <span className="text-emerald-300">● Enabled</span> : <span className="text-rose-300">● Disabled</span>}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setReferrals(true)} disabled={referralsEnabled} className="btn-primary flex-1 disabled:opacity-40">Enable</button>
              <button onClick={() => setReferrals(false)} disabled={!referralsEnabled} className="btn-ghost flex-1 disabled:opacity-40">Disable</button>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-6 text-xs text-gray-400 leading-relaxed">
            <TrendingUp className="w-4 h-4 text-amber-300 mb-2" />
            When a user reaches <b className="text-amber-200">10 referrals</b>, their <b>own</b> code is disabled
            automatically (per-user flag <span className="font-mono text-gray-300">profiles.referrals_locked</span>).
            This switch is the <b className="text-gray-300">global</b> kill-switch for the whole program
            (<span className="font-mono text-gray-300">settings.referrals_enabled</span>) — use it to pause
            referrals for everyone.            Changes are cached for up to 15 minutes on clients.
          </div>
        </div>
      ) : tab === "loyalty" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-400/[0.06] to-transparent p-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Loyalty Rater</div>
                <div className="text-[11px] text-gray-500">
                  Each 5★ rating a user gives → +{LOYALTY_5STAR_BONUS}% loyalty rate · each 4★ → +{LOYALTY_4STAR_BONUS}% · max {LOYALTY_MAX_RATE}%
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
                <Star className="w-3.5 h-3.5 text-amber-300" /> 5★ rating given
              </div>
              <div className="mt-2 font-extrabold text-2xl tabular">+{LOYALTY_5STAR_BONUS}%</div>
              <div className="mt-0.5 text-[11px] text-gray-500">per rating · env <span className="font-mono">{LOYALTY_5STAR_ENV}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
                <Star className="w-3.5 h-3.5 text-amber-200" /> 4★ rating given
              </div>
              <div className="mt-2 font-extrabold text-2xl tabular">+{LOYALTY_4STAR_BONUS}%</div>
              <div className="mt-0.5 text-[11px] text-gray-500">per rating · env <span className="font-mono">{LOYALTY_4STAR_ENV}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> Maximum rate
              </div>
              <div className="mt-2 font-extrabold text-2xl tabular">{LOYALTY_MAX_RATE}%</div>
              <div className="mt-0.5 text-[11px] text-gray-500">hard cap · env <span className="font-mono">{LOYALTY_MAX_ENV}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] p-6 text-xs text-gray-400 leading-relaxed">
            <Star className="w-4 h-4 text-amber-300 mb-2" />
            <b className="text-amber-200">Loyalty rate</b> = base success rate + rater bonus, rounded to 0.1 and
            capped at <b className="text-amber-200">{LOYALTY_MAX_RATE}%</b>. The bonus only counts ratings the user{" "}
            <b>gives</b>: every <b className="text-amber-200">5★</b> adds <b>+{LOYALTY_5STAR_BONUS}%</b>, every{" "}
            <b className="text-amber-200">4★</b> adds <b>+{LOYALTY_4STAR_BONUS}%</b>. 1–3★ ratings don&apos;t affect it.
            Counters are stored per user in <span className="font-mono text-gray-300">profiles.five_star_gives</span> /
            <span className="font-mono text-gray-300"> four_star_gives</span> and synced on every rating, so the rate
            survives across devices. Values come from <b className="text-gray-300">separate env vars</b> (static build:
            <span className="font-mono"> window.PP_LOYALTY_*</span>) — edit them to rebalance without touching code.
            Live rates for every user are shown in the <b className="text-gray-300">Users</b> tab.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <AdsTable title="Marketplace ads (tasks)" rows={data.tasks} onBan={(id, b) => setBanned("tasks", id, b)} onDelete={(id) => deleteAd("tasks", id)} />
          <AdsTable title="Campaigns" rows={data.campaigns} onBan={(id, b) => setBanned("campaigns", id, b)} onDelete={(id) => deleteAd("campaigns", id)} />
        </div>
      )}

      {/* Manual balance credit modal */}
      {creditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setCreditUser(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-base p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Add balance to @{creditUser}</div>
                <div className="text-[11px] text-gray-500">Written to the transaction ledger — shows in their wallet on next sync.</div>
              </div>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              autoFocus
              value={creditAmt}
              onChange={(e) => setCreditAmt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBalance(creditUser)}
              placeholder="Amount (USDT)"
              className="mt-5 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm tabular placeholder:text-gray-500 focus:outline-none focus:border-emerald-400/40"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setCreditUser(null)} className="btn-ghost flex-1 py-2.5">Cancel</button>
              <button onClick={() => addBalance(creditUser)} className="btn-primary flex-1 py-2.5">Add balance</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual ban modal — duration follows the user's plan by default (free 7d / premium 72h), admin can override */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setBanTarget(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-base p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-400/25 flex items-center justify-center">
                <Ban className="w-4 h-4 text-rose-300" />
              </div>
              <div>
                <div className="font-extrabold text-sm">Ban @{banTarget}</div>
                <div className="text-[11px] text-gray-500">
                  {(() => {
                    const profile = data.profiles.find((p) => p.handle === banTarget);
                    return profile?.is_premium
                      ? "Premium user — default 72 hours"
                      : "Free user — default 7 days";
                  })()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => setBanMode("auto")}
                className={clsx(
                  "rounded-xl px-3 py-2.5 text-xs font-bold border transition-colors text-left",
                  banMode === "auto"
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
                )}
              >
                Auto per plan
                <div className="text-[10px] font-semibold opacity-70 mt-0.5">
                  {(() => {
                    const profile = data.profiles.find((p) => p.handle === banTarget);
                    return defaultBanDuration(profile?.is_premium === true).label;
                  })()}
                </div>
              </button>
              <button
                onClick={() => setBanMode("custom")}
                className={clsx(
                  "rounded-xl px-3 py-2.5 text-xs font-bold border transition-colors text-left",
                  banMode === "custom"
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
                )}
              >
                Custom
                <div className="text-[10px] font-semibold opacity-70 mt-0.5">choose hours</div>
              </button>
              <button
                onClick={() => setBanMode("permanent")}
                className={clsx(
                  "rounded-xl px-3 py-2.5 text-xs font-bold border transition-colors text-left",
                  banMode === "permanent"
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
                )}
              >
                Permanent
                <div className="text-[10px] font-semibold opacity-70 mt-0.5">no expiry</div>
              </button>
            </div>

            {banMode === "custom" && (
              <input
                type="number"
                min={1}
                autoFocus
                value={banHours}
                onChange={(e) => setBanHours(e.target.value)}
                placeholder="Duration in hours (e.g. 72 = 3 days, 168 = 7 days)"
                className="mt-3 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm tabular placeholder:text-gray-500 focus:outline-none focus:border-rose-400/40"
              />
            )}

            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmBan()}
              placeholder="Reason (default: Banned by admin)"
              className="mt-3 w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm placeholder:text-gray-500 focus:outline-none focus:border-rose-400/40"
            />

            <div className="mt-4 rounded-xl px-3 py-2.5 border border-white/10 bg-white/[0.02] text-[11px] text-gray-400 flex items-center justify-between">
              <span>Will be suspended for</span>
              <span className="font-bold text-rose-300 tabular">
                {banMode === "permanent"
                  ? "Permanent"
                  : banMode === "custom"
                    ? formatBanDuration(Math.max(1, Math.round(Number(banHours) || 1)) * 3600_000)
                    : (() => {
                        const profile = data.profiles.find((p) => p.handle === banTarget);
                        return defaultBanDuration(profile?.is_premium === true).label;
                      })()}
              </span>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setBanTarget(null)} className="btn-ghost flex-1 py-2.5">Cancel</button>
              <button
                onClick={confirmBan}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-rose-500/90 hover:bg-rose-500 text-white transition-all inline-flex items-center justify-center gap-1.5"
              >
                <Ban className="w-4 h-4" /> Ban user
              </button>
            </div>
            <p className="mt-3 text-[10px] text-gray-600">
              Banned users keep read-only access — publishing, claiming and wallet actions are
              disabled until the ban expires or an appeal is approved.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "paid" || status === "manual_accept" || status === "done" || status === "approved"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/25"
      : status === "pending" || status === "new"
        ? "bg-amber-500/15 text-amber-300 border-amber-400/25"
        : "bg-white/[0.05] text-gray-400 border-white/10";
  return <span className={clsx("px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide", cls)}>{status}</span>;
}

function AdminTable({ head, rows }: { head: string[]; rows: any[][] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-gray-500">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-3">{c ?? "—"}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="px-4 py-10 text-center text-gray-500 text-xs">Nothing here yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdsTable({ title, rows, onBan, onDelete }: { title: string; rows: any[]; onBan: (id: string, banned: boolean) => void; onDelete: (id: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Megaphone className="w-4 h-4 text-violet-300" />
        <div className="font-extrabold text-sm">{title}</div>
        <span className="text-[10px] text-gray-500">{rows.length} ads</span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3 font-semibold">Ad</th>
              <th className="px-4 py-3 font-semibold">Poster</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ad) => {
              const id = ad.client_id ?? ad.id;
              const banned = !!ad.banned;
              return (
                <tr key={id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold truncate max-w-[260px]">{ad.title}</div>
                    <div className="text-[10px] text-gray-500">{ad.platform} · {ad.action} · <span className="mono">{ad.post_id ?? id}</span></div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">@{ad.poster_handle}</td>
                  <td className="px-4 py-3">
                    {banned ? (
                      <span className="px-2 py-0.5 rounded-md border border-rose-400/25 bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3" /> Banned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-gray-300 text-[10px] font-bold uppercase">
                        Live
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => onBan(id, !banned)}
                        className={clsx(
                          "text-[11px] font-bold flex items-center gap-1 transition-colors",
                          banned ? "text-emerald-300 hover:text-emerald-200" : "text-rose-300 hover:text-rose-200"
                        )}
                      >
                        {banned ? (<><Crown className="w-3.5 h-3.5" /> Unban</>) : (<><Ban className="w-3.5 h-3.5" /> Ban</>)}
                      </button>
                      <button
                        onClick={() => onDelete(id)}
                        title="Delete this ad permanently"
                        className="text-[11px] font-bold flex items-center gap-1 text-gray-400 hover:text-rose-300 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500 text-xs">No ads</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
