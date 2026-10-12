import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-zinc-500">This page or record does not exist, or you cannot see it.</p>
      <Link href="/" className="text-sm underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
