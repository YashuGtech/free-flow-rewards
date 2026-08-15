"use client";

import clsx from "clsx";
import { Crown, Sparkles, BadgeCheck } from "lucide-react";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "None";

const TIER_GRADIENT: Record<Tier, string> = {
  Bronze: "linear-gradient(135deg, #B45309 0%, #7C2D12 100%)",
  Silver: "linear-gradient(135deg, #94A3B8 0%, #475569 100%)",
  Gold: "linear-gradient(135deg, #FCD34D 0%, #B45309 100%)",
  Platinum: "linear-gradient(135deg, #67E8F9 0%, #7C3AED 50%, #E879F9 100%)",
  None: "linear-gradient(135deg, #475569 0%, #1E293B 100%)",
};

const TIER_RING: Record<Tier, string> = {
  Bronze: "ring-bronze",
  Silver: "ring-silver",
  Gold: "ring-gold",
  Platinum: "ring-platinum",
  None: "",
};

const TIER_LABEL: Record<Tier, string> = {
  Bronze: "Bronze member",
  Silver: "Silver member",
  Gold: "Gold member",
  Platinum: "Platinum member",
  None: "",
};

function initials(name: string): string {
  const cleaned = (name || "").trim();
  if (!cleaned) return "·";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserAvatar({
  name,
  tier = "None",
  size = "md",
  showBadge = false,
  highlight = false,
  verified = false,
  className,
}: {
  name: string;
  tier?: Tier;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showBadge?: boolean;
  highlight?: boolean;
  verified?: boolean;
  className?: string;
}) {
  const dim =
    size === "xs"
      ? "w-7 h-7 text-[11px]"
      : size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
      ? "w-16 h-16 text-xl"
      : size === "xl"
      ? "w-28 h-28 text-4xl"
      : "w-9 h-9 text-sm";
  return (
    <div className={clsx("relative inline-flex items-center justify-center", className)}>
      <div
        className={clsx(
          "rounded-xl flex items-center justify-center font-extrabold text-white relative border border-white/15 select-none",
          dim,
          TIER_RING[tier],
          highlight && "shadow-glow"
        )}
        style={{ background: TIER_GRADIENT[tier] }}
        aria-label={`${name} (${TIER_LABEL[tier] || "member"})`}
        title={name}
      >
        <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
        <span className="relative tracking-wider">{initials(name)}</span>
      </div>
      {verified && (
        <div
          className={clsx(
            "absolute -bottom-1 -right-1 rounded-full bg-sky-500 flex items-center justify-center border-2 border-bg-base shadow-[0_0_10px_rgba(14,165,233,0.8)]",
            size === "xs" || size === "sm" ? "w-4 h-4" : "w-5 h-5"
          )}
        >
          <BadgeCheck className={size === "xs" || size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </div>
      )}
      {showBadge && (tier === "Gold" || tier === "Platinum") && (
        <div
          className={clsx(
            "absolute -bottom-1 -right-1 rounded-full flex items-center justify-center border-2 border-bg-base shadow-glow",
            size === "xs" || size === "sm" ? "w-4 h-4" : "w-5 h-5"
          )}
          style={{
            background:
              tier === "Platinum"
                ? "linear-gradient(135deg, #67E8F9 0%, #7C3AED 100%)"
                : "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
          }}
        >
          {tier === "Platinum" ? (
            <Sparkles className="w-2.5 h-2.5 text-white" />
          ) : (
            <Crown className="w-2.5 h-2.5 text-white" />
          )}
        </div>
      )}
    </div>
  );
}
