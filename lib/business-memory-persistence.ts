import { createHash, randomUUID } from "node:crypto";
import { readDatabase, writeDatabase } from "./store";
import { postgresEnabled, query, withTransaction } from "./db";
import type { BusinessMemoryRecord, MemoryAuditEvent, MemoryEntityType, MemorySource, MemoryVerification } from "./business-memory-records";

type NewRecord = Omit<BusinessMemoryRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type RecordChanges = Partial<Pick<BusinessMemoryRecord, "title" | "summary" | "data" | "status" | "verificationStatus" | "confidenceScore" | "tags">>;

const id = (prefix: string) => `${prefix}_${randomUUID()}`;
const columns = `id, organization_id AS "organizationId", entity_type AS "entityType", entity_id AS "entityId", title, summary, data, status, source, source_id AS "sourceId", confidence_score AS "confidenceScore", verification_status AS "verificationStatus", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt", tags`;

export function persistentStructuredMemoryId(organizationId: string, entityType: MemoryEntityType, entityId: string) {
  return `memory_${createHash("sha256").update(`${organizationId}:${entityType}:${entityId}`).digest("hex").slice(0, 32)}`;
}

function auditEvent(organizationId: string, recordId: string, actorUserId: string, action: MemoryAuditEvent["action"], changes: Record<string, unknown>): MemoryAuditEvent {
  return { id: id("memaudit"), organizationId, recordId, actorUserId, action, changes, createdAt: new Date().toISOString() };
}

async function insertPostgresAudit(client: { query: typeof query }, event: MemoryAuditEvent) {
  await client.query(
    "INSERT INTO business_memory_audit_events (id, organization_id, record_id, actor_user_id, action, changes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [event.id, event.organizationId, event.recordId, event.actorUserId, event.action, event.changes, event.createdAt],
  );
}

export async function createPersistentBusinessMemoryRecord(input: NewRecord) {
  const now = new Date().toISOString();
  const record: BusinessMemoryRecord = { ...input, id: id("memory"), createdAt: now, updatedAt: now };
  const audit = auditEvent(record.organizationId, record.id, record.createdBy, "created", {
    entityType: record.entityType,
    source: record.source,
    verificationStatus: record.verificationStatus,
  });
  if (postgresEnabled) {
    await withTransaction(async (client) => {
      await client.query(
        "INSERT INTO business_memory_records (id, organization_id, entity_type, entity_id, title, summary, data, status, source, source_id, confidence_score, verification_status, created_by, created_at, updated_at, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
        [record.id, record.organizationId, record.entityType, record.entityId ?? null, record.title, record.summary, record.data, record.status, record.source, record.sourceId ?? null, record.confidenceScore ?? null, record.verificationStatus, record.createdBy, now, now, record.tags],
      );
      await insertPostgresAudit(client, audit);
    });
    return record;
  }
  const database = await readDatabase();
  database.businessMemoryRecords.push(record);
  database.businessMemoryAuditEvents.push(audit);
  await writeDatabase(database);
  return record;
}

export async function listPersistentBusinessMemoryRecords(organizationId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  if (postgresEnabled) {
    const result = await query<BusinessMemoryRecord>(`SELECT ${columns} FROM business_memory_records WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2`, [organizationId, safeLimit]);
    return result.rows;
  }
  const database = await readDatabase();
  return database.businessMemoryRecords
    .filter((record) => record.organizationId === organizationId && !record.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit);
}

export async function getPersistentBusinessMemoryRecord(organizationId: string, recordId: string) {
  if (postgresEnabled) {
    const result = await query<BusinessMemoryRecord>(`SELECT ${columns} FROM business_memory_records WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1`, [organizationId, recordId]);
    return result.rows[0] ?? null;
  }
  const database = await readDatabase();
  return database.businessMemoryRecords.find((record) => record.organizationId === organizationId && record.id === recordId && !record.deletedAt) ?? null;
}

