import fetch from "ky";
import { to } from "await-to-js";

type ScraperOptions = {
  name: string;
  baseUrl: string;
  timeout?: number;
  retries?: number;
  userAgent?: string;
};

type StingerType = "post-credit-scene" | "mid-credit-scene";
export type Stinger = { type: StingerType; note?: string };
export type ScraperResult = {
  title: string;
  link: string;
  stingers: Stinger[];
};

export type SearchInfo = {
  query: string;
  title: string;
  year: string;
  imdbId: string;
};

export class BaseScraper {
  options: ScraperOptions;
  paths: { [key: string]: string } = {};

  constructor(options: ScraperOptions) {
    this.options = Object.assign(
      {
        timeout: 5000,
        retries: 3,
        userAgent: "Stremio-AfterCredits-Scraper/1.0",
      },
      options,
    );
  }

  async fetchHtml(url: string): Promise<string> {
    const [htmlErr, html] = await to(fetch(url).then((res) => res.text()));
    if (htmlErr) {
      if (htmlErr.name === "TimeoutError") {
        throw new Error(`Request to ${url} timed out`);
      }

      throw new Error(`Failed to fetch HTML from ${url}`);
    }
    return html;
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
  async scrape(_query: SearchInfo): Promise<ScraperResult | undefined> {
    throw new Error("Method not implemented.");
  }
}
