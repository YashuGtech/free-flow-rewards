"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import ReferralGate, { REF_GATE_DISMISS_KEY } from "@/components/referral-gate";

/**
 * The store persists to localStorage with `skipHydration: true` so the SSR
 * render matches the client's first render. This component rehydrates the
 * persisted state right after mount.
 */
export default function StoreHydrate() {
  const [showGate, setShowGate] = useState(false);
  const [gateCode, setGateCode] = useState("");

  useEffect(() => {
    try {
      (useApp as any).persist?.rehydrate();
    } catch {
      // ignore storage errors
    }
    // Pull marketplace + user data from Supabase once (cached reads, demo fallback).
    // After hydration, auto-enter a referral code from the ?ref= URL parameter
    // (friend2 clicks friend1's link → code is entered automatically, then the
    // URL is cleaned so it can never be re-triggered). When no code ends up
    // entered (no ?ref, or the ?ref code was invalid), show the one-time
    // referral gate — enter a friend's code now or skip (Profile has the same
    // box and a code can be added there anytime before one is locked in).
    try {
      void useApp.getState().hydrateFromSupabase().then(() => {
        const s = useApp.getState();
        // Do one uncached submission read after the initial hydrate so an
        // approval made while this device was closed is paid immediately.
        void s.refreshSubmissions();
        if (!s.referralCodeEntered && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const ref = params.get("ref");
          const maybeOpenGate = () => {
            // Never re-open once a code is entered or the gate was skipped.
            if (useApp.getState().referralCodeEntered) return;
            try {
              if (localStorage.getItem(REF_GATE_DISMISS_KEY) === "1") return;
            } catch {
              /* ignore */
            }
            setGateCode(ref?.trim() ?? "");
            setShowGate(true);
          };
          if (ref?.trim()) {
            s.enterReferralCode(ref.trim()).then(() => {
              // Clean the URL so the referral can never be re-triggered.
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("ref");
                window.history.replaceState(null, "", url.pathname + url.search + window.location.hash);
              } catch {
                /* ignore */
              }
              maybeOpenGate();
            }).catch(() => maybeOpenGate());
          } else {
            maybeOpenGate();
          }
        }
      });
    } catch {
      // offline / demo
    }

    // Approved claims are written by the publisher's browser, so the claimer
    // needs a lightweight cross-session refresh even when they remain on the
    // Profile or Earn page. `refreshSubmissions` is cache-bypassing and the
    // payout scanner is idempotent via submissions.credited.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void useApp.getState().refreshSubmissions();
      }
    }, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  return <ReferralGate open={showGate} initialCode={gateCode} onClose={() => setShowGate(false)} />;
}
