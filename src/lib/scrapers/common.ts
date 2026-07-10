import type { CheerioAPI } from "cheerio";
import type { ScrapedOpportunity, Source } from "../types";
import { extractDeadline } from "../date";
import { classifyCategory } from "../classifier";
import { normalizeUrl, normalizeWhitespace, stableHash, truncate } from "../text";
import { fetchHtml, pageText } from "./fetch";

export type LinkCandidate = {
  title: string;
  href: string;
  context: string;
};

export function buildOpportunity(source: Source, candidate: LinkCandidate, detailText?: string): ScrapedOpportunity {
  const originalUrl = normalizeUrl(candidate.href, source.url);
  const rawText = normalizeWhitespace(`${candidate.title} ${candidate.context} ${detailText ?? ""}`);
  const category = classifyCategory(rawText);

  return {
    stableKey: `${source.id}:${stableHash(originalUrl)}`,
    title: candidate.title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    originalUrl,
    category,
    deadline: extractDeadline(rawText),
    summary: truncate(rawText, 220),
    rawText,
    tags: [category]
  };
}

export async function fetchDetailText(url: string) {
  try {
    const html = await fetchHtml(url);
    return pageText(html).slice(0, 5000);
  } catch {
    return "";
  }
}

export function uniqueCandidates(candidates: LinkCandidate[]) {
  const seen = new Set<string>();
  const result: LinkCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.title}:${candidate.href}`;

    if (!candidate.title || candidate.title.length < 4 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

export function anchorCandidates($: CheerioAPI, source: Source, hrefPattern: RegExp, limit = 20) {
  const candidates: LinkCandidate[] = [];

  $("a[href]").each((_, element) => {
    const link = $(element);
    const href = link.attr("href") ?? "";

    if (!hrefPattern.test(href)) {
      return;
    }

    const title = normalizeWhitespace(link.text());
    const row = link.closest("li, tr, article, div");
    const context = normalizeWhitespace(row.text() || link.parent().text() || title);

    candidates.push({
      title,
      href: normalizeUrl(href, source.url),
      context
    });
  });

  return uniqueCandidates(candidates).slice(0, limit);
}
