import type { Metadata } from "next";
import { EconomyView } from "@/components/economy/EconomyView";

export const metadata: Metadata = { title: "Economy", description: "The reward vault, token sinks, and the community numbers." };

export default function EconomyPage() {
  return <EconomyView />;
}
