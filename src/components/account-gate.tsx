
import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import {
  isSupabaseReady,
  isTelegramWebApp,
  restoreEmailSession,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/supabase";

export default function AccountGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // Admins retain their browser-only passcode flow. Telegram users retain
    // their verified Mini App identity. Only ordinary browser visitors need
    // an email account when Supabase is configured.
    if (pathname?.startsWith("/admin") || isTelegramWebApp() || !isSupabaseReady()) {
      setReady(true);
      return () => {
        active = false;
      };
    }
    restoreEmailSession().then((user) => {
      if (active) setReady(!!user);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const result = mode === "signIn"
      ? await signInWithEmail(normalizedEmail, password)
      : await signUpWithEmail(normalizedEmail, password, name);
    setBusy(false);
    if (!result.user) {
      setError(result.error || "Authentication failed.");
      return;
    }
    if (mode === "signUp" && "needsEmailConfirmation" in result && result.needsEmailConfirmation) {
      setNotice("Account created. Check your email, then sign in to continue.");
      setMode("signIn");
      setPassword("");
      return;
    }
    setReady(true);
  }

  if (ready) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0b0f17] p-4 sm:p-6">
      <div className="min-h-full flex items-center justify-center py-8">
        <div className="relative w-full max-w-md rounded-3xl glass-strong border border-white/10 p-6 sm:p-8 shadow-card">
          <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-brand-violet/15 blur-3xl pointer-events-none" />
          <div className="relative text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-violet shadow-glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Welcome to PromoPulse</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Use email and password to access the same Earn, Promote, Leads, Wallet, free-plan, and Premium features available in Telegram.
            </p>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => { setMode("signIn"); setError(null); setNotice(null); }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${mode === "signIn" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signUp"); setError(null); setNotice(null); }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${mode === "signUp" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="relative mt-5 space-y-4">
            {mode === "signUp" && (
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Display name</span>
                <span className="relative block">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-3 text-sm placeholder:text-gray-600 focus:border-brand-cyan/40 focus:outline-none" />
                </span>
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Email</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-3 text-sm placeholder:text-gray-600 focus:border-brand-cyan/40 focus:outline-none" />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Password</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signIn" ? "current-password" : "new-password"} className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-3 text-sm placeholder:text-gray-600 focus:border-brand-cyan/40 focus:outline-none" />
              </span>
            </label>
            {error && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
            {notice && <div role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</div>}
            <button disabled={busy} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Please wait…" : mode === "signIn" ? "Sign in securely" : "Create my account"}
            </button>
          </form>

          <p className="relative mt-5 text-center text-[11px] leading-relaxed text-gray-500">
            Your in-app chat remains available only to authenticated Premium members. Anonymous browser visitors are not given chat access.
          </p>
        </div>
      </div>
    </div>
  );
}
