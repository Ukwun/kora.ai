# Kora Deployment Guide - Netlify Production Setup

## 🚀 Quick Start (5 minutes)

### Prerequisites
- GitHub account with the repository set up
- Netlify account (free tier available at https://netlify.com)

### Step 1: Connect GitHub Repository
1. Go to [Netlify](https://netlify.com)
2. Click "New site from Git"
3. Select "GitHub" as your provider
4. Authorize Netlify to access your GitHub account
5. Select the repository: **Ukwun/kora.ai**
6. Click "Deploy site"

### Step 2: Configure Build Settings
Netlify will automatically detect Next.js and configure:
- **Build command:** `npm run build`
- **Publish directory:** `.next`
- **Node version:** 20 (auto-detected)

### Step 3: Set Environment Variables
1. In Netlify dashboard, go to Site Settings → Environment variables
2. Add the following variables:

```
SESSION_SECRET=generate-a-random-secure-string-here
NODE_ENV=production
DATABASE_TYPE=json
API_BASE_URL=https://your-netlify-domain.netlify.app
```

3. For OAuth (optional):
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

### Step 4: Deploy
Click "Deploy site" and wait for the build to complete (~2-3 minutes).

Your site is now live! 🎉

---

## 🔧 Production Checklist

- [x] Build passes locally (`npm run build`)
- [x] All dependencies installed
- [x] Environment variables configured
- [x] Authentication working (test with demo account)
- [x] Dashboard rendering correctly
- [x] API routes responding
- [x] Responsive design tested
- [x] Security headers configured
- [ ] Custom domain configured (optional)
- [ ] SSL/TLS certificate enabled (automatic with Netlify)
- [ ] Analytics set up (optional)

---

## 📊 Monitoring & Logs

### View Deployment Logs
1. Go to Netlify dashboard
2. Select your site
3. Click "Deploys" tab
4. Click on latest deploy to see build logs

### View Runtime Errors
1. Click "Functions" tab to see any API errors
2. Check browser console for client-side errors
3. Use Netlify Analytics (Pro plan) for detailed metrics

---

## 🔐 Security Best Practices

### Session Secret
Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Variables
- Never commit `.env.local` to Git
- All sensitive values should be in Netlify environment settings
- `.env.example` shows all available options

### Middleware Protection
Routes protected by middleware:
- `/dashboard/*` - Requires authentication
- `/api/auth/session` - Requires authentication

---

## 🚀 Custom Domain Setup

1. In Netlify dashboard, go to Site settings → Domain management
2. Click "Add custom domain"
3. Enter your domain (e.g., kora.ai)
4. Follow Netlify's instructions to update DNS

---

## 🆘 Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Ensure all environment variables are set
- Verify Node.js version is 18+

### Authentication Not Working
- Check SESSION_SECRET is set correctly
- Verify cookies are enabled in browser
- Clear browser cache and cookies

### Dashboard Shows "Loading workspace..."
- Check browser console for fetch errors
- Verify API routes are deployed
- Check that `/api/workspace` endpoint is accessible

### API Routes Returning 401
- Check that session cookie is being set
- Verify middleware is protecting correct routes
- Test with demo account credentials

---

## 📈 Scaling & Performance

### Current Setup (Free Tier)
- Automatic scaling with Netlify Functions
- Global CDN distribution
- Up to 125,000 function invocations/month

### Database
Currently using JSON file storage. For scaling:
1. Migrate to PostgreSQL
2. Update data layer in `lib/store.ts`
3. Configure database credentials in environment

---

## 🔄 Continuous Deployment

Every push to `master` branch automatically:
1. Triggers a build on Netlify
2. Runs tests (if configured)
3. Deploys to preview URL
4. Promotes to production on merge

### Disable Auto-Deploy
Go to Site settings → Build & deploy → Deploy settings to disable automatic builds.

---

## 💡 Tips for Success

1. **Test Locally First:** Always run `npm run build && npm start` before pushing
2. **Monitor Deploys:** Check the Deploys tab after each push
3. **Use Branch Previews:** Create pull requests to test changes before merging
4. **Backup Database:** JSON file is stored in `/data` - back up regularly
5. **Update Dependencies:** Run `npm update` periodically for security patches

---

## 📞 Support Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [GitHub Issues](https://github.com/Ukwun/kora.ai/issues)

---

## 🎯 Next Steps After Deployment

1. **Test All Features**
   - Sign up with new account
   - Test authentication flows
   - Verify dashboard functionality

2. **Configure OAuth** (if desired)
   - Set up Google OAuth credentials
   - Set up Facebook OAuth credentials
   - Update environment variables

3. **Monitor Performance**
   - Check Netlify Analytics
   - Monitor function invocations
   - Track error rates

4. **Plan Upgrades**
   - Migrate to PostgreSQL for persistence
   - Add webhook integrations
   - Implement analytics

---

**Deployment Status:** ✅ READY FOR PRODUCTION

**Last Updated:** September 2, 2026
