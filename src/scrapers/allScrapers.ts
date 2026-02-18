export { type ScraperResult } from "./_base.js";
import { appEnv } from "../appEnv.js";
import type { BaseScraper } from "./_base.js";
import { afterCreditsScraper } from "./afterCredits.js";
import { mediaStingerScraper } from "./mediaStinger.js";
import { tmdbScraper } from "./tmdb.js";
import { wikipediaScraper } from "./wikipedia.js";

export const SOURCES = (() => {
  const scraperMap: Record<string, BaseScraper> = {
    aftercredits: afterCreditsScraper,
    wikipedia: wikipediaScraper,
    mediastinger: mediaStingerScraper,
    tmdb: tmdbScraper,
  };

  const sourceOrder = appEnv.SOURCE_ORDER.replace(/\s/g, "")
    .toLowerCase()
    .split(",");

  return sourceOrder.map((name) => scraperMap[name]);
})();
