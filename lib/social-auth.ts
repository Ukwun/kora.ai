import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOrganization, createUser, findUserByEmail, listUserMemberships, readDatabase, writeDatabase } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

export function createOAuthState() {
  return randomBytes(32).toString("hex");
}

export function getOAuthBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.APP_URL || process.env.API_BASE_URL;
  const baseUrl = configuredUrl || (process.env.NODE_ENV === "production" ? "" : request.nextUrl.origin);
  if (!baseUrl) throw new Error("APP_URL must be configured for social sign-in.");

  const url = new URL(baseUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Social sign-in requires an HTTPS APP_URL in production.");
  }
  return url.origin;
}

export async function signInWithVerifiedOAuthEmail(
  request: NextRequest,
  profile: { email: string; name?: string; emailVerified: boolean },
) {
  const parsedEmail = z.string().trim().email().safeParse(profile.email);
  if (!profile.emailVerified || !parsedEmail.success) {
    throw new Error("The provider did not return a verified email address.");
  }
  const email = parsedEmail.data.toLowerCase();

  let user = await findUserByEmail(email);
  if (user?.accountStatus === "suspended") throw new Error("This account is unavailable.");

  if (!user) {
    const name = profile.name?.trim() || email.split("@")[0];
    const organization = await createOrganization({
      name: `${name}'s workspace`,
      industry: "Other",
      timezone: "Africa/Lagos",
      currency: "NGN",
    });
    user = await createUser({
      name,
      email,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
      role: "owner",
      organizationId: organization.id,
      emailVerified: true,
    });
  } else if (!user.emailVerified) {
    const database = await readDatabase();
    const storedUser = database.users.find((entry) => entry.id === user?.id);
    if (!storedUser) throw new Error("The account could not be verified.");
    storedUser.emailVerified = true;
    await writeDatabase(database);
    user.emailVerified = true;
  }

  const memberships = await listUserMemberships(user.id);
  const membership = memberships.find((entry) => entry.organizationId === user?.organizationId) ?? memberships[0];
  if (!membership) throw new Error("This account is not connected to an active workspace.");

  const response = NextResponse.redirect(new URL("/onboarding", request.url));
  return setSessionCookie(response, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: membership.role,
    organizationId: membership.organizationId,
  });
}
