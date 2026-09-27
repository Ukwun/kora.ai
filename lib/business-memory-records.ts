import { getAdminFirestore } from "./firebase-admin";

export const MEMORY_ENTITY_TYPES = [
  "organization_profile", "customer", "lead", "contact", "employee", "team", "product", "service",
  "invoice", "quotation", "payment", "expense", "subscription", "task", "project", "appointment",
  "message", "document", "meeting", "note", "goal", "report", "user_preference", "ai_recommendation",
  "approved_action", "rejected_action", "integration_event",
] as const;

export type MemoryEntityType = (typeof MEMORY_ENTITY_TYPES)[number];
export type MemorySource = "structured_application" | "user_confirmed" | "integration" | "uploaded_document" | "system_calculation";
export type MemoryVerification = "verified" | "user_confirmed" | "unverified" | "disputed";

export type BusinessMemoryRecord = {
  id: string;
  organizationId: string;
  entityType: MemoryEntityType;
  entityId?: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  status: string;
  source: MemorySource;
  sourceId?: string;
  confidenceScore?: number;
  verificationStatus: MemoryVerification;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  tags: string[];
};

export type MemoryAuditEvent = {
  id: string;
  organizationId: string;
  recordId: string;
  actorUserId: string;
  action: "created" | "updated" | "deleted";
  changes: Record<string, unknown>;
  createdAt: string;
};

const memoryCollection = (organizationId: string) =>
  getAdminFirestore().collection("organizations").doc(organizationId).collection("businessMemory");
const removeUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export async function createBusinessMemoryRecord(
  record: Omit<BusinessMemoryRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">,
) {
  const collection = memoryCollection(record.organizationId);
  const ref = collection.doc();
  const now = new Date().toISOString();
  const data: BusinessMemoryRecord = removeUndefined({ ...record, id: ref.id, createdAt: now, updatedAt: now });
  const auditRef = ref.collection("auditHistory").doc();
  const batch = getAdminFirestore().batch();
  batch.create(ref, data);
  batch.create(auditRef, {
    id: auditRef.id,
    organizationId: record.organizationId,
    recordId: ref.id,
    actorUserId: record.createdBy,
    action: "created",
    changes: { entityType: record.entityType, source: record.source, verificationStatus: record.verificationStatus },
    createdAt: now,
  } satisfies MemoryAuditEvent);
  await batch.commit();
  return data;
}

export async function listBusinessMemoryRecords(organizationId: string, limit = 50) {
  const result = await memoryCollection(organizationId).orderBy("createdAt", "desc").limit(limit).get();
  return result.docs.map((document) => document.data() as BusinessMemoryRecord).filter((record) => !record.deletedAt);
}

export async function searchBusinessMemoryRecords(organizationId: string, question: string, limit = 12) {
  const records = await listBusinessMemoryRecords(organizationId, 100);
  const terms = [...new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
  const ranked = records.map((record) => {
    const searchable = `${record.entityType} ${record.title} ${record.summary} ${record.tags.join(" ")} ${JSON.stringify(record.data)}`.toLowerCase();
    const matches = terms.filter((term) => searchable.includes(term));
    return { record, score: matches.length, matchedTerms: matches };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt))
    .slice(0, limit);
  return ranked;
}

export async function getBusinessMemoryRecord(organizationId: string, recordId: string) {
  const snapshot = await memoryCollection(organizationId).doc(recordId).get();
  if (!snapshot.exists) return null;
  const record = snapshot.data() as BusinessMemoryRecord;
  return record.deletedAt ? null : record;
}

export async function listBusinessMemoryAuditHistory(organizationId: string, recordId: string) {
  const snapshot = await memoryCollection(organizationId).doc(recordId).collection("auditHistory").orderBy("createdAt", "desc").limit(100).get();
  return snapshot.docs.map((document) => document.data() as MemoryAuditEvent);
}

export async function updateBusinessMemoryRecord(
  organizationId: string,
  recordId: string,
  actorUserId: string,
  changes: Partial<Pick<BusinessMemoryRecord, "title" | "summary" | "data" | "status" | "verificationStatus" | "confidenceScore" | "tags">>,
) {
  const ref = memoryCollection(organizationId).doc(recordId);
  const auditRef = ref.collection("auditHistory").doc();
  const now = new Date().toISOString();
  let updated: BusinessMemoryRecord | null = null;
  await getAdminFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const current = snapshot.data() as BusinessMemoryRecord;
    if (current.deletedAt) return;
    updated = { ...current, ...changes, updatedAt: now };
    transaction.update(ref, { ...changes, updatedAt: now });
    transaction.create(auditRef, {
      id: auditRef.id,
      organizationId,
      recordId,
      actorUserId,
      action: "updated",
      changes,
      createdAt: now,
    } satisfies MemoryAuditEvent);
  });
  return updated as BusinessMemoryRecord | null;
}

