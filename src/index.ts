import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { manifest } from "@/manifest.js";
import { SOURCES } from "@/scrapers/allScrapers.js";
import StreamRoute from "@/routes/stream.js";
import { appEnv } from "./appEnv.js";

const app = new Hono({ strict: false });
app.use("*", cors());

app.use(
  "*",
  serveStatic({
    root: "./static",
  }),
);

// output some debug info
console.log(
  `Source order: ${SOURCES.map((source) => source.options.name).join(", ")}`,
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

app.route("/stream", StreamRoute);

serve(
  {
    fetch: app.fetch,
    port: appEnv.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.info("Install URL: http://localhost:3000/manifest.json");
  },
);
