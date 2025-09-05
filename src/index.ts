import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { manifest } from "./manifest.js";
import type { Stream } from "stremio-addon-sdk";
import { to } from "await-to-js";
import ky from "ky";
import { z } from "zod";
import { AfterCreditsScraper, MediaStingerScraper } from "./scraper.js";
const afterCredits = new AfterCreditsScraper();
const mediaStinger = new MediaStingerScraper();

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
async function scrapeAll(query: string) {
  let [afterCreditsErr, afterCreditsResult] = await to(
    afterCredits.scrape(query)
  );

  if (afterCreditsErr) {
    console.error(
      `Error scraping AfterCredits for ${query}: ${afterCreditsErr}`
    );
    return null;
  }

  if (afterCreditsResult) {
    console.info(
      `Found aftercredits info for ${query}: ${JSON.stringify(
        afterCreditsResult
      )}`
    );
    return afterCreditsResult;
  }

  let [mediaStingerErr, mediaStingerResult] = await to(
    mediaStinger.scrape(query)
  );

  if (mediaStingerErr) {
    console.error(
      `Error scraping MediaStinger for ${query}: ${mediaStingerErr}`
    );
    return null;
  }

  if (mediaStingerResult) {
    console.info(
      `Found mediastinger info for ${query}: ${JSON.stringify(
        mediaStingerResult
      )}`
    );
    return mediaStingerResult;
  }

  console.info(`No aftercredits info found for ${query}`);
  return null;
}

app.get("/stream/movie/:id", async (c) => {
  const { id } = c.req.param();

  // strip the .json extension if present
  const cleanId = id.replace(/\.json$/, "");

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
    console.info(`No aftercredits info found for ${query}`);

    return c.json({ streams: [] });
  }

  console.info(
    `Found aftercredits info for ${query}: ${JSON.stringify(scrapeResult)}`
  );

  let stingers = "";
  for (const stinger of scrapeResult.stingers) {
    stingers += `- ${stinger.type.replace(/-/g, " ")}\n`;
  }

  const streams: Stream = {
    name: "After Credits",
    title: `💚 Stick around for:\n${stingers.trim()}`,
    externalUrl: scrapeResult.link,
  };

  if (process.env.NODE_ENV === "production") {
    c.header("Cache-Control", "public, max-age=86400"); // cache for 1 day
  }
  return c.json({ streams: [streams] });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
