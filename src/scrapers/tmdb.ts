import { to } from "await-to-js";
import {
  BaseScraper,
  type Stinger,
  type ScraperResult,
  type SearchInfo,
} from "./_base.js";
import { appEnv } from "../appEnv.js";
import z from "zod";
import { createCache } from "../cache.js";

// maps imdb tt ids to tmdb ids
const imdbCache = createCache<number>("tmdb");

const ExternalIDsResponseSchema = z.object({
  movie_results: z
    .object({
      id: z.number(),
    })
    .array(),
});

const KeywordResponseSchema = z.object({
  keywords: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .array(),
});

const MovieResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  keywords: KeywordResponseSchema,
});

export class TmdbScraper extends BaseScraper {
  paths = {
    api: "/movie/%s?append_to_response=keywords",
    externalIds: "/find/%s?external_source=imdb_id&language=en-US",
  };

  constructor() {
    super({
      name: "TMDB",
      baseUrl: "https://api.themoviedb.org/3",
    });
  }

  async scrape(query: SearchInfo): Promise<ScraperResult | undefined> {
    // if no tmdb apikey, skip
    if (!appEnv.TMDB_APIKEY) {
      this.log(`no tmdb apikey found`);
      return;
    }

    // fetch the imdb if necessary
    let imdb = await imdbCache.get(query.imdbId);
    if (!imdb) {
      this.log(`no tmdb found for ${query.imdbId}, fetching from tmdb`);
      const url = this.path("externalIds").replace(/%s/g, query.imdbId);
      console.log(url);
      const [imdbResultErr, imdbResult] = await to(
        fetch(url, {
          headers: {
            Authorization: `Bearer ${appEnv.TMDB_APIKEY}`,
            accept: "application/json",
          },
        }),
      );
      if (imdbResultErr || !imdbResult.ok) {
        this.log(`failed to fetch tmdb id for ${query.imdbId}`);
        console.warn(imdbResult?.status, imdbResult?.statusText);
        if (imdbResultErr) {
          console.error(imdbResultErr);
        }
        return;
      }

      const rawData = await imdbResult.json();
      const parsed = ExternalIDsResponseSchema.safeParse(rawData);
      console.info(rawData);
      if (!parsed.success) {
        this.log(`failed to parse imdb id for ${query.query}`);
        return;
      }

      const tmdbId = parsed.data.movie_results[0].id;
      await imdbCache.set(query.imdbId, tmdbId);
      imdb = await imdbCache.get(query.imdbId);
    }

    const apiEndpoint = this.path("api").replace(/%s/gi, `${imdb}`);

    const [error, response] = await to(
      fetch(apiEndpoint, {
        headers: {
          Authorization: `Bearer ${appEnv.TMDB_APIKEY}`,
          accept: "application/json",
        },
      }),
    );
    if (error) {
      console.error(error);
      return;
    }

    const data = await response.json();
    console.log(data);
    const parsed = MovieResponseSchema.safeParse(data);
    if (!parsed.success) {
      this.log("Invalid response from TMDB API");
      return;
    }

    const stingers: ScraperResult = {
      title: parsed.data.title,
      link: `https://www.themoviedb.org/movie/${parsed.data.id}`,
      stingers: [],
    };

    parsed.data.keywords.keywords.forEach((keyword) => {
      console.info(keyword.name);
      switch (keyword.name) {
        case "duringcreditsstinger":
          stingers.stingers.push({
            type: "mid-credit-scene",
          });
          break;
        case "aftercreditsstinger":
          stingers.stingers.push({
            type: "post-credit-scene",
          });
          break;
      }
    });

    return stingers;
  }
}

export const tmdbScraper = new TmdbScraper();
