import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import type { BusinessProfile } from "./business-profile";
import { postgresEnabled, query, withTransaction } from "./db";

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

function defaultDatabaseForDevelopment(): AppDatabase {
  return {
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

const defaultDatabase = defaultDatabaseForDevelopment();

export async function ensureDatabase() {
  assertProductionDatabase();
  if (postgresEnabled) return;
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(defaultDatabase, null, 2), "utf-8");
  }
}

export async function readDatabase(): Promise<AppDatabase> {
  if (postgresEnabled) return readPostgresDatabase();
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
  if (postgresEnabled) return writePostgresDatabase(data);
  await ensureDatabase();
  const temporaryPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(temporaryPath, dbPath);
}

async function readPostgresDatabase(): Promise<AppDatabase> {
  const [organizations, users, onboarding, profiles, customers, tasks, invoices, payments, activityEvents, memberships, passwordResetTokens, billingSubscriptions] = await Promise.all([
    query<Organization>("SELECT id, name, industry, timezone, currency, created_at AS \"createdAt\" FROM organizations"),
    query<BusinessUser>("SELECT id, name, email, password_hash AS \"passwordHash\", role, organization_id AS \"organizationId\", created_at AS \"createdAt\" FROM users"),
    query<OnboardingState>("SELECT user_id AS \"userId\", business_name AS \"businessName\", industry, goals, tools, challenges, created_at AS \"createdAt\" FROM onboarding_states"),
    query<{ id: string; userId: string; organizationId: string; data: Partial<BusinessProfile>; createdAt: string; updatedAt: string }>("SELECT id, user_id AS \"userId\", organization_id AS \"organizationId\", data, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM business_profiles"),
    query<Customer>("SELECT id, organization_id AS \"organizationId\", name, email, phone, status, notes, created_by AS \"createdBy\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM customers"),
    query<Task>("SELECT id, organization_id AS \"organizationId\", title, description, status, priority, assigned_to AS \"assignedTo\", created_by AS \"createdBy\", due_at AS \"dueAt\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM tasks"),
    query<Invoice>("SELECT id, organization_id AS \"organizationId\", customer_id AS \"customerId\", number, amount::float8 AS amount, currency, status, due_at AS \"dueAt\", created_by AS \"createdBy\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM invoices"),
    query<Payment>("SELECT id, organization_id AS \"organizationId\", invoice_id AS \"invoiceId\", customer_id AS \"customerId\", amount::float8 AS amount, currency, provider, provider_reference AS \"providerReference\", status, received_at AS \"receivedAt\", created_at AS \"createdAt\" FROM payments"),
    query<ActivityEvent>("SELECT id, organization_id AS \"organizationId\", actor_user_id AS \"actorUserId\", type, entity_type AS \"entityType\", entity_id AS \"entityId\", payload, created_at AS \"createdAt\" FROM activity_events"),
    query<Membership>("SELECT id, organization_id AS \"organizationId\", user_id AS \"userId\", email, role, status, token, COALESCE(invited_at, joined_at, NOW()) AS \"createdAt\" FROM memberships"),
    query<PasswordResetToken>("SELECT token_hash AS \"tokenHash\", user_id AS \"userId\", expires_at AS \"expiresAt\", used_at AS \"usedAt\" FROM password_reset_tokens"),
    query<BillingSubscription>("SELECT organization_id AS \"organizationId\", plan, status, provider, provider_customer_id AS \"providerCustomerId\", provider_subscription_id AS \"providerSubscriptionId\", current_period_end AS \"currentPeriodEnd\", seat_limit AS \"seatLimit\", updated_at AS \"updatedAt\" FROM billing_subscriptions"),
  ]);

  return {
    organizations: organizations.rows,
    users: users.rows,
    onboarding: onboarding.rows,
    profiles: profiles.rows.map(({ data, ...row }) => ({ ...row, ...data }) as BusinessProfile),
    customers: customers.rows,
    tasks: tasks.rows,
    invoices: invoices.rows,
    payments: payments.rows,
    activityEvents: activityEvents.rows,
    memberships: memberships.rows,
    passwordResetTokens: passwordResetTokens.rows,
    billingSubscriptions: billingSubscriptions.rows,
  };
}

