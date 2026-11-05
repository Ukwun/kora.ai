const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const email = process.env.E2E_TEST_EMAIL ?? `e2e_${Date.now()}@example.test`;
const password = process.env.E2E_TEST_PASSWORD ?? "TestPassword123!";
const secondaryEmail = process.env.E2E_SECONDARY_EMAIL;
const secondaryPassword = process.env.E2E_SECONDARY_PASSWORD;
const forbiddenEmail = process.env.E2E_FORBIDDEN_EMAIL;
const forbiddenPassword = process.env.E2E_FORBIDDEN_PASSWORD;
let cookie = "";

if (Boolean(process.env.E2E_TEST_EMAIL) !== Boolean(process.env.E2E_TEST_PASSWORD)) {
  throw new Error("Set both E2E_TEST_EMAIL and E2E_TEST_PASSWORD for a pre-created test account.");
}

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
if (Boolean(secondaryEmail) !== Boolean(secondaryPassword)) {
  throw new Error("Set both E2E_SECONDARY_EMAIL and E2E_SECONDARY_PASSWORD to test cross-workspace isolation.");
}
if (Boolean(forbiddenEmail) !== Boolean(forbiddenPassword)) {
  throw new Error("Set both E2E_FORBIDDEN_EMAIL and E2E_FORBIDDEN_PASSWORD to test role restrictions.");
}
if (process.env.E2E_FORBIDDEN_PATH && (!forbiddenEmail || !forbiddenPassword)) {
  throw new Error("E2E_FORBIDDEN_PATH requires an E2E_FORBIDDEN_EMAIL/PASSWORD test account with a role that should receive 403.");
}

await request("/api/health");
if (process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD) {
  await request("/api/auth/signin", { method: "POST", body: JSON.stringify({ email, password }) });
} else {
  if (process.env.NODE_ENV === "production" || process.env.NETLIFY === "true") {
    throw new Error("Production E2E requires a pre-created, email-verified disposable test account. Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD.");
  }
  await request("/api/auth/signup", { method: "POST", body: JSON.stringify({ name: "E2E User", email, password, confirmPassword: password }) });
}
const session = await request("/api/auth/session");
if (!session.user?.organizationId) throw new Error("Authentication did not create a workspace session");
const primaryCookie = cookie;
await request("/api/onboarding", { method: "POST", body: JSON.stringify({ step: "business_type", data: { type: "agency", businessName: "E2E Agency", industry: "Services", country: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" } }) });
const dashboard = await request("/api/tenant");
if (!dashboard) throw new Error("Workspace tenant endpoint did not respond");
const chat = await request("/api/chat");
if (!Array.isArray(chat.data?.members)) throw new Error("Chat members were not returned");
for (const path of ["/api/customers", "/api/tasks", "/api/invoices", "/api/analytics"]) {
  await request(path);
}
if (process.env.E2E_FORBIDDEN_PATH && forbiddenEmail && forbiddenPassword) {
  await request("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email: forbiddenEmail, password: forbiddenPassword }),
  });
  const forbiddenCookie = cookie;
  const response = await fetch(`${baseUrl}${process.env.E2E_FORBIDDEN_PATH}`, { headers: { cookie: forbiddenCookie }, redirect: "manual" });
  if (response.status !== 403) throw new Error(`${process.env.E2E_FORBIDDEN_PATH} returned ${response.status}; expected 403 for this test role.`);
  cookie = primaryCookie;
}

if (secondaryEmail && secondaryPassword) {
  const marker = `Kora isolation check ${Date.now()}`;
  const customer = await request("/api/customers", {
    method: "POST",
    body: JSON.stringify({ name: marker, email: `isolation_${Date.now()}@example.test` }),
  });
  if (!customer.data?.id) throw new Error("Could not create the disposable customer isolation record.");

  try {
    await request("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email: secondaryEmail, password: secondaryPassword }),
    });
    const secondarySession = await request("/api/auth/session");
    if (!secondarySession.user?.organizationId || secondarySession.user.organizationId === session.user.organizationId) {
      throw new Error("The secondary test account must belong to a different workspace.");
    }
    const secondaryCustomers = await request("/api/customers");
    if (secondaryCustomers.data?.some((entry) => entry.id === customer.data.id || entry.name === marker)) {
      throw new Error("A customer record leaked across workspaces.");
    }
  } finally {
    cookie = primaryCookie;
    await request(`/api/customers/${encodeURIComponent(customer.data.id)}`, { method: "DELETE" });
  }
}
console.log(`E2E smoke passed for ${email}`);
