import { alertCronFailure } from "./_alert.mjs";

export default async function whatsappDispatch() {
 try {
  const siteUrl = process.env.APP_URL || process.env.URL;
  const secret = process.env.WHATSAPP_QUEUE_SECRET;
  if (!siteUrl || !secret) throw new Error("APP_URL (or Netlify URL) and WHATSAPP_QUEUE_SECRET are required.");
  const response = await fetch(new URL("/api/internal/whatsapp/dispatch", siteUrl), { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp dispatch failed (${response.status}): ${result.error ?? "unknown error"}`);
  console.log(`WhatsApp dispatcher sent ${result.sent} of ${result.claimed} claimed messages.`);
 } catch (error) { await alertCronFailure("WhatsApp dispatch", error); throw error; }
}

export const config = { schedule: "*/5 * * * *" };
