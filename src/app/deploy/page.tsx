import type { Metadata } from "next";
import { DeployView } from "@/components/deploy/DeployView";

export const metadata: Metadata = { title: "Go live", description: "Operator checklist: token, contract deployment, reward vault." };

export default function DeployPage() {
  return <DeployView />;
}
