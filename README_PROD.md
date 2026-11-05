# Kora - Business Operating System

> AI-powered business operating system for modern service businesses. Centralizes sales, customer memory, money movement, operations, and AI-guided next steps.

## 🚀 Features

- **Intelligent Dashboard** - Real-time insights and activity tracking
- **Business Memory Graph** - AI learns from every transaction and action
- **Role-Based Access** - Owner, admin, manager, and employee roles
- **Multi-Channel Auth** - Email/password, Google OAuth, Facebook OAuth
- **Activity Tracking** - Passive learning from invoices, customers, tasks, payments
- **AI Observations** - Behavior-driven insights and recommendations
- **Responsive Design** - Works beautifully on all devices
- **Real-Time Updates** - Live activity stream and metrics

## 📋 Prerequisites

- Node.js 18+ 
- npm 9+
- Git

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/Ukwun/kora.ai.git
cd kora
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

See `.env.example` and [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for the current requirements. Production requires PostgreSQL, a 32-character-or-longer `SESSION_SECRET`, HTTPS `APP_URL`, verified transactional email, Firebase Admin credentials, and Upstash Redis. Production does not use `DATABASE_TYPE=json` or the local JSON file store. OAuth and payment integrations require their paired credentials and provider-side callback/webhook configuration.

## 🏗️ Project Structure

```
kora/
├── app/
│   ├── api/
│   │   └── auth/               # Authentication endpoints
│   ├── dashboard/              # Dashboard page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page & auth
│   └── globals.css             # Global styles
├── lib/
│   ├── db.ts                   # PostgreSQL connection pool
│   ├── session.ts              # Session management
│   └── store.ts                # PostgreSQL-backed records; JSON in development only
├── migrations/                 # PostgreSQL schema migrations
├── public/                      # Static assets
├── proxy.ts                     # API rate limiting and route protection
└── next.config.ts               # Next.js configuration
```

## 🔐 Authentication

### Signup Flow
In production, new accounts must verify their email before signing in. Verification and password-recovery links require a working Resend configuration and a verified sender domain. Do not rely on development-only test accounts or local file storage.

### OAuth
- Google OAuth support (configure in `.env.local`)
- Facebook OAuth support (configure in `.env.local`)

## 🚀 Deployment

### Netlify Deployment

Follow [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for the supported Netlify build, required services, environment-variable contexts, staging tests, and production release gates. The configured build runs PostgreSQL migrations before the Next.js build; configure a managed pooler, verified TLS, and all required secrets before deploying.

### Local Production Build

```bash
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000)

## 📊 Data Model

### Users
```typescript
{
  id: string
  name: string
  email: string
  passwordHash: string
  role: "owner" | "admin" | "manager" | "employee"
  organizationId: string
  createdAt: string
}
```

### Organizations
```typescript
{
  id: string
  name: string
  industry: string
  timezone: string
  currency: string
  createdAt: string
}
```

## 🔄 Activity Tracking

The system tracks:
- Invoices (revenue, customer)
- Customers (new, retention)
- Products (sales, demand)
- Tasks (approvals, delays)
- Payments (incoming capital)
- Appointments (client touchpoints)
- Employees (productivity, roles)

## 🧠 AI Features

- **Passive Learning** - Learns from every action without prompts
- **Business Memory** - Remembers patterns and exceptions
- **Behavior Modeling** - Analyzes activity for insights
- **Proactive Guidance** - Surfaces next best actions

## 🛠️ Development

### Build for Production
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## 📱 Responsive Design

- Mobile-first approach
- Tailwind CSS responsive utilities
- Works on phones, tablets, and desktops
- Dark theme optimized for modern aesthetics

## 🔒 Security Features

- HMAC-signed session cookies
- Password hashing with bcryptjs
- Input validation with Zod
- Workspace and role checks in API handlers
- Shared Upstash rate limits in the Next.js Proxy
- Security response headers configured in `netlify.toml`

## 📈 Roadmap

- [ ] Verify Resend delivery and account recovery with the production sender domain
- [ ] Complete authenticated end-to-end checks on an isolated staging database
- [ ] Load-test representative authenticated database reads at the target concurrency
- [ ] Configure and test only the OAuth, payment, and messaging integrations planned for launch
- [ ] Confirm backup/restore, monitoring, and rollback procedures before launch

## 🐛 Known Issues

- SWC loader warnings on Windows (non-blocking, using WASM instead)
- Middleware convention deprecated in Next.js 16 (still functional)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please feel free to submit pull requests.

## 📞 Support

For issues and questions, please create an issue on GitHub.

---

**Built with Next.js 16, React 19, and Tailwind CSS**
