import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import Link from "@/components/link";
import Sidebar from "@/components/sidebar";
import TopHeader from "@/components/top-header";
import ToastStack from "@/components/toast-stack";
import MobileNav from "@/components/mobile-nav";
import StoreHydrate from "@/components/store-hydrate";
import SecurityGuard from "@/components/security-guard";
import AdminRedirect from "@/components/admin-redirect";
import MonetagAdManager from "@/components/monetag-ad-manager";
import PageGate from "@/components/page-gate";
import AccountGate from "@/components/account-gate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link href="/" className="btn-primary inline-flex">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-gray-400">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-primary"
          >
            Try again
          </button>
          <a href="/" className="btn-ghost">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PromoPulse — P2P Social Promotion Marketplace" },
      {
        name: "description",
        content:
          "Earn points by completing social promotion tasks, or spend points to promote your own brand across Instagram, Telegram, YouTube and more.",
      },
      { property: "og:title", content: "PromoPulse — P2P Social Promotion Marketplace" },
      {
        property: "og:description",
        content:
          "Earn points by completing social promotion tasks, or spend points to promote your own brand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans relative min-h-screen overflow-x-hidden">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const TWINKLES = [
  { top: "12%", left: "8%" },
  { top: "22%", left: "32%", animationDelay: "0.6s" },
  { top: "55%", left: "62%", animationDelay: "1.2s" },
  { top: "68%", left: "14%", animationDelay: "1.8s" },
  { top: "84%", left: "78%", animationDelay: "2.4s" },
  { top: "30%", left: "88%", animationDelay: "0.2s" },
  { top: "76%", left: "44%", animationDelay: "1.5s" },
];

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The whole app is a client-side wallet/marketplace built on browser storage
  // and the Telegram SDK — render it after hydration to keep SSR markup stable.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-cyan" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AccountGate>
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {TWINKLES.map((style, i) => (
            <div key={i} className="twinkle" style={style} />
          ))}
        </div>

        <Sidebar />
        <div className="relative z-10 min-h-screen pb-24 lg:ml-[244px] lg:pb-0">
          <TopHeader />
          <main className="px-4 py-6 lg:px-8 lg:py-8">
            {/* Page-credit paywall: gated routes cost 1 credit per open. */}
            <PageGate>
              <Outlet />
            </PageGate>
          </main>
        </div>
        <MobileNav />
        <ToastStack />
        <SecurityGuard />
        <StoreHydrate />
        <AdminRedirect />
        <MonetagAdManager />
      </AccountGate>
    </QueryClientProvider>
  );
}
