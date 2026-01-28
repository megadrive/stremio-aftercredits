import { to } from "await-to-js";
import {
  BaseScraper,
  type Stinger,
  type ScraperResult,
  type SearchInfo,
} from "./_base.js";
import { load } from "cheerio";

export class MediaStingerScraper extends BaseScraper {
  paths = {
    search: "/?tab=MOVIES&s=%s",
  };

  constructor() {
    super({
      name: "MediaStinger",
      baseUrl: "http://www.mediastinger.com",
    });
  }

  async scrape(query: SearchInfo): Promise<ScraperResult | undefined> {
    const searchUrl = this.path("search").replace(
      "%s",
      encodeURIComponent(query.query),
    );

    const result: ScraperResult = {
      title: "",
      link: "",
      stingers: [],
    };

    const [htmlErr, html] = await to(this.fetchHtml(searchUrl));

    if (htmlErr) {
      console.error(
        `Error fetching HTML from ${searchUrl}: ${htmlErr.message}`,
      );

      return undefined;
    }

    console.info(`Fetched HTML from ${searchUrl}. Length: ${html.length}`);

    const $ = load(html);
    const $result = $("ul.highlights li").first();
    console.debug(`Found ${$result.length} results for query: ${query}`);

    if ($result.length === 0) {
      console.info(`No results found for query: ${query}`);
      return undefined;
    }

    result.link = $result.find("a").first().prop("href") ?? "";
    result.title = $result.find(".title").first().text().trim();

    const $subtitle = $result.find(".subtitle").first().text().trim();
    const stingerExists = !$subtitle
      .toLowerCase()
      .trim()
      .toLowerCase()
      .includes("no");

    if (!stingerExists) {
      // early exit, no stingers, no need to do a detail fetch
      console.warn("early exit, no stingers, no need to do a detail fetch");
      return result;
    }

    // grab details
    const during = $subtitle.toLowerCase().includes("during");
    const after = $subtitle.toLowerCase().includes("after");

    if (during) {
      result.stingers.push({ type: "mid-credit-scene" });
    }
    if (after) {
      result.stingers.push({ type: "post-credit-scene" });
    }

    return result;
  }
}
export const mediaStingerScraper = new MediaStingerScraper();
