import type { BusinessUser, Organization } from "./store";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5";

export type AIMessageRole = "user" | "assistant" | "system";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIRecommendation = {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  summary: string;
  action: string;
  intensity: "High" | "Medium" | "Low";
  category: "customer" | "revenue" | "operations" | "team" | "cash-flow" | "growth";
  approved: boolean;
  executed: boolean;
  createdAt: string;
};

export type AIInsight = {
  id: string;
  organizationId: string;
  title: string;
  summary: string;
  type: "pattern" | "anomaly" | "opportunity" | "risk";
  intensity: "High" | "Medium" | "Low";
  metrics?: Record<string, number | string>;
  createdAt: string;
};

export type AIAnalytics = {
  organizationId: string;
  totalRevenue: number | null;
  activeCustomers: number;
  openTasks: number;
  retentionRate: number | null;
  avgInvoiceValue: number | null;
  paymentDaysOverdue: number | null;
  topPerformers: string[];
  bottlenecks: string[];
  opportunities: string[];
  trends: Record<string, "up" | "down" | "stable">;
};

export type AIContext = {
  user: BusinessUser;
  organization: Organization;
  businessProfile?: {
    businessName?: string;
    industry?: string;
    country?: string;
    currency?: string;
    timezone?: string;
    employees?: number;
    customersPerMonth?: number;
    monthlyRevenueRange?: string;
    offerings?: string[];
    goals?: string[];
    mainChallenge?: string;
    source?: string;
    updatedAt?: string;
  } | null;
  recentActivity: Array<{
    label: string;
    detail: string;
    time: string;
  }>;
  memoryNodes: Array<{
    label: string;
    count: number;
  }>;
  metrics: {
    revenue: number;
    customers: number;
    tasks: number;
    retention: number | null;
  };
  evidence?: {
    overdueInvoiceCount: number;
    overdueInvoiceAmount: number;
    overdueTaskCount: number;
    dueTodayTaskCount: number;
    paidInvoiceCount: number;
    overdueInvoices: Array<{ id: string; number: string; dueAt?: string; amount: number; customerId?: string }>;
    overdueTasks: Array<{ id: string; title: string; dueAt?: string; assignedTo?: string }>;
    dueTodayTasks: Array<{ id: string; title: string; dueAt?: string; assignedTo?: string }>;
  };
};

export class AIEngine {
  async generateRecommendations(context: AIContext): Promise<AIRecommendation[]> {
    const recommendations: AIRecommendation[] = [];
    const evidence = context.evidence;
    const add = (key: string, title: string, summary: string, action: string, category: AIRecommendation["category"], intensity: AIRecommendation["intensity"]) => {
      recommendations.push({ id: `rec_${Date.now()}_${key}`, userId: context.user.id, organizationId: context.organization.id, title, summary, action, intensity, category, approved: false, executed: false, createdAt: new Date().toISOString() });
    };
    if (evidence && evidence.overdueInvoiceCount > 0) {
      const amount = new Intl.NumberFormat("en-NG", { style: "currency", currency: context.organization.currency || "NGN", maximumFractionDigits: 0 }).format(evidence.overdueInvoiceAmount);
      add("overdue-invoices", "Review overdue invoices", `${evidence.overdueInvoiceCount} invoice${evidence.overdueInvoiceCount === 1 ? " is" : "s are"} past due, totaling ${amount}.`, "Review the invoice records and decide whether to contact those customers.", "cash-flow", "High");
    }
    if (evidence && evidence.overdueTaskCount > 0) {
      add("overdue-tasks", "Review overdue tasks", `${evidence.overdueTaskCount} open task${evidence.overdueTaskCount === 1 ? " is" : "s are"} past due.`, "Review task owners, status, and due dates.", "operations", "High");
    }
    if (evidence && evidence.dueTodayTaskCount > 0) {
      add("due-today", "Check today?s due tasks", `${evidence.dueTodayTaskCount} open task${evidence.dueTodayTaskCount === 1 ? " is" : "s are"} due today.`, "Review today?s tasks with their assignees.", "operations", "Medium");
    }
    return recommendations;
  }

