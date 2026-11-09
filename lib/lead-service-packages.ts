export const leadPackageIds = ["starter", "growth", "scale", "enterprise"] as const;

export type LeadPackageId = (typeof leadPackageIds)[number];

export type LeadCampaign = {
  title: string;
  durationDays: number;
  summary: string;
  deliverables: readonly string[];
};

export type LeadPackage = {
  label: string;
  prospects: number;
  priceNGN: number;
  description: string;
  includes: readonly string[];
  campaign?: LeadCampaign;
};

export const leadPackages: Record<LeadPackageId, LeadPackage> = {
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
      "One-day targeted campaign advert",
    ],
    campaign: {
      title: "One-day targeted campaign advert",
      durationDays: 1,
      summary: "A focused advert for the country or region, industries, company size, roles and professional interests in your approved brief.",
      deliverables: [
        "Audience and channel recommendation for one approved market",
        "One ad-ready headline, primary text and call to action tailored to your offer",
        "A one-day schedule and measurement checklist",
      ],
    },
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
      "Three-day targeted campaign advert",
    ],
    campaign: {
      title: "Three-day targeted campaign advert",
      durationDays: 3,
      summary: "A three-day advert plan for your approved international or local audience, with two audience segments built from your targeting brief.",
      deliverables: [
        "Two audience segments using approved markets, industries, company sizes and roles",
        "Two ad-ready headline and primary-text variations with calls to action",
        "A three-day schedule with a mid-campaign review checkpoint and measurement checklist",
      ],
    },
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
      "Seven-day targeted campaign advert",
    ],
    campaign: {
      title: "Seven-day targeted campaign advert",
      durationDays: 7,
      summary: "A seven-day advert plan shaped around your approved brief, with up to three audience segments for local or international targeting.",
      deliverables: [
        "Up to three audience segments using approved markets, industries, company sizes and roles",
        "Three ad-ready creative and copy variations with tailored calls to action",
        "A seven-day schedule, mid-campaign review checkpoint and wrap-up measurement checklist",
      ],
    },
  },
};
