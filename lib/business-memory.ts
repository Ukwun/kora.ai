import type {
  BusinessProfile,
  BusinessMemoryNode,
  BusinessChallenge,
} from "./business-profile";
import { findBusinessProfile, saveBusinessProfile } from "./store";

// Initialize or retrieve business profile
export async function getOrCreateBusinessProfile(
  userId: string,
  organizationId: string
): Promise<BusinessProfile> {
  const existingProfile = await findBusinessProfile(userId, organizationId);
  if (existingProfile) {
    return existingProfile;
  }

  const profile: BusinessProfile = {
    id: `bp_${Date.now()}`,
    userId,
    organizationId,
    type: "other",
    employees: 0,
    customersPerMonth: 0,
    existingSoftware: [],
    mainChallenge: "cash_flow",
    onboardingStep: "business_type",
    onboardingComplete: false,
    integrations: [],
    metrics: [],
    memoryNodes: [],
    behaviorPatterns: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveBusinessProfile(profile);
  return profile;
}

// Get business profile
export async function getBusinessProfile(
  userId: string,
  organizationId: string
): Promise<BusinessProfile | null> {
  return findBusinessProfile(userId, organizationId);
}

// Update onboarding step
export async function updateOnboardingStep(
  userId: string,
  organizationId: string,
  step: string,
  data: Record<string, unknown>
): Promise<BusinessProfile> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);

  Object.assign(profile, data);
  profile.updatedAt = new Date().toISOString();

  if (
    step === "integrations" ||
    step === "complete"
  ) {
    profile.onboardingComplete = true;
    profile.onboardingCompletedAt = new Date().toISOString();
  }

  await saveBusinessProfile(profile);
  return profile;
}

