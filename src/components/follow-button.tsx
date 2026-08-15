"use client";

import { UserPlus, UserCheck } from "lucide-react";
import { useApp } from "@/lib/store";
import clsx from "clsx";

export default function FollowButton({
  handle,
  size = "md",
  className,
}: {
  handle: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const following = useApp((s) => s.following);
  const follow = useApp((s) => s.follow);
  const unfollow = useApp((s) => s.unfollow);
  const myHandle = useApp((s) => s.handle);
  const isMe = handle === myHandle;
  const active = following.includes(handle);

  if (isMe) return null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        active ? unfollow(handle) : follow(handle);
      }}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all border",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-xs",
        active
          ? "bg-white/[0.05] border-white/15 text-gray-300 hover:border-rose-400/40 hover:text-rose-300"
          : "bg-gradient-to-r from-brand-cyan to-brand-violet border-transparent text-white shadow-glow hover:shadow-glow-violet hover:-translate-y-0.5",
        className
      )}
    >
      {active ? (
        <>
          <UserCheck className="w-3.5 h-3.5" /> Following
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" /> Follow
        </>
      )}
    </button>
  );
}
