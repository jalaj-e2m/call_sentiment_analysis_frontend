import {
  ArrowRight,
  AudioLines,
  BellRing,
  Building2,
  Check,
  Clock,
  Coins,
  Download,
  EyeOff,
  GitMerge,
  Headphones,
  LayoutDashboard,
  LayoutGrid,
  Plug,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmotionChip, IntensityDots, SentimentBadge } from "@/components/sentiment";
import { Notice } from "@/components/ui";

export interface Slide {
  id: string;
  /** Short name for the progress bar and the slide counter. */
  label: string;
  /** What the presenter says; shown only in the speaker notes panel. */
  notes: string;
  body: ReactNode;
}

const eyebrow = "text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400";
const headline = "mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl";
const panel = "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const card = `${panel} p-6`;

function Heading({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <header className="mb-10">
      <p className={eyebrow}>{kicker}</p>
      <h2 className={headline}>{children}</h2>
    </header>
  );
}

function IconTile({ icon: Icon, tone = "indigo" }: { icon: LucideIcon; tone?: "indigo" | "unhappy" | "happy" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
    unhappy: "bg-sent-unhappy-soft text-sent-unhappy-fg",
    happy: "bg-sent-happy-soft text-sent-happy-fg",
  };
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

// Slides -----------------------------------------------------------------------------------------

function TitleSlide() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
        <AudioLines className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Call Sentiment</h1>
      <p className="mt-5 max-w-2xl text-xl text-zinc-600 text-balance dark:text-zinc-400">
        How our clients feel, taken from the calls we already record.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        <SentimentBadge label="happy" score={8} />
        <SentimentBadge label="neutral" score={6} />
        <SentimentBadge label="unhappy" score={3} />
      </div>
      <p className="mt-16 text-sm text-zinc-500">Press → to begin</p>
    </div>
  );
}

function Track({ steps, ending, tone }: { steps: string[]; ending: string; tone: "unhappy" | "happy" }) {
  const end = tone === "unhappy" ? "border-sent-unhappy-line bg-sent-unhappy-soft text-sent-unhappy-fg" : "border-sent-happy-line bg-sent-happy-soft text-sent-happy-fg";
  return (
    <ol className="flex flex-wrap items-center gap-3">
      {steps.map((s) => (
        <li key={s} className="flex items-center gap-3">
          <span className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-900">{s}</span>
          <ArrowRight className="h-5 w-5 text-zinc-400" aria-hidden />
        </li>
      ))}
      <li>
        <span className={`rounded-xl border px-4 py-3 text-base font-semibold ${end}`}>{ending}</span>
      </li>
    </ol>
  );
}

function OpeningSlide() {
  return (
    <div>
      <Heading kicker="Opening">
        We record every client call.
        <br />
        <span className="text-zinc-500 dark:text-zinc-400">We almost never listen to them.</span>
      </Heading>
      <div className="space-y-8">
        <div>
          <p className="mb-3 text-sm font-medium text-zinc-500">Today</p>
          <Track steps={["Call recorded in Fathom", "Nobody watches it"]} ending="Client escalates or leaves" tone="unhappy" />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-zinc-500">With Call Sentiment</p>
          <Track steps={["Call recorded in Fathom", "Analysed for us"]} ending="Flagged the same week, with the exact moment" tone="happy" />
        </div>
      </div>
    </div>
  );
}

function ProblemSlide() {
  const problems: { icon: LucideIcon; title: string; text: string; extra?: ReactNode }[] = [
    { icon: Clock, title: "Hours of video", text: "The recordings exist, but nobody has time to review them." },
    {
      icon: EyeOff,
      title: "Warning signs stay hidden",
      text: "Frustration surfaces only when it is too late.",
      extra: (
        <div className="mt-4 flex flex-wrap gap-2">
          {["Delays", "Pricing", "Reporting"].map((t) => (
            <EmotionChip key={t} emotion={t} polarity="negative" />
          ))}
        </div>
      ),
    },
    { icon: LayoutGrid, title: "No single view", text: "Across clients and team members, we rely on gut feeling instead of evidence." },
  ];
  return (
    <div>
      <Heading kicker="The problem">Three problems we have today</Heading>
      <div className="grid gap-5 md:grid-cols-3">
        {problems.map((p, i) => (
          <article key={p.title} className={card}>
            <div className="flex items-center justify-between">
              <IconTile icon={p.icon} tone="unhappy" />
              <span className="text-4xl font-semibold tabular-nums text-zinc-200 dark:text-zinc-800">{i + 1}</span>
            </div>
            <h3 className="mt-5 text-xl font-semibold">{p.title}</h3>
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">{p.text}</p>
            {p.extra}
          </article>
        ))}
      </div>
    </div>
  );
}

