import { randomUUID } from "node:crypto";
import { postgresEnabled, query } from "./db";
import { encryptSecret, decryptSecret } from "./secret-box";

export type WhatsAppConnection = { id: string; organizationId: string; connectedBy: string; businessAccountId?: string; phoneNumberId: string; encryptedAccessToken: string; status: "active" | "revoked" | "error"; createdAt: string; updatedAt: string };
export type WhatsAppMessage = { id: string; organizationId: string; customerId?: string; connectionId: string; direction: "inbound" | "outbound"; providerMessageId?: string; fromPhone?: string; toPhone?: string; body: string; status: "received" | "pending_approval" | "approved" | "queued" | "sending" | "sent" | "failed" | "rejected"; consentStatus: "unknown" | "opted_in" | "opted_out"; attempts: number; lastError?: string; createdBy?: string; createdAt: string; updatedAt: string };

function requireDatabase() { if (!postgresEnabled) throw new Error("WhatsApp persistence requires the production PostgreSQL database."); }

export async function saveWhatsAppConnection(input: { organizationId: string; connectedBy: string; businessAccountId?: string; phoneNumberId: string; accessToken: string }) {
  requireDatabase();
  const id = `wa_${randomUUID()}`;
  const now = new Date().toISOString();
  await query(`INSERT INTO whatsapp_connections (id, organization_id, connected_by, business_account_id, phone_number_id, encrypted_access_token, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$7) ON CONFLICT (phone_number_id) DO UPDATE SET organization_id=EXCLUDED.organization_id, connected_by=EXCLUDED.connected_by, business_account_id=EXCLUDED.business_account_id, encrypted_access_token=EXCLUDED.encrypted_access_token, status='active', updated_at=EXCLUDED.updated_at`, [id, input.organizationId, input.connectedBy, input.businessAccountId ?? null, input.phoneNumberId, encryptSecret(input.accessToken), now]);
  return { id, ...input, status: "active" as const, createdAt: now, updatedAt: now };
}

export async function findWhatsAppConnectionByPhoneNumberId(phoneNumberId: string) {
  requireDatabase();
  const result = await query<WhatsAppConnection>(`SELECT id, organization_id AS "organizationId", connected_by AS "connectedBy", business_account_id AS "businessAccountId", phone_number_id AS "phoneNumberId", encrypted_access_token AS "encryptedAccessToken", status, created_at AS "createdAt", updated_at AS "updatedAt" FROM whatsapp_connections WHERE phone_number_id=$1 AND status='active' LIMIT 1`, [phoneNumberId]);
  return result.rows[0] ?? null;
}

export async function getWhatsAppAccessToken(connection: Pick<WhatsAppConnection, "encryptedAccessToken">) { return decryptSecret(connection.encryptedAccessToken); }

export async function listWhatsAppMessages(organizationId: string, limit = 100) {
  requireDatabase();
  const result = await query<WhatsAppMessage>(`SELECT id, organization_id AS "organizationId", customer_id AS "customerId", connection_id AS "connectionId", direction, provider_message_id AS "providerMessageId", from_phone AS "fromPhone", to_phone AS "toPhone", body, status, consent_status AS "consentStatus", attempts, last_error AS "lastError", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt" FROM whatsapp_messages WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`, [organizationId, limit]);
  return result.rows;
}

export async function createWhatsAppMessage(input: Omit<WhatsAppMessage, "id" | "createdAt" | "updatedAt" | "attempts">) {
  requireDatabase();
  const id = `wam_${randomUUID()}`;
  const now = new Date().toISOString();
  await query(`INSERT INTO whatsapp_messages (id, organization_id, customer_id, connection_id, direction, provider_message_id, from_phone, to_phone, body, status, consent_status, attempts, last_error, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$14)`, [id, input.organizationId, input.customerId ?? null, input.connectionId, input.direction, input.providerMessageId ?? null, input.fromPhone ?? null, input.toPhone ?? null, input.body, input.status, input.consentStatus, input.lastError ?? null, input.createdBy ?? null, now]);
  return { id, ...input, attempts: 0, createdAt: now, updatedAt: now };
}

export async function updateWhatsAppMessage(id: string, organizationId: string, changes: Partial<Pick<WhatsAppMessage, "status" | "attempts" | "lastError" | "providerMessageId">>) {
  requireDatabase();
  const entries = Object.entries(changes);
  if (!entries.length) return null;
  const map: Record<string, string> = { status: "status", attempts: "attempts", lastError: "last_error", providerMessageId: "provider_message_id" };
  const assignments = entries.map(([key], index) => `${map[key]}=$${index + 3}`);
  const result = await query<WhatsAppMessage>(`UPDATE whatsapp_messages SET ${assignments.join(",")}, updated_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING id, organization_id AS "organizationId", customer_id AS "customerId", connection_id AS "connectionId", direction, provider_message_id AS "providerMessageId", from_phone AS "fromPhone", to_phone AS "toPhone", body, status, consent_status AS "consentStatus", attempts, last_error AS "lastError", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`, [id, organizationId, ...entries.map(([, value]) => value)]);
  return result.rows[0] ?? null;
}

export async function claimApprovedWhatsAppMessages(limit = 10) {
  requireDatabase();
  const result = await query<WhatsAppMessage>(`UPDATE whatsapp_messages SET status='sending', attempts=attempts+1, updated_at=NOW() WHERE id IN (SELECT id FROM whatsapp_messages WHERE status='approved' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT $1) RETURNING id, organization_id AS "organizationId", customer_id AS "customerId", connection_id AS "connectionId", direction, provider_message_id AS "providerMessageId", from_phone AS "fromPhone", to_phone AS "toPhone", body, status, consent_status AS "consentStatus", attempts, last_error AS "lastError", created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`, [limit]);
  return result.rows;
}
