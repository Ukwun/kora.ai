export type LeadComplianceRule = {
  region: string;
  version: string;
  consent: "explicit" | "manual_review";
  requirements: string[];
  replacementWindowDays: number;
  refundPolicy: string;
};

const rules: Record<string, LeadComplianceRule> = {
  NG: { region: "Nigeria", version: "ng-2026-01", consent: "explicit", requirements: ["Document how the lead consented to be contacted", "Record a working opt-out method", "Do not import sensitive-trait targeting"], replacementWindowDays: 7, refundPolicy: "Refund or one replacement only when the documented consent, validity, or agreed quality criteria fail within 7 days." },
  GB: { region: "United Kingdom", version: "gb-2026-01", consent: "explicit", requirements: ["Record explicit marketing consent and timestamp", "Provide a clear opt-out route", "Keep source and lawful-basis evidence"], replacementWindowDays: 7, refundPolicy: "Refund or one replacement only after evidence review within 7 days; no guarantee of conversion." },
  EU: { region: "European Union/EEA", version: "eu-2026-01", consent: "explicit", requirements: ["Record purpose-specific consent and timestamp", "Record source, privacy notice, and opt-out route", "Do not use sensitive personal data for targeting"], replacementWindowDays: 7, refundPolicy: "Refund or one replacement only after compliance and quality review within 7 days; no guarantee of conversion." },
  US: { region: "United States", version: "us-2026-01", consent: "explicit", requirements: ["Record source and consent evidence", "Provide opt-out instructions", "Review state-specific outreach requirements before delivery"], replacementWindowDays: 7, refundPolicy: "Refund or one replacement only when agreed validity or consent criteria fail within 7 days." },
  DEFAULT: { region: "Other region", version: "manual-review-2026-01", consent: "manual_review", requirements: ["Manual compliance review is required before delivery", "Record source, consent, opt-out, and quality evidence", "Do not use sensitive personal data for targeting"], replacementWindowDays: 7, refundPolicy: "No delivery or refund promise until regional rules and written terms are reviewed." },
};

export function getLeadComplianceRule(country: string) {
  const normalized = country.trim().toLowerCase();
  if (["nigeria", "ng"].includes(normalized)) return rules.NG;
  if (["uk", "united kingdom", "great britain", "gb"].includes(normalized)) return rules.GB;
  if (["eu", "european union", "eea", "germany", "france", "ireland", "netherlands", "spain", "italy"].includes(normalized)) return rules.EU;
  if (["us", "usa", "united states", "canada"].includes(normalized)) return rules.US;
  return rules.DEFAULT;
}

export const leadQualityCriteria = ["Reachable contact details", "Explicit consent evidence", "Correct country/region and professional targeting", "Relevant role or company information", "No duplicate or previously opted-out contact"];