function Mark({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sent-happy-soft text-sent-happy-fg">
      <Check className="h-4 w-4" aria-label="Yes" />
    </span>
  ) : (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
      <X className="h-4 w-4" aria-label="No" />
    </span>
  );
}

function WhySlide() {
  const rows: [string, boolean][] = [
    ["A summary of each call", true],
    ["Is the client happy? A 1–10 score", false],
    ["Adds up across calls and clients", false],
    ["Real quotes, checked against the transcript", false],
  ];
  return (
    <div>
      <Heading kicker="Why this solution">A layer on top of Fathom, not another note-taker</Heading>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className={`${panel} overflow-hidden`}>
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
                <th className="px-5 py-3 font-medium" scope="col" />
                <th className="px-3 py-3 text-center font-medium" scope="col">
                  Fathom
                </th>
                <th className="px-5 py-3 text-center font-semibold text-indigo-600 dark:text-indigo-400" scope="col">
                  Call Sentiment
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, fathom]) => (
                <tr key={label} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
                  <th className="px-5 py-4 font-medium" scope="row">
                    {label}
                  </th>
                  <td className="px-3 py-4 text-center">
                    <Mark yes={fathom} />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Mark yes />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-500">Every score is backed by evidence (sample data)</p>
          <article className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <EmotionChip emotion="frustration" polarity="negative" />
              <IntensityDots intensity={3} polarity="negative" />
              <span className="text-sm font-medium">Reporting delays</span>
              <span className="ml-auto font-mono text-xs text-zinc-500">14:32</span>
            </div>
            <blockquote className="mt-3 border-l-2 border-zinc-300 pl-3 text-base italic dark:border-zinc-600">
              “This is the second month the report has come in late.”
            </blockquote>
            <p className="mt-2 text-xs text-zinc-500">Client · quote found in the transcript</p>
          </article>
          <article className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <EmotionChip emotion="concern" polarity="negative" />
              <IntensityDots intensity={2} polarity="negative" />
              <span className="text-sm font-medium">Budget</span>
              <span className="ml-auto font-mono text-xs text-zinc-500">22:05</span>
            </div>
            <div className="mt-3 space-y-1">
              <Notice tone="warning">Quote not matched to transcript. Do not treat it as evidence.</Notice>
              <p className="pl-3 text-base italic text-zinc-500 line-through decoration-zinc-400">“We might need to cut the budget.”</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function FlowSlide() {
  const steps: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Plug, title: "Connect Fathom", text: "Each team member, once." },
    { icon: Download, title: "Import client calls only", text: "Skips internal meetings, interviews, and calls that are too short or too long." },
    { icon: Building2, title: "Match the client", text: "By the attendees' email domains." },
    { icon: GitMerge, title: "One meeting, one call", text: "Two of us recorded it? Merged, so nothing is double-counted." },
    { icon: Sparkles, title: "AI analysis", text: "Score, label, summary, reasoning and key moments with timestamps." },
    { icon: LayoutDashboard, title: "Dashboards", text: "Per client, per person and for the whole portfolio." },
  ];
  return (
    <div>
      <Heading kicker="What it does">From recording to insight in six steps</Heading>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`${card} flex gap-4`}>
            <IconTile icon={s.icon} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HelpsSlide() {
  const groups: { icon: LucideIcon; who: string; what: string; text: string }[] = [
    { icon: BellRing, who: "Leadership", what: "An early-warning system", text: "See which clients need attention this week, instead of hearing about it next quarter." },
    { icon: Headphones, who: "Account owners", what: "A coaching tool", text: "Jump straight to the moment a client got frustrated and hear exactly what was said." },
    { icon: Coins, who: "The company", what: "Value from what we already pay for", text: "Hundreds of hours of recordings turned into data we can act on." },
  ];
  return (
    <div>
      <Heading kicker="How it helps">One platform, three wins</Heading>
      <div className="grid gap-5 md:grid-cols-3">
        {groups.map((g) => (
          <article key={g.who} className={card}>
            <IconTile icon={g.icon} tone="happy" />
            <p className="mt-5 text-sm font-medium text-zinc-500">{g.who}</p>
            <h3 className="mt-1 text-xl font-semibold">{g.what}</h3>
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">{g.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function LiveDemoSlide() {
  const pages = [
    { href: "/", label: "Dashboard", text: "KPIs, needs attention, portfolio, topics" },
    { href: "/calls", label: "Calls", text: "Every client call, filters, Analyze" },
    { href: "/clients", label: "Clients", text: "Client health, ranked by attention" },
    { href: "/users", label: "Users", text: "Roles and access (admin)" },
    { href: "/settings", label: "Settings", text: "The rules behind the scenes (admin)" },
  ];
  return (
    <div>
      <Heading kicker="Live demo">Let’s see it on real calls</Heading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className={`${card} group flex items-center justify-between gap-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50`}
            >
              <span>
                <span className="block text-lg font-semibold">{p.label}</span>
                <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{p.text}</span>
              </span>
              <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SLIDES: Slide[] = [
  {
    id: "title",
    label: "Title",
    notes: "Introduce yourself and the goal: ten minutes on the problem and the idea, then a live demo on real calls.",
    body: <TitleSlide />,
  },
  {
    id: "opening",
    label: "Opening",
    notes:
      "Every week our team has dozens of client calls, and every one of them is recorded in Fathom. But almost nobody goes back and watches them, so we only find out a client is unhappy when they escalate or leave. That's why I built a platform that listens to those calls for us, tells us how each client is feeling, and shows us exactly where in the call it happened.",
    body: <OpeningSlide />,
  },
  {
    id: "problem",
    label: "Problem",
    notes:
      "Today we have three problems. First, the recordings exist, but they are hours of video, so nobody has time to review them. Second, because nobody reviews them, warning signs like frustration about delays, pricing or reporting stay hidden until it's too late. And third, leadership has no single view across clients and team members, so we rely on gut feeling and whoever speaks up in meetings, rather than on evidence.",
    body: <ProblemSlide />,
  },
  {
    id: "why",
    label: "Why",
    notes:
      "Fathom already gives a summary per call, but a summary doesn't tell you whether the client is happy, and it doesn't add up across calls or clients. So instead of building another note-taker, I built a layer on top of Fathom. It pulls in the calls we already record, then scores client sentiment from 1 to 10, and backs every score with real quotes from the transcript. Because every quote is checked against the transcript, we're not just trusting the AI. And if a quote can't be matched, the platform says so clearly and never shows it as evidence.",
    body: <WhySlide />,
  },
  {
    id: "flow",
    label: "Flow",
    notes:
      "The flow is simple. First, each team member connects their own Fathom account once. Then the platform imports their meetings, but it keeps only real client calls. It skips internal meetings, interviews, and calls that are too short or too long. Next, it matches each call to the right client using the attendees' email domains. And if two of us recorded the same meeting, it merges them into one call, so we never double-count and there is only one analysis per meeting. After that, the AI reads the transcript and produces a score, a label (happy, neutral or unhappy), a summary, the reasoning behind the score, and the key emotional moments with timestamps. Finally, all of it rolls up into dashboards per client, per person and for the whole portfolio.",
    body: <FlowSlide />,
  },
  {
    id: "helps",
    label: "Impact",
    notes:
      "For leadership, it's an early-warning system. You see which clients need attention this week, instead of hearing about it next quarter. For account owners, it's a coaching tool, because they can jump straight to the moment a client got frustrated and hear exactly what was said. And for the company, it turns hundreds of hours of recordings we already pay for into data we can act on.",
    body: <HelpsSlide />,
  },
  {
    id: "demo",
    label: "Demo",
    notes: "So that's the idea. Now let me show you the product itself, starting with the dashboard a manager sees first.",
    body: <LiveDemoSlide />,
  },
];
