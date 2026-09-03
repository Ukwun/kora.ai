import { readDatabase, writeDatabase, type ActivityEvent, type Customer, type Invoice, type Payment, type Task } from "./store";

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
  return customer;
}

export async function createTask(data: Omit<Task, "id" | "createdAt" | "updatedAt">) {
  const database = await readDatabase();
  const now = new Date().toISOString();
  const task: Task = { ...data, id: createId("task"), createdAt: now, updatedAt: now };
  database.tasks.push(task);
  await recordActivity(database, data.organizationId, data.createdBy, "task.created", "task", task.id, { title: task.title });
  await writeDatabase(database);
  return task;
}

export async function createInvoice(data: Omit<Invoice, "id" | "createdAt" | "updatedAt">) {
  const database = await readDatabase();
  const now = new Date().toISOString();
  const invoice: Invoice = { ...data, id: createId("inv"), createdAt: now, updatedAt: now };
  database.invoices.push(invoice);
  await recordActivity(database, data.organizationId, data.createdBy, "invoice.created", "invoice", invoice.id, { amount: invoice.amount, number: invoice.number });
  await writeDatabase(database);
  return invoice;
}

export async function createPayment(data: Omit<Payment, "id" | "createdAt">) {
  const database = await readDatabase();
  const payment: Payment = { ...data, id: createId("pay"), createdAt: new Date().toISOString() };
  database.payments.push(payment);
  await recordActivity(database, data.organizationId, "system", "payment.received", "payment", payment.id, { amount: payment.amount });
  await writeDatabase(database);
  return payment;
}

export async function updateOrganizationRecord(
  key: "customers" | "tasks" | "invoices" | "payments",
  organizationId: string,
  id: string,
  changes: Record<string, unknown>
) {
  const database = await readDatabase();
  const records = database[key] as Array<{ id: string; organizationId: string; updatedAt?: string }>;
  const record = records.find((entry) => entry.id === id && entry.organizationId === organizationId);
  if (!record) return null;
  Object.assign(record, changes, { updatedAt: new Date().toISOString() });
  await writeDatabase(database);
  return record;
}

export async function deleteOrganizationRecord(
  key: "customers" | "tasks" | "invoices" | "payments",
  organizationId: string,
  id: string
) {
  const database = await readDatabase();
  const records = database[key] as Array<{ id: string; organizationId: string }>;
  const index = records.findIndex((entry) => entry.id === id && entry.organizationId === organizationId);
  if (index < 0) return false;
  records.splice(index, 1);
  await writeDatabase(database);
  return true;
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
