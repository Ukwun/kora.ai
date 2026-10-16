import { readDatabase, writeDatabase, type ActivityEvent, type Customer, type Invoice, type Payment, type Task } from "./store";
import { deleteStructuredEntityMemory, recordStructuredEntityMemory } from "./business-memory-records";
import { postgresEnabled, query } from "./db";

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listOrganizationRecords<T extends { organizationId: string }>(
  key: "customers" | "tasks" | "invoices" | "payments",
  organizationId: string
): Promise<T[]> {
  if (postgresEnabled) {
    const statements = {
      customers: `SELECT id, organization_id AS "organizationId", name, email, phone, status, notes, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt" FROM customers WHERE organization_id = $1 ORDER BY created_at DESC`,
      tasks: `SELECT id, organization_id AS "organizationId", title, description, status, priority, assigned_to AS "assignedTo", created_by AS "createdBy", due_at AS "dueAt", created_at AS "createdAt", updated_at AS "updatedAt" FROM tasks WHERE organization_id = $1 ORDER BY created_at DESC`,
      invoices: `SELECT id, organization_id AS "organizationId", customer_id AS "customerId", number, amount::float8 AS amount, currency, status, due_at AS "dueAt", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt" FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC`,
      payments: `SELECT id, organization_id AS "organizationId", invoice_id AS "invoiceId", customer_id AS "customerId", amount::float8 AS amount, currency, provider, provider_reference AS "providerReference", status, received_at AS "receivedAt", created_at AS "createdAt" FROM payments WHERE organization_id = $1 ORDER BY created_at DESC`,
    } as const;
    const result = await query<T>(statements[key], [organizationId]);
    return result.rows;
  }
  const database = await readDatabase();
  return database[key].filter((record) => record.organizationId === organizationId) as unknown as T[];
}

export async function listOrganizationActivity(organizationId: string): Promise<ActivityEvent[]> {
  if (postgresEnabled) {
    const result = await query<ActivityEvent>(`SELECT activity_events.id, activity_events.organization_id AS "organizationId", activity_events.actor_user_id AS "actorUserId", users.name AS "actorName", activity_events.type, activity_events.entity_type AS "entityType", activity_events.entity_id AS "entityId", activity_events.payload, activity_events.created_at AS "createdAt" FROM activity_events LEFT JOIN users ON users.id = activity_events.actor_user_id WHERE activity_events.organization_id = $1 ORDER BY activity_events.created_at DESC LIMIT 500`, [organizationId]);
    return result.rows;
  }
  const database = await readDatabase();
  return database.activityEvents
    .filter((event) => event.organizationId === organizationId)
    .map((event) => ({
      ...event,
      actorName: database.users.find((user) => user.id === event.actorUserId)?.name,
    }));
}

export async function createCustomer(data: Omit<Customer, "id" | "createdAt" | "updatedAt">) {
  const database = await readDatabase();
  const now = new Date().toISOString();
  const customer: Customer = { ...data, id: createId("cus"), createdAt: now, updatedAt: now };
  database.customers.push(customer);
  await recordActivity(database, data.organizationId, data.createdBy, "customer.created", "customer", customer.id, { name: customer.name });
  await writeDatabase(database);
  await mirrorMemory(customer.organizationId, customer.createdBy, "customer", customer.id, customer.name, customer);
  return customer;
}

export async function createTask(data: Omit<Task, "id" | "createdAt" | "updatedAt">) {
  const database = await readDatabase();
  const now = new Date().toISOString();
  const task: Task = { ...data, id: createId("task"), createdAt: now, updatedAt: now };
  database.tasks.push(task);
  await recordActivity(database, data.organizationId, data.createdBy, "task.created", "task", task.id, { title: task.title });
  await writeDatabase(database);
  await mirrorMemory(task.organizationId, task.createdBy, "task", task.id, task.title, task);
  return task;
}

