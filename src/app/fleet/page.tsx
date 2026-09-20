import type { Metadata } from "next";
import { FleetBuilder } from "@/components/fleet/FleetBuilder";

export const metadata: Metadata = { title: "Fleet", description: "Three slots, one number: Total Fleet Power. Build the fleet, see every planet's odds update live." };

export default function FleetPage() {
  return <FleetBuilder />;
}
