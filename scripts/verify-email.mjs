const apiKey = process.env.RESEND_API_KEY;
const sender = process.env.EMAIL_FROM;
if (!apiKey || !sender) {
  throw new Error("RESEND_API_KEY and EMAIL_FROM are required to verify transactional email.");
}

const senderAddress = /<([^<>]+)>/.exec(sender)?.[1] ?? sender;
const senderDomain = senderAddress.split("@")[1]?.toLowerCase();
if (!senderDomain) throw new Error("EMAIL_FROM must contain a valid sender address.");

const domainsResponse = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${apiKey}` },
  signal: AbortSignal.timeout(10_000),
});
if (!domainsResponse.ok) {
  throw new Error(`Resend domain verification failed with HTTP ${domainsResponse.status}.`);
}

const domainsBody = await domainsResponse.json();
const verified = Array.isArray(domainsBody.data)
  && domainsBody.data.some((domain) => domain.name?.toLowerCase() === senderDomain && domain.status === "verified");
if (!verified) {
  throw new Error(`The sender domain ${senderDomain} is not verified in Resend.`);
}

let testEmailSent = false;
if (process.env.EMAIL_SMOKE_TEST_TO) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender,
      to: process.env.EMAIL_SMOKE_TEST_TO,
      subject: "Kora transactional email verification",
      text: "This message confirms Kora can send transactional email through the configured provider.",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Resend test delivery failed with HTTP ${response.status}.`);
  }
  testEmailSent = true;
}

console.log(JSON.stringify({ provider: "Resend", senderDomainVerified: verified, testEmailSent }));
