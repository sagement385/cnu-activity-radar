import type { ScrapedOpportunity, Source } from "../types";
import { normalizeWhitespace, normalizeUrl, stripHtml } from "../text";
import { buildOpportunity, fetchDetailText, LinkCandidate, uniqueCandidates } from "./common";
import { fetchHtml, loadHtml } from "./fetch";

const SEARCH_URLS = [
  "https://linkareer.com/list/activity?keyword=%EC%84%9C%ED%8F%AC%ED%84%B0%EC%A6%88",
  "https://linkareer.com/list/activity?keyword=%EA%B3%B5%EB%AA%A8%EC%A0%84",
  "https://linkareer.com/list/activity?keyword=%EA%B3%B5%EA%B3%B5%EA%B8%B0%EA%B4%80",
  "https://linkareer.com/list/activity?keyword=%EA%B8%B0%EA%B3%84%EA%B3%B5%ED%95%99"
];

export async function scrapeLinkareer(source: Source): Promise<ScrapedOpportunity[]> {
  const candidates: LinkCandidate[] = [];

  for (const url of SEARCH_URLS) {
    try {
      const html = await fetchHtml(url);
      const $ = loadHtml(html);

      $("a[href*='/activity/']").each((_, element) => {
        const link = $(element);
        const href = normalizeUrl(link.attr("href") ?? "", url);
        const title = extractLinkareerTitle(link.text(), link.html() ?? "");
        const context = normalizeWhitespace(link.closest("li, article, div").text());

        if (title.length >= 4) {
          candidates.push({ title, href, context });
        }
      });
    } catch {
      continue;
    }
  }

  const unique = uniqueCandidates(candidates).slice(0, 20);
  const opportunities: ScrapedOpportunity[] = [];

  for (const [index, candidate] of unique.entries()) {
    const detailText = index < 10 ? await fetchDetailText(candidate.href) : "";
    opportunities.push(buildOpportunity(source, candidate, detailText));
  }

  return opportunities;
}

function extractLinkareerTitle(text: string, html: string) {
  const stripped = stripHtml(text);
  const altMatch = html.match(/alt=["']([^"']+)["']/i);
  const alt = altMatch ? normalizeWhitespace(altMatch[1]) : "";

  if (stripped && !stripped.includes("<img") && stripped.length >= 4) {
    return stripped.replace(/^추천/, "").trim();
  }

  return alt || stripped;
}
