import type { BusinessUser, Organization } from "./store";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
  totalRevenue: number;
  activeCustomers: number;
  taskCompletion: number;
  retentionRate: number;
  avgInvoiceValue: number;
  paymentDaysOverdue: number;
  topPerformers: string[];
  bottlenecks: string[];
  opportunities: string[];
  trends: Record<string, "up" | "down" | "stable">;
};

export type AIContext = {
  user: BusinessUser;
  organization: Organization;
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
    retention: number;
  };
};

export class AIEngine {
  async generateRecommendations(context: AIContext): Promise<AIRecommendation[]> {
    const recommendations: AIRecommendation[] = [];

    // Revenue Optimization
    if (context.metrics.revenue > 10000000) {
      recommendations.push({
        id: `rec_${Date.now()}_1`,
        userId: context.user.id,
        organizationId: context.organization.id,
        title: "Scale pricing strategy",
        summary: "Revenue has exceeded ₦10M. Consider implementing tiered pricing or premium services to capture more value from high-value customers.",
        action: "Review pricing model with finance team",
        intensity: "High",
        category: "revenue",
        approved: false,
        executed: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Customer Retention
    if (context.memoryNodes.some((n) => n.label === "Customers" && n.count > 100)) {
      recommendations.push({
        id: `rec_${Date.now()}_2`,
        userId: context.user.id,
        organizationId: context.organization.id,
        title: "Launch retention program",
        summary: "With 100+ customers, implement a loyalty or VIP program to increase repeat business and reduce churn.",
        action: "Design customer retention program",
        intensity: "Medium",
        category: "customer",
        approved: false,
        executed: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Task Completion
    if (context.metrics.tasks > 50) {
      recommendations.push({
        id: `rec_${Date.now()}_3`,
        userId: context.user.id,
        organizationId: context.organization.id,
        title: "Automate task workflows",
        summary: "With 50+ tasks in pipeline, implement workflow automation to reduce manual work and increase team capacity.",
        action: "Configure task automation rules",
        intensity: "High",
        category: "operations",
        approved: false,
        executed: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Team Expansion
    if (context.metrics.revenue > 5000000 && context.metrics.customers > 50) {
      recommendations.push({
        id: `rec_${Date.now()}_4`,
        userId: context.user.id,
        organizationId: context.organization.id,
        title: "Hire dedicated account manager",
        summary: "At ₦5M+ revenue with 50+ customers, dedicated account management will improve retention and customer satisfaction.",
        action: "Post job opening for Account Manager",
        intensity: "Medium",
        category: "team",
        approved: false,
        executed: false,
        createdAt: new Date().toISOString(),
      });
    }

    // Cash Flow Management
    recommendations.push({
      id: `rec_${Date.now()}_5`,
      userId: context.user.id,
      organizationId: context.organization.id,
      title: "Optimize payment terms",
      summary: "Review overdue invoices and implement stricter payment terms to improve cash flow cycle.",
      action: "Review and update payment policies",
      intensity: "Medium",
      category: "cash-flow",
      approved: false,
      executed: false,
      createdAt: new Date().toISOString(),
    });

    return recommendations;
  }

  async generateInsights(analytics: AIAnalytics): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    if (analytics.paymentDaysOverdue > 15) {
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

    if (analytics.retentionRate < 85) {
      insights.push({
        id: `ins_${Date.now()}_2`,
        organizationId: analytics.organizationId,
        title: "Customer retention below target",
        summary: `Current retention at ${analytics.retentionRate}%. Industry standard is 85-90%. Investigate customer satisfaction.`,
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

    if (analytics.activeCustomers > analytics.totalRevenue / 50000) {
      insights.push({
        id: `ins_${Date.now()}_5`,
        organizationId: analytics.organizationId,
        title: "Upsell opportunity",
        summary: `${analytics.activeCustomers} customers with average value of ₦${Math.round(analytics.avgInvoiceValue).toLocaleString()}. Potential for upselling premium services.`,
        type: "opportunity",
        intensity: "Low",
        createdAt: new Date().toISOString(),
      });
    }

    return insights;
  }

  async analyzeContext(context: AIContext): Promise<AIAnalytics> {
    return {
      organizationId: context.organization.id,
      totalRevenue: context.metrics.revenue,
      activeCustomers: context.metrics.customers,
      taskCompletion: context.metrics.tasks,
      retentionRate: context.metrics.retention,
      avgInvoiceValue: context.metrics.revenue / Math.max(context.metrics.customers, 1),
      paymentDaysOverdue: Math.floor(Math.random() * 20),
      topPerformers: ["John Akinrinde", "Oluchi Adeyemi"],
      bottlenecks: ["Quote-to-invoice", "Approval delays"],
      opportunities: ["Upselling", "Automation", "Team expansion"],
      trends: {
        revenue: context.metrics.revenue > 10000000 ? "up" : "stable",
        customers: context.metrics.customers > 100 ? "up" : "stable",
        retention: context.metrics.retention > 90 ? "up" : "down",
      },
    };
  }

  async chat(messages: AIMessage[], context: AIContext): Promise<string> {
    const systemPrompt = `You are Kora, an intelligent business operating system AI assistant. You help businesses understand their operations and make better decisions.

Current Business Context:
- Organization: ${context.organization.name}
- Industry: ${context.organization.industry}
- User: ${context.user.name} (${context.user.role})
- Revenue: ₦${context.metrics.revenue.toLocaleString()}
- Customers: ${context.metrics.customers}
- Active Tasks: ${context.metrics.tasks}
- Retention Rate: ${context.metrics.retention}%

Your responses should be:
1. Concise and actionable
2. Based on real business data
3. Respectful of business context
4. Forward-looking and strategic
5. Always professional

Provide insights, recommendations, and analysis based on the business data provided.`;

    const conversationMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...messages,
    ];

    // Simulate AI response (in production, call OpenAI API)
    const userMessage = messages[messages.length - 1]?.content || "";

    if (userMessage.toLowerCase().includes("revenue")) {
      return `Your current revenue is ₦${context.metrics.revenue.toLocaleString()}, which represents strong growth. I recommend focusing on retention and scaling operations to handle increased demand.`;
    } else if (userMessage.toLowerCase().includes("customer")) {
      return `You have ${context.metrics.customers} active customers with a retention rate of ${context.metrics.retention}%. Consider implementing a loyalty program to increase repeat business.`;
    } else if (userMessage.toLowerCase().includes("performance")) {
      return `Overall performance is strong. Revenue growth is ${context.metrics.revenue > 10000000 ? "accelerating" : "steady"}, and team capacity is ${context.metrics.tasks > 100 ? "reaching limits" : "healthy"}. Focus on automation to scale further.`;
    } else {
      return `I'm analyzing your business data. Based on your current metrics, I recommend focusing on ${context.metrics.revenue > 5000000 ? "scaling your team and operations" : "optimizing your sales and customer acquisition processes"}.`;
    }
  }
}
