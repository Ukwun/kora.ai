import { alertCronFailure } from "./_alert.mjs";

export default async function overdueNotifications() {
 try {
  const siteUrl = process.env.APP_URL || process.env.URL;
  const secret = process.env.WEEKLY_REPORT_SECRET;
  if (!siteUrl || !secret) throw new Error("APP_URL (or Netlify URL) and WEEKLY_REPORT_SECRET are required.");
  const response = await fetch(new URL("/api/internal/notifications/overdue", siteUrl), { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Overdue notification delivery failed (${response.status}): ${result.error ?? "unknown error"}`);
  console.log(`Overdue notifications sent for ${result.notified} workspaces.`);
 } catch (error) { await alertCronFailure("overdue notifications", error); throw error; }
}

export const config = { schedule: "0 8 * * *" };
