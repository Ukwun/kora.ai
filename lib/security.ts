import { NextRequest } from "next/server";
import type { BusinessUser } from "./store";

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Audit log types
export type AuditLogAction =
  | "user.signin"
  | "user.signup"
  | "user.logout"
  | "data.create"
  | "data.read"
  | "data.update"
  | "data.delete"
  | "ai.recommendation"
  | "ai.feedback"
  | "permission.denied"
  | "error";

export type AuditLog = {
  id: string;
  timestamp: string;
  userId: string;
  organizationId: string;
  action: AuditLogAction;
  resource: string;
  resourceId?: string;
  status: "success" | "failure";
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

// Input validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return input.substring(0, maxLength).trim().replace(/[<>]/g, "");
}

// Rate limiting
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowSeconds: number = 60
): boolean {
  const now = Date.now();
  const limiter = rateLimitStore.get(identifier);

  if (!limiter || now > limiter.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowSeconds * 1000 });
    return true;
  }

  if (limiter.count >= limit) {
    return false;
  }

  limiter.count++;
  return true;
}

// Extract client IP from request
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(":")[0] : request.headers.get("x-real-ip") || "unknown";
  return ip;
}

// Extract user agent from request
export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

// Authorization check - verify user has access to organization
export function canAccessOrganization(
  user: BusinessUser,
  organizationId: string
): boolean {
  return user.organizationId === organizationId;
}

// Authorization check - verify user has required role
export function hasRole(user: BusinessUser, requiredRoles: string[]): boolean {
  return requiredRoles.includes(user.role);
}

// Role-based permission check
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "create_user",
    "delete_user",
    "manage_billing",
    "view_audit_logs",
    "manage_settings",
    "create_api_key",
    "delete_api_key",
    "all_data_access",
  ],
  admin: [
    "create_user",
    "manage_settings",
    "view_audit_logs",
    "all_data_access",
  ],
  manager: [
    "view_team_data",
    "create_task",
    "assign_task",
    "view_reports",
  ],
  employee: [
    "view_own_data",
    "create_task",
    "update_own_task",
  ],
};

export function canPerformAction(user: BusinessUser, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(action) || permissions.includes("all_data_access");
}

// Audit logging
export async function logAudit(
  log: Omit<AuditLog, "id" | "timestamp">
): Promise<AuditLog> {
  const auditLog: AuditLog = {
    ...log,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  // In production, store in database or dedicated logging service
  console.log(
    `[AUDIT] ${auditLog.action} | User: ${auditLog.userId} | Org: ${auditLog.organizationId} | Status: ${auditLog.status}`
  );

  return auditLog;
}

// Secure error messages (don't leak sensitive info)
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only expose specific safe error messages
    if (error.message.includes("validation") || error.message.includes("invalid")) {
      return error.message;
    }
  }
  return "An error occurred. Please try again later.";
}

// Token validation
export function validateJWT(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Decode and verify structure (full verification requires secret)
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    const now = Math.floor(Date.now() / 1000);

    return payload.exp > now;
  } catch {
    return false;
  }
}
