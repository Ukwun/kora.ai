const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const email = `e2e_${Date.now()}@example.test`;
let cookie = "";

async function request(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers ?? {}) };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

await request("/api/health");
await request("/api/auth/signup", { method: "POST", body: JSON.stringify({ name: "E2E User", email, password: "TestPassword123!", confirmPassword: "TestPassword123!" }) });
const session = await request("/api/auth/session");
if (!session.user?.organizationId) throw new Error("Signup did not create an authenticated workspace session");
await request("/api/onboarding", { method: "POST", body: JSON.stringify({ step: "business_type", data: { type: "agency", businessName: "E2E Agency", industry: "Services", country: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" } }) });
const dashboard = await request("/api/tenant");
if (!dashboard) throw new Error("Workspace tenant endpoint did not respond");
const chat = await request("/api/chat");
if (!Array.isArray(chat.data?.members)) throw new Error("Chat members were not returned");
console.log(`E2E smoke passed for ${email}`);
