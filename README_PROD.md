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

## 📝 Environment Variables

See `.env.example` for all available configuration options:

- `SESSION_SECRET` - HMAC secret for session signing (generate a random string)
- `NODE_ENV` - Set to `production` for production builds
- `DATABASE_TYPE` - Currently uses `json`, can be upgraded to PostgreSQL
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` - Facebook OAuth credentials

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
│   ├── auth.ts                 # Auth utilities
│   ├── session.ts              # Session management
│   └── store.ts                # Data store (JSON)
├── data/
│   └── app-db.json            # Application data
├── public/                      # Static assets
├── middleware.ts                # Route protection
└── next.config.ts               # Next.js configuration
```

## 🔐 Authentication

### Demo Account
- **Email:** demo@kora.ng
- **Password:** demo1234

### Signup Flow
Users can create an account with email/password and immediately access the dashboard. Organizations and roles are assigned automatically.

### OAuth
- Google OAuth support (configure in `.env.local`)
- Facebook OAuth support (configure in `.env.local`)

## 🚀 Deployment

### Netlify Deployment

1. **Connect Repository:**
   - Push code to GitHub
   - Sign in to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Select this GitHub repository
   - Netlify will auto-detect Next.js configuration

2. **Configure Build Settings:**
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Set Environment Variables:**
   - Go to Site Settings → Environment
   - Add all variables from `.env.example`
   - Ensure `NODE_ENV=production` and `SESSION_SECRET` are set

4. **Deploy:**
   - Netlify will automatically build and deploy on push to main branch

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
- Protected API routes with middleware
- Security headers (CORS, CSP, etc.)

## 📈 Roadmap

- [ ] PostgreSQL database integration
- [ ] Email verification
- [ ] Advanced analytics
- [ ] API integrations (Stripe, Gmail, WhatsApp)
- [ ] Team collaboration features
- [ ] Custom workflows
- [ ] Webhook support

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
