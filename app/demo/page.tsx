import type { Metadata } from "next";
import { DemoDeck } from "@/components/demo/DemoDeck";

export const metadata: Metadata = { title: "Pitch" };

/** Static pitch deck with sample data only; open at /demo. Arrow keys move, N shows speaker notes. */
export default function DemoPage() {
  return <DemoDeck />;
}