// Add memory node (observation or insight)
export async function addMemoryNode(
  organizationId: string,
  userId: string,
  node: Omit<BusinessMemoryNode, "id" | "createdAt" | "updatedAt">
): Promise<BusinessMemoryNode> {
  const newNode: BusinessMemoryNode = {
    ...node,
    id: `mem_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Also update profile
  const profile = await getOrCreateBusinessProfile(userId, organizationId);
  profile.memoryNodes.push(newNode);
  await saveBusinessProfile(profile);

  return newNode;
}

// Get memory nodes by category
export async function getMemoryNodesByCategory(
  organizationId: string,
  userId: string,
  category?: string
): Promise<BusinessMemoryNode[]> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);
  const nodes = profile.memoryNodes;

  if (category) {
    return nodes.filter((n) => n.category === category);
  }

  return nodes;
}

// Record behavior pattern
export async function recordBehaviorPattern(
  organizationId: string,
  userId: string,
  pattern: string,
  value: unknown
): Promise<void> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);

  if (!profile.behaviorPatterns) {
    profile.behaviorPatterns = {};
  }

  (profile.behaviorPatterns as Record<string, unknown>)[pattern] = value;
  profile.updatedAt = new Date().toISOString();

  await saveBusinessProfile(profile);

  // Add to memory nodes as an observation
  await addMemoryNode(organizationId, userId, {
    category: "observation",
    title: `Behavior Pattern: ${pattern}`,
    content: `Observed: ${JSON.stringify(value)}`,
    confidence: 75,
    source: "observed",
  });
}

// Analyze business metrics over time
export async function analyzeMetrics(
  organizationId: string,
  userId: string
): Promise<{
  revenue: { current: number; trend: string };
  customers: { current: number; trend: string };
  growth: { monthly: number; quarterly: number };
  topInsights: string[];
}> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);

  const revenueMetrics = profile.metrics.filter((m) =>
    m.name.toLowerCase().includes("revenue")
  );
  const customerMetrics = profile.metrics.filter((m) =>
    m.name.toLowerCase().includes("customer")
  );

  const currentRevenue = revenueMetrics[revenueMetrics.length - 1]?.value || 0;
  const previousRevenue = revenueMetrics[revenueMetrics.length - 2]?.value || 0;

  const revenueTrend =
    typeof currentRevenue === "number" && typeof previousRevenue === "number"
      ? currentRevenue > previousRevenue
        ? "up"
        : "down"
      : "stable";

  const insights: string[] = [];

  if (revenueTrend === "up") {
    insights.push("Revenue is trending upward");
  }

  if (profile.mainChallenge === "cash_flow") {
    insights.push("Focus on cash flow to maintain momentum");
  }

  return {
    revenue: {
      current: typeof currentRevenue === "number" ? currentRevenue : 0,
      trend: revenueTrend,
    },
    customers: {
      current: profile.customersPerMonth,
      trend: "stable",
    },
    growth: {
      monthly: 5,
      quarterly: 15,
    },
    topInsights: insights,
  };
}

// Get AI context from business profile
export async function getBusinessContext(
  organizationId: string,
  userId: string
): Promise<{
  businessType: string;
  size: number;
  challenge: string;
  integrations: string[];
  patterns: Record<string, unknown>;
  keyMetrics: BusinessProfile["metrics"];
  memoryInsights: BusinessMemoryNode[];
}> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);

  const patterns = profile.behaviorPatterns || {};
  const topMemory = await getMemoryNodesByCategory(
    organizationId,
    userId,
    "insight"
  );

  return {
    businessType: profile.type,
    size: profile.employees,
    challenge: profile.mainChallenge,
    integrations: profile.integrations
      .filter((i) => i.connected)
      .map((i) => i.type),
    patterns,
    keyMetrics: profile.metrics.slice(-10),
    memoryInsights: topMemory.slice(0, 5),
  };
}

// Connection tracking
export async function recordIntegrationConnection(
  organizationId: string,
  userId: string,
  integrationType: string
): Promise<BusinessProfile> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);

  const existingIntegration = profile.integrations.find(
    (i) => i.type === integrationType
  );

  if (existingIntegration) {
    existingIntegration.connected = true;
    existingIntegration.connectedAt = new Date().toISOString();
  } else {
    profile.integrations.push({
      type: integrationType as any,
      connected: true,
      connectedAt: new Date().toISOString(),
    });
  }

  profile.updatedAt = new Date().toISOString();
  await saveBusinessProfile(profile);

  // Add memory node
  await addMemoryNode(organizationId, userId, {
    category: "insight",
    title: `Connected to ${integrationType}`,
    content: `Integration with ${integrationType} is now active. Real-time data syncing enabled.`,
    confidence: 95,
    source: "manual",
  });

  return profile;
}

// Simulate learning from user actions
export async function recordUserAction(
  organizationId: string,
  userId: string,
  actionType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);

  // Learn from action
  switch (actionType) {
    case "invoice_created":
      if (!profile.behaviorPatterns.invoiceCycle) {
        profile.behaviorPatterns.invoiceCycle = 7; // default
      }
      await addMemoryNode(organizationId, userId, {
        category: "observation",
        title: "Invoice Activity",
        content: "User created an invoice",
        confidence: 90,
        source: "observed",
      });
      break;

    case "customer_added":
      await addMemoryNode(organizationId, userId, {
        category: "observation",
        title: "Customer Acquisition",
        content: "New customer added to system",
        confidence: 95,
        source: "observed",
      });
      break;

    case "payment_received":
      await addMemoryNode(organizationId, userId, {
        category: "observation",
        title: "Payment Recorded",
        content: "Payment received from customer",
        confidence: 95,
        source: "observed",
      });
      break;

    case "task_completed":
      await addMemoryNode(organizationId, userId, {
        category: "observation",
        title: "Task Completion",
        content: "User completed a task",
        confidence: 90,
        source: "observed",
      });
      break;
  }

  profile.updatedAt = new Date().toISOString();
  await saveBusinessProfile(profile);
}

// Get business summary for AI
export async function getBusinessSummary(
  organizationId: string,
  userId: string
): Promise<string> {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);
  const context = await getBusinessContext(organizationId, userId);

  const summary = `
Business Profile:
- Type: ${profile.type}
- Employees: ${profile.employees}
- Monthly Customers: ${profile.customersPerMonth}
- Main Challenge: ${profile.mainChallenge}
- Onboarding Complete: ${profile.onboardingComplete}

Connected Integrations: ${context.integrations.length > 0 ? context.integrations.join(", ") : "None yet"}

Key Metrics: ${profile.metrics.length} recorded

Behavior Patterns: ${Object.keys(profile.behaviorPatterns).length} identified

Memory Nodes: ${profile.memoryNodes.length} observations and insights

AI Context Version: ${profile.aiContext?.contextVersion || 1}
  `.trim();

  return summary;
}
