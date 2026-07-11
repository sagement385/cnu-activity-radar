import * as cheerio from "cheerio";
import * as tls from "tls";
import { Agent, fetch as undiciFetch } from "undici";
import { normalizeWhitespace } from "../text";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; CNUActivityRadar/0.1; +https://github.com/sagement385/cnu-activity-radar)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7"
};

const getSystemCertificates = (tls as typeof tls & { getCACertificates?: (type: "system") => string[] }).getCACertificates;
const systemCertificateDispatcher = new Agent({
  connect: {
    ca: Array.from(new Set([...tls.rootCertificates, ...(getSystemCertificates?.("system") ?? [])]))
  }
});

export async function fetchHtml(url: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      cache: "no-store"
    });
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error ? (error as { cause?: { code?: string; message?: string } }).cause : null;
    const hostname = new URL(url).hostname;
    const certificateError = cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || cause?.code === "SELF_SIGNED_CERT_IN_CHAIN";
    if (certificateError && (hostname === "jnu.ac.kr" || hostname.endsWith(".jnu.ac.kr"))) {
      try {
        response = await undiciFetch(url, {
          headers: DEFAULT_HEADERS,
          redirect: "follow",
          dispatcher: systemCertificateDispatcher
        }) as unknown as Response;
      } catch (retryError) {
        const retryCause = retryError && typeof retryError === "object" && "cause" in retryError ? (retryError as { cause?: { code?: string; message?: string } }).cause : null;
        throw new Error(`Failed to fetch ${url}: ${retryCause?.code ?? retryCause?.message ?? "certificate validation failed"}`);
      }
    } else {
      throw new Error(`Failed to fetch ${url}: ${cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : "network error")}`);
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const charset = response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1]?.replace(/["']/g, "") ?? "utf-8";

  try {
    return new TextDecoder(charset, { fatal: false }).decode(arrayBuffer);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
  }
}

export function loadHtml(html: string) {
  return cheerio.load(html);
}

export function pageText(html: string) {
  const $ = loadHtml(html);
  $("script, style, noscript, svg").remove();
  return normalizeWhitespace($("body").text());
}
