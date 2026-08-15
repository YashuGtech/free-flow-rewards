
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Send } from "lucide-react";
import clsx from "clsx";

export default function RateDialog({
  title,
  subtitle,
  onSubmit,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onSubmit: (stars: number, comment: string) => void;
  onClose: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const LABELS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 24, scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong rounded-3xl w-full max-w-md p-6 border border-white/10 shadow-card relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-16 w-52 h-52 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center z-10">
            <X className="w-4 h-4" />
          </button>

          <div className="relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mx-auto flex items-center justify-center shadow-glow">
              <Star className="w-6 h-6 text-white fill-current" />
            </div>
            <div className="font-extrabold text-lg mt-3 leading-tight">{title}</div>
            {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
          </div>

          {/* Star picker */}
          <div className="relative mt-5 flex flex-col items-center">
            <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setStars(n)}
                  onMouseEnter={() => setHover(n)}
                  className="p-1 -m-1 transition-transform hover:scale-110"
                  aria-label={`${n} stars`}
                >
                  <Star
                    className={clsx(
                      "w-9 h-9 transition-all",
                      n <= (hover || stars)
                        ? "text-amber-400 fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                        : "text-gray-700"
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-semibold mt-2 text-amber-300">{LABELS[hover || stars]}</div>
          </div>

          <div className="relative mt-5">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">
              Comment (optional)
            </div>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What was your experience like?"
              className="w-full px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm placeholder:text-gray-500 focus:outline-none focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/30 resize-none"
            />
          </div>

          <div className="relative mt-5 flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost flex-1">
              Skip
            </button>
            <button
              onClick={() => {
                onSubmit(stars, comment.trim());
                onClose();
              }}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Submit rating
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
