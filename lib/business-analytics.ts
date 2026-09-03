// Business Analytics and Pattern Recognition

import type { BusinessProfile } from "./business-profile";

export interface BehaviorPattern {
  name: string;
  frequency: number;
  lastOccurrence: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerAnalysis {
  id: string;
  name: string;
  totalSpent: number;
  transactionCount: number;
  averageTransactionValue: number;
  lastPurchaseDate: string;
  daysInactive: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: string;
}

export interface FollowUpOpportunity {
  quotationsSent: number;
  quotationsFollowedUp: number;
  followUpRate: number;
  missedOpportunities: number;
  estimatedValue: number;
  recommendation: string;
}

export interface InventoryPattern {
  productName: string;
  sellOutCycle: number; // days
  nextReorderDate: string;
  stockLevel: number;
  recommendation: string;
}

export interface BusinessMetrics {
  invoiceCount: number;
  customerCount: number;
  taskCount: number;
  paymentCount: number;
  expenseCount: number;
  teamSize: number;
  averageInvoiceValue: number;
  averagePaymentDays: number;
  overduePct: number;
}

// Analyze customer behavior
export function analyzeTopCustomer(
  customers: Array<{ name: string; totalSpent: number }>
): { name: string; spent: number } | null {
  if (customers.length === 0) return null;

  const top = customers.reduce((best, current) =>
    current.totalSpent > best.totalSpent ? current : best
  );

  return {
    name: top.name,
    spent: top.totalSpent,
  };
}

// Detect follow-up pattern
export function analyzeFollowUpPattern(
  quotations: Array<{
    id: string;
    followed_up: boolean;
  }>
): FollowUpOpportunity {
  const total = quotations.length;
  const followed = quotations.filter((q) => q.followed_up).length;
  const followUpRate = total > 0 ? (followed / total) * 100 : 0;
  const missed = total - followed;

  return {
    quotationsSent: total,
    quotationsFollowedUp: followed,
    followUpRate: Math.round(followUpRate),
    missedOpportunities: missed,
    estimatedValue: missed * 50000, // estimated value per quote
    recommendation: `You've sent ${total} quotations this month. ${missed} haven't received a follow-up. Businesses often recover opportunities simply by following up once. Would you like me to draft those messages?`,
  };
}

// Detect inventory patterns
export function analyzeInventoryPattern(
  productName: string,
  salesHistory: Array<{ date: string; sold: boolean }>
): InventoryPattern {
  // Calculate average sell-out cycle
  let cycles: number[] = [];
  let currentCycle = 0;
  let lastSaleDate: Date | null = null;

  for (const entry of salesHistory) {
    if (entry.sold) {
      if (lastSaleDate) {
        const daysElapsed = Math.floor(
          (new Date(entry.date).getTime() - lastSaleDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        cycles.push(daysElapsed);
      }
      lastSaleDate = new Date(entry.date);
    }
  }

  const avgCycle =
    cycles.length > 0
      ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
      : 28; // default to 28 days

  const nextReorder = new Date();
  nextReorder.setDate(nextReorder.getDate() + Math.max(0, avgCycle - 7)); // Reorder 7 days before cycle

  return {
    productName,
    sellOutCycle: avgCycle,
    nextReorderDate: nextReorder.toISOString().split("T")[0],
    stockLevel: 50, // placeholder
    recommendation: `${productName} usually sells out every ${avgCycle} days. Reorder before ${nextReorder.toLocaleDateString()}.`,
  };
}

// Detect payment patterns
export function analyzePaymentPattern(
  invoices: Array<{
    createdAt: string;
    paidAt?: string;
  }>
): {
  averagePaymentDays: number;
  overduePercentage: number;
  overdueTotalValue: number;
} {
  let paymentDays: number[] = [];
  let overdueCount = 0;

  for (const invoice of invoices) {
    if (invoice.paidAt) {
      const created = new Date(invoice.createdAt);
      const paid = new Date(invoice.paidAt);
      const days = Math.floor(
        (paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      );
      paymentDays.push(days);
    } else {
      // Still unpaid, consider overdue if > 30 days
      const created = new Date(invoice.createdAt);
      const now = new Date();
      const days = Math.floor(
        (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 30) {
        overdueCount++;
      }
    }
  }

  const avgDays =
    paymentDays.length > 0
      ? Math.round(paymentDays.reduce((a, b) => a + b, 0) / paymentDays.length)
      : 0;

  const overduePct =
    invoices.length > 0
      ? Math.round((overdueCount / invoices.length) * 100)
      : 0;

  return {
    averagePaymentDays: avgDays,
    overduePercentage: overduePct,
    overdueTotalValue: overdueCount * 100000, // placeholder
  };
}

// Generate AI recommendations based on patterns
export function generatePatternRecommendations(
  profile: BusinessProfile
): string[] {
  const recommendations: string[] = [];

  // If challenge is cash flow, check payment patterns
  if (profile.mainChallenge === "cash_flow") {
    if (profile.behaviorPatterns.invoiceCycle) {
      recommendations.push(
        `Your invoice cycle is ${profile.behaviorPatterns.invoiceCycle} days. Consider automating reminders.`
      );
    }
  }

  // If many quotations sent, check follow-up
  if (profile.memoryNodes.length > 10) {
    const quotationMemory = profile.memoryNodes.find((n) =>
      n.title.includes("quotation")
    );
    if (quotationMemory) {
      recommendations.push(
        "Quotations are being tracked. Have you followed up on all of them?"
      );
    }
  }

  // If retail or restaurant, check inventory
  if (["retail", "restaurant"].includes(profile.type)) {
    recommendations.push("Inventory patterns are being monitored automatically.");
  }

  // If has employees, suggest team productivity tracking
  if (profile.employees > 1) {
    recommendations.push("You have a team. Let me track who's most productive.");
  }

  return recommendations;
}

// Calculate business health score
export function calculateBusinessHealthScore(
  profile: BusinessProfile
): number {
  let score = 50; // base score

  // Onboarding bonus
  if (profile.onboardingComplete) {
    score += 10;
  }

  // Integration bonus
  const connectedIntegrations = profile.integrations.filter(
    (i) => i.connected
  ).length;
  score += connectedIntegrations * 5;

  // Activity bonus
  if (profile.memoryNodes.length > 0) {
    score += Math.min(20, profile.memoryNodes.length);
  }

  // Behavior pattern bonus
  if (Object.keys(profile.behaviorPatterns).length > 0) {
    score += 10;
  }

  return Math.min(100, score);
}
