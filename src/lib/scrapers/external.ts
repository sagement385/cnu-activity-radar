import type { ScrapedOpportunity, Source } from "../types";
import { normalizeWhitespace, normalizeUrl } from "../text";
import { buildOpportunity, fetchDetailText, LinkCandidate, uniqueCandidates } from "./common";
import { fetchHtml, loadHtml } from "./fetch";

const SOURCE_RULES: Record<string, RegExp> = {
  allforyoung_activity: /\/posts\//i,
  thinkcontest_activity: /\/Contest\//i
};

export async function scrapeExternal(source: Source): Promise<ScrapedOpportunity[]> {
  const html = await fetchHtml(source.url);
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
    candidates.push({ title, href: normalizeUrl(href, source.url), context });
  });

  const unique = uniqueCandidates(candidates).slice(0, 36);
  const opportunities: ScrapedOpportunity[] = [];

  for (const [index, candidate] of unique.entries()) {
    const detailText = index < 18 ? await fetchDetailText(candidate.href) : "";
    opportunities.push(buildOpportunity(source, candidate, detailText));
  }

  return opportunities;
}
