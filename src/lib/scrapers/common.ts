import type { CheerioAPI } from "cheerio";
import type { ScrapedOpportunity, Source } from "../types";
import { extractDeadline } from "../date";
import { classifyCategory } from "../classifier";
import { normalizeUrl, normalizeWhitespace, stableHash, truncate } from "../text";
import { fetchHtml, loadHtml, pageText } from "./fetch";

export type LinkCandidate = {
  title: string;
  href: string;
  context: string;
  imageUrl?: string | null;
};

export function buildOpportunity(source: Source, candidate: LinkCandidate, detailText?: string, detailImageUrl?: string | null): ScrapedOpportunity {
  const originalUrl = normalizeUrl(candidate.href, source.url);
  const rawText = normalizeWhitespace(`${candidate.title} ${candidate.context} ${detailText ?? ""} ${source.name}`);
  const category = classifyCategory(`${candidate.title} ${candidate.context} ${source.name}`);

  return {
    stableKey: `${source.id}:${stableHash(originalUrl)}`,
    title: candidate.title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    originalUrl,
    posterUrl: detailImageUrl ?? candidate.imageUrl ?? null,
    category,
    deadline: extractDeadline(rawText),
    summary: truncate(rawText, 220),
    rawText,
    tags: [category]
  };
}

export function extractImageUrl($: CheerioAPI, element: Parameters<CheerioAPI>[0], baseUrl: string) {
  const container = $(element).closest("li, article, .card, .event, tr, section, div");
  const directImage = $(element).find("img").first();
  const image = directImage.length ? directImage : container.find("img").first();
  const htmlImageUrl = ($(element).html() ?? "").match(/(?:data-src|data-original|data-lazy-src|src|srcset|srcSet|data-srcset|data-srcSet)=["']([^"']+)/i)?.[1] ?? "";
  const rawUrl = image.attr("data-src") ?? image.attr("data-original") ?? image.attr("data-lazy-src") ?? image.attr("src") ?? image.attr("srcset") ?? image.attr("srcSet") ?? image.attr("data-srcset") ?? image.attr("data-srcSet") ?? htmlImageUrl;
  const imageUrl = rawUrl.split(",")[0]?.trim().split(/\s+/)[0] ?? "";

  if (!imageUrl || imageUrl.startsWith("data:")) {
    return null;
  }

  return normalizeUrl(imageUrl, baseUrl);
}

export async function fetchDetailData(url: string) {
  try {
    const html = await fetchHtml(url);
    const $ = loadHtml(html);
    const imageElement = $("meta[property='og:image'], meta[name='twitter:image']").first();
    const rawImageUrl =
      imageElement.attr("content") ??
      $("img").first().attr("data-src") ??
      $("img").first().attr("data-original") ??
      $("img").first().attr("src") ??
      $("img").first().attr("srcset") ??
      $("img").first().attr("srcSet") ??
      "";
    const imageUrl = rawImageUrl.split(",")[0]?.trim().split(/\s+/)[0] ?? "";

    return {
      text: pageText(html).slice(0, 5000),
      imageUrl: imageUrl && !imageUrl.startsWith("data:") ? normalizeUrl(imageUrl, url) : null
    };
  } catch {
    return { text: "", imageUrl: null };
  }
}

export async function fetchDetailText(url: string) {
  return (await fetchDetailData(url)).text;
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
