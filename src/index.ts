import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { manifest } from "./manifest.js";
import type { Stream } from "stremio-addon-sdk";
import { to } from "await-to-js";
import ky from "ky";
import { z } from "zod";
import {
  afterCreditsScraper,
  mediaStingerScraper,
  wikipediaScraper,
  type ScraperResult,
} from "./scraper.js";
import { createCache } from "./cache.js";
import { appEnv } from "./appEnv.js";
const cache = createCache<ScraperResult>(
  "aftercredits",
  1000 * 60 * 60 * 24 * 7
); // 7 days

const SOURCES = [wikipediaScraper, afterCreditsScraper, mediaStingerScraper];

const app = new Hono({ strict: false });
app.use("*", cors());

app.use(
  "*",
  serveStatic({
    root: "./static",
  })
);

app.get("/", (c) => {
  return c.redirect("/configure.html");
});

app.get("/configure", (c) => {
  return c.redirect("/configure.html");
});

app.get("/manifest.json", (c) => {
  return c.json(manifest);
});

const CinemetaResponseSchema = z.object({
  meta: z.object({
    id: z.string(),
    name: z.string(),
    releaseInfo: z.coerce.string().optional(),
  }),
});

// scrape all sources for a given query in sequence
async function scrapeAll(query: string): Promise<ScraperResult | null> {
  console.info(`Cache miss for ${query}, scraping...`);

  for (const source of SOURCES) {
    let [err, result] = await to(source.scrape(query));
    if (err) {
      console.error(`Error scraping ${query} from ${source.constructor.name}`);
      console.error(err);
      continue;
    }
    if (result) {
      console.info(`Scraped ${query} from ${source.constructor.name}`);
      return result;
    }
  }

  console.info(`No aftercredits info found for ${query}`);
  return null;
}

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

app.get("/stream/movie/:id", async (c) => {
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
    return c.json({ streams: [stream] });
  }

  console.info(`Fetching aftercredits info for ${cleanId}`);

  // get details from imdbid from cinemeta
  const [cinemetaErr, cinemeta] = await to(
    ky(`https://cinemeta-live.strem.io/meta/movie/${cleanId}.json`)
  );

  if (cinemetaErr || !cinemeta.ok) {
    console.error(`Failed to fetch details for ${cleanId} from cinemeta`);
    return c.json({ streams: [] });
  }

  // parse cinemeta response
  const cinemetaJson = await cinemeta.json();
  const parseResult = CinemetaResponseSchema.safeParse(cinemetaJson);
  if (!parseResult.success) {
    console.error(
      `Cinemeta response for ${cleanId} did not match expected schema`
    );
    console.error(parseResult.error);
    return c.json({ streams: [] });
  }

  // get aftercredits details
  const { meta } = parseResult.data;
  const query = `${meta.name} ${meta.releaseInfo ?? ""}`.trim();
  let [_err, scrapeResult] = await to(scrapeAll(query));

  if (!scrapeResult) {
    console.info(`No info found for ${query}`);

    return c.json({ streams: [] });
  }

  if (scrapeResult.stingers.length === 0) {
    console.info(`No stingers found for ${query}`);
    return c.json({ streams: [] });
  }

  console.info(`Found info for ${query} from ${scrapeResult.link}`);

  // cache the result for future requests
  await cache.set(cleanId, scrapeResult);

  const streams = scrapeResultToStream(scrapeResult);

  return c.json({ streams: [streams] });
});

serve(
  {
    fetch: app.fetch,
    port:
      process.env.PORT && Number.isInteger(process.env.PORT)
        ? +process.env.PORT
        : 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.info("Install URL: http://localhost:3000/manifest.json");
  }
);
