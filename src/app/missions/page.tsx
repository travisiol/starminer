import type { Metadata } from "next";
import { MissionsView } from "@/components/missions/MissionsView";

export const metadata: Metadata = { title: "Missions", description: "The active expedition, its timer and odds, and the log of every resolved one." };

export default function MissionsPage() {
  return <MissionsView />;
}