  async generateInsights(analytics: AIAnalytics): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    if (analytics.paymentDaysOverdue !== null && analytics.paymentDaysOverdue > 15) {
      insights.push({
        id: `ins_${Date.now()}_1`,
        organizationId: analytics.organizationId,
        title: "Payment delays detected",
        summary: `${analytics.paymentDaysOverdue} days overdue on average. Consider sending payment reminders or adjusting credit terms.`,
        type: "anomaly",
        intensity: "High",
        createdAt: new Date().toISOString(),
      });
    }

    if (analytics.retentionRate !== null && analytics.retentionRate < 85) {
      insights.push({
        id: `ins_${Date.now()}_2`,
        organizationId: analytics.organizationId,
        title: "Customer retention below target",
        summary: `Recorded customer retention is ${analytics.retentionRate}%. Review the supporting period and records before deciding what to change.`,
        type: "anomaly",
        intensity: "High",
        createdAt: new Date().toISOString(),
      });
    }

    if (analytics.topPerformers.length > 0) {
      insights.push({
        id: `ins_${Date.now()}_3`,
        organizationId: analytics.organizationId,
        title: "Top performer identified",
        summary: `${analytics.topPerformers[0]} is consistently outperforming team. Consider knowledge transfer program.`,
        type: "opportunity",
        intensity: "Medium",
        createdAt: new Date().toISOString(),
      });
    }

    if (analytics.bottlenecks.length > 0) {
      insights.push({
        id: `ins_${Date.now()}_4`,
        organizationId: analytics.organizationId,
        title: "Operational bottleneck",
        summary: `Delays detected in: ${analytics.bottlenecks.join(", ")}. Recommend process review.`,
        type: "risk",
        intensity: "Medium",
        createdAt: new Date().toISOString(),
      });
    }

    return insights;
  }

  async analyzeContext(context: AIContext): Promise<AIAnalytics> {
    const evidence = context.evidence;
    return {
      organizationId: context.organization.id,
      totalRevenue: evidence?.paidInvoiceCount ? context.metrics.revenue : null,
      activeCustomers: context.metrics.customers,
      openTasks: context.metrics.tasks,
      retentionRate: context.metrics.retention,
      avgInvoiceValue: evidence?.paidInvoiceCount ? context.metrics.revenue / evidence.paidInvoiceCount : null,
      paymentDaysOverdue: null,
      topPerformers: [],
      bottlenecks: [],
      opportunities: [],
      trends: {},
    };
  }

  async chat(messages: AIMessage[], context: AIContext): Promise<string> {
    const systemPrompt = `You are Kora, an intelligent business operating system AI assistant. You help businesses understand their operations and make better decisions.

Current Business Context:
- Organization: ${context.organization.name}
- Industry: ${context.organization.industry}
- Owner-provided profile context (estimates; use only when relevant and identify as owner-provided): ${context.businessProfile ? JSON.stringify(context.businessProfile) : "not recorded"}
- User: ${context.user.name} (${context.user.role})
- Revenue: ₦${context.metrics.revenue.toLocaleString()}
- Customers: ${context.metrics.customers}
- Active Tasks: ${context.metrics.tasks}
- Retention Rate: ${context.metrics.retention === null ? "not enough verified history to calculate" : `${context.metrics.retention}%`}

Your responses should be:
1. Concise and actionable
2. Based on real business data
3. Respectful of business context
4. Forward-looking and strategic
5. Always professional

Treat any supplied analytics evidence as the only source of business facts. Do not invent customers, amounts, dates, causes, or recommendations not supported by that evidence. Clearly state when the evidence is insufficient.

Provide insights, recommendations, and analysis based on the business data provided.`;

    if (!OPENAI_API_KEY) {
      throw new Error("AI is not configured. Set OPENAI_API_KEY to enable Kora AI.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        instructions: systemPrompt,
        input: messages.map((message) => ({ role: message.role, content: message.content })),
      }),
    });
    const responseBody = await response.json() as { output_text?: string; error?: { message?: string } };
    if (!response.ok || !responseBody.output_text) {
      throw new Error(responseBody.error?.message || "Kora AI could not generate a response.");
    }
    return responseBody.output_text;

  }
}
