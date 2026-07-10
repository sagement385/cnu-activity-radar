import * as cheerio from "cheerio";
import { normalizeWhitespace } from "../text";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; CNUActivityRadar/0.1; +https://github.com/sagement385/cnu-activity-radar)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7"
};

export async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
}

export function loadHtml(html: string) {
  return cheerio.load(html);
}

export function pageText(html: string) {
  const $ = loadHtml(html);
  $("script, style, noscript, svg").remove();
  return normalizeWhitespace($("body").text());
}
