import { DEFAULT_SOURCES } from "../lib/defaults";
import { scrapeSource } from "../lib/scrapers";

async function main() {
  const requestedIds = (process.env.TEST_SOURCE_IDS ?? "jnu_international_notice,jnu_jobcenter_notice,jnu_education_innovation,jnu_engineering_notice")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const output: Array<Record<string, unknown>> = [];

  for (const id of requestedIds) {
    const source = DEFAULT_SOURCES.find((item) => item.id === id);
    if (!source) {
      output.push({ id, error: "source not found" });
      continue;
    }

    try {
      const items = await scrapeSource({
        ...source,
        parser_config: { ...source.parser_config, limit: 5, detail_limit: 1 }
      });
      output.push({
        id,
        count: items.length,
        samples: items.slice(0, 2).map((item) => ({ title: item.title, url: item.originalUrl, deadline: item.deadline, rawSample: item.rawText.slice(0, 320) }))
      });
    } catch (error) {
      output.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
