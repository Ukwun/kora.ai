import type { Metadata } from "next";
import HomeExperience from "./components/HomeExperience";

export const metadata: Metadata = {
  title: "Kora — See your whole business. Clearly.",
  description:
    "Connect the people, work, and money behind your business in one workspace-aware operating system.",
};

export default function HomePage() {
  return <HomeExperience />;
}
