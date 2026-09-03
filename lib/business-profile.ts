// Business Profile and Onboarding Types

export type BusinessType = 
  | "restaurant"
  | "agency"
  | "clinic"
  | "school"
  | "retail"
  | "construction"
  | "manufacturer"
  | "other";

export type BusinessChallenge =
  | "finding_customers"
  | "following_up"
  | "payroll"
  | "inventory"
  | "cash_flow"
  | "employees"
  | "marketing";

export type IntegrationType =
  | "gmail"
  | "whatsapp"
  | "bank"
  | "calendar"
  | "stripe"
  | "paystack"
  | "flutterwave"
  | "shopify"
  | "woocommerce"
  | "google_drive"
  | "dropbox";

export type OnboardingStep =
  | "business_type"
  | "employees"
  | "customers"
  | "software"
  | "challenge"
  | "integrations"
  | "complete";

export type BusinessMetric = {
  name: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
  date: string;
};

export type CustomerProfile = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalSpent: number;
  transactionCount: number;
  lastInteraction: string;
  firstInteraction: string;
  status: "active" | "inactive" | "at_risk";
  notes?: string;
};

export type BusinessMemoryNode = {
  id: string;
  category: "pattern" | "insight" | "metric" | "observation" | "recommendation";
  title: string;
  content: string;
  confidence: number; // 0-100
  source: "manual" | "inferred" | "observed";
  createdAt: string;
  updatedAt: string;
  frequency?: number; // How many times observed
};

export type BusinessProfile = {
  id: string;
  userId: string;
  organizationId: string;
  type: BusinessType;
  employees: number;
  customersPerMonth: number;
  existingSoftware: string[];
  mainChallenge: BusinessChallenge;
  onboardingStep: OnboardingStep;
  onboardingComplete: boolean;
  onboardingCompletedAt?: string;
  integrations: {
    type: IntegrationType;
    connected: boolean;
    connectedAt?: string;
    metadata?: Record<string, unknown>;
  }[];
  metrics: BusinessMetric[];
  memoryNodes: BusinessMemoryNode[];
  behaviorPatterns: {
    invoiceCycle?: number; // Average days between invoices
    paymentCycle?: number; // Average days to get paid
    customerRetention?: number; // Percentage
    productPopularity?: { product: string; sales: number }[];
  };
  createdAt: string;
  updatedAt: string;
  aiContext?: {
    lastContextUpdate: string;
    contextVersion: number;
  };
};

export type OnboardingResponse = {
  step: OnboardingStep;
  data: Record<string, unknown>;
  timestamp: string;
};
