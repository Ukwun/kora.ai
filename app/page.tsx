import type { Metadata } from "next";
import HomeExperience from "./components/HomeExperience";

export const metadata: Metadata = {
  title: "Kora — See your whole business. Clearly.",
  description:
    "Connect your business and find your next customers worldwide. Kora helps shape audience research and thoughtful outreach around your goals.",
};

export default function HomePage() {
  return <HomeExperience />;
}
