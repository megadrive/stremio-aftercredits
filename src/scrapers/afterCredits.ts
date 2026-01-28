import { to } from "await-to-js";
import {
  BaseScraper,
  type Stinger,
  type ScraperResult,
  type SearchInfo,
} from "./_base.js";
import { load } from "cheerio";

export class AfterCreditsScraper extends BaseScraper {
  paths = {
    search: "/?s=%s",
  };

  constructor() {
    super({
      name: "AfterCredits",
      baseUrl: "https://aftercredits.com",
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
    const $results = $("h3.entry-title");
    console.debug(`Found ${$results.length} results for query: ${query}`);
    const results = $results.filter((i, el) => {
      const title = $(el).text().toLowerCase();
      return title.trim().endsWith("*");
    });

    if (results.length === 0) {
      console.info(`No results found for query: ${query}`);
      return undefined;
    }
    // fetch the href of the first result for more details
    const firstResult = results.first();
    const href = firstResult.find("a").attr("href");
    if (!href) {
      console.info(`No href found for the first result of query: ${query}`);
      return undefined;
    }

    result.link = href;
    result.title = firstResult
      .text()
      .replace(/[*|?]$/, "")
      .trim();

    // does title include split of the query
    const queryWithoutYear = query.query.replace(/[0-9]{4}$/, "").trim();

    const stingerExists =
      firstResult.text().includes("*") &&
      result.title.toLowerCase().includes(queryWithoutYear.toLowerCase());

    if (!stingerExists) {
      // early exit, no stingers, no need to do a detail fetch
      console.warn("early exit, no stingers, no need to do a detail fetch");
      return result;
    }

    // grab details
    const [detailHtmlErr, detailHtml] = await to(this.fetchHtml(href));

    if (detailHtmlErr) {
      throw new Error(`Failed to fetch detail HTML from ${href}`);
    }

    const $$ = load(detailHtml);

    const $$spoilers = $$(".spoiler-wrap");
    console.info(`Found ${$$spoilers.length} spoilers for ${result.title}`);

    $$spoilers.each((i, el) => {
      const stinger: Stinger = { type: "post-credit-scene" }; // make an assumption

      const $$when = $$(el).find(".spoiler-head").text().trim().toLowerCase();
      if ($$when.includes("during the credits")) {
        stinger.type = "mid-credit-scene";
      }

      const $$details = $$(el).find(".spoiler-body").text().trim();
      if ($$details && $$details.length > 0) {
        stinger.note = $$details;
      }

      console.info(`Found stinger: ${JSON.stringify(stinger)}`);

      result.stingers.push(stinger);
    });

    return result;
  }
}
export const afterCreditsScraper = new AfterCreditsScraper();
