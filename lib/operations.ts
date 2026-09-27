import { readDatabase, writeDatabase, type ActivityEvent, type Customer, type Invoice, type Payment, type Task } from "./store";
import { isFirebaseAdminConfigured } from "./firebase-admin";
import { recordStructuredEntityMemory } from "./business-memory-records";

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listOrganizationRecords<T extends { organizationId: string }>(
  key: "customers" | "tasks" | "invoices" | "payments",
  organizationId: string
): Promise<T[]> {
  const database = await readDatabase();
  return database[key].filter((record) => record.organizationId === organizationId) as unknown as T[];
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
  if (!isFirebaseAdminConfigured()) return;
  try {
    await recordStructuredEntityMemory({ organizationId, createdBy, entityType, entityId, title, summary: `${title} · ${entityType} record`, data });
  } catch (error) {
    console.error("Unable to mirror the saved record into Firebase business memory.", error);
  }
}

async function deleteMemoryMirror(organizationId: string, entityType: "customer" | "task" | "invoice" | "payment", entityId: string) {
  if (!isFirebaseAdminConfigured()) return;
  try {
    const { deleteBusinessMemoryRecord } = await import("./business-memory-records");
    const recordId = `${entityType}_${entityId}`;
    await deleteBusinessMemoryRecord(organizationId, recordId, "system");
  } catch (error) {
    console.error("Unable to remove the deleted record from Firebase business memory.", error);
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
