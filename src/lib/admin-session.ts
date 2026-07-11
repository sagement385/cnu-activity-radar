export const ADMIN_COOKIE_NAME = "cnu_admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.DASHBOARD_SECRET || process.env.CRON_SECRET || "";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function sign(payload: string) {
  const secret = sessionSecret();
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createAdminSessionToken() {
  const payload = textToBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS }));
  const signature = await sign(payload);
  if (!signature) return "";
  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await sign(payload);
  if (!expected || expected.length !== signature.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (mismatch !== 0) return false;

  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
