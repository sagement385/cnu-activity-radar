import type { ScrapedOpportunity, Source } from "../types";
import { normalizeWhitespace } from "../text";
import { buildOpportunity, extractImageUrl, fetchDetailData, LinkCandidate, uniqueCandidates } from "./common";
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

    candidates.push({ title, href, context, imageUrl: extractImageUrl($, element, source.url) });
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
      candidates.push({ title, href, context, imageUrl: extractImageUrl($, element, source.url) });
    }
  });

  return hydrateCandidates(source, uniqueCandidates(candidates).slice(0, 24), 10);
}

export async function scrapeRegistryBoard(source: Source): Promise<ScrapedOpportunity[]> {
  const html = await fetchHtml(source.list_url ?? source.url);
  const $ = loadHtml(html);
  const candidates: LinkCandidate[] = [];
  const config = source.parser_config ?? {};
  const selector = config.link_selector || "a[href]";
  let hrefPattern: RegExp;

  try {
    hrefPattern = new RegExp(config.link_pattern || "artclView|bbsMode=view", "i");
  } catch {
    throw new Error(`Invalid link pattern for ${source.id}`);
  }

  $(selector).each((_, element) => {
    const link = $(element);
    const href = link.attr("href") ?? "";
    if (!hrefPattern.test(href)) return;

    const container = link.closest(config.item_selector || "li, tr, article, .item, .post, div");
    const configuredTitle = config.title_selector ? normalizeWhitespace(container.find(config.title_selector).first().text()) : "";
    const title = configuredTitle || normalizeWhitespace(link.attr("title") || link.text());
    if (!title || title.length < 5 || /^(공지사항|notice|상세|더보기|목록|go)$/i.test(title)) return;

    candidates.push({
      title,
      href,
      context: normalizeWhitespace(container.text() || link.parent().text() || title),
      imageUrl: extractImageUrl($, element, source.url)
    });
  });

  return hydrateCandidates(
    source,
    uniqueCandidates(candidates).slice(0, config.limit ?? 24),
    config.detail_limit ?? 10
  );
}

async function hydrateCandidates(source: Source, candidates: LinkCandidate[], detailLimit: number) {
  const opportunities: ScrapedOpportunity[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const detail = index < detailLimit ? await fetchDetailData(candidate.href) : { text: "", imageUrl: null };
    opportunities.push(buildOpportunity(source, candidate, detail.text, detail.imageUrl));
  }

  return opportunities;
}
