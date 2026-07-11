import type { ScrapedOpportunity, Source } from "../types";
import { toDateOnly, todayKst } from "../date";
import { normalizeWhitespace, normalizeUrl } from "../text";
import { buildOpportunity, extractImageUrl, fetchDetailData, LinkCandidate, uniqueCandidates } from "./common";
import { fetchHtml, loadHtml } from "./fetch";

const SOURCE_RULES: Record<string, RegExp> = {
  allforyoung_activity: /\/posts\//i,
  thinkcontest_activity: /\/Contest\//i
};

export async function scrapeExternal(source: Source): Promise<ScrapedOpportunity[]> {
  const html = await fetchHtml(source.url);

  if (source.id === "allforyoung_activity") {
    return scrapeAllForYoung(source, html);
  }

  const $ = loadHtml(html);
  const candidates: LinkCandidate[] = [];
  const hrefPattern = SOURCE_RULES[source.id] ?? /\/(activity|contest|posts?)\//i;

  $("a[href]").each((_, element) => {
    const link = $(element);
    const href = link.attr("href") ?? "";
    const title = normalizeWhitespace(link.text());

    if (!hrefPattern.test(href) || title.length < 5 || /^(상세|자세히|더보기|로그인|회원가입|목록)$/i.test(title)) {
      return;
    }

    const row = link.closest("li, tr, article, section, div");
    const context = normalizeWhitespace(row.text() || title);
    candidates.push({ title, href: normalizeUrl(href, source.url), context, imageUrl: extractImageUrl($, element, source.url) });
  });

  const unique = uniqueCandidates(candidates).slice(0, 36);
  const opportunities: ScrapedOpportunity[] = [];

  for (const [index, candidate] of unique.entries()) {
    const detail = index < 18 ? await fetchDetailData(candidate.href) : { text: "", imageUrl: null };
    opportunities.push(buildOpportunity(source, candidate, detail.text, detail.imageUrl));
  }

  return opportunities;
}

const ALLFORYOUNG_ITEM_PATTERN = /\\"data\\":\{\\"id\\":(\d+),\\"category\\":\\"([^\"]+)\\",\\"title\\":\\"((?:\\\\.|[^\"\\\\])*)\\",\\"organization\\":\\"((?:\\\\.|[^\"\\\\])*)\\",\\"poster_url\\":\\"((?:\\\\.|[^\"\\\\])*)\\",\\"thumbnail_url\\":\\"((?:\\\\.|[^\"\\\\])*)\\",\\"dday\\":\\"([^\"]*)\\"/g;

function scrapeAllForYoung(source: Source, html: string) {
  const opportunities: ScrapedOpportunity[] = [];

  for (const match of html.matchAll(ALLFORYOUNG_ITEM_PATTERN)) {
    const [, id, rawCategory, rawTitle, rawOrganization, rawPosterUrl, , dday] = match;
    const category = decodeEscapedField(rawCategory);
    const title = decodeEscapedField(rawTitle);
    const organization = decodeEscapedField(rawOrganization);
    const posterUrl = decodeEscapedField(rawPosterUrl);
    const deadline = deadlineFromDday(dday);
    const originalUrl = normalizeUrl(`/posts/${id}`, source.url);
    const context = normalizeWhitespace(`${category} ${organization} ${dday}`);
    const item = buildOpportunity(source, { title, href: originalUrl, context, imageUrl: posterUrl }, undefined, posterUrl);

    item.organization = organization || null;
    const finalCategory = category || item.category || "대외활동";
    item.category = finalCategory;
    item.deadline = deadline ?? item.deadline;
    item.tags = [finalCategory];
    item.rawText = normalizeWhitespace(`${title} ${organization} ${category} ${dday} ${source.name}`);
    item.summary = item.rawText;
    opportunities.push(item);
  }

  return opportunities.slice(0, 36);
}

function decodeEscapedField(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function deadlineFromDday(dday: string) {
  const match = dday.match(/D-(\d+)/i);
  if (!match) {
    return null;
  }

  const deadline = todayKst();
  deadline.setDate(deadline.getDate() + Number(match[1]));
  return toDateOnly(deadline);
}
