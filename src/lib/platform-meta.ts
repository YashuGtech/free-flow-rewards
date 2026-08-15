import type { Platform } from "./types";

export const PLATFORM_META: Record<
  Platform,
  { color: string; gradient: string; bg: string; hex: string }
> = {
  Instagram: {
    color: "from-pink-500 via-fuchsia-500 to-amber-400",
    gradient: "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
    bg: "rgba(221, 42, 123, 0.12)",
    hex: "#DD2A7B",
  },
  Telegram: {
    color: "from-sky-400 to-blue-500",
    gradient: "linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)",
    bg: "rgba(42, 171, 238, 0.12)",
    hex: "#2AABEE",
  },
  YouTube: {
    color: "from-red-500 to-rose-600",
    gradient: "linear-gradient(135deg, #FF0000 0%, #CC0000 100%)",
    bg: "rgba(255, 0, 0, 0.12)",
    hex: "#FF0000",
  },
  Twitter: {
    color: "from-sky-300 to-sky-500",
    gradient: "linear-gradient(135deg, #1DA1F2 0%, #0A85D9 100%)",
    bg: "rgba(29, 161, 242, 0.12)",
    hex: "#1DA1F2",
  },
  TikTok: {
    color: "from-fuchsia-500 to-cyan-400",
    gradient: "linear-gradient(135deg, #FF0050 0%, #00F2EA 100%)",
    bg: "rgba(255, 0, 80, 0.12)",
    hex: "#FF0050",
  },
  "Play Store": {
    color: "from-green-400 to-sky-500",
    gradient: "linear-gradient(135deg, #00E676 0%, #0091EA 100%)",
    bg: "rgba(0, 200, 83, 0.12)",
    hex: "#00C853",
  },
  "App Store": {
    color: "from-sky-400 to-blue-600",
    gradient: "linear-gradient(135deg, #5AC8FA 0%, #0A84FF 100%)",
    bg: "rgba(10, 132, 255, 0.12)",
    hex: "#0A84FF",
  },
  Browser: {
    color: "from-emerald-400 to-teal-500",
    gradient: "linear-gradient(135deg, #34d399 0%, #0d9488 100%)",
    bg: "rgba(16, 185, 129, 0.12)",
    hex: "#10b981",
  },
};
