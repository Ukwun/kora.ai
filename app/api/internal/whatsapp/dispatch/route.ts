import { NextRequest, NextResponse } from "next/server";
import { claimApprovedWhatsAppMessages, getWhatsAppAccessToken, updateWhatsAppMessage } from "@/lib/whatsapp-storage";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (!process.env.WHATSAPP_QUEUE_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.WHATSAPP_QUEUE_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messages = await claimApprovedWhatsAppMessages(20);
  let sent = 0;
  for (const message of messages) {
    const connectionResult = await query<{ id: string; phoneNumberId: string; organizationId: string; connectedBy: string; encryptedAccessToken: string; status: "active" }>(`SELECT id, phone_number_id AS "phoneNumberId", organization_id AS "organizationId", connected_by AS "connectedBy", encrypted_access_token AS "encryptedAccessToken", status FROM whatsapp_connections WHERE id=$1 AND status='active' LIMIT 1`, [message.connectionId]);
    const connection = connectionResult.rows[0];
    if (!connection) { await updateWhatsAppMessage(message.id, message.organizationId, { status: "failed", lastError: "WhatsApp connection is unavailable." }); continue; }
    try {
      const accessToken = await getWhatsAppAccessToken(connection);
      const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0"}/${connection.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: message.toPhone, type: "text", text: { preview_url: false, body: message.body } }) });
      const result = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
      if (!response.ok || !result.messages?.[0]?.id) throw new Error(result.error?.message ?? "Meta rejected the message.");
      await updateWhatsAppMessage(message.id, message.organizationId, { status: "sent", providerMessageId: result.messages[0].id }); sent++;
    } catch (error) {
      const attempts = Number(message.attempts ?? 1);
      await updateWhatsAppMessage(message.id, message.organizationId, { status: attempts >= 3 ? "failed" : "approved", lastError: error instanceof Error ? error.message : "WhatsApp delivery failed." });
    }
  }
  return NextResponse.json({ success: true, claimed: messages.length, sent });
}
