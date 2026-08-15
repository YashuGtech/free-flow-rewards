
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Rocket, ClipboardList, FileCheck2, User } from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";

const NAV = [
  { href: "/", label: "Earn", icon: Zap },
  { href: "/promote", label: "Promote", icon: Rocket },
  { href: "/campaigns", label: "Campaigns", icon: ClipboardList },
  { href: "/leads", label: "Leads", icon: FileCheck2 },
  { href: "/profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const path = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2">
      <div className="glass-strong border border-white/10 rounded-2xl px-2 py-2 shadow-card">
        <div className="flex items-center justify-between">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? path === "/" : path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl flex-1"
              >
                {active && (
                  <motion.div
                    layoutId="mnav-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-cyan/25 to-brand-violet/25 border border-white/15"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon
                  className={clsx(
                    "relative w-5 h-5 mb-0.5",
                    active ? "text-white" : "text-gray-500"
                  )}
                />
                <span
                  className={clsx(
                    "relative text-[10px] font-semibold",
                    active ? "text-white" : "text-gray-500"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
