import type { ScrapedOpportunity, Source } from "../types";
import { normalizeWhitespace } from "../text";
import { buildOpportunity, fetchDetailText, LinkCandidate, uniqueCandidates } from "./common";
import { fetchHtml, loadHtml } from "./fetch";

export async function scrapeJnuEvents(source: Source): Promise<ScrapedOpportunity[]> {
  const html = await fetchHtml(source.url);
  const $ = loadHtml(html);
  const candidates: LinkCandidate[] = [];

  $("a[href*='EventView']").each((_, element) => {
    const link = $(element);
    const href = link.attr("href") ?? "";
    const title = normalizeWhitespace(link.text() || link.closest("h3, h4, li, div").text());
    const container = link.closest("li, article, .event, div");
    const context = normalizeWhitespace(container.text());

    candidates.push({ title, href, context });
  });

  const fallbackCandidates = uniqueCandidates(candidates).slice(0, 24);
  return hydrateCandidates(source, fallbackCandidates, 12);
}

export async function scrapeJnuBoard(source: Source): Promise<ScrapedOpportunity[]> {
  const html = await fetchHtml(source.url);
  const $ = loadHtml(html);
  const candidates: LinkCandidate[] = [];

  $("a[href]").each((_, element) => {
    const link = $(element);
    const href = link.attr("href") ?? "";
    const isBoardLink =
      source.id === "jnu_main_notice"
        ? href.includes("bbsMode=view") && href.includes("key=")
        : href.includes("artclView") || href.includes("bbsMode=view");

    if (!isBoardLink) {
      return;
    }

    const title = normalizeWhitespace(link.text());
    const row = link.closest("li, tr, div");
    const context = normalizeWhitespace(row.text());

    if (title && !title.includes("RSS") && !title.includes("목록")) {
      candidates.push({ title, href, context });
    }
  });

  return hydrateCandidates(source, uniqueCandidates(candidates).slice(0, 24), 10);
}

async function hydrateCandidates(source: Source, candidates: LinkCandidate[], detailLimit: number) {
  const opportunities: ScrapedOpportunity[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const detailText = index < detailLimit ? await fetchDetailText(candidate.href) : "";
    opportunities.push(buildOpportunity(source, candidate, detailText));
  }

  return opportunities;
}
