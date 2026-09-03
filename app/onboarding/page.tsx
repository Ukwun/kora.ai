"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingFlow from "@/app/components/OnboardingFlow";

export default function OnboardingPage() {
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if onboarding is already complete
    const checkOnboarding = async () => {
      try {
        const response = await fetch("/api/onboarding");
        const data = await response.json();

        if (data.complete) {
          router.push("/dashboard");
        } else {
          setIsComplete(false);
        }
      } catch (error) {
        console.error("Error checking onboarding:", error);
        setIsComplete(false);
      }
    };

    checkOnboarding();
  }, [router]);

  if (isComplete === null) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4" />
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return null;
  }

  return <OnboardingFlow />;
}
