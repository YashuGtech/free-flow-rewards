
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Send, Smartphone, Sparkles, ShieldCheck } from "lucide-react";
import { isAdmin } from "@/lib/admin";

const BOT_USERNAME = "PromoPulseOffical_Bot";
const BOT_URL = `https://t.me/${BOT_USERNAME}`;

/**
 * Telegram-only gate.
 *
 * PromoPulse is a Telegram Mini App: anyone opening it in a plain browser is
 * shown a full-screen blocker with a button to open it inside Telegram
 * (@PromoPulseOffical_Bot). Inside Telegram, the WebApp API is initialized
 * and the real app renders.
 *
 * Exception — the admin panel must work from a normal browser: the gate is
 * lifted when the visitor is an admin (passcode stored in the session) or
 * the current route is /admin, so the panel's own passcode screen can unlock
 * there. Normal users on any other page still get the blocker.
 */
export default function TelegramGate({ children }: { children: React.ReactNode }) {
  const [inTelegram, setInTelegram] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const w = (window as any).Telegram?.WebApp;
      if (w && w.initData) {
        w.ready?.();
        w.expand?.();
        setInTelegram(true);
      } else {
        setInTelegram(false);
      }
    } catch {
      setInTelegram(false);
    }
  }, []);

  // Browser pass-through for the admin panel only (safe on SSR — isAdmin()
  // returns false without a window, and inTelegram is null before mount).
  const adminBrowser =
    typeof window !== "undefined" &&
    inTelegram === false &&
    (isAdmin() || pathname?.startsWith("/admin"));

  if (inTelegram === true || adminBrowser) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0b0f17] overflow-y-auto">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-brand-cyan/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-brand-violet/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-violet flex items-center justify-center shadow-glow">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">PromoPulse</h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          This app is a <b className="text-white">Telegram Mini App</b> — it only works inside Telegram.
        </p>

        <a
          href={BOT_URL}
          className="mt-6 w-full btn-primary inline-flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" /> Open in Telegram
        </a>
        <div className="mt-3 text-[11px] text-gray-500">
          @{BOT_USERNAME} · tap <b className="text-gray-400">Launch</b> inside the chat to open the app
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
            <Smartphone className="w-3.5 h-3.5" /> How to open
          </div>
          <ol className="mt-3 space-y-2 text-[12px] text-gray-400 leading-relaxed list-none">
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-cyan-300">1</span>
              Open Telegram on your phone or desktop
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-cyan-300">2</span>
              Search <b className="text-white">@{BOT_USERNAME}</b>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-cyan-300">3</span>
              Press <b className="text-white">Start</b>, then <b className="text-white">Launch</b> the app
            </li>
          </ol>
        </div>

        <a
          href="/admin"
          className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-violet-300 transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Admin panel
        </a>
      </div>
    </div>
  );
}
