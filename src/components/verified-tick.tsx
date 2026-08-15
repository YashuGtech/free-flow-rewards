import { BadgeCheck } from "lucide-react";
import clsx from "clsx";

export default function VerifiedTick({
  show = false,
  className,
}: {
  show?: boolean;
  className?: string;
}) {
  if (!show) return null;
  return (
    <span
      title="Premium verified"
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300",
        className ?? "w-4 h-4"
      )}
    >
      <BadgeCheck className={clsx(className ? className : "w-3.5 h-3.5")} />
    </span>
  );
}
