import type { Metadata } from "next";
import { HangarView } from "@/components/hangar/HangarView";

export const metadata: Metadata = { title: "Hangar", description: "Your ships on three platforms. Equip up to three; the platform powers up." };

export default function HangarPage() {
  return <HangarView />;
}
