import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = { title: "How it works", description: "Thirty worlds, one three-ship fleet, transparent odds. Build, explore, mine, grow." };

export default function HowItWorksPage() {
  return <Landing />;
}
