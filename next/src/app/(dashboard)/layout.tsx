import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyDemoToken, DEMO_COOKIE } from "@/lib/demo-token";
import Image from "next/image";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/shared/sidebar";
import { BottomNav } from "@/components/shared/bottom-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { DemoBanner } from "@/components/shared/demo-banner";
import { HealthAutoSync } from "@/components/shared/health-auto-sync";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { KeyboardShortcutsProvider } from "@/components/shared/keyboard-shortcuts-provider";
import { EnabledModulesProvider } from "@/hooks/use-enabled-modules";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const demoToken = cookieStore.get(DEMO_COOKIE)?.value;
  const isDemo = await verifyDemoToken(demoToken);

  let email: string;
  let name: string | null | undefined;
  let role: string | undefined;
  let session: Session | null = null;

  if (isDemo) {
    email = "demo@example.com";
    name = "Demo User";
    role = "user";
  } else {
    session = await auth() as Session | null;
    if (!session?.user) {
      redirect("/login");
    }
    email = session.user.email!;
    name = session.user.name;
    role = (session.user as Record<string, unknown>).role as string | undefined;
  }

  return (
    <SessionProvider session={session}>
      <EnabledModulesProvider>
        <div className="flex flex-col min-h-screen bg-background">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
          >
            Skip to content
          </a>

          {/* Top bar: title + toggles */}
          <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Image src="/PD.png" alt="Personal Dashboard" width={28} height={28} className="rounded" />
                <span className="hidden sm:inline text-sm font-semibold truncate">Personal Dashboard</span>
              </div>
              <div className="flex items-center gap-2">
                <Sidebar
                  userEmail={email}
                  userName={name}
                  userRole={role}
                  isDemo={isDemo}
                />
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>

            {/* Horizontal nav — desktop only */}
            <div className="hidden sm:block">
              <BottomNav userRole={role} />
            </div>
          </header>

          {isDemo && <DemoBanner />}

          <KeyboardShortcutsProvider>
            <main id="main-content" className="flex-1 px-3 py-3 md:p-6 animate-page-in pb-20 sm:pb-0">
              <ErrorBoundary module="Page">
                {children}
              </ErrorBoundary>
            </main>
          </KeyboardShortcutsProvider>

          {/* Bottom nav — mobile only (thumb zone) */}
          <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/50 sm:hidden pb-safe">
            <BottomNav userRole={role} />
          </nav>

          <HealthAutoSync />
        </div>
      </EnabledModulesProvider>
    </SessionProvider>
  );
}
