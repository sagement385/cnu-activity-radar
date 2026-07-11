"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSessionToken, ADMIN_COOKIE_NAME, ADMIN_SESSION_SECONDS } from "@/lib/admin-session";
import { getLoginIdentifier, isLoginRateLimited, recordLoginAttempt, verifyAdminPassword } from "@/lib/admin-auth";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");
  const redirectPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  const identifierHash = await getLoginIdentifier();
  if (await isLoginRateLimited(identifierHash)) {
    redirect(`/admin?error=locked&next=${encodeURIComponent(redirectPath)}`);
  }

  if (verifyAdminPassword(password)) {
    await recordLoginAttempt(identifierHash, true);
    const token = await createAdminSessionToken();
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_SESSION_SECONDS,
      path: "/"
    });
    redirect(redirectPath);
  }

  await recordLoginAttempt(identifierHash, false);
  redirect(`/admin?error=1&next=${encodeURIComponent(redirectPath)}`);
}
