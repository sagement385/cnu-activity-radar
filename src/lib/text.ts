import { createHash } from "crypto";

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

export function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function includesAny(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

export function matchKeywords(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  return keywords.filter((keyword) => lowered.includes(keyword.toLowerCase()));
}

export function stripHtml(value: string) {
  return normalizeWhitespace(value.replace(/<[^>]*>/g, " "));
}

export function truncate(value: string, length = 180) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length - 1)}...`;
}