export async function listPersistentBusinessMemoryAuditHistory(organizationId: string, recordId: string) {
  if (postgresEnabled) {
    const result = await query<MemoryAuditEvent>(
      `SELECT id, organization_id AS "organizationId", record_id AS "recordId", actor_user_id AS "actorUserId", action, changes, created_at AS "createdAt" FROM business_memory_audit_events WHERE organization_id = $1 AND record_id = $2 ORDER BY created_at DESC LIMIT 100`,
      [organizationId, recordId],
    );
    return result.rows;
  }
  const database = await readDatabase();
  return database.businessMemoryAuditEvents
    .filter((event) => event.organizationId === organizationId && event.recordId === recordId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}

export async function updatePersistentBusinessMemoryRecord(organizationId: string, recordId: string, actorUserId: string, changes: RecordChanges) {
  const now = new Date().toISOString();
  if (postgresEnabled) {
    return withTransaction(async (client) => {
      const selected = await client.query<BusinessMemoryRecord>(`SELECT ${columns} FROM business_memory_records WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE`, [organizationId, recordId]);
      const current = selected.rows[0];
      if (!current) return null;
      const columnNames: Record<keyof RecordChanges, string> = {
        title: "title",
        summary: "summary",
        data: "data",
        status: "status",
        verificationStatus: "verification_status",
        confidenceScore: "confidence_score",
        tags: "tags",
      };
      const entries = Object.entries(changes) as [keyof RecordChanges, RecordChanges[keyof RecordChanges]][];
      const assignments = entries.map(([key], index) => `${columnNames[key]} = $${index + 3}`);
      const values = entries.map(([key, value]) => key === "data" || key === "tags" ? JSON.stringify(value) : value);
      await client.query(
        `UPDATE business_memory_records SET ${assignments.join(", ")}, updated_at = $${values.length + 3} WHERE organization_id = $1 AND id = $2`,
        [organizationId, recordId, ...values, now],
      );
      const updated = { ...current, ...changes, updatedAt: now };
      await insertPostgresAudit(client, auditEvent(organizationId, recordId, actorUserId, "updated", changes));
      return updated;
    });
  }
  const database = await readDatabase();
  const record = database.businessMemoryRecords.find((entry) => entry.organizationId === organizationId && entry.id === recordId && !entry.deletedAt);
  if (!record) return null;
  Object.assign(record, changes, { updatedAt: now });
  database.businessMemoryAuditEvents.push(auditEvent(organizationId, recordId, actorUserId, "updated", changes));
  await writeDatabase(database);
  return record;
}

export async function decidePersistentBusinessRecommendation(organizationId: string, recordId: string, actorUserId: string, decision: "approved" | "rejected", changes: RecordChanges = {}) {
  const now = new Date().toISOString();
  const actionType = decision === "approved" ? "approved_action" : "rejected_action";
  if (postgresEnabled) {
    return withTransaction(async (client) => {
      const selected = await client.query<BusinessMemoryRecord>(`SELECT ${columns} FROM business_memory_records WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE`, [organizationId, recordId]);
      const current = selected.rows[0];
      if (!current || current.entityType !== "ai_recommendation" || current.status !== "pending_approval") return null;
      const updated = { ...current, ...changes, status: decision, updatedAt: now };
      const actionRecord: BusinessMemoryRecord = {
        id: id("memory"), organizationId, entityType: actionType, entityId: current.id,
        title: `${decision === "approved" ? "Approved" : "Rejected"}: ${current.title}`,
        summary: decision === "approved" ? "An owner approved this recommendation. Approval records consent; it does not execute an external action." : "An owner rejected this recommendation.",
        data: { recommendationId: current.id, decision }, status: "recorded", source: "user_confirmed",
        sourceId: current.id, verificationStatus: "user_confirmed", createdBy: actorUserId,
        createdAt: now, updatedAt: now, tags: ["recommendation_decision"],
      };
      const entries = Object.entries({ ...changes, status: decision }) as [keyof RecordChanges, RecordChanges[keyof RecordChanges]][];
      const columnNames: Record<keyof RecordChanges, string> = {
        title: "title", summary: "summary", data: "data", status: "status",
        verificationStatus: "verification_status", confidenceScore: "confidence_score", tags: "tags",
      };
      const assignments = entries.map(([key], index) => `${columnNames[key]} = $${index + 3}`);
      const values = entries.map(([key, value]) => key === "data" || key === "tags" ? JSON.stringify(value) : value);
      await client.query(
        `UPDATE business_memory_records SET ${assignments.join(", ")}, updated_at = $${values.length + 3} WHERE organization_id = $1 AND id = $2`,
        [organizationId, recordId, ...values, now],
      );
      await insertPostgresAudit(client, auditEvent(organizationId, recordId, actorUserId, "updated", { ...changes, status: decision }));
      await client.query(
        "INSERT INTO business_memory_records (id, organization_id, entity_type, entity_id, title, summary, data, status, source, source_id, verification_status, created_by, created_at, updated_at, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        [actionRecord.id, organizationId, actionRecord.entityType, actionRecord.entityId, actionRecord.title, actionRecord.summary, actionRecord.data, actionRecord.status, actionRecord.source, actionRecord.sourceId, actionRecord.verificationStatus, actionRecord.createdBy, now, now, actionRecord.tags],
      );
      await insertPostgresAudit(client, auditEvent(organizationId, actionRecord.id, actorUserId, "created", { entityType: actionType, source: "user_confirmed" }));
      return { record: updated, decision: actionRecord };
    });
  }
  const database = await readDatabase();
  const current = database.businessMemoryRecords.find((record) => record.organizationId === organizationId && record.id === recordId && !record.deletedAt);
  if (!current || current.entityType !== "ai_recommendation" || current.status !== "pending_approval") return null;
  Object.assign(current, changes, { status: decision, updatedAt: now });
  const actionRecord: BusinessMemoryRecord = {
    id: id("memory"), organizationId, entityType: actionType, entityId: current.id,
    title: `${decision === "approved" ? "Approved" : "Rejected"}: ${current.title}`,
    summary: decision === "approved" ? "An owner approved this recommendation. Approval records consent; it does not execute an external action." : "An owner rejected this recommendation.",
    data: { recommendationId: current.id, decision }, status: "recorded", source: "user_confirmed",
    sourceId: current.id, verificationStatus: "user_confirmed", createdBy: actorUserId,
    createdAt: now, updatedAt: now, tags: ["recommendation_decision"],
  };
  database.businessMemoryRecords.push(actionRecord);
  database.businessMemoryAuditEvents.push(
    auditEvent(organizationId, recordId, actorUserId, "updated", { ...changes, status: decision }),
    auditEvent(organizationId, actionRecord.id, actorUserId, "created", { entityType: actionType, source: "user_confirmed" }),
  );
  await writeDatabase(database);
  return { record: current, decision: actionRecord };
}

export async function deletePersistentBusinessMemoryRecord(organizationId: string, recordId: string, actorUserId: string) {
  const now = new Date().toISOString();
  if (postgresEnabled) {
    return withTransaction(async (client) => {
      const result = await client.query(
        "UPDATE business_memory_records SET status = 'deleted', deleted_at = $3, updated_at = $3 WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING id",
        [organizationId, recordId, now],
      );
      if (!result.rowCount) return false;
      await insertPostgresAudit(client, auditEvent(organizationId, recordId, actorUserId, "deleted", {}));
      return true;
    });
  }
  const database = await readDatabase();
  const record = database.businessMemoryRecords.find((entry) => entry.organizationId === organizationId && entry.id === recordId && !entry.deletedAt);
  if (!record) return false;
  Object.assign(record, { status: "deleted", deletedAt: now, updatedAt: now });
  database.businessMemoryAuditEvents.push(auditEvent(organizationId, recordId, actorUserId, "deleted", {}));
  await writeDatabase(database);
  return true;
}

export async function recordPersistentStructuredEntityMemory(input: {
  organizationId: string;
  createdBy: string;
  entityType: MemoryEntityType;
  entityId: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  source?: MemorySource;
  verificationStatus?: MemoryVerification;
}) {
  const recordId = persistentStructuredMemoryId(input.organizationId, input.entityType, input.entityId);
  const now = new Date().toISOString();
  if (postgresEnabled) {
    return withTransaction(async (client) => {
      const existing = await client.query<BusinessMemoryRecord>(`SELECT ${columns} FROM business_memory_records WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [input.organizationId, recordId]);
      const current = existing.rows[0];
      const record: BusinessMemoryRecord = {
        id: recordId, ...input, status: current?.status ?? "active",
        source: input.source ?? "structured_application", sourceId: input.entityId,
        verificationStatus: input.verificationStatus ?? "verified",
        confidenceScore: current?.confidenceScore, tags: current?.tags ?? [],
        createdAt: current?.createdAt ?? now, updatedAt: now,
      };
      await client.query(
        "INSERT INTO business_memory_records (id, organization_id, entity_type, entity_id, title, summary, data, status, source, source_id, confidence_score, verification_status, created_by, created_at, updated_at, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, data=EXCLUDED.data, source=EXCLUDED.source, source_id=EXCLUDED.source_id, verification_status=EXCLUDED.verification_status, updated_at=EXCLUDED.updated_at",
        [record.id, record.organizationId, record.entityType, record.entityId, record.title, record.summary, record.data, record.status, record.source, record.sourceId, record.confidenceScore ?? null, record.verificationStatus, record.createdBy, record.createdAt, now, record.tags],
      );
      await insertPostgresAudit(client, auditEvent(input.organizationId, recordId, input.createdBy, current ? "updated" : "created", { entityType: input.entityType, entityId: input.entityId }));
      return record;
    });
  }
  const database = await readDatabase();
  const index = database.businessMemoryRecords.findIndex((record) => record.id === recordId && record.organizationId === input.organizationId);
  const current = index >= 0 ? database.businessMemoryRecords[index] : null;
  const record: BusinessMemoryRecord = {
    id: recordId, ...input, status: current?.status ?? "active",
    source: input.source ?? "structured_application", sourceId: input.entityId,
    verificationStatus: input.verificationStatus ?? "verified",
    confidenceScore: current?.confidenceScore, tags: current?.tags ?? [],
    createdAt: current?.createdAt ?? now, updatedAt: now,
  };
  if (index >= 0) database.businessMemoryRecords[index] = record;
  else database.businessMemoryRecords.push(record);
  database.businessMemoryAuditEvents.push(auditEvent(input.organizationId, recordId, input.createdBy, current ? "updated" : "created", { entityType: input.entityType, entityId: input.entityId }));
  await writeDatabase(database);
  return record;
}
