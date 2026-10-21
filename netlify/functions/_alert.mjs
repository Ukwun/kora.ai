export async function alertCronFailure(name, error) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_ADMIN_EMAIL;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !to || !from) return;
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: `Kora cron failed: ${name}`, text: `${name} failed at ${new Date().toISOString()}\n\n${error instanceof Error ? error.stack ?? error.message : String(error)}` }) });
}
