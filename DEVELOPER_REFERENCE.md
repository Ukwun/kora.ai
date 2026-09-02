# Developer Quick Reference

## Security Utilities Cheat Sheet

### Authorization Checks
```typescript
// Check if user can access organization
if (!canAccessOrganization(session, organizationId)) {
  return 403; // Access denied
}

// Check user has required role
if (!hasRole(user, ["owner", "admin"])) {
  return 403; // Insufficient permissions
}

// Check specific permission
if (!canPerformAction(user, "view_reports")) {
  return 403; // Permission denied
}
```

### Rate Limiting
```typescript
import { checkRateLimit } from "@/lib/security";

const rateLimitKey = `endpoint_${session.id}`;
if (!checkRateLimit(rateLimitKey, 100, 60)) {
  return 429; // Too many requests
}
```

### Input Validation
```typescript
import { validateEmail, validatePassword, sanitizeInput } from "@/lib/security";

// Validate email
const emailValid = validateEmail(email);

// Validate password
const { valid, errors } = validatePassword(password);
if (!valid) {
  // errors contains reasons why
}

// Sanitize user input
const cleanInput = sanitizeInput(userInput, 1000);
```

### Audit Logging
```typescript
import { logAudit, getClientIP } from "@/lib/security";

await logAudit({
  userId: session.id,
  organizationId: session.organizationId,
  action: "data.create",
  resource: "invoice",
  resourceId: invoiceId,
  status: "success",
  details: { amount: 50000 },
  ipAddress: getClientIP(request),
});
```

### Error Handling
```typescript
import { getSafeErrorMessage } from "@/lib/security";

try {
  // risky operation
} catch (error) {
  const safeMessage = getSafeErrorMessage(error);
  return { error: safeMessage }; // Safe to send to frontend
}
```

---

## Data Accuracy Quick Reference

### Creating Data Records
```typescript
import { createDataRecord } from "@/lib/data-accuracy";

const record = createDataRecord(
  actualData,
  "verified", // data source
  95, // confidence score 0-100
  "Confirmed by audit", // reasoning
  { source: "manual_entry" } // metadata
);
```

### Checking if Update is Allowed
```typescript
import { canUpdateRecord, validateDataUpdate } from "@/lib/data-accuracy";

const oldRecord = existing;
const newRecord = updated;

if (!canUpdateRecord(oldRecord, newRecord)) {
  console.error("Cannot update verified data with predicted data");
  return;
}

const { allowed, reason } = validateDataUpdate(oldRecord, newRecord);
if (!allowed) {
  console.error(reason);
}
```

### Confidence Messages
```typescript
import { 
  highConfidenceMessage,
  mediumConfidenceMessage,
  lowConfidenceMessage,
  formatConfidenceMessage
} from "@/lib/data-accuracy";

const msg = highConfidenceMessage(
  "Revenue grew 12%",
  "Based on confirmed payments",
  "verified"
);

console.log(formatConfidenceMessage(msg));
// Output: "This is based on confirmed data: Revenue grew 12%"
```

### Dual Records (Predicted vs Actual)
```typescript
import { createDualRecord } from "@/lib/data-accuracy";

const record = createDualRecord(
  predicted = 100000, // predicted payment amount
  actual = undefined, // not yet received
  reasoning = "Based on payment history"
);

// Later when actual payment arrives:
record.actual = {
  actual: 95000,
  verifiedAt: new Date().toISOString()
};
```

---

## AI Feedback Quick Reference

### Recording Feedback
```typescript
import { recordFeedback } from "@/lib/ai-feedback";

const feedback = await recordFeedback({
  recommendationId: "rec_123",
  userId: user.id,
  organizationId: org.id,
  feedbackType: "useful", // or "not-useful", "incorrect", etc.
  comment: "This helped close the deal"
});
```

### Getting Stats
```typescript
import { getFeedbackStats } from "@/lib/ai-feedback";

const stats = getFeedbackStats(organizationId, userId);
// Returns: {
//   total: 50,
//   useful: 35,
//   notUseful: 10,
//   incorrect: 3,
//   alreadyCompleted: 2,
//   positiveRate: 70
// }
```

### Should Show Recommendation?
```typescript
import { shouldShowRecommendation } from "@/lib/ai-feedback";

if (shouldShowRecommendation(orgId, userId, "revenue_optimization")) {
  // Show recommendation to user
}
```

### Filter by Score
```typescript
import { filterRecommendationsByScore } from "@/lib/ai-feedback";

const recommendations = [
  { id: "r1", category: "revenue", title: "Scale pricing" },
  { id: "r2", category: "customer", title: "Retention program" }
];

const filtered = filterRecommendationsByScore(
  recommendations,
  organizationId,
  userId,
  40 // minimum score threshold
);
```

