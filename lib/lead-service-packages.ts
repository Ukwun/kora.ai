export const leadPackageIds = ["starter", "growth", "scale", "enterprise"] as const;

export type LeadPackageId = (typeof leadPackageIds)[number];

export const leadPackages = {
  starter: {
    label: "Kora Starter",
    prospects: 25,
    priceNGN: 39_000,
    description: "A targeted starting list, researched against one agreed targeting brief.",
    includes: [
      "Targeted prospect research",
      "Business contact information",
      "Decision-maker details where available",
      "Email delivery",
      "Basic quality review",
      "One targeting brief",
    ],
  },
  growth: {
    label: "Kora Growth",
    prospects: 50,
    priceNGN: 69_000,
    description: "More detailed filtering and stronger contact checks for your sales pipeline.",
    includes: [
      "Everything in Starter",
      "More detailed prospect filtering",
      "Role and company information",
      "Stronger contact verification",
      "Priority fulfilment",
    ],
  },
  scale: {
    label: "Kora Scale",
    prospects: 100,
    priceNGN: 129_000,
    description: "A larger, more segmented prospect pool with quality reporting.",
    includes: [
      "Everything in Growth",
      "Larger prospect pool",
      "More detailed segmentation",
      "Contact-quality reporting",
      "Suitable for ongoing sales prospecting",
    ],
  },
  enterprise: {
    label: "Kora Enterprise",
    prospects: 200,
    priceNGN: 239_000,
    description: "A larger research engagement shaped around your team’s requirements.",
    includes: [
      "Everything in Scale",
      "Larger targeting requirements",
      "Priority fulfilment",
      "Suitable for sales teams and agencies",
      "Custom targeting brief",
    ],
  },
} satisfies Record<LeadPackageId, {
  label: string;
  prospects: number;
  priceNGN: number;
  description: string;
  includes: readonly string[];
}>;