async function writePostgresDatabase(data: AppDatabase) {
  await withTransaction(async (client) => {
    for (const organization of data.organizations) await client.query("INSERT INTO organizations (id, name, industry, timezone, currency, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, industry=EXCLUDED.industry, timezone=EXCLUDED.timezone, currency=EXCLUDED.currency", [organization.id, organization.name, organization.industry, organization.timezone, organization.currency, organization.createdAt]);
    for (const user of data.users) await client.query("INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id, name=EXCLUDED.name, email=EXCLUDED.email, password_hash=EXCLUDED.password_hash, role=EXCLUDED.role", [user.id, user.organizationId, user.name, user.email, user.passwordHash, user.role, user.createdAt]);
    for (const profile of data.profiles) {
      const { id, userId, organizationId, createdAt, updatedAt, ...profileData } = profile;
      await client.query("INSERT INTO business_profiles (id, user_id, organization_id, data, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=EXCLUDED.updated_at", [id, userId, organizationId, profileData, createdAt, updatedAt]);
    }
    for (const entry of data.onboarding) await client.query("INSERT INTO onboarding_states (user_id, business_name, industry, goals, tools, challenges, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO UPDATE SET business_name=EXCLUDED.business_name, industry=EXCLUDED.industry, goals=EXCLUDED.goals, tools=EXCLUDED.tools, challenges=EXCLUDED.challenges", [entry.userId, entry.businessName, entry.industry, entry.goals, entry.tools, entry.challenges, entry.createdAt]);
    for (const customer of data.customers) await client.query("INSERT INTO customers (id, organization_id, name, email, phone, status, notes, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, status=EXCLUDED.status, notes=EXCLUDED.notes, updated_at=EXCLUDED.updated_at", [customer.id, customer.organizationId, customer.name, customer.email ?? null, customer.phone ?? null, customer.status, customer.notes ?? null, customer.createdBy, customer.createdAt, customer.updatedAt]);
    for (const task of data.tasks) await client.query("INSERT INTO tasks (id, organization_id, title, description, status, priority, assigned_to, created_by, due_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status, priority=EXCLUDED.priority, assigned_to=EXCLUDED.assigned_to, due_at=EXCLUDED.due_at, updated_at=EXCLUDED.updated_at", [task.id, task.organizationId, task.title, task.description ?? null, task.status, task.priority, task.assignedTo ?? null, task.createdBy, task.dueAt ?? null, task.createdAt, task.updatedAt]);
    for (const invoice of data.invoices) await client.query("INSERT INTO invoices (id, organization_id, customer_id, number, amount, currency, status, due_at, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET customer_id=EXCLUDED.customer_id, number=EXCLUDED.number, amount=EXCLUDED.amount, currency=EXCLUDED.currency, status=EXCLUDED.status, due_at=EXCLUDED.due_at, updated_at=EXCLUDED.updated_at", [invoice.id, invoice.organizationId, invoice.customerId ?? null, invoice.number, invoice.amount, invoice.currency, invoice.status, invoice.dueAt ?? null, invoice.createdBy, invoice.createdAt, invoice.updatedAt]);
    for (const payment of data.payments) await client.query("INSERT INTO payments (id, organization_id, invoice_id, customer_id, amount, currency, provider, provider_reference, status, received_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET invoice_id=EXCLUDED.invoice_id, customer_id=EXCLUDED.customer_id, amount=EXCLUDED.amount, currency=EXCLUDED.currency, provider=EXCLUDED.provider, provider_reference=EXCLUDED.provider_reference, status=EXCLUDED.status, received_at=EXCLUDED.received_at", [payment.id, payment.organizationId, payment.invoiceId ?? null, payment.customerId ?? null, payment.amount, payment.currency, payment.provider, payment.providerReference ?? null, payment.status, payment.receivedAt ?? null, payment.createdAt]);
    for (const event of data.activityEvents) await client.query("INSERT INTO activity_events (id, organization_id, actor_user_id, type, entity_type, entity_id, payload, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload", [event.id, event.organizationId, event.actorUserId, event.type, event.entityType, event.entityId ?? null, event.payload, event.createdAt]);
    for (const membership of data.memberships) await client.query("INSERT INTO memberships (id, organization_id, user_id, email, role, status, invited_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id, email=EXCLUDED.email, role=EXCLUDED.role, status=EXCLUDED.status, invited_at=EXCLUDED.invited_at", [membership.id, membership.organizationId, membership.userId ?? null, membership.email, membership.role, membership.status, membership.createdAt]);
    for (const token of data.passwordResetTokens) await client.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, used_at) VALUES ($1,$2,$3,$4) ON CONFLICT (token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at, used_at=EXCLUDED.used_at", [token.tokenHash, token.userId, token.expiresAt, token.usedAt ?? null]);
    for (const subscription of data.billingSubscriptions) await client.query("INSERT INTO billing_subscriptions (organization_id, plan, status, provider, provider_customer_id, provider_subscription_id, current_period_end, seat_limit, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (organization_id) DO UPDATE SET plan=EXCLUDED.plan, status=EXCLUDED.status, provider=EXCLUDED.provider, provider_customer_id=EXCLUDED.provider_customer_id, provider_subscription_id=EXCLUDED.provider_subscription_id, current_period_end=EXCLUDED.current_period_end, seat_limit=EXCLUDED.seat_limit, updated_at=EXCLUDED.updated_at", [subscription.organizationId, subscription.plan, subscription.status, subscription.provider ?? null, subscription.providerCustomerId ?? null, subscription.providerSubscriptionId ?? null, subscription.currentPeriodEnd ?? null, subscription.seatLimit, subscription.updatedAt]);
  });
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
