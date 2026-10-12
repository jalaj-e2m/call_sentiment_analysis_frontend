import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-1 text-sm text-zinc-500">This page or record does not exist, or you cannot see it.</p>
      <Link href="/" className={`${buttonClass} mt-6`}>
        Back to the dashboard
      </Link>
    </main>
  );
}
