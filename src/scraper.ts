import { to } from "await-to-js";
import { load } from "cheerio";
import fetch from "ky";

type ScraperOptions = {
  name: string;
  baseUrl: string;
  timeout?: number;
  retries?: number;
  userAgent?: string;
};

type StingerType = "post-credit-scene" | "mid-credit-scene";
type Stinger = { type: StingerType; note?: string };
export type ScraperResult = {
  title: string;
  link: string;
  stingers: Stinger[];
};

/**
 * Fetch HTML content from a given URL
 * @param url - URL to fetch HTML from
 * @returns HTML as a string or throws an Error if the fetch fails
 */
async function fetchHtml(url: string): Promise<string> {
  const [htmlErr, html] = await to(fetch(url).then((res) => res.text()));
  if (htmlErr) {
    if (htmlErr.name === "TimeoutError") {
      throw new Error(`Request to ${url} timed out`);
    }

    throw new Error(`Failed to fetch HTML from ${url}`);
  }
  return html;
}

class BaseScraper {
  options: ScraperOptions;
  paths: { [key: string]: string } = {};

  constructor(options: ScraperOptions) {
    this.options = Object.assign(
      {
        timeout: 5000,
        retries: 3,
        userAgent: "Stremio-AfterCredits-Scraper/1.0",
      },
      options
    );
  }

  path(pathKey: string): string {
    return (
      this.options.baseUrl + this.paths[pathKey as keyof typeof this.path] || ""
    );
  }

  log(message: string) {
    console.log(`[AfterCreditsScraper] ${message}`);
  }

  // Placeholder for common scraper methods and properties
  async scrape(_query: string): Promise<ScraperResult | undefined> {
    throw new Error("Method not implemented.");
  }
}

class AfterCreditsScraper extends BaseScraper {
  paths = {
    search: "/?s=%s",
  };

  constructor() {
    super({
      name: "AfterCredits",
      baseUrl: "https://aftercredits.com",
    });
  }

  async scrape(query: string): Promise<ScraperResult | undefined> {
    const searchUrl = this.path("search").replace(
      "%s",
      encodeURIComponent(query)
    );

    const result: ScraperResult = {
      title: "",
      link: "",
      stingers: [],
    };

    const [htmlErr, html] = await to(fetchHtml(searchUrl));

    if (htmlErr) {
      console.error(
        `Error fetching HTML from ${searchUrl}: ${htmlErr.message}`
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

    const stingerExists = firstResult.text().includes("*");

    if (!stingerExists) {
      // early exit, no stingers, no need to do a detail fetch
      console.warn("early exit, no stingers, no need to do a detail fetch");
      return result;
    }

    // grab details
    const [detailHtmlErr, detailHtml] = await to(fetchHtml(href));

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

class MediaStingerScraper extends BaseScraper {
  paths = {
    search: "/?tab=MOVIES&s=%s",
  };

  constructor() {
    super({
      name: "MediaStinger",
      baseUrl: "http://www.mediastinger.com",
    });
  }

  async scrape(query: string): Promise<ScraperResult | undefined> {
    const searchUrl = this.path("search").replace(
      "%s",
      encodeURIComponent(query)
    );

    const result: ScraperResult = {
      title: "",
      link: "",
      stingers: [],
    };

    const [htmlErr, html] = await to(fetchHtml(searchUrl));

    if (htmlErr) {
      console.error(
        `Error fetching HTML from ${searchUrl}: ${htmlErr.message}`
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
    const stingerExists = !$subtitle.toLowerCase().trim().startsWith("no");

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

  async fetchHtml() {
    // fetch the html from the base url
    const [htmlErr, html] = await to(fetchHtml(this.options.baseUrl));

    if (htmlErr) {
      console.error(
        `Error fetching HTML from ${this.options.baseUrl}: ${htmlErr.message}`
      );
      return;
    }

    this.cache = { html, time: Date.now() };
    console.info(
      `Fetched HTML from ${this.options.baseUrl}. Length: ${html.length}`
    );
  }

  async scrape(query: string): Promise<ScraperResult | undefined> {
    const result: ScraperResult = {
      title: "",
      link: "",
      stingers: [],
    };

    if (!this.ready) {
      console.warn("Cached HTML not ready, fetching HTML...");
      await this.fetchHtml().catch((err) => {
        console.error(`Error fetching HTML: ${err.message}`);
      });
    }

    if (!this.cache.html) {
      console.error("No cached HTML available");
      return undefined;
    }

    const $ = load(this.cache.html);
    const normalizedQuery = query
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
