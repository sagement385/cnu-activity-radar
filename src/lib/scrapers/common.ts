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
  const images = [...$(element).find("img").toArray(), ...container.find("img").toArray()];

  for (const imageElement of images) {
    const image = $(imageElement);
    const rawUrls = [
      image.attr("data-src"),
      image.attr("data-original"),
      image.attr("data-lazy-src"),
      image.attr("srcset"),
      image.attr("srcSet"),
      image.attr("data-srcset"),
      image.attr("data-srcSet"),
      image.attr("src")
    ];

    for (const rawUrl of rawUrls) {
      const imageUrl = rawUrl?.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
      if (isUsableImageUrl(imageUrl)) {
        return normalizeUrl(imageUrl, baseUrl);
      }
    }
  }

  const html = `${$(element).html() ?? ""} ${container.html() ?? ""}`;
  const htmlMatches = html.matchAll(/(?:data-src|data-original|data-lazy-src|src|srcset|srcSet|data-srcset|data-srcSet)=["']([^"']+)/gi);

  for (const match of htmlMatches) {
    const imageUrl = match[1]?.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
    if (isUsableImageUrl(imageUrl)) {
      return normalizeUrl(imageUrl, baseUrl);
    }
  }

  return null;
}

export async function fetchDetailData(url: string) {
  try {
    const html = await fetchHtml(url);
    const $ = loadHtml(html);
    const imageElement = $("meta[property='og:image'], meta[name='twitter:image']").first();
    const metaImageUrl = imageElement.attr("content") ?? "";
    const imageUrl = isUsableImageUrl(metaImageUrl)
      ? metaImageUrl
      : extractImageUrl($, "body", url);

    return {
      text: pageText(html).slice(0, 5000),
      imageUrl: imageUrl ? normalizeUrl(imageUrl, url) : null
    };
  } catch {
    return { text: "", imageUrl: null };
  }
}

function isUsableImageUrl(value: string) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return false;
  }

  const lowered = value.toLowerCase();
  return !lowered.includes("icon_file") && !lowered.includes("placeholder");
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
