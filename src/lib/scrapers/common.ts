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

  const deadline = extractDeadline(rawText);
  const isCampus = source.id.startsWith("jnu_") || source.source_type !== "external";
  const activityType = /온라인|비대면|원격/i.test(rawText)
    ? /오프라인|대면/i.test(rawText) ? "혼합" : "온라인"
    : /오프라인|대면|장소/i.test(rawText) ? "오프라인" : "미확인";
  const eligibilityStatus = /대학원생\s*(전용|만)|재직자\s*(전용|만)|졸업생\s*(전용|만)|교직원\s*대상/i.test(rawText)
    ? "지원 불가"
    : /학부생|재학생|대학생/i.test(rawText) ? "지원 가능" : "조건 확인 필요";

  return {
    stableKey: `${source.id}:${stableHash(originalUrl)}`,
    title: candidate.title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    originalUrl,
    posterUrl: detailImageUrl ?? candidate.imageUrl ?? null,
    organization: source.organization ?? (isCampus ? "전남대학교" : null),
    category,
    subCategory: source.source_group ?? null,
    campusScope: isCampus ? "교내" : "교외",
    target: [],
    allowedGrades: [],
    allowedMajors: [],
    activityType,
    deadline,
    eligibilityStatus,
    deadlineConfidence: deadline ? "high" : "low",
    dataConfidence: detailText ? "high" : "medium",
    summary: truncate(rawText, 220),
    rawText,
    tags: Array.from(new Set([category, source.source_group].filter(Boolean) as string[])),
    sourceRefs: [{ sourceId: source.id, sourceName: source.name, sourceUrl: source.url, originalUrl }]
  };
}

export function extractImageUrl($: CheerioAPI, element: Parameters<CheerioAPI>[0], baseUrl: string) {
  const root = $(element);
  const scopes = [...root.toArray(), ...root.parents().slice(0, 8).toArray()];
  const images = scopes.flatMap((scope) => $(scope).find("img").toArray());

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

  const html = scopes.map((scope) => $(scope).html() ?? "").join(" ");
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
