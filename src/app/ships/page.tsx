import type { Metadata } from "next";
import { ShipGallery } from "@/components/ships/ShipGallery";

export const metadata: Metadata = { title: "Ships", description: "Every hull in the system, class by class." };

export default function ShipsPage() {
  return <ShipGallery />;
}
