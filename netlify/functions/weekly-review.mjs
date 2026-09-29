export default async function weeklyReview() {
  const siteUrl = process.env.APP_URL || process.env.URL;
  const secret = process.env.WEEKLY_REPORT_SECRET;
  if (!siteUrl || !secret) throw new Error("APP_URL (or Netlify URL) and WEEKLY_REPORT_SECRET are required.");
  const response = await fetch(new URL("/api/internal/weekly-delivery", siteUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Weekly report delivery failed (${response.status}): ${result.error ?? "unknown error"}`);
  console.log(`Weekly reports delivered to ${result.sent} opted-in workspace members.`);
}

export const config = { schedule: "0 8 * * 1" };
