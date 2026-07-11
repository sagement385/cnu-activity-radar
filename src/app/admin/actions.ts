"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAdmin(formData: FormData) {
  const secret = process.env.DASHBOARD_SECRET;
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");
  const redirectPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  if (!secret || secret === "disabled" || password === secret) {
    const cookieStore = await cookies();
    cookieStore.set("dashboard_secret", secret && secret !== "disabled" ? secret : "local", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });
    redirect(redirectPath);
  }

  redirect("/admin?error=1");
}
