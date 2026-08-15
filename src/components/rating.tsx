import { Star } from "lucide-react";
import clsx from "clsx";

export default function Rating({
  rating,
  count,
  className,
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className={clsx("inline-flex items-center gap-1", className)} title={`${rating.toFixed(1)} / 5 · ${count ?? 0} ratings`}>
      <span className="relative inline-block leading-none">
        <span className="flex text-gray-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="w-3 h-3 fill-current" />
          ))}
        </span>
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
          <span className="flex text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-current" />
            ))}
          </span>
        </span>
      </span>
      <span className="text-[11px] font-semibold text-gray-300 tabular">{rating.toFixed(1)}</span>
      {typeof count === "number" && (
        <span className="text-[10px] text-gray-500">({count.toLocaleString()})</span>
      )}
    </span>
  );
}
