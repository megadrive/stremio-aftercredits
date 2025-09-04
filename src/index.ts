import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { manifest } from "./manifest.js";
import type { Stream } from "stremio-addon-sdk";
import { to } from "await-to-js";
import ky from "ky";
import { z } from "zod";
import { AfterCreditsScraper } from "./scraper.js";
const afterCredits = new AfterCreditsScraper();

const app = new Hono();
app.use("*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono!");
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
  const [scrapeErr, scrapeResult] = await to(afterCredits.scrape(query));

  if (scrapeErr) {
    console.error(`Error scraping AfterCredits for ${query}: ${scrapeErr}`);
    return c.json({ streams: [] });
  }

  if (!scrapeResult) {
    console.info(`No aftercredits info found for ${query}`);
    return c.json({ streams: [] });
  }

  console.info(
    `Found aftercredits info for ${query}: ${JSON.stringify(scrapeResult)}`
  );

  const streams: Stream[] = scrapeResult.stingers.map((stinger, index) => {
    const note = stinger.note ? ` (${stinger.note})` : "";
    return {
      title: stinger.type.replace(/-/g, " "),
      externalUrl: scrapeResult.link,
    };
  });

  return c.json({ streams });
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
