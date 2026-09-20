import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = { title: "Profile", description: "Commander level, XP, milestones and settings." };

export default function ProfilePage() {
  return <ProfileView />;
}
