import { createHash, scryptSync, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "./supabase";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminPassword(password: string) {
  const storedHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  if (storedHash.startsWith("scrypt$")) {
    const [, salt, expected] = storedHash.split("$");
    if (!salt || !expected) return false;
    const actual = scryptSync(password, Buffer.from(salt, "base64url"), 64).toString("base64url");
    return safeEqual(actual, expected);
  }
  if (storedHash.startsWith("sha256$")) {
    return safeEqual(createHash("sha256").update(password).digest("hex"), storedHash.slice(7));
  }

  const legacySecret = process.env.DASHBOARD_SECRET ?? "";
  return Boolean(legacySecret && legacySecret !== "disabled" && safeEqual(password, legacySecret));
}

export async function getLoginIdentifier() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${forwardedFor}:${userAgent}`).digest("hex");
}

export async function isLoginRateLimited(identifierHash: string) {
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier_hash", identifierHash)
      .eq("success", false)
      .gte("created_at", since);
    return !error && (count ?? 0) >= 5;
  } catch {
    return false;
  }
}

export async function recordLoginAttempt(identifierHash: string, success: boolean) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_login_attempts").insert({ identifier_hash: identifierHash, success });
  } catch {
    // Authentication remains available if audit logging is temporarily unavailable.
  }
}
