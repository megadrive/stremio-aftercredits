import { to } from "await-to-js";
import {
  BaseScraper,
  type Stinger,
  type ScraperResult,
  type SearchInfo,
} from "./_base.js";
import { load } from "cheerio";

export class WikipediaScraper extends BaseScraper {
  paths = {
    search: "/?tab=MOVIES&s=%s",
  };

  cache: {
    /** html of the page */
    html: string | undefined;
    /** time when fetched */
    time: number;
  } = { html: undefined, time: 0 };

  constructor() {
    super({
      name: "Wikipedia",
      baseUrl:
        "https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes",
    });
  }

  get ready() {
    return (
      this.cache.html !== undefined && Date.now() - this.cache.time < 86400000
    ); // 24 hours
  }

  async fetchHtmlWiki() {
    // fetch the html from the base url
    const [htmlErr, html] = await to(this.fetchHtml(this.options.baseUrl));

    if (htmlErr) {
      console.error(
        `Error fetching HTML from ${this.options.baseUrl}: ${htmlErr.message}`,
      );
      return;
    }

    this.cache = { html, time: Date.now() };
    console.info(
      `Fetched HTML from ${this.options.baseUrl}. Length: ${html.length}`,
    );
  }

  async scrape(query: SearchInfo): Promise<ScraperResult | undefined> {
    const result: ScraperResult = {
      title: "",
      link: "",
      stingers: [],
    };

    if (!this.ready) {
      console.warn("Cached HTML not ready, fetching HTML...");
      await this.fetchHtmlWiki().catch((err) => {
        console.error(`Error fetching HTML: ${err.message}`);
      });
    }

    if (!this.cache.html) {
      console.error("No cached HTML available");
      return undefined;
    }

    const $ = load(this.cache.html);
    const normalizedQuery = query.query
      .trim() // trim initial whitespace
      .replace(/[0-9]{4}$/, "") // remove provided year
      .trim(); // trim trailing year if present
    console.debug(`Normalized query: ${normalizedQuery}`);

    let found = false;

    // find the appropriate tables
    const tables: any[] = []; // TODO: remove any
    const $tables = $("table.wikitable");
    $tables.each(function (i, e) {
      if ($(e).find("tr").text().trim().startsWith("Year")) {
        tables.push(e);
      }
    });

    // within each table, find the row that matches the query
    for (const table of tables) {
      const $table = $(table);
      const $rows = $table.find("tr");
      $rows.each((i, el) => {
        const $cells = $(el).find("td");
        if ($cells.length < 2) {
          return;
        }

        const titleCell = $cells.first();
        let titleText = titleCell.text().trim();

        // normalize title text
        titleText = titleText.replace(/\s*\(.*?\)\s*/g, "").trim(); // remove parenthetical info

        // remove any non-alphanumeric characters from both titleText and normalizedQuery
        titleText = titleText
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()
          .toLowerCase();
        const normalizedQueryClean = normalizedQuery
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()
          .toLowerCase();

        if (
          titleText === normalizedQueryClean ||
          titleText.startsWith(normalizedQueryClean)
        ) {
          result.title = titleText;
          const link = titleCell.find("a").first().attr("href");
          if (link) {
            result.link = `https://en.wikipedia.org${link}`;
          }

          result.stingers.push({ type: "post-credit-scene" });

          found = true;
          console.info(`Found matching row for query: ${query}`);
        }
      });

      if (found) {
        break;
      }
    }

    if (!found) {
      console.info(`No results found for query: ${query}`);
      return undefined;
    }

    return result;
  }
}
export const wikipediaScraper = new WikipediaScraper();
