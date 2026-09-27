import bcrypt from "bcryptjs";
import { z } from "zod";

export type AuthAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  organizationId: string | null;
  role: "owner" | "admin" | "manager" | "employee";
  createdAt: string;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  industry: string;
  timezone: string;
  currency: string;
  createdAt: string;
};

export const authSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8),
  confirmPassword: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2),
  industry: z.string().trim().min(2),
  timezone: z.string().trim().min(2),
  currency: z.string().trim().min(2),
});

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
