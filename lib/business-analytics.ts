// Business analytics helpers operate on recorded business events.

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
  estimatedValue: number | null;
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
    amount?: number;
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
    estimatedValue: quotations.filter((quote) => !quote.followed_up && typeof quote.amount === "number").length === missed
      ? quotations.filter((quote) => !quote.followed_up).reduce((sum, quote) => sum + (quote.amount ?? 0), 0)
      : null,
    recommendation: total
      ? `There ${missed === 1 ? "is" : "are"} ${missed} of ${total} recorded quotations without a follow-up status. Review the quotation records before contacting customers.`
      : "No quotation records are available to assess follow-up activity.",
  };
}

// Detect payment patterns
export function analyzePaymentPattern(
  invoices: Array<{
    createdAt: string;
    paidAt?: string;
    dueAt?: string;
    amount: number;
  }>
): {
  averagePaymentDays: number;
  overduePercentage: number;
  overdueTotalValue: number;
} {
  const paymentDays: number[] = [];
  let overdueCount = 0;
  let overdueTotalValue = 0;

  for (const invoice of invoices) {
    if (invoice.paidAt) {
      const created = new Date(invoice.createdAt);
      const paid = new Date(invoice.paidAt);
      const days = Math.floor(
        (paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      );
      paymentDays.push(days);
    } else if (invoice.dueAt) {
      const now = new Date();
      if (new Date(invoice.dueAt) < now) {
        overdueCount++;
        overdueTotalValue += invoice.amount;
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
    overdueTotalValue,
  };
}
