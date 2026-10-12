"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getBrowserDb } from "@/lib/supabase/browser";
import { buttonClass } from "./ui";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/calls", label: "Calls" },
  { href: "/clients", label: "Clients" },
];

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/settings", label: "Settings" }] : LINKS;
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={`rounded-md px-2.5 py-1.5 ${
            active(l.href)
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {l.label}
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
  return (
    <button type="button" onClick={toggle} className={buttonClass} aria-label="Toggle dark mode">
      {dark === null ? "Theme" : dark ? "Light" : "Dark"}
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const db = getBrowserDb();
  if (!db) return null;
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={async () => {
        await db.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
