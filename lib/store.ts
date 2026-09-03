import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import type { BusinessProfile } from "./business-profile";

export type UserRole = "owner" | "admin" | "manager" | "employee";

export type BusinessUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organizationId: string;
  createdAt: string;
};

export type Organization = {
  id: string;
  name: string;
  industry: string;
  timezone: string;
  currency: string;
  createdAt: string;
};

export type OnboardingState = {
  userId: string;
  businessName: string;
  industry: string;
  goals: string[];
  tools: string[];
  challenges: string[];
  createdAt: string;
};

export type Customer = {
  id: string;
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  status: "active" | "inactive" | "at_risk";
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  createdBy: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Invoice = {
  id: string;
  organizationId: string;
  customerId?: string;
  number: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  organizationId: string;
  invoiceId?: string;
  customerId?: string;
  amount: number;
  currency: string;
  provider: string;
  providerReference?: string;
  status: "pending" | "received" | "failed" | "refunded";
  receivedAt?: string;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  organizationId: string;
  actorUserId: string;
  type: string;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type Membership = {
  id: string;
  organizationId: string;
  userId?: string;
  email: string;
  role: UserRole;
  status: "active" | "invited" | "revoked";
  token?: string;
  createdAt: string;
};

export type PasswordResetToken = {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  usedAt?: string;
};

export type BillingSubscription = {
  organizationId: string;
  plan: "starter" | "growth" | "business";
  status: "trial" | "active" | "past_due" | "cancelled";
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodEnd?: string;
  seatLimit: number;
  updatedAt: string;
};

export type AppDatabase = {
  organizations: Organization[];
  users: BusinessUser[];
  onboarding: OnboardingState[];
  profiles: BusinessProfile[];
  customers: Customer[];
  tasks: Task[];
  invoices: Invoice[];
  payments: Payment[];
  activityEvents: ActivityEvent[];
  memberships: Membership[];
  passwordResetTokens: PasswordResetToken[];
  billingSubscriptions: BillingSubscription[];
};

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "app-db.json");

function assertProductionDatabase() {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production; refusing to use file storage");
  }
}

const defaultOrganizations: Organization[] = [
  {
    id: "org_kora_1",
    name: "Kora Works Ltd",
    industry: "Operations & Services",
    timezone: "Africa/Lagos",
    currency: "NGN",
    createdAt: new Date().toISOString(),
  },
];

const defaultUsers: BusinessUser[] = [
  {
    id: "user_demo_1",
    name: "John Akinrinde",
    email: "demo@kora.ng",
    passwordHash: bcrypt.hashSync("demo1234", 10),
    role: "owner",
    organizationId: "org_kora_1",
    createdAt: new Date().toISOString(),
  },
];

const defaultDatabase: AppDatabase = {
  organizations: defaultOrganizations,
  users: defaultUsers,
  onboarding: [],
  profiles: [],
  customers: [],
  tasks: [],
  invoices: [],
  payments: [],
  activityEvents: [],
  memberships: [],
  passwordResetTokens: [],
  billingSubscriptions: [],
};

export async function ensureDatabase() {
  assertProductionDatabase();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(defaultDatabase, null, 2), "utf-8");
  }
}

export async function readDatabase(): Promise<AppDatabase> {
  await ensureDatabase();

  const raw = await fs.readFile(dbPath, "utf-8");
  try {
    const parsed = JSON.parse(raw) as AppDatabase;
    return {
      organizations: parsed.organizations ?? defaultDatabase.organizations,
      users: parsed.users ?? defaultDatabase.users,
      onboarding: parsed.onboarding ?? defaultDatabase.onboarding,
      profiles: parsed.profiles ?? defaultDatabase.profiles,
      customers: parsed.customers ?? defaultDatabase.customers,
      tasks: parsed.tasks ?? defaultDatabase.tasks,
      invoices: parsed.invoices ?? defaultDatabase.invoices,
      payments: parsed.payments ?? defaultDatabase.payments,
      activityEvents: parsed.activityEvents ?? defaultDatabase.activityEvents,
      memberships: parsed.memberships ?? defaultDatabase.memberships,
      passwordResetTokens: parsed.passwordResetTokens ?? defaultDatabase.passwordResetTokens,
      billingSubscriptions: parsed.billingSubscriptions ?? defaultDatabase.billingSubscriptions,
    };
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(defaultDatabase, null, 2), "utf-8");
    return defaultDatabase;
  }
}

export async function writeDatabase(data: AppDatabase) {
  await ensureDatabase();
  const temporaryPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(temporaryPath, dbPath);
}

export async function findUserByEmail(email: string) {
  const db = await readDatabase();
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findOrganizationById(id: string) {
  const db = await readDatabase();
  return db.organizations.find((organization) => organization.id === id) ?? null;
}

export async function updateUserOrganization(userId: string, organizationId: string) {
  const db = await readDatabase();
  const user = db.users.find((entry) => entry.id === userId);

  if (!user) {
    return null;
  }

  user.organizationId = organizationId;
  await writeDatabase(db);
  return user;
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  organizationId?: string;
}) {
  const db = await readDatabase();
  const user: BusinessUser = {
    id: `user_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`,
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
    role: data.role ?? "owner",
    organizationId: data.organizationId ?? "org_kora_1",
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  await writeDatabase(db);
  return user;
}

export async function createOrganization(data: {
  name: string;
  industry: string;
  timezone: string;
  currency: string;
}) {
  const db = await readDatabase();
  const organization: Organization = {
    id: `org_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`,
    name: data.name,
    industry: data.industry,
    timezone: data.timezone,
    currency: data.currency,
    createdAt: new Date().toISOString(),
  };

  db.organizations.push(organization);
  await writeDatabase(db);
  return organization;
}

export async function saveOnboarding(data: Omit<OnboardingState, "createdAt"> & { createdAt?: string }) {
  const db = await readDatabase();
  const existingIndex = db.onboarding.findIndex((entry) => entry.userId === data.userId);
  const entry: OnboardingState = {
    userId: data.userId,
    businessName: data.businessName,
    industry: data.industry,
    goals: data.goals,
    tools: data.tools,
    challenges: data.challenges,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    db.onboarding[existingIndex] = entry;
  } else {
    db.onboarding.push(entry);
  }

  await writeDatabase(db);
  return entry;
}

export async function getOnboardingForUser(userId: string) {
  const db = await readDatabase();
  return db.onboarding.find((entry) => entry.userId === userId) ?? null;
}

export async function findBusinessProfile(userId: string, organizationId: string) {
  const db = await readDatabase();
  return db.profiles.find(
    (profile) => profile.userId === userId && profile.organizationId === organizationId
  ) ?? null;
}

export async function saveBusinessProfile(profile: BusinessProfile) {
  const db = await readDatabase();
  const existingIndex = db.profiles.findIndex((entry) => entry.id === profile.id);

  if (existingIndex >= 0) {
    db.profiles[existingIndex] = profile;
  } else {
    db.profiles.push(profile);
  }

  await writeDatabase(db);
  return profile;
}
