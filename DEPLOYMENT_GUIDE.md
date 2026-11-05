# Kora production deployment on Netlify

Kora is a Next.js application with server-side API routes, PostgreSQL persistence, Firebase-backed business memory, transactional email, and Upstash-backed distributed rate limiting. It must not be deployed as a static site or use the local JSON file store for production data.

## Required production services

Provision and verify these before promoting a deployment:

- **Netlify** site connected to `Ukwun/kora.ai`, with the Next.js runtime/adapter enabled.
- **Managed PostgreSQL** with a serverless or transaction pooler. Use a provider connection string that reaches the pooler, not a direct connection intended for a long-running server.
- **Verified TLS** for PostgreSQL. Certificate verification is enabled by default. If the provider uses a private CA, set `DATABASE_CA_CERT` to its PEM certificate. Do not set `DATABASE_SSL=false` in production.
- **Upstash Redis** REST URL and token. Production startup requires both; application rate limits fail closed instead of silently switching to process-local state.
- **Resend** API key and a verified sender domain in `EMAIL_FROM`. Set `APP_URL` to the canonical HTTPS site origin.
- **Firebase Admin** project ID and service-account email/private key, or service-account JSON, for business memory.
- A cryptographically random `SESSION_SECRET` of at least 32 characters.

OAuth, payment, WhatsApp, and AI integrations are optional until their credentials, redirect/webhook URLs, and provider-side setup are complete. Configure both client/public and secret values for a provider as applicable. Never place secrets in Git, client-side variables, logs, or screenshots. Do not expose a Netlify deploy preview to untrusted users with production data or secrets.

## Netlify build settings

The repository's `netlify.toml` runs:

```text
npm run db:migrate && npm run build
```

Set Node.js to the version pinned in `netlify.toml`. Use Netlify's Next.js adapter/runtime rather than configuring the site as static output. The migration command uses `DATABASE_URL` during the **build**, so make the database URL available to the production build context as well as Functions/Runtime. Restrict who can trigger trusted production builds; do not make fork previews inherit production credentials.

Add these production environment variables in Netlify (values are secrets where noted):

| Variable | Required | Notes |
|---|---:|---|
| `DATABASE_URL` | Yes | Managed PostgreSQL pooler URL; Build and Function/Runtime contexts |
| `DATABASE_POOL_MAX` | Optional | Defaults to `1` in production; maximum allowed is `5` per function instance |
| `DATABASE_SSL` | Optional | TLS verification is on by default; `false` is rejected in production |
| `DATABASE_CA_CERT` | If needed | PEM CA certificate for a private database CA |
| `SESSION_SECRET` | Yes | Random, secret, at least 32 characters |
| `APP_URL` | Yes | Canonical HTTPS origin, with no path required |
| `RESEND_API_KEY` | Yes | Secret; Resend account must verify the sender domain |
| `EMAIL_FROM` | Yes | Sender name/address using a verified domain |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project |
| `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` | Yes* | Service-account credentials; private key is secret |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Alternative | Use instead of the two service-account fields above |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Configure together; register `/api/auth/google/callback` |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Optional | Configure together; register `/api/auth/facebook/callback` |
| `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` | Optional | Configure together only when enabling live payments |
| `PAYMENT_WEBHOOK_SECRET` | For payments | Configure and verify provider webhook signatures before accepting payments |
| WhatsApp variables | Optional | Configure Meta app, webhook, token encryption, and queue secrets before enabling |

`*` Either the service-account pair or `FIREBASE_SERVICE_ACCOUNT_JSON` is required. Set optional providers only after their provider-side app, redirect URI, webhooks, and business approvals are ready. Configure preview and production values deliberately; avoid copying live credentials to untrusted deploy previews.

## Safe release sequence

1. Add required variables to Netlify and confirm production build context access. Do not paste secret values into issue trackers or chat.
2. Verify the sender domain and credentials in Resend. From a trusted environment that has the production variables, run:

   ```text
   npm run email:verify
   ```

   To send one deliberate test message to an address you control, set `EMAIL_SMOKE_TEST_TO` for that command. The script checks Resend authentication and sender-domain verification; it sends no message unless the recipient variable is explicitly set.
3. Confirm the production database is reachable through verified TLS and that the pooler/connection limits match Netlify's expected function concurrency. Production uses a pool size of one by default. Increase only after checking the database provider's limits and load-test results.
4. Deploy a trusted production build. Migrations run before the build. Inspect Netlify build logs and stop on migration, configuration, or build failures.
5. Check `https://<site>/api/health`. It returns `200` only when the production database is reachable and mandatory environment configuration is complete. It intentionally reports optional integrations separately.
6. In a protected staging environment, exercise sign-up, verification email delivery, sign-in, password recovery, onboarding, tenant isolation, role restrictions, customer/task/invoice workflows, and any enabled provider integrations. Do not use real customer data for test accounts.
7. Run authenticated load testing against staging with disposable test credentials and a concurrency profile agreed with the database and provider capacity. Monitor Netlify function errors/duration, PostgreSQL connections/latency, Upstash rate limits, email delivery, and provider webhooks. A health-only or local test does not establish production capacity.
8. Promote only after restoring/backup procedures, alerting, privacy/retention settings, and rollback ownership are confirmed.

## Validation commands

```text
npm ci
npm run type-check
npm run lint
npm run build
npm run email:verify
```

`npm run test:e2e` creates a development account and updates its onboarding data; run it only against an isolated test database. For staging, set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` to a disposable, already verified owner account. Optionally set `E2E_FORBIDDEN_PATH`, `E2E_FORBIDDEN_EMAIL`, and `E2E_FORBIDDEN_PASSWORD` to verify a `403` for a lower-privilege account, or set `E2E_SECONDARY_EMAIL` and `E2E_SECONDARY_PASSWORD` to a second verified owner in a different workspace to create/check/delete a temporary customer and verify cross-workspace isolation. The extra test accounts should be used with disposable staging workspaces only.

`npm run test:load` defaults to health requests. For authenticated staging traffic, set `LOAD_TEST_EMAIL`, `LOAD_TEST_PASSWORD`, `LOAD_PATHS` (comma-separated GET endpoints such as `/api/customers,/api/tasks,/api/invoices,/api/analytics`), `CONCURRENCY`, `REQUESTS_PER_WORKER`, `LOAD_REQUEST_TIMEOUT_MS`, and `BASE_URL`. It exercises reads only and reports status counts and p50/p95/max latency. Authenticated requests are limited by account; unauthenticated requests are limited by client IP. Start with low concurrency, coordinate higher loads with the database/Redis providers, and use only a disposable staging workspace. This script is a load probe, not a capacity certification. Never point either script at production data without an approved test plan.

## Scaling and operations notes

- Production rate limiting uses Upstash; there is no production process-local fallback.
- PostgreSQL connections use certificate verification by default. `DATABASE_SSL=false` is a development-only opt-out.
- `DATABASE_POOL_MAX` defaults to one per serverless instance and is capped at five. The total possible connections are still pool size multiplied by active instances; use a provider pooler and confirm its limits.
- File-backed `data/app-db.json` is development-only. Production refuses to use it when PostgreSQL is missing.
- Health status confirms database connectivity and required configuration, not successful delivery of an email or OAuth/payment transaction. Run the email verification command and provider-specific staging tests as part of release.
