import { Clock, CheckCircle2, XCircle } from "lucide-react";
import type { ClaimStatus } from "@/lib/types";
import clsx from "clsx";

export default function SubmissionStatus({
  status,
  reason,
  compact = false,
}: {
  status: ClaimStatus;
  reason?: string;
  compact?: boolean;
}) {
  const map = {
    pending: {
      label: "Pending",
      cls: "bg-amber-500/15 text-amber-300 border-amber-400/25",
      Icon: Clock,
    },
    approved: {
      label: "Approved",
      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
      Icon: CheckCircle2,
    },
    rejected: {
      label: "Rejected",
      cls: "bg-rose-500/15 text-rose-300 border-rose-400/25",
      Icon: XCircle,
    },
  }[status];

  const { label, cls, Icon } = map;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border font-semibold",
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
          cls
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      {status === "rejected" && reason && (
        <p className={clsx("text-rose-200/80 leading-snug", compact ? "text-[10px]" : "text-xs")}>
          <span className="font-semibold text-rose-300">Reason:</span> {reason}
        </p>
      )}
    </div>
  );
}