export async function createInvoice(data: Omit<Invoice, "id" | "createdAt" | "updatedAt">) {
  const database = await readDatabase();
  const now = new Date().toISOString();
  const invoice: Invoice = { ...data, id: createId("inv"), createdAt: now, updatedAt: now };
  database.invoices.push(invoice);
  await recordActivity(database, data.organizationId, data.createdBy, "invoice.created", "invoice", invoice.id, { amount: invoice.amount, number: invoice.number });
  await writeDatabase(database);
  await mirrorMemory(invoice.organizationId, invoice.createdBy, "invoice", invoice.id, invoice.number, invoice);
  return invoice;
}

export async function createPayment(data: Omit<Payment, "id" | "createdAt">) {
  const database = await readDatabase();
  const payment: Payment = { ...data, id: createId("pay"), createdAt: new Date().toISOString() };
  database.payments.push(payment);
  await recordActivity(database, data.organizationId, "system", "payment.received", "payment", payment.id, { amount: payment.amount });
  await writeDatabase(database);
  await mirrorMemory(payment.organizationId, "system", "payment", payment.id, `Payment ${payment.providerReference ?? payment.id}`, payment);
  return payment;
}

export async function updateOrganizationRecord(
  key: "customers" | "tasks" | "invoices" | "payments",
  organizationId: string,
  id: string,
  changes: Record<string, unknown>,
  actorUserId = "system"
) {
  const database = await readDatabase();
  const records = database[key] as Array<{ id: string; organizationId: string; updatedAt?: string }>;
  const record = records.find((entry) => entry.id === id && entry.organizationId === organizationId);
  if (!record) return null;
  Object.assign(record, changes, { updatedAt: new Date().toISOString() });
  await recordActivity(database, organizationId, actorUserId, `${key.slice(0, -1)}.updated`, key.slice(0, -1), id, { changedFields: Object.keys(changes) });
  await writeDatabase(database);
  const entityType = key === "customers" ? "customer" : key === "tasks" ? "task" : key === "invoices" ? "invoice" : "payment";
  await mirrorMemory(organizationId, "createdBy" in record ? String(record.createdBy) : "system", entityType, id, "title" in record ? String(record.title) : "number" in record ? String(record.number) : "name" in record ? String(record.name) : id, record);
  return record;
}

export async function deleteOrganizationRecord(
  key: "customers" | "tasks" | "invoices" | "payments",
  organizationId: string,
  id: string,
  actorUserId = "system"
) {
  const database = await readDatabase();
  const records = database[key] as Array<{ id: string; organizationId: string }>;
  const index = records.findIndex((entry) => entry.id === id && entry.organizationId === organizationId);
  if (index < 0) return false;
  records.splice(index, 1);
  await recordActivity(database, organizationId, actorUserId, `${key.slice(0, -1)}.deleted`, key.slice(0, -1), id, {});
  await writeDatabase(database);
  await deleteMemoryMirror(organizationId, key === "customers" ? "customer" : key === "tasks" ? "task" : key === "invoices" ? "invoice" : "payment", id);
  return true;
}

async function mirrorMemory(organizationId: string, createdBy: string, entityType: "customer" | "task" | "invoice" | "payment", entityId: string, title: string, data: Record<string, unknown>) {
  try {
    await recordStructuredEntityMemory({ organizationId, createdBy, entityType, entityId, title, summary: `${title} · ${entityType} record`, data });
  } catch (error) {
    console.error("Unable to mirror the saved record into business memory.", error);
  }
}

async function deleteMemoryMirror(organizationId: string, entityType: "customer" | "task" | "invoice" | "payment", entityId: string) {
  try {
    await deleteStructuredEntityMemory(organizationId, entityType, entityId, "system");
  } catch (error) {
    console.error("Unable to remove the deleted record from business memory.", error);
  }
}

async function recordActivity(
  database: Awaited<ReturnType<typeof readDatabase>>,
  organizationId: string,
  actorUserId: string,
  type: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
) {
  const event: ActivityEvent = {
    id: createId("evt"),
    organizationId,
    actorUserId,
    type,
    entityType,
    entityId,
    payload,
    createdAt: new Date().toISOString(),
  };
  database.activityEvents.push(event);
}
