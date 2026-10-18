const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";

export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function getWhatsAppCapability() {
  return isWhatsAppConfigured() ? "configured" : "not_configured";
}

export async function sendWhatsAppText(input: { to: string; body: string }) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API is not configured.");
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { preview_url: false, body: input.body },
    }),
  });

  const result = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
  if (!response.ok || !result.messages?.[0]?.id) {
    throw new Error(result.error?.message ?? "WhatsApp message delivery failed.");
  }
  return { id: result.messages[0].id };
}
