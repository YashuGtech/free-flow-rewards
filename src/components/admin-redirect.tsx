
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";

/**
 * Auto-redirect: when the owner/admin (TG id whitelisted via
 * NEXT_PUBLIC_ADMIN_TG_ID) opens the app, send them straight to the admin
 * panel. Runs once per page load so the admin can still navigate the normal
 * app afterwards.
 */
export default function AdminRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (typeof window === "undefined") return;
    if (isAdmin() && pathname !== "/admin") {
      ran.current = true;
      router.replace("/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
