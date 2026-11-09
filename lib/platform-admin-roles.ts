export type PlatformAdminRole = "super_admin" | "admin";

const platformAdminRoles: Record<string, PlatformAdminRole> = {
  "ukwun97@gmail.com": "super_admin",
  "solaceinterlude@gmail.com": "admin",
};

export function getPlatformAdminRole(email: string | null | undefined): PlatformAdminRole | null {
  return email ? platformAdminRoles[email.trim().toLowerCase()] ?? null : null;
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  return getPlatformAdminRole(email) !== null;
}
