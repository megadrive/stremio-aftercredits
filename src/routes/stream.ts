import ky from "ky";
import { Hono } from "hono";
import { to } from "await-to-js";
import { appEnv } from "../appEnv.js";
import type { Stream } from "stremio-addon-sdk";
import { createCache } from "@/cache.js";
import { SOURCES, type ScraperResult } from "@/scrapers/allScrapers.js";
import { CinemetaResponseSchema } from "@/util.js";
import type { SearchInfo } from "@/scrapers/_base.js";

const cache = createCache<ScraperResult>("stingers");

const app = new Hono();

console.info(
  `Scrapers registered: ${SOURCES.map((s) => s.constructor.name).join(", ")}`,
);

// scrape all sources for a given query in parallel, returning the first successful result
async function scrapeAll(query: SearchInfo): Promise<ScraperResult | null> {
  console.info(`Cache miss for ${query.query}, scraping...`);

  // Create promises for all scrapers to run in parallel
  const scraperPromises = SOURCES.map(async (source) => {
    console.info(`Scraping ${source.constructor.name} for ${query.query}`);

    try {
      // Attempt to scrape from this source
      const result = await source.scrape(query);

      if (result) {
        console.info(`Scraped ${query.query} from ${source.constructor.name}`);
        return result;
      }
      // If result is null, throw to signal this scraper didn't find anything
      throw new Error(`No result from ${source.constructor.name}`);
    } catch (err) {
      console.error(
        `Error scraping ${query.query} from ${source.constructor.name}`,
      );
      console.error(err);
      // Re-throw so Promise.any can try the next scraper
      throw err;
    }
  });

  try {
    // Promise.any resolves with the first successful result, rejects only if all fail
    const result = await Promise.any(scraperPromises);
    return result;
  } catch (err) {
    // AggregateError is thrown when all promises reject
    if (err instanceof AggregateError) {
      console.info(`No stinger info found for ${query.query}`);
    } else {
      console.error(`Unexpected error in scrapeAll:`, err);
    }
    return null;
  }
}

const STREAM: Stream = {
  name: "After Credits",
  title: "",
  externalUrl: "https://aftercredits.almosteffective.com/",
};

function scrapeResultToStream(result: ScraperResult): Stream {
  let stingers = "";
  for (const stinger of result.stingers) {
    stingers += `💚 ${stinger.type.replace(/-/g, " ")}\n`;
  }

  return {
    name: "After Credits",
    title: `Stick around for:\n${stingers.trim()}`,
    externalUrl: result.link,
  };
}

app.get("/movie/:id", async (c) => {
  const { id } = c.req.param();

  // strip the .json extension if present
  const cleanId = id.replace(/\.json$/, "");

  // set cache header
  if (appEnv.isProduction) {
    c.header("Cache-Control", "public, max-age=86400"); // cache for 1 day
  }

  // cache lookup
  const cached = await cache.get(cleanId);
  if (appEnv.isProduction && cached) {
    console.info(`Cache hit for ${cleanId}`);
    const stream = scrapeResultToStream(cached);
    c.header("X-AfterCredits-Source", "Cached");
    return c.json({ streams: [stream] });
  }

  console.info(`Fetching aftercredits info for ${cleanId}`);

  // get details from imdbid from cinemeta
  const [cinemetaErr, cinemeta] = await to(
    ky(`https://cinemeta-live.strem.io/meta/movie/${cleanId}.json`),
  );

  if (cinemetaErr || !cinemeta.ok) {
    console.error(`Failed to fetch details for ${cleanId} from cinemeta`);
    return c.json({
      streams: [],
    });
  }

  // parse cinemeta response
  const cinemetaJson = await cinemeta.json();
  const parseResult = CinemetaResponseSchema.safeParse(cinemetaJson);
  if (!parseResult.success) {
    console.error(
      `Cinemeta response for ${cleanId} did not match expected schema`,
    );
    console.error(parseResult.error);
    return c.json({ streams: [] });
  }

  // get aftercredits details
  const { meta } = parseResult.data;
  const cleanedName = meta.name.replace(/[^a-zA-Z0-9\s]/g, "");
  const query = `${cleanedName} ${meta.releaseInfo ?? ""}`.trim();
  let [_err, scrapeResult] = await to(
    scrapeAll({
      query,
      title: meta.name,
      imdbId: cleanId,
      year: meta.releaseInfo ?? "",
    }),
  );

  if (!scrapeResult) {
    console.info(`No info found for ${query}`);

    return c.json({ streams: [] });
  }

  if (scrapeResult.stingers.length === 0) {
    console.info(`No stingers found for ${query}`);
    if (appEnv.SHOW_NO_STINGERS) {
      return c.json({
        streams: [
          {
            ...STREAM,
            title: "No Stingers Found",
          },
        ],
      });
    }
    return c.json({
      streams: [],
    });
  }

  console.info(`Found info for ${query} from ${scrapeResult.link}`);

  // cache the result for future requests
  await cache.set(cleanId, scrapeResult);

  const streams = scrapeResultToStream(scrapeResult);

  return c.json({ streams: [streams] });
});

export default app;
