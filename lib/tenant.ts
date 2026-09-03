import { readDatabase } from "./store";

export type TenantPlan = "starter" | "growth" | "business";

export type TenantIntegrationType =
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

export type TenantIntegration = {
  type: TenantIntegrationType;
  connected: boolean;
  connectedAt?: string;
  metadata?: Record<string, unknown>;
};

export type TenantMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "active" | "invited" | "pending";
  joinedAt: string;
};

export type TenantBilling = {
  plan: TenantPlan;
  monthlyPrice: number;
  status: "active" | "trial" | "past_due" | "cancelled";
  seats: number;
  nextBillingDate: string;
};

export type TenantSnapshot = {
  organizationId: string;
  plan: TenantPlan;
  billing: TenantBilling;
  memberships: TenantMembership[];
  integrations: TenantIntegration[];
};

const defaultIntegrations: TenantIntegration[] = [
  { type: "gmail", connected: true, connectedAt: new Date().toISOString(), metadata: { source: "gmail-connector" } },
  { type: "whatsapp", connected: false, metadata: { source: "manual" } },
  { type: "calendar", connected: true, connectedAt: new Date().toISOString(), metadata: { source: "google-calendar" } },
  { type: "stripe", connected: false, metadata: { source: "manual" } },
  { type: "flutterwave", connected: true, connectedAt: new Date().toISOString(), metadata: { source: "flutterwave" } },
];

const defaultMemberships: TenantMembership[] = [
  {
    id: "member_1",
    userId: "user_demo_1",
    organizationId: "org_kora_1",
    role: "owner",
    status: "active",
    joinedAt: new Date().toISOString(),
  },
  {
    id: "member_2",
    userId: "user_demo_2",
    organizationId: "org_kora_1",
    role: "admin",
    status: "active",
    joinedAt: new Date().toISOString(),
  },
  {
    id: "member_3",
    userId: "user_demo_3",
    organizationId: "org_kora_1",
    role: "manager",
    status: "invited",
    joinedAt: new Date().toISOString(),
  },
];

export async function getTenantSnapshot(organizationId: string): Promise<TenantSnapshot> {
  const database = await readDatabase();
  const plan: TenantPlan = "growth";
  const summary = getPlanSummary(plan);
  const memberships: TenantMembership[] = database.users
    .filter((user) => user.organizationId === organizationId)
    .map((user) => ({
      id: `member_${user.id}`,
      userId: user.id,
      organizationId,
      role: user.role,
      status: "active",
      joinedAt: user.createdAt,
    }));
  const integrations = database.profiles
    .filter((profile) => profile.organizationId === organizationId)
    .flatMap((profile) => profile.integrations)
    .filter((integration, index, all) => all.findIndex((entry) => entry.type === integration.type) === index);

  return {
    organizationId,
    plan,
    billing: {
      plan,
      monthlyPrice: summary.monthlyPrice,
      status: "active",
      seats: summary.seats,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    memberships,
    integrations,
  };
}

export function getPlanSummary(plan: TenantPlan) {
  const planMap: Record<
    TenantPlan,
    { label: string; monthlyPrice: number; seats: number; description: string }
  > = {
    starter: {
      label: "Starter",
      monthlyPrice: 14000,
      seats: 3,
      description: "One workspace • 3 users • basic AI",
    },
    growth: {
      label: "Growth",
      monthlyPrice: 34000,
      seats: 12,
      description: "Advanced reports • automation • team roles",
    },
    business: {
      label: "Business",
      monthlyPrice: 79000,
      seats: 25,
      description: "Custom onboarding • full permissions • priority support",
    },
  };

  return planMap[plan];
}

export function syncIntegrationState(
  integrations: TenantIntegration[],
  integrationType: TenantIntegrationType,
  connected = true
): TenantIntegration[] {
  return integrations.map((integration) => {
    if (integration.type !== integrationType) {
      return integration;
    }

    return {
      ...integration,
      connected,
      connectedAt: connected ? new Date().toISOString() : integration.connectedAt,
      metadata: {
        ...integration.metadata,
        source: integration.metadata?.source ?? "manual",
      },
    };
  });
}

export function enforceTenantIsolation<T extends { organizationId?: string }>(
  records: T[],
  organizationId: string
): T[] {
  return records.filter((record) => record.organizationId === organizationId);
}

export function isUserAllowedForRole(
  role: TenantMembership["role"],
  requiredRole: TenantMembership["role"]
): boolean {
  const hierarchy = {
    owner: 4,
    admin: 3,
    manager: 2,
    employee: 1,
  } as const;

  return hierarchy[role] >= hierarchy[requiredRole];
}
