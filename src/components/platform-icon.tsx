
import type { ComponentType } from "react";
import {
  Instagram as InstagramIcon,
  Send as TelegramIcon,
  Youtube as YoutubeIcon,
  Twitter as TwitterIcon,
  Music2 as TiktokIcon,
  Store as PlayStoreIcon,
  AppWindow as AppStoreIcon,
  Globe as BrowserIcon,
} from "lucide-react";
import { type Platform, PLATFORM_META } from "@/lib/mock-data";
import clsx from "clsx";

export default function PlatformIcon({
  platform,
  size = "md",
  className,
}: {
  platform: Platform;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const meta = PLATFORM_META[platform];
  const Icon = ICONS[platform] ?? BrowserIcon;
  const dim =
    size === "sm"
      ? "w-7 h-7"
      : size === "lg"
      ? "w-12 h-12"
      : size === "xl"
      ? "w-16 h-16"
      : "w-9 h-9";
  const iconDim =
    size === "sm" ? "w-4 h-4" :
    size === "lg" ? "w-6 h-6" :
    size === "xl" ? "w-8 h-8" :
    "w-5 h-5";

  return (
    <div
      className={clsx(
        "rounded-xl flex items-center justify-center shrink-0 border border-white/15 relative",
        dim,
        className
      )}
      style={{
        background: meta.gradient,
        boxShadow: `0 4px 22px ${meta.hex}66, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
    >
      {/* faint inner highlight */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
      <Icon className={clsx("text-white relative z-10 drop-shadow", iconDim)} strokeWidth={2.2} />
    </div>
  );
}

const ICONS: Record<Platform, ComponentType<any>> = {
  Instagram: InstagramIcon,
  Telegram: TelegramIcon,
  YouTube: YoutubeIcon,
  Twitter: TwitterIcon,
  TikTok: TiktokIcon,
  "Play Store": PlayStoreIcon,
  "App Store": AppStoreIcon,
  Browser: BrowserIcon,
};
