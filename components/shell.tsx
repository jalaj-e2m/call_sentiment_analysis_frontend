"use client";

import { AudioLines, Building, LayoutDashboard, LogOut, Menu, Moon, Phone, Plug, Settings, Sun, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { Profile } from "@/lib/model";
import { getBrowserDb } from "@/lib/supabase/browser";
import { SyncPanel } from "./sync";
import { buttonClass, iconButtonClass } from "./ui";

const LINKS: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/clients", label: "Clients", icon: Building },
  { href: "/fathom", label: "Fathom", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function Nav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="flex flex-col gap-0.5 text-sm" aria-label="Main">
      {LINKS.filter((l) => isAdmin || !l.adminOnly).map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={active(href) ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
            active(href)
              ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white"
              : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${active(href) ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"}`}
            aria-hidden
          />
          {label}
        </Link>
      ))}
    </nav>
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

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-1 text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
        <AudioLines className="h-4 w-4" aria-hidden />
      </span>
      Call Sentiment
    </Link>
  );
}

function SidebarBody({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <Brand />
      <Nav isAdmin={profile.role === "admin"} onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        <SyncPanel />
        <div className="flex items-center gap-2.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {initials(profile)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{profile.fullName ?? profile.email}</p>
            <p className="text-xs capitalize text-zinc-500">{profile.role}</p>
          </div>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ profile, banner, children }: { profile: Profile; banner?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">
        <SidebarBody profile={profile} />
      </aside>

      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
        <Brand />
        <button type="button" className={iconButtonClass} onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl dark:bg-zinc-900">
            <button
              type="button"
              className={`${iconButtonClass} absolute right-2 top-3`}
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <SidebarBody profile={profile} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        {banner}
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
