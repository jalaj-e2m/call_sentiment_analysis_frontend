"use client";

import { AudioLines, Building, LayoutDashboard, Lock, LogOut, Menu, Moon, Phone, Plug, Settings, Sun, UsersRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { displayTitle } from "@/lib/access";
import { parseRange, rangeHref } from "@/lib/analytics";
import type { Profile } from "@/lib/model";
import { getBrowserDb } from "@/lib/supabase/browser";
import { SyncButton, SyncPanel } from "./sync";
import { Tip, TooltipProvider } from "./tooltip";
import { buttonClass, iconButtonClass } from "./ui";

/** data: locked until the first Fathom sync for executors and engineers. */
const LINKS: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; data?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, data: true },
  { href: "/calls", label: "Calls", icon: Phone, data: true },
  { href: "/clients", label: "Clients", icon: Building, data: true },
  { href: "/fathom", label: "Fathom", icon: Plug },
  { href: "/users", label: "Users", icon: UsersRound, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

const LOCKED_HINT = "Sync your Fathom calls first";

interface NavProps {
  isAdmin: boolean;
  locked: boolean;
  rail?: boolean;
  onNavigate?: () => void;
}

/** Nav links keep the date range and the admin's person filter so switching pages does not reset them. */
function NavLinks(props: NavProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const range = parseRange(params.get("range") ?? undefined);
  const person = params.get("person");
  return <NavList {...props} pathname={pathname} hrefFor={(h) => rangeHref(h, range, props.isAdmin ? person : null)} />;
}

function NavList({ isAdmin, locked, rail = false, onNavigate, pathname, hrefFor }: NavProps & { pathname: string; hrefFor: (href: string) => string }) {
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const itemShape = rail ? "h-9 w-9 justify-center" : "gap-2.5 px-2.5 py-1.5";
  return (
    <nav className={`flex flex-col gap-0.5 text-sm ${rail ? "items-center" : ""}`} aria-label="Main">
      {LINKS.filter((l) => isAdmin || !l.adminOnly).map(({ href, label, icon: Icon, data }) => {
        if (locked && data) {
          const off = (
            <span
              key={href}
              role="link"
              aria-disabled="true"
              aria-label={`${label} (locked: ${LOCKED_HINT.toLowerCase()})`}
              tabIndex={0}
              className={`flex cursor-not-allowed items-center rounded-md font-medium text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:text-zinc-600 ${itemShape}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {rail ? null : (
                <>
                  {label}
                  <Lock className="ml-auto h-3 w-3" aria-hidden />
                </>
              )}
            </span>
          );
          return (
            <Tip key={href} content={`${label}: ${LOCKED_HINT}`} side="right">
              {off}
            </Tip>
          );
        }
        const on = active(href);
        const link = (
          <Link
            key={href}
            href={hrefFor(href)}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            aria-label={rail ? label : undefined}
            className={`flex items-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${itemShape} ${
              on
                ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className={`h-4 w-4 ${on ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500"}`} aria-hidden />
            {rail ? null : label}
          </Link>
        );
        return rail ? (
          <Tip key={href} content={label} side="right">
            {link}
          </Tip>
        ) : (
          link
        );
      })}
    </nav>
  );
}

export function Nav(props: NavProps) {
  const pathname = usePathname();
  return (
    <Suspense fallback={<NavList {...props} pathname={pathname} hrefFor={(h) => h} />}>
      <NavLinks {...props} />
    </Suspense>
  );
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore<boolean | null>(
    subscribeToTheme,
    () => document.documentElement.classList.contains("dark"),
    () => null,
  );
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" onClick={toggle} className={iconButtonClass} aria-label={label} title={label}>
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function SignOutButton({ variant = "icon" }: { variant?: "icon" | "button" }) {
  const router = useRouter();
  const db = getBrowserDb();
  if (!db) return null;
  async function signOut() {
    await db!.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return variant === "icon" ? (
    <button type="button" onClick={signOut} className={iconButtonClass} aria-label="Sign out" title="Sign out">
      <LogOut className="h-4 w-4" aria-hidden />
    </button>
  ) : (
    <button type="button" onClick={signOut} className={buttonClass}>
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      Sign out
    </button>
  );
}

function initials(profile: Profile): string {
  const source = profile.fullName?.trim() || profile.email || "?";
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

function BrandMark() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
      <AudioLines className="h-4 w-4" aria-hidden />
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-1 text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
      <BrandMark />
      Call Sentiment
    </Link>
  );
}

function Avatar({ profile }: { profile: Profile }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {initials(profile)}
    </span>
  );
}

function SidebarBody({ profile, locked, onNavigate }: { profile: Profile; locked: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <Brand />
      <Nav isAdmin={profile.role === "admin"} locked={locked} onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        <SyncPanel />
        <div className="flex items-center gap-2.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <Avatar profile={profile} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{profile.fullName ?? profile.email}</p>
            <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{displayTitle(profile)}</p>
          </div>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

/** Tablet: icon rail with tooltips. */
function RailBody({ profile, locked }: { profile: Profile; locked: boolean }) {
  return (
    <div className="flex h-full flex-col items-center gap-6 py-4">
      <Tip content="Call Sentiment" side="right">
        <Link href="/" aria-label="Call Sentiment home">
          <BrandMark />
        </Link>
      </Tip>
      <Nav isAdmin={profile.role === "admin"} locked={locked} rail />
      <div className="mt-auto flex flex-col items-center gap-2">
        <SyncButton size="icon" />
        <ThemeToggle />
        <SignOutButton />
        <Tip content={`${profile.fullName ?? profile.email} (${displayTitle(profile)})`} side="right">
          <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50" aria-label="Signed-in user">
            <Avatar profile={profile} />
          </button>
        </Tip>
      </div>
    </div>
  );
}

export function AppShell({
  profile,
  locked = false,
  banner,
  children,
}: {
  profile: Profile;
  locked?: boolean;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow dark:focus:bg-zinc-900"
        >
          Skip to content
        </a>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">
          <SidebarBody profile={profile} locked={locked} />
        </aside>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 border-r border-zinc-200 bg-white md:block lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
          <RailBody profile={profile} locked={locked} />
        </aside>

        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
          <Brand />
          <button type="button" className={iconButtonClass} onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {open ? (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" className="absolute inset-0 bg-zinc-950/40" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl dark:bg-zinc-900">
              <button
                type="button"
                className={`${iconButtonClass} absolute right-2 top-3`}
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
              <SidebarBody profile={profile} locked={locked} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="md:pl-16 lg:pl-60">
          {banner}
          <main id="content" className="mx-auto max-w-[1400px] px-4 pb-12 md:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
