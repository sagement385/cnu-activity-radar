import type { ScrapedOpportunity } from "./types";
import { stableHash } from "./text";

function normalizedTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*d-?\d+[^)]*\)/gi, " ")
    .replace(/20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/g, " ")
    .replace(/[^0-9a-z가-힣]+/gi, "")
    .trim();
}

export function canonicalOpportunityKey(item: ScrapedOpportunity) {
  const title = normalizedTitle(item.title);
  const organization = (item.organization ?? "").toLowerCase().replace(/[^0-9a-z가-힣]+/gi, "");
  const discriminator = item.deadline ? `${organization}:${item.deadline}` : item.originalUrl.replace(/[?#].*$/, "");
  return stableHash(`${title}:${discriminator}`);
}

export function mergeDuplicateItems(items: ScrapedOpportunity[]) {
  const merged = new Map<string, ScrapedOpportunity>();

  for (const item of items) {
    const canonicalKey = canonicalOpportunityKey(item);
    const existing = merged.get(canonicalKey);
    if (!existing) {
      merged.set(canonicalKey, item);
      continue;
    }

    const existingOfficial = existing.sourceId.startsWith("jnu_");
    const itemOfficial = item.sourceId.startsWith("jnu_");
    const preferred = itemOfficial !== existingOfficial
      ? itemOfficial ? item : existing
      : item.rawText.length >= existing.rawText.length ? item : existing;
    const other = preferred === item ? existing : item;

    merged.set(canonicalKey, {
      ...other,
      ...preferred,
      title: preferred.title.length >= other.title.length ? preferred.title : other.title,
      summary: preferred.summary ?? other.summary,
      rawText: preferred.rawText.length >= other.rawText.length ? preferred.rawText : other.rawText,
      posterUrl: preferred.posterUrl ?? other.posterUrl,
      tags: Array.from(new Set([...(other.tags ?? []), ...(preferred.tags ?? [])])),
      sourceRefs: Array.from(
        new Map(
          [...(other.sourceRefs ?? []), ...(preferred.sourceRefs ?? [])].map((ref) => [`${ref.sourceId}:${ref.originalUrl}`, ref])
        ).values()
      )
    });
  }

  return [...merged.values()];
}
