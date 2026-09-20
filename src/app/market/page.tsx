import type { Metadata } from "next";
import { MarketView } from "@/components/market/MarketView";

export const metadata: Metadata = { title: "Ship Market", description: "Twenty-four hulls across six classes. Every ship adds Fleet Power." };

export default function MarketPage() {
  return <MarketView />;
}