export async function decideBusinessRecommendation(
  organizationId: string,
  recordId: string,
  actorUserId: string,
  decision: "approved" | "rejected",
  changes: Partial<Pick<BusinessMemoryRecord, "title" | "summary" | "data" | "verificationStatus" | "confidenceScore" | "tags">> = {},
) {
  const database = getAdminFirestore();
  const recordRef = memoryCollection(organizationId).doc(recordId);
  const decisionRef = memoryCollection(organizationId).doc();
  const recordAuditRef = recordRef.collection("auditHistory").doc();
  const decisionAuditRef = decisionRef.collection("auditHistory").doc();
  const now = new Date().toISOString();
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(recordRef);
    if (!snapshot.exists) return;
    const current = snapshot.data() as BusinessMemoryRecord;
    if (current.deletedAt || current.entityType !== "ai_recommendation" || current.status !== "pending_approval") return;
    const updated: BusinessMemoryRecord = { ...current, ...changes, status: decision, updatedAt: now };
    const actionType = decision === "approved" ? "approved_action" : "rejected_action";
    const actionRecord: BusinessMemoryRecord = {
      id: decisionRef.id,
      organizationId,
      entityType: actionType,
      entityId: current.id,
      title: `${decision === "approved" ? "Approved" : "Rejected"}: ${current.title}`,
      summary: decision === "approved" ? "An owner approved this recommendation. Approval records consent; it does not execute an external action." : "An owner rejected this recommendation.",
      data: { recommendationId: current.id, decision },
      status: "recorded",
      source: "user_confirmed",
      sourceId: current.id,
      verificationStatus: "user_confirmed",
      createdBy: actorUserId,
      createdAt: now,
      updatedAt: now,
      tags: ["recommendation_decision"],
    };
    transaction.update(recordRef, { ...changes, status: decision, updatedAt: now });
    transaction.create(recordAuditRef, { id: recordAuditRef.id, organizationId, recordId, actorUserId, action: "updated", changes: { ...changes, status: decision }, createdAt: now } satisfies MemoryAuditEvent);
    transaction.create(decisionRef, actionRecord);
    transaction.create(decisionAuditRef, { id: decisionAuditRef.id, organizationId, recordId: decisionRef.id, actorUserId, action: "created", changes: { entityType: actionType, source: "user_confirmed" }, createdAt: now } satisfies MemoryAuditEvent);
    return { record: updated, decision: actionRecord };
  });
}

export async function deleteBusinessMemoryRecord(organizationId: string, recordId: string, actorUserId: string) {
  const ref = memoryCollection(organizationId).doc(recordId);
  const auditRef = ref.collection("auditHistory").doc();
  const now = new Date().toISOString();
  let deleted = false;
  await getAdminFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("deletedAt")) return;
    transaction.update(ref, { status: "deleted", deletedAt: now, updatedAt: now });
    transaction.create(auditRef, { id: auditRef.id, organizationId, recordId, actorUserId, action: "deleted", changes: {}, createdAt: now } satisfies MemoryAuditEvent);
    deleted = true;
  });
  return deleted;
}

export async function recordStructuredEntityMemory(input: {
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
  const database = getAdminFirestore();
  const ref = memoryCollection(input.organizationId).doc(`${input.entityType}_${input.entityId}`);
  const auditRef = ref.collection("auditHistory").doc();
  const now = new Date().toISOString();
  let saved: BusinessMemoryRecord;
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() as BusinessMemoryRecord : null;
    saved = removeUndefined({
      id: ref.id,
      ...input,
      status: current?.status ?? "active",
      source: input.source ?? "structured_application",
      sourceId: input.entityId,
      verificationStatus: input.verificationStatus ?? "verified",
      tags: current?.tags ?? [],
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });
    transaction.set(ref, saved);
    transaction.create(auditRef, {
      id: auditRef.id,
      organizationId: input.organizationId,
      recordId: ref.id,
      actorUserId: input.createdBy,
      action: current ? "updated" : "created",
      changes: { entityType: input.entityType, entityId: input.entityId },
      createdAt: now,
    } satisfies MemoryAuditEvent);
  });
  return saved!;
}

