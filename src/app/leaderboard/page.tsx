import type { Metadata } from "next";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const metadata: Metadata = { title: "Leaderboard", description: "Strongest fleets, top miners, furthest worlds." };

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