---

## API Endpoint Template

### Protected Endpoint Template
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  canPerformAction,
  sanitizeInput,
  getSafeErrorMessage,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  // 1. Verify session
  const session = await getSessionFromRequest(request);
  if (!session) {
    await logAudit({
      userId: "anonymous",
      organizationId: "unknown",
      action: "permission.denied",
      resource: "endpoint",
      status: "failure",
      ipAddress: getClientIP(request),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limiting
  const rateLimitKey = `endpoint_${session.id}`;
  if (!checkRateLimit(rateLimitKey, 100, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    // 3. Verify org access
    if (!canAccessOrganization(session, session.organizationId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. Check permissions
    if (!canPerformAction(session, "required_permission")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // 5. Sanitize inputs
    const body = await request.json();
    const cleanInput = sanitizeInput(body.userInput, 1000);

    // 6. Process request
    const result = await doSomething(cleanInput);

    // 7. Log success
    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "data.create",
      resource: "thing",
      status: "success",
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error:", error);

    // 8. Log error
    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "error",
      resource: "endpoint",
      status: "failure",
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    );
  }
}
```

---

## Environment Variables

### Required for Production
```env
# Session secret (REQUIRED)
SESSION_SECRET=your-secure-secret-key-here

# Node environment
NODE_ENV=production

# Database (when migrating)
DATABASE_URL=postgresql://user:pass@host/db

# Email service (when integrating)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-key

# Error tracking
SENTRY_DSN=your-sentry-url

# Rate limiting
REDIS_URL=redis://localhost:6379
```

### Development Defaults
```env
NODE_ENV=development
API_BASE_URL=http://localhost:3000
```

---

## Common Tasks

### Add New Protected Endpoint
1. Create file in `app/api/route.ts`
2. Add session verification
3. Add rate limiting
4. Add permission checks
5. Add input sanitization
6. Add audit logging
7. Return safe error messages

### Add New Permission
1. Edit `ROLE_PERMISSIONS` in `lib/security.ts`
2. Add to appropriate roles
3. Update RBAC checks in endpoints
4. Add permission verification

### Track New Data Type
1. Use `createDataRecord()` for tracking
2. Include source and confidence
3. Check `canUpdateRecord()` before updating
4. Use `DualRecord` for predictions vs actuals

### Implement New AI Recommendation
1. Add to `AIEngine` in `lib/ai.ts`
2. Include confidence level
3. Provide reasoning
4. Handle low-confidence cases
5. Test feedback loop

---

## Testing Security

### Manual Testing
```bash
# Test rate limiting
for i in {1..101}; do curl http://localhost:3000/api/ai; done
# Should fail on 101st request with 429

# Test unauthorized access
curl http://localhost:3000/api/analytics
# Should return 401

# Test org isolation
curl -H "Cookie: kora_session=..." http://localhost:3000/api/workspace
# Should only show user's org data
```

### Check Audit Logs
```bash
# View recent logs
tail -100 /var/log/kora/audit.log

# Search for errors
grep "status: failure" /var/log/kora/audit.log

# Track user activity
grep "userId: user123" /var/log/kora/audit.log
```

---

## Debugging Tips

### Enable Verbose Logging
```typescript
// In development:
console.log("[AUDIT]", auditLog);
console.log("[SECURITY]", securityCheck);
console.log("[ERROR]", safeError);
```

### Check Session Token
```typescript
const { id, email, organizationId, role } = session;
console.log("Session user:", { id, email, organizationId, role });
```

### Verify Permissions
```typescript
const permissions = ROLE_PERMISSIONS[user.role];
console.log(`User ${user.id} has:`, permissions);
console.log(`Can perform 'view_reports':`, canPerformAction(user, "view_reports"));
```

---

## Performance Tips

1. **Cache permission checks** for high-traffic endpoints
2. **Batch audit logs** before persisting to database
3. **Use Redis** for rate limiting in production
4. **Implement feedback pagination** for large datasets
5. **Compress audit logs** for archive storage

---

## Security Audit Checklist

Before each deployment:
- [ ] All endpoints have session verification
- [ ] All endpoints have rate limiting
- [ ] All user inputs are sanitized
- [ ] All mutations are audited
- [ ] All errors are safe messages
- [ ] All secrets in .env only
- [ ] No console.logs with sensitive data
- [ ] HTTPS enabled in production
- [ ] Cookies have secure flag
- [ ] CORS properly configured

---

**Last Updated**: September 2, 2026
**Version**: 1.0
