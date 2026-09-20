import type { Metadata } from "next";
import { SystemView } from "@/components/system/SystemView";

export const metadata: Metadata = { title: "System", description: "Thirty worlds across six zones. Pick a planet, check your odds, launch." };

export default function SystemPage() {
  return <SystemView />;
}
